import { useEffect, useState } from 'react'
import MapArea from '../map/MapArea'
import { Modal } from '../ui/Overlay'
import { API_BASE_URL } from '../../config/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { readableTextOn } from '../../utils/color'
import { triageRoman } from '../../utils/triage'
import { formatDateTime } from '../../utils/time'
import '../patients/PatientDetailModal.css'

// Detalle de una solicitud de préstamo de unidad: qué piden, quién lo pide, para qué emergencia y dónde está la unidad.
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
        <Modal
            open
            onClose={onClose}
            size="xl"
            eyebrow={`Solicitud de ${request.requesting_institution || 'otra institución'}`}
            title={`Unidad ${request.unit_number || 'sin identificar'}`}
            footer={(
                <>
                    <button type="button" className="btn btn-outline-danger" onClick={() => { onReject(request.inter_institutional_request_id); onClose() }}>Rechazar</button>
                    <button type="button" className="btn btn-ok" onClick={() => { onAccept(request.inter_institutional_request_id); onClose() }}>Confirmar préstamo</button>
                </>
            )}
        >
            {request.triage_level && (
                <div className="pd-chips">
                    <span className="chip" style={{ background: request.triage_hex_color || 'var(--text-3)', color: readableTextOn(request.triage_hex_color), borderColor: 'transparent' }}>
                        Triage {triageRoman(request.triage_level)}{request.triage_color_name ? ` · ${request.triage_color_name}` : ''}
                    </span>
                </div>
            )}
            <div className="pd-grid">
                <div className="pd-main" tabIndex={0} role="region" aria-label="Datos de la solicitud">
                    <section className="pd-card">
                        <h3>Unidad solicitada</h3>
                        <dl className="pd-facts">
                            <div><dt>Unidad</dt><dd>{request.unit_number || '—'}</dd></div>
                            <div><dt>Tipo</dt><dd>{request.ambulance_type_name || 'Desconocido'}</dd></div>
                            <div><dt>Placas</dt><dd className="mono">{request.license_plate || 'Sin registrar'}</dd></div>
                        </dl>
                    </section>
                    <section className="pd-card">
                        <h3>Emergencia</h3>
                        <p className="pd-lead">{request.emergency_type_name || 'Sin tipo'}: {request.emergency_description || 'Sin descripción'}</p>
                        {request.reporter_name && <p className="pd-muted">Reportó {request.reporter_name}{request.reporter_phone ? ` · ${request.reporter_phone}` : ''}</p>}
                        <p className="pd-muted">Pacientes involucrados: {request.num_patients || 1}</p>
                    </section>
                    <section className="pd-card">
                        <h3>Solicitud</h3>
                        <dl className="pd-facts">
                            <div><dt>Quién la pide</dt><dd>{request.requesting_institution || 'Institución desconocida'}</dd></div>
                            <div><dt>Enviada</dt><dd>{request.requested_at ? formatDateTime(request.requested_at) : '—'}</dd></div>
                        </dl>
                        <p className="pd-muted">Confirma solo si tu institución puede prescindir de esta unidad mientras dure el préstamo.</p>
                    </section>
                </div>
                <div className="pd-map">
                    {hasMapData ? (
                        <MapArea
                            ambulanceLocation={ambulanceLocation ? { ...ambulanceLocation, unitNumber: request.unit_number, color: request.triage_hex_color } : null}
                            emergencyLocation={request.emergency_latitude ? { latitude: request.emergency_latitude, longitude: request.emergency_longitude } : null}
                        />
                    ) : (
                        <p className="pd-muted pd-map-empty">Sin ubicación disponible todavía.</p>
                    )}
                </div>
            </div>
        </Modal>
    )
}

export default UnitRequestDetailModal
