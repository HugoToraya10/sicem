import { useState, useEffect } from 'react'
import Navbar from '../components/layout/Navbar'
import EmergencyCard from '../components/emergencies/EmergencyCard'
import MapArea from '../components/map/MapArea'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import './Dashboard.css'
import { getNavLinks } from '../utils/Navlinks';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const Dashboard = () => {
    const { user, token } = useAuth()
    const navLinks = getNavLinks(user?.roleId)
    console.log('roleId actual:', user?.roleId)
console.log('navLinks calculados:', navLinks)
    const navigate = useNavigate()

    const [emergencies, setEmergencies] = useState([])
    const [ambulances, setAmbulances] = useState([])
    const [toasts, setToasts] = useState([])
    const [avgResponseToday, setAvgResponseToday] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')

    const pushToast = (typeName, description) => {
        const id = Date.now() + Math.random()
        setToasts((current) => [...current, { id, typeName, description }])
        setTimeout(() => {
            setToasts((current) => current.filter((t) => t.id !== id))
        }, 5000)
    }

    // Emergencias activas
    useEffect(() => {
        fetch('http://localhost:3000/emergencias/emergencias-activas', {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(({ data }) => setEmergencies(data.map(em => toLowerCaseKeys(em))))
            .catch(error => console.error('Ha ocurrido un error buscando las emergencias activas', error))
    }, [])

    // Ambulancias con su última ubicación conocida, para pintarlas en el mapa
    useEffect(() => {
        fetch('http://localhost:3000/unidades/ambulancias', {
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
                    fetch(`http://localhost:3000/unidades/ubicacion/${amb.ambulance_id}`, {
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

    // Tiempo promedio de respuesta de hoy (KPI)
    useEffect(() => {
        fetch('http://localhost:3000/emergencias/analiticas/tiempo-respuesta-hoy', {
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
            pushToast(em.type_name, em.description)
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            setEmergencies(current => current.filter(em => em.emergency_id !== closedId))
        })

        return () => emergencySocket.disconnect()
    }, [])

    const availableUnits = ambulances.filter((amb) => parseInt(amb.ambulance_status_id) === 1).length

    const filteredEmergencies = statusFilter === 'all'
        ? emergencies
        : emergencies.filter((em) => em.status_name === statusFilter)

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
                        <span className="toast-title">Nueva emergencia: {t.typeName || 'Sin tipo'}</span>
                        <span className="toast-desc">{t.description || 'Sin descripción'}</span>
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
                <aside className="dashboard-sidebar">
                    <h4 className="sidebar-title">Emergencias Activas ({filteredEmergencies.length})</h4>
                    <select className="dashboard-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Todas</option>
                        <option value="Registrada">Registradas</option>
                        <option value="Asignada">Asignadas</option>
                        <option value="En atención">En atención</option>
                        <option value="Trasladando">Trasladando</option>
                    </select>
                    <div className="emergency-list">
                        {filteredEmergencies.map((em) => (
                            <EmergencyCard
                                key={em.emergency_id}
                                type={em.type_name}
                                location={em.description}
                                elapsedLabel=""
                                unitCode=""
                                statusLabel={em.status_name}
                                severity="stable"
                                color={em.triage_hex_color}
                                triageLevel={em.triage_level}
                                onCardClick={() => navigate(`/emergencias/${em.emergency_id}`)}
                            />
                        ))}
                        {filteredEmergencies.length === 0 && (
                            <p className="empty-state">
                                {statusFilter === 'all' ? 'Sin emergencias activas por ahora.' : 'Sin emergencias con este estado.'}
                            </p>
                        )}
                    </div>

                    <h4 className="sidebar-title" style={{ marginTop: 20 }}>Unidades</h4>
                    <div className="unit-list">
                        {ambulances.map((amb) => (
                            <div key={amb.ambulance_id} className="unit-list-item">
                                <span className="unit-dot" />
                                {amb.unit_number}
                            </div>
                        ))}
                    </div>
                </aside>

                <MapArea ambulances={ambulances} />
            </div>
        </div>
    )
}

export default Dashboard