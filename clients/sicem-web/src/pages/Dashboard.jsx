import { useState, useEffect, useRef } from 'react'
import { roleLabel } from '../config/roles'
import Navbar from '../components/layout/Navbar'
import EmergencyCard from '../components/emergencies/EmergencyCard'
import MapArea from '../components/map/MapArea'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import L from 'leaflet'
import Icon from '../components/ui/Icon'
import MapControls from '../components/map/MapControls'
import QuickAssignCard from '../components/emergencies/QuickAssignCard'
import { playAlert, isMuted, setMuted } from '../utils/alertSound'
import LiveClock from '../components/ui/LiveClock'
import RegionNotice from '../components/ui/RegionNotice'
import { useRegion } from '../context/useRegion'
import { STALLED_THRESHOLD_MINUTES, FAILURE_WINDOW_MS, ACTIVITY_LOG_MAX } from '../config/operations'
import './Dashboard.css'
import { getNavLinks } from '../utils/Navlinks';
import {API_BASE_URL} from '../config/api'
import AnimatedNumber from '../components/ui/AnimatedNumber'


// A partir de esta antigüedad, una emergencia se marca visualmente como
// "estancada" — no es un valor mágico del backend, solo un umbral operativo
// para llamar la atención del despachador/admin sobre casos que llevan
// demasiado tiempo sin resolver.

// Formatea un promedio de segundos a "X min Y s" (o solo "Y s" si es menos de un minuto)
const formatResponseTime = (totalSeconds) => {
    const s = Math.round(totalSeconds)
    const m = Math.floor(s / 60)
    const rem = s % 60
    if (m === 0) return `${rem} s`
    return rem > 0 ? `${m} min ${rem} s` : `${m} min`
}

