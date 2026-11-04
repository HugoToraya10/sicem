import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import UnitRequestDetailModal from '../components/requests/UnitRequestDetailModal'
import RejectReasonModal from '../components/patients/RejectReasonModal'
import { useDialogs } from '../context/useDialogs'
import { readableTextOn } from '../utils/color'
import { formatElapsed } from '../utils/time'
import { triageRoman } from '../utils/triage'
import Icon from '../components/ui/Icon'
import '../components/patients/IncomingPatientCard.css'
import './IncomingUnitRequests.css'
import AnimatedNumber from '../components/ui/AnimatedNumber'

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
    const { notify } = useDialogs()
    const [requests, setRequests] = useState([])
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [rejectingRequestId, setRejectingRequestId] = useState(null)

    const fetchRequests = useCallback(() => {
        fetch(`${API_BASE_URL}/emergencias/solicitudes-pendientes-institucion/${user.institutionId}`, {
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
        fetch(`${API_BASE_URL}/emergencias/responder-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ interInstitutionalRequestId, requestStatusId, rejectionReason: rejectionReason || null })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo responder la solicitud'); return body }))
            .then(() => {
                setRequests((current) => current.filter((r) => r.inter_institutional_request_id !== interInstitutionalRequestId))
                setSelectedRequest(null)
                setRejectingRequestId(null)
                notify(requestStatusId === ACCEPTED_STATUS_ID ? 'Préstamo confirmado. La unidad ya figura como asignada.' : 'Solicitud rechazada.', 'ok')
            })
            .catch((error) => {
                console.error('Error respondiendo solicitud de unidad. ', error)
                notify(error.message || 'No se pudo responder la solicitud. Intenta de nuevo.', 'error')
            })
    }

    const handleAccept = (interInstitutionalRequestId) => respond(interInstitutionalRequestId, ACCEPTED_STATUS_ID, null)
    const handleReject = (interInstitutionalRequestId) => setRejectingRequestId(interInstitutionalRequestId)
    const handleConfirmReject = (reason) => respond(rejectingRequestId, REJECTED_STATUS_ID, reason)

    const visibleRequests = sortByPriority(requests)

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Solicitudes de unidad</h1>
                    <p className="page-sub">Otras instituciones piden prestada una de tus ambulancias. Confirma solo si puedes prescindir de ella.</p>
                </div>
                <ul className="stat-row" aria-label="Resumen">
                    <li><b><AnimatedNumber value={visibleRequests.length} /></b><span>pendientes</span></li>
                </ul>
            </div>

            <div className="iur-list">
                {visibleRequests.map((r) => {
                    const level = triageRoman(r.triage_level)
                    const color = r.triage_hex_color || 'var(--text-3)'
                    return (
                        <article key={r.inter_institutional_request_id} className="ipc" style={{ '--c': color }} aria-label={`Unidad ${r.unit_number || 'sin identificar'}`}>
                            <span className="ipc-rail" />
                            <div className="ipc-main">
                                <div className="ipc-top">
                                    {level && <span className="tri" style={{ '--c': color, color: readableTextOn(r.triage_hex_color) }} title={r.triage_color_name ? `Triage nivel ${level} (${r.triage_color_name})` : `Triage nivel ${level}`}>{level}</span>}
                                    <h2 className="ipc-name">Unidad {r.unit_number || 'sin identificar'}</h2>
                                    {r.requested_at && <span className="chip"><Icon name="clock" />{formatElapsed(r.requested_at)}</span>}
                                </div>
                                <p className="ipc-desc">Pide: {r.requesting_institution || 'Institución desconocida'}</p>
                                <p className="ipc-meta">{r.emergency_type_name || 'Emergencia'} · {r.emergency_description || 'Sin descripción'}</p>
                            </div>
                            <div className="ipc-actions">
                                <button type="button" className="btn btn-ok" onClick={() => handleAccept(r.inter_institutional_request_id)}><Icon name="check" size={16} />Confirmar</button>
                                <button type="button" className="btn btn-outline-danger" onClick={() => handleReject(r.inter_institutional_request_id)}>Rechazar</button>
                                <button type="button" className="btn btn-ghost" onClick={() => setSelectedRequest(r)}>Ver detalle</button>
                            </div>
                        </article>
                    )
                })}
                {visibleRequests.length === 0 && (
                    <p className="empty">Sin solicitudes de préstamo por ahora. Cuando otra institución pida una unidad, suena una alerta y aparece aquí.</p>
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
