import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/layout/Navbar'
import EmergencyCard from '../components/emergencies/EmergencyCard'
import MapArea from '../components/map/MapArea'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import './Dashboard.css'
import { getNavLinks } from '../utils/Navlinks';
import {API_BASE_URL} from '../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

// A partir de esta antigüedad, una emergencia se marca visualmente como
// "estancada" — no es un valor mágico del backend, solo un umbral operativo
// para llamar la atención del despachador/admin sobre casos que llevan
// demasiado tiempo sin resolver.
const STALLED_THRESHOLD_MINUTES = 120

const formatElapsed = (createdAt) => {
    if (!createdAt) return ''
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60
    return `${hours}h ${remaining}min`
}

const isStalled = (createdAt) => {
    if (!createdAt) return false
    const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000
    return minutes >= STALLED_THRESHOLD_MINUTES
}

// Orden de prioridad real, no solo antigüedad: una emergencia con pacientes
// rechazados necesita que el despachador reasigne YA (nadie más se está
// haciendo cargo de esos pacientes), así que va primero sin importar triage.
// Después manda la severidad del triage (menor max_wait_minutes = más
// urgente); sin triage asignado se manda al final del todo, igual que en
// sicem-desktop. Dentro de cada nivel, la más antigua va primero.
const priorityScore = (em) => {
    if ((em.rejected_patients_count || 0) > 0) return -1
    const wait = em.max_wait_minutes
    return (wait === null || wait === undefined) ? Infinity : Number(wait)
}

const sortByPriority = (list) => [...list].sort((a, b) => {
    const scoreDiff = priorityScore(a) - priorityScore(b)
    if (scoreDiff !== 0) return scoreDiff
    return new Date(a.created_at) - new Date(b.created_at)
})

