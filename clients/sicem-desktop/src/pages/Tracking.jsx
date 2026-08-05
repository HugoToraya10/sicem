import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import PatientDetailModal from '../components/patients/PatientDetailModal'
import './Tracking.css'

// Menor max_wait_minutes = triage más urgente; sin triage se manda al final.
const priorityScore = (p) => {
    const wait = p.max_wait_minutes
    return (wait === null || wait === undefined) ? Infinity : Number(wait)
}
const sortByPriority = (list) => [...list].sort((a, b) => {
    const scoreDiff = priorityScore(a) - priorityScore(b)
    if (scoreDiff !== 0) return scoreDiff
    return new Date(a.created_at) - new Date(b.created_at)
})

// Todo lo que ya aceptaste y sigue activo — con lo que TODAVÍA puedes hacer
// algo (confirmar llegada o dar de alta). Ni "solicitudes nuevas" (eso es
// Pacientes en Camino) ni "ya resuelto" (eso es Historial).
const Tracking = () => {
    const { user, token } = useAuth()
    const [patients, setPatients] = useState([])
    const [selectedPatient, setSelectedPatient] = useState(null)

    const fetchPatients = useCallback(() => {
        fetch(`http://localhost:3000/emergencias/historial-institucion/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients((data || []).map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error recuperando seguimiento. ', error))
    }, [user, token])

    useEffect(() => { fetchPatients() }, [fetchPatients])

    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventPatientDelivered', () => fetchPatients())
        emergencySocket.on('eventEmergencyClosed', () => fetchPatients())
        // Si se acepta/rechaza un paciente desde otra pantalla (p. ej.
        // Pacientes en Camino en otra pestaña) mientras esta ya está montada,
        // sin esto Seguimiento se queda con la lista vieja hasta que se
        // vuelva a entrar a la pantalla.
        emergencySocket.on('eventPatientReceptionUpdated', () => fetchPatients())
        return () => emergencySocket.disconnect()
    }, [token, fetchPatients])

    // Aviso de "Concluir traslado" desde sicem-mobile — va en el socket de
    // unidades (puerto 3003), no en el de emergencias, mismo criterio que
    // eventAmbulanceFailureReported (PrivateRoute.jsx): ese servicio es dueño
    // de esta información. El resaltado en rojo se deriva directo de
    // p.paramedic_concluded_at (ya viene en getPatientHistoryByInstitution) —
    // aquí solo hace falta refrescar la lista para que ese dato llegue, sin
    // llevar un estado local aparte que se pudiera perder al navegar entre
    // pantallas (Pacientes en Camino <-> Seguimiento).
    useEffect(() => {
        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventTransferConcluded', (data) => {
            const mine = (data?.hospitalInstitutionIds || []).some((id) => parseInt(id) === parseInt(user.institutionId))
            if (mine) fetchPatients()
        })
        return () => unitsSocket.disconnect()
    }, [token, user, fetchPatients])

    const waitingArrival = sortByPriority(
        patients.filter((p) => p.reception_status_name === 'Aceptada' && !p.delivered_at && !p.closed_at)
    )
    const waitingDischarge = sortByPriority(
        patients.filter((p) => p.delivered_at && !p.discharged_at)
    )

    const handlePatientUpdated = (emergencyPatientId, changes) => {
        setPatients((current) => current.map((p) =>
            p.emergency_patient_id === emergencyPatientId ? { ...p, ...changes } : p
        ))
    }

    // Acción directa desde la tarjeta, sin pasar por el modal — mismo endpoint
    // y misma confirmación que PatientDetailModal, solo que aquí es un clic en
    // vez de abrir-detalle-y-buscar-el-botón. La velocidad es el punto de esta
    // pantalla.
    const handleConfirmDelivery = (emergencyPatientId) => {
        if (!window.confirm('¿Confirmas que este paciente ya llegó físicamente a tu institución?')) return
        fetch('http://localhost:3000/emergencias/confirmar-llegada-paciente', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo confirmar'); return body }))
            .then(() => handlePatientUpdated(emergencyPatientId, { delivered_at: new Date().toISOString() }))
            .catch(error => { console.error('Error confirmando llegada. ', error); alert(error.message) })
    }

    const handleDischarge = (emergencyPatientId) => {
        if (!window.confirm('¿Confirmas el alta de este paciente? Esto libera la cama que tenía reservada.')) return
        fetch('http://localhost:3000/emergencias/dar-alta-paciente', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo dar de alta'); return body }))
            .then(() => handlePatientUpdated(emergencyPatientId, { discharged_at: new Date().toISOString() }))
            .catch(error => { console.error('Error dando de alta. ', error); alert(error.message) })
    }

    const renderCard = (p, action) => {
        const fullName = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado'
        const isUrgent = Boolean(p.paramedic_concluded_at) && !p.delivered_at
        return (
            <div
                key={p.emergency_patient_id}
                className={`tracking-card${isUrgent ? ' tc-urgent' : ''}`}
                style={{ borderLeftColor: isUrgent ? '#C0272D' : (p.triage_hex_color || '#1565C0') }}
                onClick={() => setSelectedPatient(p)}
            >
                <div className="tc-name-row">
                    <span className="tc-name">{fullName}</span>
                    {isUrgent && <span className="tc-urgent-badge">🚑 Unidad ya llegó</span>}
                    {p.triage_level && (
                        <span className="tc-triage-badge" style={{ background: p.triage_hex_color || '#888' }}>
                            {p.triage_level} · {p.triage_color_name}
                        </span>
                    )}
                </div>
                <div className="tc-detail">{p.speciality_name || 'Sin especialidad'} · CURP: {p.curp || 'Sin CURP'}</div>
                <div className="tc-actions">
                    <button className={action.className} onClick={(e) => { e.stopPropagation(); action.onClick(p.emergency_patient_id) }}>{action.label}</button>
                    <button className="tc-detail-btn" onClick={(e) => { e.stopPropagation(); setSelectedPatient(p) }}>Ver detalle</button>
                </div>
            </div>
        )
    }

    return (
        <div className="tracking-layout">
            <div className="tracking-section">
                <div className="section-title">Esperando Llegada ({waitingArrival.length})</div>
                <div className="tracking-grid">
                    {waitingArrival.map((p) => renderCard(p, { label: 'Confirmar llegada', className: 'tc-deliver-btn', onClick: handleConfirmDelivery }))}
                    {waitingArrival.length === 0 && <p className="empty-state">Sin pacientes aceptados esperando llegar.</p>}
                </div>
            </div>

            <div className="tracking-section">
                <div className="section-title">Esperando Alta ({waitingDischarge.length})</div>
                <div className="tracking-grid">
                    {waitingDischarge.map((p) => renderCard(p, { label: 'Dar de alta', className: 'tc-discharge-btn', onClick: handleDischarge }))}
                    {waitingDischarge.length === 0 && <p className="empty-state">Sin pacientes internados esperando alta.</p>}
                </div>
            </div>

            {selectedPatient && (
                <PatientDetailModal
                    patient={selectedPatient}
                    token={token}
                    onClose={() => setSelectedPatient(null)}
                    onAccept={() => {}}
                    onReject={() => {}}
                    onPatientUpdated={handlePatientUpdated}
                />
            )}
        </div>
    )
}

export default Tracking
