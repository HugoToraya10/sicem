import { useState, useEffect, useCallback } from 'react'
import AmbulanceStatusCard from '../components/ambulances/AmbulanceStatusCard'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import './MyAmbulances.css'

const MyAmbulances = () => {
    const { user, token } = useAuth()
    const [ambulances, setAmbulances] = useState([])
    const [statuses, setStatuses] = useState([])

    const fetchAmbulances = useCallback(() => {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

        Promise.all([
            fetch(`${API_BASE_URL}/unidades/ambulancias-disponibles/${user.institutionId}`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/unidades/tipos-ambulancia`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/unidades/estados-ambulancia`, { headers }).then(res => res.json()),
        ])
            .then(([ambulancesRes, typesRes, statusesRes]) => {
                const typeCatalog = (typesRes.data || []).map(t => toLowerCaseKeys(t))
                const statusCatalog = (statusesRes.data || []).map(s => toLowerCaseKeys(s))
                setStatuses(statusCatalog)

                const merged = (ambulancesRes.data || []).map(a => toLowerCaseKeys(a)).map(a => ({
                    ...a,
                    type_name: typeCatalog.find(t => t.ambulance_type_id === a.ambulance_type_id)?.ambulance_type || 'Tipo desconocido'
                }))
                setAmbulances(merged)
            })
            .catch(error => console.error('Error recuperando ambulancias. ', error))
    }, [user, token])

    useEffect(() => { fetchAmbulances() }, [fetchAmbulances])

    // Esta pantalla nunca se actualizaba sola — cualquier cosa que cambiara el
    // estado de una unidad propia (salir a una emergencia, volver, que la pida
    // otra institución, que se acepte/rechace/cancele esa solicitud) solo se
    // veía después de recargar. Ante la duda de qué cambió exactamente,
    // simplemente se vuelve a pedir todo — es una lista chica, no vale la pena
    // parchear campo por campo por cada evento distinto.
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventAmbulanceAssigned', () => fetchAmbulances())
        emergencySocket.on('eventAmbulanceUnassigned', () => fetchAmbulances())
        emergencySocket.on('eventInterInstitutionalRequest', () => fetchAmbulances())
        emergencySocket.on('eventInterInstitutionalRequestResponded', () => fetchAmbulances())
        return () => emergencySocket.disconnect()
    }, [token, fetchAmbulances])

    const handleUpdateStatus = (ambulanceId, ambulanceStatusId) => {
        return fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId, ambulanceStatusId })
        })
            .then(res => {
                if (!res.ok) throw new Error('No se pudo actualizar el estado')
                return res.json()
            })
            .then(() => {
                setAmbulances((current) => current.map((a) =>
                    a.ambulance_id === ambulanceId ? { ...a, ambulance_status_id: ambulanceStatusId } : a
                ))
            })
            .catch(error => {
                console.error('Error actualizando estado de ambulancia. ', error)
                alert('No se pudo actualizar el estado. Intenta de nuevo.')
            })
    }

    return (
        <div className="my-ambulances-layout">
            <div className="section-title">Mis Ambulancias</div>
            <div className="my-ambulances-grid">
                {ambulances.map((a) => (
                    <AmbulanceStatusCard key={a.ambulance_id} ambulance={a} statuses={statuses} onUpdateStatus={handleUpdateStatus} />
                ))}
                {ambulances.length === 0 && (
                    <p className="empty-state">Sin ambulancias disponibles para tu institución.</p>
                )}
            </div>
        </div>
    )
}

export default MyAmbulances