const Dashboard = () => {
    const { user, token } = useAuth()
    const navLinks = getNavLinks(user?.roleId)
    console.log('roleId actual:', user?.roleId)
console.log('navLinks calculados:', navLinks)
    const navigate = useNavigate()

    const [emergencies, setEmergencies] = useState([])
    const [ambulances, setAmbulances] = useState([])
    const [hospitals, setHospitals] = useState([])
    const [toasts, setToasts] = useState([])
    const [avgResponseToday, setAvgResponseToday] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [triageFilter, setTriageFilter] = useState('all')
    const [triageCatalog, setTriageCatalog] = useState([])
    const [emergencyStatusCatalog, setEmergencyStatusCatalog] = useState([])
    const [unitsExpanded, setUnitsExpanded] = useState(false)

    const pushToast = (typeName, description) => {
        const id = Date.now() + Math.random()
        setToasts((current) => [...current, { id, typeName, description }])
        setTimeout(() => {
            setToasts((current) => current.filter((t) => t.id !== id))
        }, 5000)
    }

    // Los listeners de socket de abajo se crean UNA vez (efectos con deps
    // fijas) — si applyEmergencyStatusUpdate leyera emergencyStatusCatalog
    // directo, quedaría pegado al valor que tenía en ese primer render
    // (probablemente todavía vacío, el fetch del catálogo es async). Este
    // ref siempre tiene el valor más reciente sin tener que reconectar los
    // sockets por eso — mismo patrón que pendingAlertRef en
    // sicem-mobile/context/SocketContext.jsx.
    const emergencyStatusCatalogRef = useRef([])
    useEffect(() => { emergencyStatusCatalogRef.current = emergencyStatusCatalog }, [emergencyStatusCatalog])

    // eventEmergencyStatusUpdated llega desde DOS sockets distintos según
    // quién lo haya disparado: el servicio de emergencias (cambio manual del
    // despachador, o el nuevo auto-avance al asignar una unidad) y el
    // servicio de unidades (auto-avance cuando el paramédico mueve su propia
    // ambulancia — En escena/Trasladando). Este último siempre manda
    // statusName ya resuelto; el manual todavía no, así que aquí se cae al
    // catálogo si hace falta.
    const applyEmergencyStatusUpdate = ({ emergencyId, emergencyStatusId, statusName }) => {
        const resolvedName = statusName
            || emergencyStatusCatalogRef.current.find((s) => String(s.emergency_status_id) === String(emergencyStatusId))?.name
        setEmergencies((current) => current.map((em) => (
            String(em.emergency_id) === String(emergencyId)
                ? { ...em, status_name: resolvedName ?? em.status_name }
                : em
        )))
    }

    // Emergencias activas
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/emergencias-activas`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(({ data }) => setEmergencies(data.map(em => toLowerCaseKeys(em))))
            .catch(error => console.error('Ha ocurrido un error buscando las emergencias activas', error))
    }, [])

    // Hospitales, para pintarlos en el mismo mapa que las ambulancias — el
    // CRUM decide a qué hospital mandar cada traslado, así que verlos juntos
    // ayuda a esa decisión de un vistazo. Camas disponibles no cambia tan
    // seguido como para necesitar socket — un fetch al montar alcanza.
    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-destino`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setHospitals((data || []).map(h => toLowerCaseKeys(h))))
            .catch(error => console.error('Error recuperando hospitales. ', error))
    }, [])

    // Ambulancias con su última ubicación conocida, para pintarlas en el mapa
    useEffect(() => {
        fetch(`${API_BASE_URL}/unidades/ambulancias`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(({ data }) => {
                const ambulancesLower = data.map(amb => toLowerCaseKeys(amb))

                // Por cada ambulancia, pedimos su última ubicación conocida
                const locationPromises = ambulancesLower.map((amb) =>
                    fetch(`${API_BASE_URL}/unidades/ubicacion/${amb.ambulance_id}`, {
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        }
                    })
                        .then((res) => res.ok ? res.json() : { data: null })
                        .then(({ data: locationData }) => ({
                            ...amb,
                            latitude: locationData ? toLowerCaseKeys(locationData).latitude : null,
                            longitude: locationData ? toLowerCaseKeys(locationData).longitude : null,
                        }))
                        .catch(() => ({ ...amb, latitude: null, longitude: null }))
                )

                Promise.all(locationPromises).then((ambulancesWithLocation) => {
                    setAmbulances(ambulancesWithLocation)
                })
            })
            .catch(error => console.error('Error recuperando ambulancias. ', error))
    }, [])

    // Catálogo real de niveles de triage, para el filtro — mismo fix que ya se
    // hizo en sicem-desktop: no se deriva de las emergencias ya cargadas.
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setTriageCatalog((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando catálogo de triage. ', error))
    }, [])

    // Catálogo de estados de emergencia — solo para poder ponerle nombre a
    // eventEmergencyStatusUpdated cuando llega sin statusName (el endpoint
    // manual de cambio de estado todavía no lo manda, a diferencia de los
    // nuevos que sí sincronizan el estado desde la ambulancia).
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/estados-emergencia`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setEmergencyStatusCatalog((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error recuperando catálogo de estados de emergencia. ', error))
    }, [])

    // Tiempo promedio de respuesta de hoy (KPI)
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/tiempo-respuesta-hoy`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(({ data }) => setAvgResponseToday(data?.[0]?.avg_minutes ?? null))
            .catch(error => console.error('Error consultando tiempo de respuesta de hoy. ', error))
    }, [])

    // Socket.io — emergencias en tiempo real
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        emergencySocket.on('eventEmergencyRegistered', data => {
            const em = toLowerCaseKeys(data)
            setEmergencies(currentEmergencies => [em, ...currentEmergencies])
            pushToast(`Nueva emergencia: ${em.type_name || 'Sin tipo'}`, em.description || 'Sin descripción')
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            setEmergencies(current => current.filter(em => em.emergency_id !== closedId))
        })

        // Cambio manual del despachador (updateEmergencyStatus), o auto-avance
        // al asignar una unidad (registerAssignment / unidad interinstitucional
        // aceptada) — ambos emiten desde este mismo socket de emergencias.
        emergencySocket.on('eventEmergencyStatusUpdated', applyEmergencyStatusUpdate)

        // Un hospital confirmó o rechazó la recepción de un paciente — ajusta los
        // contadores de esa emergencia en el acto en vez de refetchear la lista
        // completa (mismo patrón optimista que el resto de este archivo).
        emergencySocket.on('eventPatientReceptionUpdated', ({ emergencyId, accepted }) => {
            setEmergencies(current => current.map(em => {
                if (em.emergency_id !== emergencyId) return em
                return {
                    ...em,
                    pending_patients_count: Math.max(0, (em.pending_patients_count || 0) - 1),
                    rejected_patients_count: accepted
                        ? (em.rejected_patients_count || 0)
                        : (em.rejected_patients_count || 0) + 1,
                }
            }))
        })

        return () => emergencySocket.disconnect()
    }, [])

    // Socket.io — servicio de unidades: estado de ambulancias en vivo (se
    // emite al iniciar/terminar turno o cambiar el estado manualmente desde
    // sicem-mobile), para que "Disponible" en el mapa refleje si de verdad
    // hay alguien manejando la unidad ahora mismo, sin tener que refrescar.
    useEffect(() => {
        const unitsSocket = connectUnitsSocket(token)

        unitsSocket.on('eventAmbulanceStatusChanged', ({ ambulanceId, ambulanceStatusId }) => {
            setAmbulances(current => current.map(amb =>
                parseInt(amb.ambulance_id) === parseInt(ambulanceId)
                    ? { ...amb, ambulance_status_id: ambulanceStatusId }
                    : amb
            ))
        })

        // El backend YA manda esto (sicem-mobile reporta ubicación cada 15s
        // mientras hay turno activo, ver LocationReporter en
        // clients/sicem-mobile/app/(app)/_layout.js) — solo faltaba
        // escucharlo aquí. Antes las ambulancias se pedían UNA vez al montar
        // (fetch a /unidades/ubicacion/:id) y ya nunca se volvían a mover en
        // el mapa sin recargar la página entera.
        unitsSocket.on('eventoUbicacionAmbulancia', ({ ambulanceId, latitude, longitude }) => {
            setAmbulances(current => current.map(amb =>
                parseInt(amb.ambulance_id) === parseInt(ambulanceId)
                    ? { ...amb, latitude, longitude }
                    : amb
            ))
        })

        // El paramédico reportó una falla en su unidad — solo avisa, no
        // cambia nada solo (ver reportAmbulanceFailure en
        // services/unidades/controllers/unit.js). El despachador decide qué
        // hacer (reasignar, sacarla de servicio, etc.).
        unitsSocket.on('eventAmbulanceFailureReported', ({ unitNumber, paramedicName, note }) => {
            pushToast(`⚠ Falla reportada — ${unitNumber || 'unidad'}`, paramedicName ? `${paramedicName}: ${note}` : note)
        })

        // Auto-avance del estado de la emergencia cuando el paramédico mueve
        // su propia ambulancia (En escena/Trasladando) — ver
        // advanceEmergencyStatusForAmbulance en services/unidades.
        unitsSocket.on('eventEmergencyStatusUpdated', applyEmergencyStatusUpdate)

        return () => unitsSocket.disconnect()
    }, [token])

    // Fuerza un re-render cada minuto para que "elapsedLabel" y la marca de
    // "estancada" avancen solas sin que el despachador tenga que refrescar.
    const [, forceTick] = useState(0)
    useEffect(() => {
        const interval = setInterval(() => forceTick((t) => t + 1), 60000)
        return () => clearInterval(interval)
    }, [])

    const availableUnits = ambulances.filter((amb) => parseInt(amb.ambulance_status_id) === 1).length

    const filteredEmergencies = sortByPriority(
        emergencies
            .filter((em) => statusFilter === 'all' || em.status_name === statusFilter)
            .filter((em) => triageFilter === 'all' || em.triage_level === triageFilter)
    )

    // Panel fijo, no un filtro que el despachador prenda/apague: siempre son
    // las emergencias activas con al menos un paciente todavía sin aceptar
    // por su hospital destino — es la lista de "qué necesita que yo mueva algo
    // ahora mismo" (reasignar, insistir, etc.), separada de la lista general.
    // Un rechazo también cuenta como "no aceptado": si solo se mirara
    // pending_patients_count, un paciente rechazado (que además es más urgente
    // que uno simplemente pendiente) hacía desaparecer la emergencia justo
    // cuando más necesitaba que el despachador la viera.
    const needsAcceptanceEmergencies = sortByPriority(
        emergencies.filter((em) => (em.pending_patients_count || 0) > 0 || (em.rejected_patients_count || 0) > 0)
    )

    return (
        <div className="dashboard-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="toast-stack">
                {toasts.map((t) => (
                    <div key={t.id} className="toast-card">
                        {/* pushToast ya recibe el título completo armado por quien lo llama
                        (antes decía "Nueva emergencia: " siempre, aunque el toast fuera de
                        otra cosa — como el de falla reportada que se agregó después). */}
                        <span className="toast-title">{t.typeName || 'Aviso'}</span>
                        <span className="toast-desc">{t.description || ''}</span>
                    </div>
                ))}
            </div>

            <div className="kpi-row">
                <div className="kpi-card">
                    <span className="kpi-value">{emergencies.length}</span>
                    <span className="kpi-label">Emergencias activas</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-value">{avgResponseToday !== null ? `${Math.round(avgResponseToday)} min` : '—'}</span>
                    <span className="kpi-label">Tiempo prom. de respuesta (hoy)</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-value">{availableUnits}</span>
                    <span className="kpi-label">Unidades disponibles</span>
                </div>
            </div>

            <div className="dashboard-body">
                <aside className="dashboard-sidebar dashboard-sidebar-left">
                    <div className="emergency-section">
                        <h4 className="sidebar-title">Emergencias Activas ({filteredEmergencies.length})</h4>
                        <div className="dashboard-filter-row">
                            <select className="dashboard-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">Todas</option>
                                <option value="Registrada">Registradas</option>
                                <option value="Asignada">Asignadas</option>
                                <option value="En atención">En atención</option>
                                <option value="Trasladando">Trasladando</option>
                            </select>
                            <select className="dashboard-status-filter" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                                <option value="all">Todo triage</option>
                                {triageCatalog.map((t) => (
                                    <option key={t.triage_level_id} value={t.level}>Nivel {t.level}</option>
                                ))}
                            </select>
                        </div>
                        <div className="emergency-list">
                            {filteredEmergencies.map((em) => (
                                <EmergencyCard
                                    key={em.emergency_id}
                                    type={em.type_name}
                                    location={em.description}
                                    elapsedLabel={formatElapsed(em.created_at)}
                                    unitCode=""
                                    statusLabel={em.status_name}
                                    severity="stable"
                                    color={em.triage_hex_color}
                                    triageLevel={em.triage_level}
                                    pendingCount={em.pending_patients_count}
                                    rejectedCount={em.rejected_patients_count}
                                    isStalled={isStalled(em.created_at)}
                                    onCardClick={() => navigate(`/emergencias/${em.emergency_id}`)}
                                />
                            ))}
                            {filteredEmergencies.length === 0 && (
                                <p className="empty-state">
                                    {statusFilter === 'all' && triageFilter === 'all' ? 'Sin emergencias activas por ahora.' : 'Sin emergencias con estos filtros.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="units-section">
                        <button type="button" className="units-toggle" onClick={() => setUnitsExpanded((v) => !v)}>
                            <span>Unidades ({ambulances.length})</span>
                            <span className={`units-caret ${unitsExpanded ? 'open' : ''}`}>▾</span>
                        </button>
                        {unitsExpanded && (
                            <div className="unit-list">
                                {ambulances.map((amb) => (
                                    <div key={amb.ambulance_id} className="unit-list-item">
                                        <span className="unit-dot" />
                                        {amb.unit_number}
                                    </div>
                                ))}
                                {ambulances.length === 0 && <p className="empty-state">Sin unidades registradas.</p>}
                            </div>
                        )}
                    </div>
                </aside>

                <MapArea ambulances={ambulances} hospitals={hospitals} />

                <aside className="dashboard-sidebar dashboard-sidebar-right">
                    <h4 className="sidebar-title">Necesitan aceptación ({needsAcceptanceEmergencies.length})</h4>
                    <p className="sidebar-hint">Emergencias activas con pacientes sin aceptar todavía en su hospital destino.</p>
                    <div className="emergency-list">
                        {needsAcceptanceEmergencies.map((em) => (
                            <EmergencyCard
                                key={em.emergency_id}
                                type={em.type_name}
                                location={em.description}
                                elapsedLabel={formatElapsed(em.created_at)}
                                unitCode=""
                                statusLabel={em.status_name}
                                severity="stable"
                                color={em.triage_hex_color}
                                triageLevel={em.triage_level}
                                pendingCount={em.pending_patients_count}
                                rejectedCount={em.rejected_patients_count}
                                isStalled={isStalled(em.created_at)}
                                onCardClick={() => navigate(`/emergencias/${em.emergency_id}`)}
                            />
                        ))}
                        {needsAcceptanceEmergencies.length === 0 && (
                            <p className="empty-state">Todo aceptado — sin pendientes.</p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default Dashboard