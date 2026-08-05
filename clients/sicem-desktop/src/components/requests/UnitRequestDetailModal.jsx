import { useEffect, useState } from 'react'
import MapArea from '../map/MapArea'
import { API_BASE_URL } from '../../config/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import '../patients/PatientDetailModal.css'

// Mismo patrón que PatientDetailModal: overlay + recuadro grande con mapa fijo
// a la derecha — reutiliza las mismas clases CSS, solo cambia el contenido.
const UnitRequestDetailModal = ({ request, token, onClose, onAccept, onReject }) => {
    const [ambulanceLocation, setAmbulanceLocation] = useState(null)

    useEffect(() => {
        if (!request.ambulance_id) { setAmbulanceLocation(null); return }
        fetch(`${API_BASE_URL}/unidades/ubicacion/${request.ambulance_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : { data: null })
            .then(({ data }) => setAmbulanceLocation(data ? toLowerCaseKeys(data) : null))
            .catch(error => console.error('Error recuperando ubicación de la ambulancia. ', error))
    }, [request.ambulance_id, token])

    const hasMapData = Boolean(ambulanceLocation || request.emergency_latitude)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-info">
                        <h3>Unidad {request.unit_number || 'sin identificar'}</h3>
                        {request.triage_level && (
                            <span className="triage-badge" style={{ background: request.triage_hex_color || '#888' }}>
                                Triage {request.triage_level} · {request.triage_color_name}
                            </span>
                        )}
                    </div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body-columns">
                    <div className="modal-column-main">
                        <div className="modal-section">
                            <h5>Institución solicitante</h5>
                            <p>{request.requesting_institution || 'Institución desconocida'}</p>
                        </div>

                        <div className="modal-section">
                            <h5>Unidad solicitada</h5>
                            <p>Unidad {request.unit_number || '—'} · {request.ambulance_type_name || 'Tipo desconocido'}</p>
                            <p>Placas: {request.license_plate || 'Sin registrar'}</p>
                        </div>

                        <div className="modal-section">
                            <h5>Emergencia</h5>
                            <p>{request.emergency_type_name || 'Sin tipo'} — {request.emergency_description || 'Sin descripción'}</p>
                            {request.reporter_name && (
                                <p>Reportó: {request.reporter_name}{request.reporter_phone ? ` · ${request.reporter_phone}` : ''}</p>
                            )}
                            <p>Pacientes involucrados: {request.num_patients || 1}</p>
                        </div>

                        <div className="modal-section">
                            <h5>Solicitud</h5>
                            <p>Enviada: {request.requested_at ? new Date(request.requested_at).toLocaleString('es-MX') : '—'}</p>
                        </div>
                    </div>

                    <div className="modal-column-map">
                        {hasMapData ? (
                            <MapArea
                                ambulanceLocation={ambulanceLocation ? { ...ambulanceLocation, unitNumber: request.unit_number, color: request.triage_hex_color } : null}
                                emergencyLocation={request.emergency_latitude ? { latitude: request.emergency_latitude, longitude: request.emergency_longitude } : null}
                            />
                        ) : (
                            <p className="modal-empty map-empty">Sin ubicación disponible todavía.</p>
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-accept" onClick={() => { onAccept(request.inter_institutional_request_id); onClose() }}>
                        Confirmar préstamo
                    </button>
                    <button className="btn-reject" onClick={() => { onReject(request.inter_institutional_request_id); onClose() }}>
                        Rechazar
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UnitRequestDetailModal
