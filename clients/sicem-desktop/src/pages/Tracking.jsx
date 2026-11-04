import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import PatientDetailModal from '../components/patients/PatientDetailModal'
import Icon from '../components/ui/Icon'
import { useDialogs } from '../context/useDialogs'
import { readableTextOn } from '../utils/color'
import { formatElapsed } from '../utils/time'
import { triageRoman } from '../utils/triage'
import '../components/patients/IncomingPatientCard.css'
import './Tracking.css'
import AnimatedNumber from '../components/ui/AnimatedNumber'

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
    const { notify, confirm } = useDialogs()
    const [patients, setPatients] = useState([])
    const [selectedPatient, setSelectedPatient] = useState(null)

    const fetchPatients = useCallback(() => {
        fetch(`${API_BASE_URL}/emergencias/historial-institucion/${user.institutionId}`, {
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
    const handleConfirmDelivery = async (emergencyPatientId) => {
        const ok = await confirm({ title: 'Confirmar llegada física', message: '¿Confirmas que este paciente ya llegó físicamente a tu institución?', confirmLabel: 'Sí, ya llegó' })
        if (!ok) return
        fetch(`${API_BASE_URL}/emergencias/confirmar-llegada-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo confirmar'); return body }))
            .then(() => { handlePatientUpdated(emergencyPatientId, { delivered_at: new Date().toISOString() }); notify('Llegada confirmada.', 'ok') })
            .catch(error => { console.error('Error confirmando llegada. ', error); notify(error.message, 'error') })
    }

    const handleDischarge = async (emergencyPatientId) => {
        const ok = await confirm({ title: 'Dar de alta al paciente', message: 'Esto libera la cama que tenía reservada. ¿Confirmas el alta?', confirmLabel: 'Dar de alta' })
        if (!ok) return
        fetch(`${API_BASE_URL}/emergencias/dar-alta-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo dar de alta'); return body }))
            .then(() => { handlePatientUpdated(emergencyPatientId, { discharged_at: new Date().toISOString() }); notify('Paciente dado de alta. La cama quedó libre.', 'ok') })
            .catch(error => { console.error('Error dando de alta. ', error); notify(error.message, 'error') })
    }

    const renderCard = (p, action) => {
        const fullName = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado'
        const isUrgent = Boolean(p.paramedic_concluded_at) && !p.delivered_at
        const level = triageRoman(p.triage_level)
        const color = p.triage_hex_color || 'var(--text-3)'
        return (
            <article key={p.emergency_patient_id} className={`ipc${isUrgent ? ' ipc-urgent' : ''}`} style={{ '--c': isUrgent ? 'var(--brand)' : color }} aria-label={fullName}>
                <span className="ipc-rail" />
                <div className="ipc-main">
                    <div className="ipc-top">
                        {level && <span className="tri" style={{ '--c': color, color: readableTextOn(p.triage_hex_color) }} title={p.triage_color_name ? `Triage nivel ${level} (${p.triage_color_name})` : `Triage nivel ${level}`}>{level}</span>}
                        <h3 className="ipc-name">{fullName}</h3>
                        {isUrgent && <span className="chip chip-brand"><Icon name="alert" />Unidad ya llegó</span>}
                        {p.created_at && <span className="chip"><Icon name="clock" />{formatElapsed(p.created_at)}</span>}
                    </div>
                    <p className="ipc-meta">{p.speciality_name || 'Sin especialidad'} · CURP: {p.curp || 'sin CURP'}</p>
                </div>
                <div className="ipc-actions">
                    <button type="button" className={`btn ${action.tone}`} onClick={() => action.onClick(p.emergency_patient_id)}>{action.label}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setSelectedPatient(p)}>Ver detalle</button>
                </div>
            </article>
        )
    }

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Seguimiento</h1>
                    <p className="page-sub">Pacientes que ya aceptaste: confirma cuando lleguen y da el alta para liberar su cama.</p>
                </div>
                <ul className="stat-row" aria-label="Resumen">
                    <li><b><AnimatedNumber value={waitingArrival.length} /></b><span>por llegar</span></li>
                    <li><b><AnimatedNumber value={waitingDischarge.length} /></b><span>por dar de alta</span></li>
                </ul>
            </div>

            <section className="tracking-section" aria-labelledby="trk-arrival">
                <h2 id="trk-arrival" className="tracking-title">Esperando llegada <span className="count">{waitingArrival.length}</span></h2>
                <div className="cards">
                    {waitingArrival.map((p) => renderCard(p, { label: 'Confirmar llegada', tone: 'btn-primary', onClick: handleConfirmDelivery }))}
                    {waitingArrival.length === 0 && <p className="empty">Ningún paciente aceptado viene en camino.</p>}
                </div>
            </section>

            <section className="tracking-section" aria-labelledby="trk-discharge">
                <h2 id="trk-discharge" className="tracking-title">Esperando alta <span className="count">{waitingDischarge.length}</span></h2>
                <div className="cards">
                    {waitingDischarge.map((p) => renderCard(p, { label: 'Dar de alta', tone: 'btn-ok', onClick: handleDischarge }))}
                    {waitingDischarge.length === 0 && <p className="empty">Ningún paciente internado espera alta.</p>}
                </div>
            </section>

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
