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

    // Socket.io — emergencias en tiempo real
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        emergencySocket.on('eventEmergencyRegistered', data => {
            setEmergencies(currentEmergencies => [toLowerCaseKeys(data), ...currentEmergencies])
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            setEmergencies(current => current.filter(em => em.emergency_id !== closedId))
        })

        return () => emergencySocket.disconnect()
    }, [])

    return (
        <div className="dashboard-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />
            <div className="dashboard-body">
                <aside className="dashboard-sidebar">
                    <h4 className="sidebar-title">Emergencias Activas ({emergencies.length})</h4>
                    <div className="emergency-list">
                        {emergencies.map((em) => (
                            <EmergencyCard
                                key={em.emergency_id}
                                type={em.type_name}
                                location={em.description}
                                elapsedLabel=""
                                unitCode=""
                                statusLabel={em.status_name}
                                severity="stable"
                                onCardClick={() => navigate(`/emergencias/${em.emergency_id}`)}
                            />
                        ))}
                        {emergencies.length === 0 && (
                            <p className="empty-state">Sin emergencias activas por ahora.</p>
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