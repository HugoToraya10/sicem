import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import UnitRequestDetailModal from '../components/requests/UnitRequestDetailModal'
import RejectReasonModal from '../components/patients/RejectReasonModal'
import './IncomingUnitRequests.css'

// request_status_id del catálogo real (confirmado contra la BD, mismo patrón
// de hardcodear ids estables que ya usa Requests.jsx en sicem-web):
// 1 Pendiente, 2 Aceptada, 3 Rechazada, 4 Cancelada.
const ACCEPTED_STATUS_ID = 2
const REJECTED_STATUS_ID = 3

// Mismo criterio de prioridad que el resto de la app: menor max_wait_minutes
// (triage más urgente) primero; sin triage, al final. Empate: la más antigua.
const priorityScore = (r) => {
    const wait = r.max_wait_minutes
    return (wait === null || wait === undefined) ? Infinity : Number(wait)
}
const sortByPriority = (list) => [...list].sort((a, b) => {
    const scoreDiff = priorityScore(a) - priorityScore(b)
    if (scoreDiff !== 0) return scoreDiff
    return new Date(a.requested_at) - new Date(b.requested_at)
})

// Bandeja de solicitudes de OTRAS instituciones pidiendo prestada una unidad
// nuestra — sin esto, esas ambulancias se quedaban "Pendiente" para siempre
// porque no había forma de aceptarlas/rechazarlas desde sicem-desktop.
const IncomingUnitRequests = () => {
    const { user, token } = useAuth()
    const [requests, setRequests] = useState([])
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [rejectingRequestId, setRejectingRequestId] = useState(null)

    const fetchRequests = useCallback(() => {
        fetch(`http://localhost:3000/emergencias/solicitudes-pendientes-institucion/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setRequests((data || []).map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error recuperando solicitudes de unidad. ', error))
    }, [user, token])

    useEffect(() => { fetchRequests() }, [fetchRequests])

    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)

        // El aviso con sonido/notificación vive en PrivateRoute.jsx (global, para
        // que suene sin importar en qué pantalla esté el usuario) — aquí solo se
        // refresca la lista para no duplicar el sonido cuando sí está en esta pantalla.
        emergencySocket.on('eventInterInstitutionalRequest', () => fetchRequests())

        // Cubre el caso de que otra persona de la misma institución (u otra
        // sesión) ya haya respondido esta solicitud — se quita sola de la lista.
        emergencySocket.on('eventInterInstitutionalRequestResponded', () => fetchRequests())

        // Un cierre forzado también cancela las solicitudes pendientes de esa
        // emergencia por detrás — sin este listener, la tarjeta se quedaba
        // mostrando "Pendiente" hasta recargar la pantalla.
        emergencySocket.on('eventEmergencyClosed', () => fetchRequests())

        return () => emergencySocket.disconnect()
    }, [token, user, fetchRequests])

    const respond = (interInstitutionalRequestId, requestStatusId, rejectionReason) => {
        fetch('http://localhost:3000/emergencias/responder-solicitud', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ interInstitutionalRequestId, requestStatusId, rejectionReason: rejectionReason || null })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo responder la solicitud'); return body }))
            .then(() => {
                setRequests((current) => current.filter((r) => r.inter_institutional_request_id !== interInstitutionalRequestId))
                setSelectedRequest(null)
                setRejectingRequestId(null)
            })
            .catch((error) => {
                console.error('Error respondiendo solicitud de unidad. ', error)
                alert(error.message || 'No se pudo responder la solicitud. Intenta de nuevo.')
            })
    }

    const handleAccept = (interInstitutionalRequestId) => respond(interInstitutionalRequestId, ACCEPTED_STATUS_ID, null)
    const handleReject = (interInstitutionalRequestId) => setRejectingRequestId(interInstitutionalRequestId)
    const handleConfirmReject = (reason) => respond(rejectingRequestId, REJECTED_STATUS_ID, reason)

    const visibleRequests = sortByPriority(requests)

    return (
        <div className="iur-layout">
            <div className="section-title">Solicitudes de Unidad ({visibleRequests.length})</div>

            <div className="iur-list">
                {visibleRequests.map((r) => (
                    <div key={r.inter_institutional_request_id} className="iur-card" style={{ borderLeftColor: r.triage_hex_color || '#1565C0' }}>
                        <div className="iur-info">
                            <div className="iur-name-row">
                                <span className="iur-unit">Unidad {r.unit_number || 'sin identificar'}</span>
                                {r.triage_level && (
                                    <span className="iur-triage-badge" style={{ background: r.triage_hex_color || '#888' }}>
                                        {r.triage_level} · {r.triage_color_name}
                                    </span>
                                )}
                            </div>
                            <div className="iur-detail">Pide: {r.requesting_institution || 'Institución desconocida'}</div>
                            <div className="iur-detail">{r.emergency_type_name || 'Emergencia'} · {r.emergency_description || 'Sin descripción'}</div>
                        </div>
                        <div className="iur-actions">
                            <button className="iur-accept-btn" onClick={() => handleAccept(r.inter_institutional_request_id)}>Confirmar</button>
                            <button className="iur-reject-btn" onClick={() => handleReject(r.inter_institutional_request_id)}>Rechazar</button>
                            <button className="iur-detail-btn" onClick={() => setSelectedRequest(r)}>Ver detalle</button>
                        </div>
                    </div>
                ))}
                {visibleRequests.length === 0 && (
                    <p className="empty-state">Sin solicitudes de préstamo de unidad por ahora.</p>
                )}
            </div>

            {selectedRequest && (
                <UnitRequestDetailModal
                    request={selectedRequest}
                    token={token}
                    onClose={() => setSelectedRequest(null)}
                    onAccept={handleAccept}
                    onReject={handleReject}
                />
            )}

            {rejectingRequestId && (
                <RejectReasonModal
                    title="Motivo de rechazo"
                    message="¿Por qué rechazas prestar esta unidad? (en uso, fuera de servicio, etc.)"
                    onConfirm={handleConfirmReject}
                    onCancel={() => setRejectingRequestId(null)}
                />
            )}
        </div>
    )
}

export default IncomingUnitRequests