const formatElapsed = (createdAt) => {
    if (!createdAt) return ''
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
    const days = Math.floor(hours / 24)
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
const UNIT_STATUS_NAME = { 1: 'Disponible', 2: 'En camino', 3: 'En escena', 4: 'Trasladando', 5: 'Fuera de servicio', 6: 'En mantenimiento', 7: 'Reservada' }
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const timeLabel = (d, timeZone) => d.toLocaleTimeString('es-MX', { hour12: false, timeZone })
// Una falla reportada deja de ser noticia a las 12 h, o cuando la unidad ya se desasignó
const unitStatusColor = { 1: 'var(--u-free)', 2: 'var(--u-route)', 3: 'var(--u-scene)', 4: 'var(--u-transfer)' }

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
    const { region } = useRegion()
    const navLinks = getNavLinks(user?.roleId)
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
    const [selectedId, setSelectedId] = useState(null)
    const [hoverId, setHoverId] = useState(null)
    const [leafletMap, setLeafletMap] = useState(null)
    const [layers, setLayers] = useState({ emergencies: true, units: true, hospitals: true, routes: true })
    const [unitFilter, setUnitFilter] = useState('all')
    // En ventanas angostas los paneles flotantes taparían el mapa: arrancan plegados
    const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 1100)
    const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1100)
    const [rightTab, setRightTab] = useState('accept')
    const [routeLines, setRouteLines] = useState([])
    const [eventLog, setEventLog] = useState([])
    const [failureReports, setFailureReports] = useState([])
    const [followNew, setFollowNew] = useState(false)
    const [muted, setMutedState] = useState(() => isMuted())
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [roomModeOn, setRoomModeOn] = useState(false)

    // Refs con el valor más reciente para los listeners de socket, que se crean una sola vez
    const emergenciesRef = useRef([])
    const ambulancesRef = useRef([])
    const followNewRef = useRef(false)
    const focusRef = useRef(null)
    const cycleRef = useRef({})
    useEffect(() => { emergenciesRef.current = emergencies }, [emergencies])
    useEffect(() => { ambulancesRef.current = ambulances }, [ambulances])
    useEffect(() => { followNewRef.current = followNew }, [followNew])

    // Bitácora en vivo: los últimos eventos del sistema, el más reciente primero
    const logEvent = (text, tone = 'info') => {
        setEventLog((current) => [{ id: Date.now() + Math.random(), at: new Date(), text, tone }, ...current].slice(0, ACTIVITY_LOG_MAX))
    }

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
        const target = emergenciesRef.current.find((em) => String(em.emergency_id) === String(emergencyId))
        if (target && resolvedName) logEvent(`${target.type_name || 'Emergencia'}: ${resolvedName}`)
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

                // Una sola consulta con la última ubicación de todas las unidades (antes eran 33 llamadas, una por unidad).
                fetch(`${API_BASE_URL}/unidades/ubicaciones`, {
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                })
                    .then((res) => res.ok ? res.json() : { data: [] })
                    .then(({ data: locations }) => {
                        const byAmbulance = new Map((locations || []).map((l) => { const k = toLowerCaseKeys(l); return [String(k.ambulance_id), k] }))
                        setAmbulances(ambulancesLower.map((amb) => {
                            const loc = byAmbulance.get(String(amb.ambulance_id))
                            return { ...amb, latitude: loc ? loc.latitude : null, longitude: loc ? loc.longitude : null }
                        }))
                    })
                    .catch(() => setAmbulances(ambulancesLower.map((amb) => ({ ...amb, latitude: null, longitude: null }))))
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
            .then(({ data }) => setAvgResponseToday(data?.[0]?.avg_seconds ?? null))
            .catch(error => console.error('Error consultando tiempo de respuesta de hoy. ', error))
    }, [])

    // Socket.io — emergencias en tiempo real
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        emergencySocket.on('eventEmergencyRegistered', data => {
            const em = toLowerCaseKeys(data)
            setEmergencies(currentEmergencies => [em, ...currentEmergencies])
            pushToast(`Nueva emergencia: ${em.type_name || 'Sin tipo'}`, em.description || 'Sin descripción')
            logEvent(`Nueva emergencia: ${em.type_name || 'Sin tipo'}`, 'alert')
            playAlert()
            if (followNewRef.current) focusRef.current?.(em)
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            const closed = emergenciesRef.current.find(em => em.emergency_id === closedId)
            if (closed) logEvent(`Emergencia cerrada: ${closed.type_name || 'Sin tipo'}`)
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
            const target = emergenciesRef.current.find(em => em.emergency_id === emergencyId)
            logEvent(`${target?.type_name || 'Emergencia'}: hospital ${accepted ? 'aceptó' : 'rechazó'} a un paciente`, accepted ? 'info' : 'alert')
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
            const unit = ambulancesRef.current.find(amb => parseInt(amb.ambulance_id) === parseInt(ambulanceId))
            if (unit) logEvent(`${unit.unit_number}: ${UNIT_STATUS_NAME[parseInt(ambulanceStatusId)] || 'cambió de estado'}`)
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
        unitsSocket.on('eventAmbulanceFailureReported', ({ unitNumber, paramedicName, note, emergencyId, ambulanceId }) => {
            logEvent(`Falla reportada en ${unitNumber || 'una unidad'}`, 'alert')
            playAlert()
            setFailureReports((current) => [{ id: `live-${Date.now()}`, ambulance_id: ambulanceId, emergency_id: emergencyId, unit_number: unitNumber, reported_at: new Date().toISOString() }, ...current])
            pushToast(`⚠ Falla reportada — ${unitNumber || 'unidad'}`, paramedicName ? `${paramedicName}: ${note}` : note)
        })

        // Auto-avance del estado de la emergencia cuando el paramédico mueve
        // su propia ambulancia (En escena/Trasladando) — ver
        // advanceEmergencyStatusForAmbulance en services/unidades.
        unitsSocket.on('eventEmergencyStatusUpdated', applyEmergencyStatusUpdate)

        return () => unitsSocket.disconnect()
    }, [token])

    // Fallas de unidad aún vigentes (últimas 12 h y con la unidad todavía asignada),
    // para la cinta de atención. La campana de la barra conserva el historial completo.
    useEffect(() => {
        fetch(`${API_BASE_URL}/unidades/reportes-falla`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json())
            .then((data) => {
                const active = (data.reports || []).filter((r) =>
                    r.emergency_id
                    && Date.now() - new Date(r.reported_at).getTime() < FAILURE_WINDOW_MS
                    && !(r.unassigned || r.still_assigned === false || r.still_assigned === 0)
                ).map((r) => ({ id: r.ambulance_failure_report_id, ambulance_id: r.ambulance_id, emergency_id: r.emergency_id, unit_number: r.unit_number, reported_at: r.reported_at }))
                setFailureReports(active)
            })
            .catch(() => {})
    }, [])

    // Mantiene sincronizado el botón de pantalla completa con el estado real del navegador
    useEffect(() => {
        const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

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
    // "Registrada" = sin ninguna unidad activa (se regresa sola a este estado
    // al desasignar la última unidad — ver unassignAmbulance en emergencias)
    // — una emergencia así tampoco va a ningún lado sin que el despachador
    // haga algo, igual que un paciente sin aceptar.
    const needsAcceptanceEmergencies = sortByPriority(
        emergencies.filter((em) =>
            (em.pending_patients_count || 0) > 0 || (em.rejected_patients_count || 0) > 0 || em.status_name === 'Registrada'
        )
    )

    // ── Control del mapa ─────────────────────────────────────────
    // El encuadre deja libre el espacio que tapan los paneles flotantes y la tarjeta inferior.
    const fitOptions = () => ({
        paddingTopLeft: [leftOpen ? 390 : 70, 60],
        paddingBottomRight: [rightOpen ? 440 : 100, 280],
        maxZoom: 15,
        duration: 0.8,
    })

    const focusEmergency = (em) => {
        setSelectedId(String(em.emergency_id))
        const lat = parseFloat(em.latitude)
        const lon = parseFloat(em.longitude)
        if (!leafletMap || !Number.isFinite(lat) || !Number.isFinite(lon)) return
        leafletMap.flyToBounds(L.latLngBounds([[lat, lon]]), fitOptions())
    }
    useEffect(() => { focusRef.current = focusEmergency })

    const fitAll = () => {
        const points = filteredEmergencies
            .filter((em) => Number.isFinite(parseFloat(em.latitude)) && Number.isFinite(parseFloat(em.longitude)))
            .map((em) => [parseFloat(em.latitude), parseFloat(em.longitude)])
        if (!leafletMap || points.length === 0) return
        leafletMap.flyToBounds(L.latLngBounds(points), fitOptions())
    }

    const goCritical = () => {
        const top = sortByPriority(emergencies).find((em) => Number.isFinite(parseFloat(em.latitude)) && Number.isFinite(parseFloat(em.longitude)))
        if (top) focusEmergency(top)
    }

    // Algunos navegadores (o paneles de navegador integrados) no permiten pantalla completa:
    // en ese caso se avisa, en lugar de fallar en silencio.
    const enterFullscreen = () => {
        const notAvailable = () => pushToast('Pantalla completa no disponible', 'Este navegador no la permite aquí. Prueba con la tecla F11.')
        if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) { notAvailable(); return }
        document.documentElement.requestFullscreen().catch(notAvailable)
    }

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else enterFullscreen()
    }

    // Modo sala: mapa sin paneles, y a pantalla completa si el navegador lo permite.
    // No depende de la pantalla completa: los paneles se ocultan de todos modos.
    const roomMode = roomModeOn && !leftOpen && !rightOpen
    const toggleRoomMode = () => {
        if (roomMode) {
            setRoomModeOn(false)
            setLeftOpen(true); setRightOpen(true)
            if (document.fullscreenElement) document.exitFullscreen?.()
        } else {
            setRoomModeOn(true)
            setLeftOpen(false); setRightOpen(false)
            if (!document.fullscreenElement) enterFullscreen()
        }
    }

    const toggleMuted = () => { const next = !muted; setMuted(next); setMutedState(next) }

    // Cinta de atención: cada botón lleva a la siguiente emergencia de su grupo
    const rejectedList = emergencies.filter((em) => (em.rejected_patients_count || 0) > 0)
    const noUnitList = emergencies.filter((em) => em.status_name === 'Registrada')
    const focusGroup = (key, list) => {
        if (list.length === 0) return
        const idx = (cycleRef.current[key] || 0) % list.length
        cycleRef.current[key] = idx + 1
        focusEmergency(list[idx])
    }
    const focusFailure = () => {
        const withEmergency = failureReports
            .map((f) => emergencies.find((em) => String(em.emergency_id) === String(f.emergency_id)))
            .filter(Boolean)
        if (withEmergency.length === 0) { pushToast('Esa emergencia ya no está activa', 'Revisa la campana de la barra para ver el reporte completo.'); return }
        focusGroup('fail', withEmergency)
    }

    // Una unidad se asignó desde el mapa: se refleja al instante (los sockets lo confirman después)
    const handleAssigned = (emergencyId, unit) => {
        const target = emergencies.find((em) => em.emergency_id === emergencyId)
        setEmergencies((current) => current.map((em) => em.emergency_id === emergencyId ? { ...em, status_name: 'Asignada' } : em))
        setAmbulances((current) => current.map((amb) => parseInt(amb.ambulance_id) === parseInt(unit.ambulance_id) ? { ...amb, ambulance_status_id: 2 } : amb))
        pushToast(`Unidad ${unit.unit_number} asignada`, `Va en camino: ${target?.type_name || 'emergencia'}`)
        logEvent(`${unit.unit_number} asignada a ${target?.type_name || 'una emergencia'}`)
    }

    // Lo que se pinta en el mapa respeta las capas y los filtros elegidos
    const mapAmbulances = layers.units
        ? ambulances.filter((amb) => unitFilter === 'all' || String(parseInt(amb.ambulance_status_id)) === unitFilter)
        : []
    const mapEmergencies = layers.emergencies ? filteredEmergencies : []
    const mapHospitals = layers.hospitals ? hospitals : []
    const mapRoutes = layers.routes ? routeLines : []

    const selectedEmergency = emergencies.find((em) => String(em.emergency_id) === String(selectedId)) || null

    // Distribución por nivel de triage para la franja de situación: se arma desde
    // el catálogo real (colores y orden), más un tramo para las que aún no tienen triage.
    const triageDistribution = [...triageCatalog]
        .sort((a, b) => Number(a.max_wait_minutes) - Number(b.max_wait_minutes))
        .map((t) => ({ key: t.triage_level_id, label: ROMAN[t.level] || t.level, color: t.hex_color, count: emergencies.filter((em) => em.triage_level === t.level).length }))
    const withoutTriage = emergencies.filter((em) => em.triage_level === null || em.triage_level === undefined).length

    const renderCard = (em) => (
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
            isSelected={String(em.emergency_id) === String(hoverId || selectedId)}
            onCardClick={() => navigate(`/emergencias/${em.emergency_id}`)}
            onLocate={() => focusEmergency(em)}
            onHover={(on) => setHoverId(on ? String(em.emergency_id) : null)}
        />
    )

    return (
        <div className="dashboard-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <main id="contenido" className="dashboard-main">
            <h1 className="sr-only">Panel de situación</h1>

            <div className="toast-stack" role="status" aria-live="polite">
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

            <section className="situation" aria-label="Situación actual">
                <div className="stat">
                    <span className="stat-value"><AnimatedNumber value={emergencies.length} /></span>
                    <span className="stat-label">Emergencias activas</span>
                </div>
                <div className={`stat ${needsAcceptanceEmergencies.length > 0 ? 'stat-alert' : ''}`}>
                    <span className="stat-value"><AnimatedNumber value={needsAcceptanceEmergencies.length} /></span>
                    <span className="stat-label">Esperando aceptación</span>
                </div>
                <div className="stat">
                    <span className="stat-value"><AnimatedNumber value={availableUnits} /><small>de {ambulances.length}</small></span>
                    <span className="stat-label">Unidades disponibles</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{avgResponseToday !== null ? formatResponseTime(avgResponseToday) : '—'}</span>
                    <span className="stat-label">Respuesta promedio hoy</span>
                </div>
                <div className="triage-dist">
                    <span className="stat-label">Activas por nivel de triage</span>
                    <div className="triage-bar" role="img" aria-label={triageDistribution.map((d) => `nivel ${d.label}: ${d.count}`).join(', ')}>
                        {triageDistribution.filter((d) => d.count > 0).map((d) => (
                            <i key={d.key} style={{ flex: d.count, background: d.color }} />
                        ))}
                        {withoutTriage > 0 && <i style={{ flex: withoutTriage, background: 'var(--line-strong)' }} />}
                    </div>
                    <div className="triage-legend">
                        {triageDistribution.map((d) => (
                            <span key={d.key}><em style={{ background: d.color }} />{d.label} · {d.count}</span>
                        ))}
                        {withoutTriage > 0 && <span><em style={{ background: 'var(--line-strong)' }} />Sin triage · {withoutTriage}</span>}
                    </div>
                </div>
                <div className="clock">
                    <span className="clock-value"><LiveClock /></span>
                    <span className="stat-label"><span className="live">En vivo</span> · hora de {region.city || region.state || 'tu región'}</span>
                </div>
            </section>

            <div className="ribbon" role="region" aria-label="Alertas y controles">
                <div className="ribbon-alerts">
                    {rejectedList.length > 0 && (
                        <button type="button" className="rb rb-danger" onClick={() => focusGroup('rej', rejectedList)}>
                            <Icon name="alert" size={15} />{plural(rejectedList.length, 'emergencia con paciente rechazado', 'emergencias con paciente rechazado')}
                        </button>
                    )}
                    {noUnitList.length > 0 && (
                        <button type="button" className="rb rb-warn" onClick={() => focusGroup('nou', noUnitList)}>
                            <Icon name="clock" size={15} />{plural(noUnitList.length, 'emergencia sin unidad', 'emergencias sin unidad')}
                        </button>
                    )}
                    {failureReports.length > 0 && (
                        <button type="button" className="rb rb-danger" onClick={focusFailure}>
                            <Icon name="wrench" size={15} />{plural(failureReports.length, 'falla de unidad reportada', 'fallas de unidad reportadas')}
                        </button>
                    )}
                    {rejectedList.length === 0 && noUnitList.length === 0 && failureReports.length === 0 && (
                        <span className="rb-ok"><Icon name="check" size={15} />Sin alertas pendientes</span>
                    )}
                </div>
                <div className="ribbon-tools">
                    <label className="switch" title="El mapa se centra solo en cada emergencia nueva">
                        <input type="checkbox" checked={followNew} onChange={(e) => setFollowNew(e.target.checked)} />
                        <span className="switch-track" aria-hidden="true" />
                        Seguir emergencias nuevas
                    </label>
                    <button type="button" className="rb-tool" onClick={toggleMuted} aria-pressed={!muted} aria-label={muted ? 'Activar el sonido de alertas' : 'Silenciar el sonido de alertas'} title={muted ? 'Sonido de alertas: apagado' : 'Sonido de alertas: encendido'}>
                        <Icon name={muted ? 'volume-off' : 'volume'} size={17} />
                    </button>
                    <button type="button" className={`rb-tool rb-tool-text ${roomMode ? 'rb-tool-on' : ''}`} onClick={toggleRoomMode} aria-pressed={roomMode}>
                        <Icon name="expand" size={16} />Modo sala
                    </button>
                </div>
            </div>

            <RegionNotice />

            <div className={`stage ${leftOpen ? '' : 'stage-left-collapsed'} ${rightOpen ? '' : 'stage-right-collapsed'}`}>
                <MapArea
                    ambulances={mapAmbulances}
                    hospitals={mapHospitals}
                    emergencies={mapEmergencies}
                    routes={mapRoutes}
                    selectedEmergencyId={hoverId || selectedId}
                    onEmergencyClick={(em) => setSelectedId(String(em.emergency_id))}
                    onMapReady={setLeafletMap}
                    hideZoomControl
                    legendCentered
                />

                <MapControls
                    map={leafletMap}
                    onFitAll={fitAll}
                    onGoCritical={goCritical}
                    layers={layers}
                    onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                    unitFilter={unitFilter}
                    onUnitFilter={setUnitFilter}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={toggleFullscreen}
                />

                {leftOpen ? (
                <aside className="panel panel-left" aria-label="Emergencias activas">
                    <div className="panel-head">
                        <div className="panel-head-row">
                            <h2>Emergencias activas <span className="count">{filteredEmergencies.length}</span></h2>
                            <button type="button" className="panel-fold" onClick={() => setLeftOpen(false)} aria-label="Ocultar la lista de emergencias" title="Ocultar panel"><Icon name="chevron-left" size={18} /></button>
                        </div>
                        <div className="filter-chips" role="group" aria-label="Filtrar por nivel de triage">
                            <button type="button" aria-pressed={triageFilter === 'all'} onClick={() => setTriageFilter('all')}>Todas</button>
                            {triageCatalog.map((t) => (
                                <button
                                    type="button"
                                    key={t.triage_level_id}
                                    aria-pressed={triageFilter === t.level}
                                    aria-label={`Nivel ${t.level}`}
                                    onClick={() => setTriageFilter(triageFilter === t.level ? 'all' : t.level)}
                                >
                                    <i style={{ background: t.hex_color }} />{ROMAN[t.level] || t.level}
                                </button>
                            ))}
                        </div>
                        <select className="panel-select" aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos los estados</option>
                            <option value="Registrada">Registradas</option>
                            <option value="Asignada">Asignadas</option>
                            <option value="En atención">En atención</option>
                            <option value="Trasladando">Trasladando</option>
                        </select>
                    </div>
                    <div className="panel-list">
                        {filteredEmergencies.map(renderCard)}
                        {filteredEmergencies.length === 0 && (
                            <p className="empty-state">
                                {statusFilter === 'all' && triageFilter === 'all'
                                    ? 'Sin emergencias activas por ahora. Cuando se registre una, aparecerá aquí al instante.'
                                    : 'Ninguna emergencia coincide con estos filtros. Quita un filtro para ver más.'}
                            </p>
                        )}
                    </div>

                    <div className="units-section">
                        <button type="button" className="units-toggle" aria-expanded={unitsExpanded} onClick={() => setUnitsExpanded((v) => !v)}>
                            <span>Unidades <span className="count">{ambulances.length}</span></span>
                            <Icon name="chevron" size={16} className={`units-caret ${unitsExpanded ? 'open' : ''}`} />
                        </button>
                        {unitsExpanded && (
                            <div className="unit-list">
                                {ambulances.map((amb) => (
                                    <div key={amb.ambulance_id} className="unit-list-item">
                                        <span className="unit-dot" style={{ background: unitStatusColor[parseInt(amb.ambulance_status_id)] || 'var(--u-off)' }} />
                                        {amb.unit_number}
                                    </div>
                                ))}
                                {ambulances.length === 0 && <p className="empty-state">Sin unidades registradas.</p>}
                            </div>
                        )}
                    </div>
                </aside>
                ) : (
                    <button type="button" className="panel-tab panel-tab-left" onClick={() => setLeftOpen(true)} aria-label={`Mostrar la lista de emergencias (${filteredEmergencies.length})`}>
                        <Icon name="list" size={18} /><span className="count">{filteredEmergencies.length}</span>
                    </button>
                )}

                {rightOpen ? (
                <aside className="panel panel-right" aria-label="Necesitan aceptación y bitácora">
                    <div className="panel-head panel-head-tabs">
                        <div className="tabs" role="tablist">
                            <button type="button" role="tab" aria-selected={rightTab === 'accept'} onClick={() => setRightTab('accept')}>Por aceptar <span className="count">{needsAcceptanceEmergencies.length}</span></button>
                            <button type="button" role="tab" aria-selected={rightTab === 'log'} onClick={() => setRightTab('log')}>Bitácora <span className="count">{eventLog.length}</span></button>
                        </div>
                        <button type="button" className="panel-fold" onClick={() => setRightOpen(false)} aria-label="Ocultar el panel derecho" title="Ocultar panel"><Icon name="chevron-right" size={18} /></button>
                    </div>
                    {rightTab === 'accept' ? (
                        <>
                            <p className="panel-hint panel-hint-pad">Pacientes sin hospital que los reciba. Primero los rechazados, después por gravedad.</p>
                            <div className="panel-list">
                                {needsAcceptanceEmergencies.map(renderCard)}
                                {needsAcceptanceEmergencies.length === 0 && (
                                    <p className="empty-state">Todo aceptado. No hay pendientes por ahora.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <ol className="log" aria-label="Eventos recientes">
                            {eventLog.map((ev) => (
                                <li key={ev.id} className={`log-item log-${ev.tone}`}>
                                    <time className="log-time">{timeLabel(ev.at, region.timeZone)}</time>
                                    <span className="log-text">{ev.text}</span>
                                </li>
                            ))}
                            {eventLog.length === 0 && (
                                <li className="empty-state">Aquí aparecerán los eventos en cuanto ocurran: emergencias nuevas, cambios de unidad y respuestas de hospitales.</li>
                            )}
                        </ol>
                    )}
                </aside>
                ) : (
                    <button type="button" className="panel-tab panel-tab-right" onClick={() => setRightOpen(true)} aria-label={`Mostrar el panel derecho (${needsAcceptanceEmergencies.length} por aceptar)`}>
                        <Icon name="alert" size={18} /><span className="count">{needsAcceptanceEmergencies.length}</span>
                    </button>
                )}

                {selectedEmergency && (
                    <QuickAssignCard
                        key={selectedEmergency.emergency_id}
                        emergency={selectedEmergency}
                        ambulances={ambulances}
                        user={user}
                        token={token}
                        formatElapsed={formatElapsed}
                        onClose={() => setSelectedId(null)}
                        onOpen={() => navigate(`/emergencias/${selectedEmergency.emergency_id}`)}
                        onAssigned={handleAssigned}
                        onRouteChange={(lines) => setRouteLines(lines || [])}
                    />
                )}
            </div>
            </main>
        </div>
    )
}

export default Dashboard
