import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import { toLowerCaseKeys } from '../../utils/formatData'
import MapArea from '../map/MapArea'
import './PatientDetailModal.css'

const PatientDetailModal = ({ patient, token, onClose, onAccept, onReject, onPatientUpdated }) => {
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [loadingNotes, setLoadingNotes] = useState(true)
    const [ambulanceLocation, setAmbulanceLocation] = useState(null)
    const [routeCoordinates, setRouteCoordinates] = useState(null)
    const [eta, setEta] = useState(null)
    const [otherPatients, setOtherPatients] = useState([])
    const [history, setHistory] = useState([])
    const [deliveredAt, setDeliveredAt] = useState(patient.delivered_at || null)
    const [confirmingDelivery, setConfirmingDelivery] = useState(false)
    const [dischargedAt, setDischargedAt] = useState(patient.discharged_at || null)
    const [discharging, setDischarging] = useState(false)

    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/notas/${patient.emergency_patient_id}`, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(({ data }) => setNotes(data.map(n => toLowerCaseKeys(n))))
            .catch(error => console.error('Error recuperando notas de urgencia. ', error))
            .finally(() => setLoadingNotes(false))
    }, [patient.emergency_patient_id, token])

    // Ubicación en tiempo real de la ambulancia asignada — mismo endpoint que
    // usa el mapa del despachador (Dashboard.jsx en sicem-web), solo que aquí
    // apunta a la ambulancia concreta de este paciente.
    useEffect(() => {
        if (!patient.ambulance_id) { setAmbulanceLocation(null); return }
        fetch(`${API_BASE_URL}/unidades/ubicacion/${patient.ambulance_id}`, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(res => res.ok ? res.json() : { data: null })
            .then(({ data }) => setAmbulanceLocation(data ? toLowerCaseKeys(data) : null))
            .catch(error => console.error('Error recuperando ubicación de la ambulancia. ', error))
    }, [patient.ambulance_id, token])

    // Traza completa punto A (unidad) → punto B (emergencia) — mismo servicio
    // OSRM ya usado en sicem-web para esto mismo.
    useEffect(() => {
        if (!ambulanceLocation?.latitude || !ambulanceLocation?.longitude || !patient.emergency_latitude || !patient.emergency_longitude) {
            setRouteCoordinates(null)
            return
        }
        const url = `https://router.project-osrm.org/route/v1/driving/${ambulanceLocation.longitude},${ambulanceLocation.latitude};${patient.emergency_longitude},${patient.emergency_latitude}?overview=full&geometries=geojson`
        fetch(url)
            .then(res => res.json())
            .then((data) => {
                if (data.code !== 'Ok' || !data.routes?.[0]) { setRouteCoordinates(null); return }
                setRouteCoordinates(data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]))
            })
            .catch((error) => { console.error('Error trazando la ruta de la ambulancia. ', error); setRouteCoordinates(null) })
    }, [ambulanceLocation, patient.emergency_latitude, patient.emergency_longitude])

    // ETA/notas que el despachador ya mandó al asignar el traslado a esta
    // institución — no hay endpoint filtrado, se pide todo y se cruza en
    // cliente (mismo patrón que el resto de la app con catálogos pequeños).
    useEffect(() => {
        if (!user?.institutionId) return
        fetch(`${API_BASE_URL}/hospitales/notificaciones`, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(({ data }) => {
                const mine = (data || []).map(n => toLowerCaseKeys(n)).find(n =>
                    parseInt(n.emergency_id) === parseInt(patient.emergency_id) &&
                    parseInt(n.institution_id) === parseInt(user.institutionId)
                )
                setEta(mine || null)
            })
            .catch(error => console.error('Error recuperando notificación de traslado. ', error))
    }, [patient.emergency_id, user, token])

    // Si la emergencia tiene más de un paciente (p. ej. accidente múltiple),
    // muestra a los demás — puede que vayan a otras instituciones.
    useEffect(() => {
        if (!patient.num_patients || parseInt(patient.num_patients) <= 1) { setOtherPatients([]); return }
        fetch(`${API_BASE_URL}/emergencias/pacientes/${patient.emergency_id}`, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(({ data }) => {
                const others = (data || [])
                    .map(p => toLowerCaseKeys(p))
                    .filter(p => p.emergency_patient_id !== patient.emergency_patient_id)
                setOtherPatients(others)
            })
            .catch(error => console.error('Error recuperando otros pacientes de la emergencia. ', error))
    }, [patient.emergency_id, patient.num_patients, patient.emergency_patient_id, token])

    // Visitas anteriores de este mismo paciente — endpoint ya existía, sin uso
    // hasta ahora en ningún frontend.
    useEffect(() => {
        if (!patient.user_profile_id) { setHistory([]); return }
        fetch(`${API_BASE_URL}/emergencias/emergencias-paciente/${patient.user_profile_id}`, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(({ data }) => {
                const past = (data || [])
                    .map(e => toLowerCaseKeys(e))
                    .filter(e => parseInt(e.emergency_id) !== parseInt(patient.emergency_id))
                setHistory(past)
            })
            .catch(error => console.error('Error recuperando historial del paciente. ', error))
    }, [patient.user_profile_id, patient.emergency_id, token])

    const fullName = [patient.first_name, patient.first_surname, patient.second_surname]
        .filter(Boolean).join(' ') || 'Paciente no identificado'

    // Una emergencia ya cerrada (auto-cierre, cierre normal o forzado) no
    // admite más acciones sobre sus pacientes — ni aceptar/rechazar ni
    // confirmar llegada. Antes solo se miraba reception_status_id, por eso en
    // el Historial (que sí incluye cerradas) los botones seguían apareciendo.
    const isClosed = Boolean(patient.closed_at)
    const isPending = parseInt(patient.reception_status_id) === 1 && !isClosed
    const isRejected = patient.reception_status_name === 'Rechazada'
    // Antes esto era "!isClosed && !isRejected", lo cual dejaba pasar también a
    // los Pendientes (nunca aceptados) — el botón de confirmar llegada
    // aparecía sin haber pasado por Aceptar, cuando ni siquiera se les había
    // reservado cama. Debe exigir que ya esté Aceptada, igual que Seguimiento.
    const canConfirmDelivery = !isClosed && patient.reception_status_name === 'Aceptada'
    const hasMapData = Boolean(ambulanceLocation || patient.emergency_latitude)

    // Confirmación de llegada FÍSICA — distinta de Aceptar/Rechazar (esa es la
    // decisión administrativa de antes de que llegue). Mientras no exista
    // sicem-mobile, es el propio hospital quien la dispara.
    const handleConfirmDelivery = () => {
        if (!window.confirm('¿Confirmas que este paciente ya llegó físicamente a tu institución?')) return
        setConfirmingDelivery(true)
        fetch(`${API_BASE_URL}/emergencias/confirmar-llegada-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId: patient.emergency_patient_id })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo confirmar'); return body }))
            .then(({ data }) => {
                const deliveredNow = new Date().toISOString()
                setDeliveredAt(deliveredNow)
                // Avisa al padre (History.jsx / IncomingPatients.jsx) para que
                // actualice su propia lista sin que haga falta salir y volver a
                // entrar a la pantalla.
                onPatientUpdated?.(patient.emergency_patient_id, { delivered_at: deliveredNow })
                // Si esta era la última entrega pendiente, la emergencia ya se
                // cerró sola en el backend — el modal ya no tiene nada más que
                // mostrar de "en camino", así que se cierra solo.
                if (data?.emergencyClosed) onClose()
            })
            .catch(error => { console.error('Error confirmando llegada. ', error); alert(error.message) })
            .finally(() => setConfirmingDelivery(false))
    }

    // Alta médica — libera la cama que "Aceptar" reservó. A diferencia de las
    // demás acciones, esto NO depende de que la emergencia siga abierta: lo
    // normal es que la emergencia ya se haya cerrado sola (todos entregados)
    // mucho antes de que este paciente en particular reciba su alta.
    const handleDischarge = () => {
        if (!window.confirm('¿Confirmas el alta de este paciente? Esto libera la cama que tenía reservada.')) return
        setDischarging(true)
        fetch(`${API_BASE_URL}/emergencias/dar-alta-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId: patient.emergency_patient_id })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo dar de alta'); return body }))
            .then(() => {
                const dischargedNow = new Date().toISOString()
                setDischargedAt(dischargedNow)
                onPatientUpdated?.(patient.emergency_patient_id, { discharged_at: dischargedNow })
            })
            .catch(error => { console.error('Error dando de alta. ', error); alert(error.message) })
            .finally(() => setDischarging(false))
    }

    const hasAnyAction = (!isClosed && (isPending || canConfirmDelivery)) || deliveredAt

    return (
        // Mismo patrón de overlay que antes, solo que ahora el modal es mucho
        // más grande (casi pantalla completa) porque ya no cabe todo en un
        // recuadro pequeño — dos columnas: info a la izquierda, mapa fijo arriba
        // a la derecha.
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-info">
                        <h3>{fullName}</h3>
                        {patient.triage_level && (
                            <span className="triage-badge" style={{ background: patient.triage_hex_color || '#888' }}>
                                Triage {patient.triage_level} · {patient.triage_color_name}
                            </span>
                        )}
                        {deliveredAt && <span className="delivered-badge">✓ Entregado</span>}
                        {dischargedAt && <span className="discharged-badge">✓ Dado de alta</span>}
                    </div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body-columns">
                    <div className="modal-column-main">
                        <div className="modal-section">
                            <h5>Emergencia</h5>
                            <p>{patient.description || 'Sin descripción'}</p>
                            {patient.notes && <p className="modal-notes">Notas: {patient.notes}</p>}
                            {patient.reporter_name && (
                                <p>Reportó: {patient.reporter_name}{patient.reporter_phone ? ` · ${patient.reporter_phone}` : ''}</p>
                            )}
                            {eta && (
                                <p className="modal-eta">
                                    <strong>Llegada estimada:</strong> {eta.estimated_arrival ? new Date(eta.estimated_arrival).toLocaleString('es-MX') : 'Sin definir'}
                                    {eta.notes ? ` — ${eta.notes}` : ''}
                                </p>
                            )}
                        </div>

                        <div className="modal-section">
                            <h5>Traslado</h5>
                            <p>Unidad {patient.unit_number || 'sin asignar'} · {patient.institution_name || '—'}</p>
                            <p>CURP: {patient.curp || 'Sin identificar'}</p>
                        </div>

                        <div className="modal-section">
                            <h5>Información clínica</h5>
                            <p>Tipo de sangre: {patient.blood_type || 'Desconocido'}</p>
                            {(patient.weight || patient.height) && (
                                <p>
                                    {patient.weight ? `Peso: ${patient.weight} kg` : ''}
                                    {patient.weight && patient.height ? ' · ' : ''}
                                    {patient.height ? `Talla: ${patient.height} m` : ''}
                                </p>
                            )}
                            <p>Alergias: {patient.allergies || 'Ninguna registrada'}</p>
                            <p>Condiciones: {patient.conditions || 'Ninguna registrada'}</p>
                            <p>Medicamentos: {patient.medications || 'Ninguno registrado'}</p>
                            {patient.clinical_record_notes && <p>Notas del expediente: {patient.clinical_record_notes}</p>}
                        </div>

                        <div className="modal-section">
                            <h5>Signos vitales reportados en campo</h5>
                            {loadingNotes && <p className="modal-empty">Cargando...</p>}
                            {!loadingNotes && notes.length === 0 && (
                                <p className="modal-empty">Sin reportes de campo todavía.</p>
                            )}
                            {notes.map((note) => (
                                <div key={note.emergency_note_id} className="vitals-entry">
                                    <div className="vitals-time">{new Date(note.recorded_at).toLocaleTimeString()}</div>
                                    <div className="vitals-grid">
                                        {note.blood_pressure && <span>PA: {note.blood_pressure}</span>}
                                        {note.heart_rate && <span>FC: {note.heart_rate} lpm</span>}
                                        {note.temperature && <span>Temp: {note.temperature}°C</span>}
                                        {note.oxygen_saturation && <span>SpO2: {note.oxygen_saturation}%</span>}
                                        {note.respiratory_rate && <span>FR: {note.respiratory_rate}</span>}
                                    </div>
                                    {note.initial_diagnosis && <p><strong>Diagnóstico:</strong> {note.initial_diagnosis}</p>}
                                    {note.treatment_applied && <p><strong>Tratamiento:</strong> {note.treatment_applied}</p>}
                                </div>
                            ))}
                        </div>

                        {otherPatients.length > 0 && (
                            <div className="modal-section">
                                <h5>Otros pacientes de esta misma emergencia ({otherPatients.length})</h5>
                                {otherPatients.map((p) => (
                                    <p key={p.emergency_patient_id}>
                                        {[p.first_name, p.first_surname].filter(Boolean).join(' ') || 'Paciente no identificado'}
                                        {p.destination_institution_id
                                            ? (parseInt(p.destination_institution_id) === parseInt(user?.institutionId) ? ' — también viene a tu institución' : ' — trasladado a otra institución')
                                            : ' — sin destino asignado todavía'}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="modal-section">
                            <h5>Historial de emergencias anteriores</h5>
                            {history.length === 0 && <p className="modal-empty">Sin visitas anteriores registradas.</p>}
                            {history.map((h) => (
                                <p key={h.emergency_id}>
                                    {new Date(h.created_at).toLocaleDateString('es-MX')} — {h.type_name || 'Sin tipo'} ({h.status_name || 'Sin estado'})
                                </p>
                            ))}
                        </div>
                    </div>

                    <div className="modal-column-map">
                        {hasMapData ? (
                            <MapArea
                                ambulanceLocation={ambulanceLocation ? { ...ambulanceLocation, unitNumber: patient.unit_number, color: patient.triage_hex_color } : null}
                                emergencyLocation={patient.emergency_latitude ? { latitude: patient.emergency_latitude, longitude: patient.emergency_longitude } : null}
                                routeCoordinates={routeCoordinates}
                            />
                        ) : (
                            <p className="modal-empty map-empty">Sin ubicación disponible todavía.</p>
                        )}
                    </div>
                </div>

                {hasAnyAction && (
                    <div className="modal-actions">
                        {!isClosed && isPending && (
                            <>
                                <button className="btn-accept" onClick={() => { onAccept(patient.emergency_patient_id); onClose() }}>Aceptar</button>
                                <button className="btn-reject" onClick={() => { onReject(patient.emergency_patient_id); onClose() }}>Rechazar</button>
                            </>
                        )}
                        {!isClosed && canConfirmDelivery && (
                            <button className="btn-deliver" onClick={handleConfirmDelivery} disabled={Boolean(deliveredAt) || confirmingDelivery}>
                                {deliveredAt ? 'Llegada ya confirmada' : (confirmingDelivery ? 'Confirmando...' : 'Confirmar llegada física')}
                            </button>
                        )}
                        {deliveredAt && (
                            <button className="btn-discharge" onClick={handleDischarge} disabled={Boolean(dischargedAt) || discharging}>
                                {dischargedAt ? 'Ya dado de alta' : (discharging ? 'Dando de alta...' : 'Dar de alta (liberar cama)')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PatientDetailModal
