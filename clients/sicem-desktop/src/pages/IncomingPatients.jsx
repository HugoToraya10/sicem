import { useState, useEffect, useCallback } from 'react'
import IncomingPatientCard from '../components/patients/IncomingPatientCard'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import './IncomingPatients.css'

const IncomingPatients = () => {
    const { user, token } = useAuth()
    const [patients, setPatients] = useState([])

    const fetchIncomingPatients = useCallback(() => {
        fetch(`http://localhost:3000/emergencias/pacientes-en-camino/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data.map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error recuperando pacientes en camino. ', error))
    }, [user, token])

    useEffect(() => {
        fetchIncomingPatients()
    }, [fetchIncomingPatients])

    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        emergencySocket.on('eventPatientRegistered', (data) => {
            if (parseInt(data.destinationInstitutionId) === parseInt(user.institutionId)) {
                fetchIncomingPatients()
            }
        })

        emergencySocket.on('eventEmergencyClosed', ({ emergency_id, emergencyId }) => {
            const closedId = emergency_id || emergencyId
            setPatients((current) => current.filter((p) => p.emergency_id !== closedId))
        })

        return () => emergencySocket.disconnect()
    }, [token, user, fetchIncomingPatients])

    const handleViewDetail = (patient) => {
        alert(`Detalle de ${patient.first_name || 'paciente'}: pantalla pendiente de construir.`)
    }

    return (
        <div className="incoming-layout">
            <div className="section-title">Pacientes en Camino ({patients.length})</div>
            {patients.map((p) => (
                <IncomingPatientCard key={p.emergency_patient_id} patient={p} onViewDetail={handleViewDetail} />
            ))}
            {patients.length === 0 && (
                <p className="empty-state">Sin pacientes en camino por ahora.</p>
            )}
        </div>
    )
}

export default IncomingPatients