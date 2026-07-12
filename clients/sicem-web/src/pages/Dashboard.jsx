import { useState, useEffect } from 'react'
import Navbar from '../components/layout/Navbar'
import EmergencyCard from '../components/emergencies/EmergencyCard'
import MapArea from '../components/map/MapArea'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/emergencias/nueva', label: 'Nueva Emergencia' },
    { to: '/solicitudes', label: 'Solicitudes' },
]

const roleLabels = {
    1: 'Administrador',
    2: 'Despachador',
    3: 'Paramédico',
    4: 'Hospital',
    5: 'Paciente'
}

const Dashboard = () => {
    const { user, token } = useAuth()
    const navigate = useNavigate();

    // TODO (Hugo): estos dos van a venir de tus propios fetch al Gateway
    const [emergencies, setEmergencies] = useState([])
    const [ambulances, setAmbulances] = useState([])

    // TODO (Hugo): useEffect que haga fetch a
    // GET http://localhost:3000/emergencias/emergencias-activas
    // con el header Authorization: Bearer <token>
    useEffect(() => {

    }, [])

    // TODO (Hugo): conexión Socket.io a localhost:3005 (emergencias) y 3003 (unidades)
    // escuchando eventEmergencyRegistered, eventEmergencyStatusUpdated,
    // eventEmergencyClosed, eventoUbicacionAmbulancia

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
                                elapsedLabel={/*TODO (Hugo): calcular con em.created_at */ ''}
                                unitCode={/* TODO (Hugo): sacar de assignments de esta emergencia */ ''}
                                statusLabel={em.status_name}
                                severity={/* TODO (Hugo): derivar de em.emergency_type_id o triage */ 'stable'}
                                onCardClick={()=>{
                                    
                                }}
                            />
                        ))}
                        {emergencies.length === 0 && (
                            <p className="empty-state">Sin emergencias activas por ahora.</p>
                        )}
                    </div>

                    <h4 className="sidebar-title" style={{ marginTop: 20 }}>Unidades Disponibles</h4>
                    <div className="unit-list">
                        {ambulances.map((amb) => (
                            <div key={amb.ambulance_id} className="unit-list-item">
                                <span className="unit-dot" />
                                {amb.unit_number} — {amb.institution_name}
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