import { useState, useEffect } from 'react'
import { useDialogs } from '../../context/useDialogs'
import { readableTextOn } from '../../utils/color'
import { triageRoman } from '../../utils/triage'
import { formatDate, formatDateTime } from '../../utils/time'
import Icon from '../ui/Icon'
import { Modal } from '../ui/Overlay'
import { API_BASE_URL } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import { toLowerCaseKeys } from '../../utils/formatData'
import MapArea from '../map/MapArea'
import './PatientDetailModal.css'

// 36.80 -> 36.8, 91.00 -> 91
const fmtNum = (v) => { const n = Number(v); return Number.isNaN(n) ? v : String(n) }

const PatientDetailModal = ({ patient, token, onClose, onAccept, onReject, onPatientUpdated }) => {
    const { user } = useAuth()
    const { notify, confirm } = useDialogs()
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
    const handleConfirmDelivery = async () => {
        const ok = await confirm({
            title: 'Confirmar llegada física',
            message: '¿Confirmas que este paciente ya llegó físicamente a tu institución?',
            confirmLabel: 'Sí, ya llegó',
        })
        if (!ok) return
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
                notify('Llegada confirmada.', 'ok')
                // Si esta era la última entrega pendiente, la emergencia ya se
                // cerró sola en el backend — el modal ya no tiene nada más que
                // mostrar de "en camino", así que se cierra solo.
                if (data?.emergencyClosed) onClose()
            })
            .catch(error => { console.error('Error confirmando llegada. ', error); notify(error.message, 'error') })
            .finally(() => setConfirmingDelivery(false))
    }

    // Alta médica — libera la cama que "Aceptar" reservó. A diferencia de las
    // demás acciones, esto NO depende de que la emergencia siga abierta: lo
    // normal es que la emergencia ya se haya cerrado sola (todos entregados)
    // mucho antes de que este paciente en particular reciba su alta.
    const handleDischarge = async () => {
        const ok = await confirm({
            title: 'Dar de alta al paciente',
            message: 'Esto libera la cama que tenía reservada. ¿Confirmas el alta?',
            confirmLabel: 'Dar de alta',
        })
        if (!ok) return
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
                notify('Paciente dado de alta. La cama quedó libre.', 'ok')
            })
            .catch(error => { console.error('Error dando de alta. ', error); notify(error.message, 'error') })
            .finally(() => setDischarging(false))
    }

    const hasAnyAction = (!isClosed && (isPending || canConfirmDelivery)) || deliveredAt

    const splitList = (txt) => String(txt || '').split(/[,;]+/).map((t) => t.trim()).filter(Boolean)
    const allergyList = splitList(patient.allergies)
    const conditionList = splitList(patient.conditions)
    const medicationList = splitList(patient.medications)
    const affiliatedElsewhere = Boolean(patient.curp || patient.patient_identification_number) && Boolean(patient.patient_institution_id)
        && parseInt(patient.patient_institution_id) !== parseInt(user?.institutionId)

    const footer = hasAnyAction ? (
        <>
            {!isClosed && isPending && (
                <>
                    <button type="button" className="btn btn-outline-danger" onClick={() => { onReject(patient.emergency_patient_id); onClose() }}>Rechazar</button>
                    <button type="button" className="btn btn-ok" onClick={() => { onAccept(patient.emergency_patient_id); onClose() }}>Aceptar paciente</button>
                </>
            )}
            {!isClosed && canConfirmDelivery && (
                <button type="button" className="btn btn-primary" onClick={handleConfirmDelivery} disabled={Boolean(deliveredAt) || confirmingDelivery}>
                    {deliveredAt ? 'Llegada ya confirmada' : (confirmingDelivery ? 'Confirmando…' : 'Confirmar llegada física')}
                </button>
            )}
            {deliveredAt && (
                <button type="button" className="btn" onClick={handleDischarge} disabled={Boolean(dischargedAt) || discharging}>
                    {dischargedAt ? 'Ya dado de alta' : (discharging ? 'Dando de alta…' : 'Dar de alta y liberar cama')}
                </button>
            )}
        </>
    ) : null

    const Vital = ({ label, value, unit, warn }) => (
        <div className={`pd-vital${warn ? ' warn' : ''}`}><span>{label}</span><b>{value}{unit && <small>{unit}</small>}</b></div>
    )

    return (
        <Modal open onClose={onClose} size="full" eyebrow={`Emergencia #${patient.emergency_id}`} title={fullName} footer={footer}>
            <div className="pd-chips">
                {patient.triage_level && (
                    <span className="chip" style={{ background: patient.triage_hex_color || 'var(--text-3)', color: readableTextOn(patient.triage_hex_color), borderColor: 'transparent' }}>
                        Triage {triageRoman(patient.triage_level)}{patient.triage_color_name ? ` · ${patient.triage_color_name}` : ''}
                    </span>
                )}
                {patient.reception_status_name && <span className="chip">{patient.reception_status_name}</span>}
                {affiliatedElsewhere && (
                    <span className="chip chip-warn" title={`Este paciente está afiliado a ${patient.patient_institution_name || 'otra institución'}`}>
                        Afiliado a {patient.patient_institution_name || 'otra institución'}
                    </span>
                )}
                {deliveredAt && <span className="chip chip-ok"><Icon name="check" />Entregado</span>}
                {dischargedAt && <span className="chip chip-steel"><Icon name="check" />Dado de alta</span>}
            </div>

            <div className="pd-grid">
                <div className="pd-main" tabIndex={0} role="region" aria-label="Datos del paciente">
                    <section className="pd-card">
                        <h3>Qué pasó</h3>
                        <p className="pd-lead">{patient.description || 'Sin descripción'}</p>
                        {patient.notes && <p className="pd-muted">Notas: {patient.notes}</p>}
                        {patient.reporter_name && <p className="pd-muted">Reportó {patient.reporter_name}{patient.reporter_phone ? ` · ${patient.reporter_phone}` : ''}</p>}
                        {eta && (
                            <p className="pd-eta"><Icon name="clock" size={16} /><span><b>Llegada estimada:</b> {eta.estimated_arrival ? formatDateTime(eta.estimated_arrival) : 'Sin definir'}{eta.notes ? ` — ${eta.notes}` : ''}</span></p>
                        )}
                    </section>

                    <section className="pd-card">
                        <h3>Traslado</h3>
                        <dl className="pd-facts">
                            <div><dt>Unidad</dt><dd>{patient.unit_number || 'Sin asignar'}</dd></div>
                            <div><dt>Institución de origen</dt><dd>{patient.institution_name || '—'}</dd></div>
                            <div><dt>CURP</dt><dd className="mono">{patient.curp || 'Sin identificar'}</dd></div>
                            {(patient.curp || patient.patient_identification_number) && patient.patient_institution_name && (
                                <div><dt>Afiliación</dt><dd>{patient.patient_institution_name}{patient.patient_identification_number ? ` (${patient.patient_identification_number})` : ''}</dd></div>
                            )}
                        </dl>
                    </section>

                    <section className="pd-card">
                        <h3>Información clínica</h3>
                        <dl className="pd-facts">
                            <div><dt>Sangre</dt><dd className="pd-blood">{patient.blood_type || 'Desconocido'}</dd></div>
                            {patient.weight && <div><dt>Peso</dt><dd>{patient.weight} kg</dd></div>}
                            {patient.height && <div><dt>Talla</dt><dd>{patient.height} m</dd></div>}
                        </dl>
                        <div className="pd-tags">
                            <h4>Alergias</h4>
                            {allergyList.length ? <ul>{allergyList.map((a) => <li key={a} className="pd-tag bad">{a}</li>)}</ul> : <p className="pd-muted">Ninguna registrada</p>}
                            <h4>Condiciones</h4>
                            {conditionList.length ? <ul>{conditionList.map((a) => <li key={a} className="pd-tag warn">{a}</li>)}</ul> : <p className="pd-muted">Ninguna registrada</p>}
                            <h4>Medicamentos</h4>
                            {medicationList.length ? <ul>{medicationList.map((a) => <li key={a} className="pd-tag">{a}</li>)}</ul> : <p className="pd-muted">Ninguno registrado</p>}
                        </div>
                        {patient.clinical_record_notes && <p className="pd-muted">Notas del expediente: {patient.clinical_record_notes}</p>}
                    </section>

                    <section className="pd-card">
                        <h3>Signos vitales en campo</h3>
                        {loadingNotes && <p className="pd-muted">Cargando…</p>}
                        {!loadingNotes && notes.length === 0 && <p className="pd-muted">Sin reportes de campo todavía.</p>}
                        {notes.map((note) => (
                            <div key={note.emergency_note_id} className="pd-note">
                                <div className="pd-note-time">{new Date(note.recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="pd-vitals">
                                    {note.blood_pressure && <Vital label="Presión" value={note.blood_pressure} />}
                                    {note.heart_rate && <Vital label="Frec. cardiaca" value={fmtNum(note.heart_rate)} unit=" lpm" />}
                                    {note.oxygen_saturation && <Vital label="SpO₂" value={fmtNum(note.oxygen_saturation)} unit="%" warn={Number(note.oxygen_saturation) < 92} />}
                                    {note.temperature && <Vital label="Temperatura" value={fmtNum(note.temperature)} unit=" °C" />}
                                    {note.respiratory_rate && <Vital label="Frec. resp." value={fmtNum(note.respiratory_rate)} unit=" rpm" />}
                                    {note.glucose_level && <Vital label="Glucosa" value={fmtNum(note.glucose_level)} unit=" mg/dL" />}
                                    {note.glasgow_scale && <Vital label="Glasgow" value={fmtNum(note.glasgow_scale)} />}
                                    {note.pain_scale !== null && note.pain_scale !== undefined && note.pain_scale !== '' && <Vital label="Dolor" value={fmtNum(note.pain_scale)} unit="/10" />}
                                </div>
                                {(note.consciousness_level || note.pupils || note.patient_status) && (
                                    <p className="pd-note-line">
                                        {note.consciousness_level && <><b>Conciencia:</b> {note.consciousness_level}. </>}
                                        {note.pupils && <><b>Pupilas:</b> {note.pupils}. </>}
                                        {note.patient_status && <><b>Estado:</b> {note.patient_status}.</>}
                                    </p>
                                )}
                                {note.initial_diagnosis && <p className="pd-note-line"><b>Diagnóstico:</b> {note.initial_diagnosis}</p>}
                                {note.treatment_applied && <p className="pd-note-line"><b>Tratamiento:</b> {note.treatment_applied}</p>}
                            </div>
                        ))}
                    </section>

                    {otherPatients.length > 0 && (
                        <section className="pd-card">
                            <h3>Otros pacientes de esta emergencia ({otherPatients.length})</h3>
                            <ul className="pd-list">
                                {otherPatients.map((op) => (
                                    <li key={op.emergency_patient_id}>
                                        <b>{[op.first_name, op.first_surname].filter(Boolean).join(' ') || 'Paciente no identificado'}</b>
                                        <span>{op.destination_institution_id
                                            ? (parseInt(op.destination_institution_id) === parseInt(user?.institutionId) ? 'También viene a tu institución' : 'Trasladado a otra institución')
                                            : 'Sin destino asignado todavía'}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section className="pd-card">
                        <h3>Emergencias anteriores</h3>
                        {history.length === 0 && <p className="pd-muted">Sin visitas anteriores registradas.</p>}
                        <ul className="pd-list">
                            {history.map((h) => (
                                <li key={h.emergency_id}><b>{h.type_name || 'Sin tipo'}</b><span>{formatDate(h.created_at)} · {h.status_name || 'Sin estado'}</span></li>
                            ))}
                        </ul>
                    </section>
                </div>

                <div className="pd-map">
                    {hasMapData ? (
                        <MapArea
                            ambulanceLocation={ambulanceLocation ? { ...ambulanceLocation, unitNumber: patient.unit_number, color: patient.triage_hex_color } : null}
                            emergencyLocation={patient.emergency_latitude ? { latitude: patient.emergency_latitude, longitude: patient.emergency_longitude } : null}
                            routeCoordinates={routeCoordinates}
                        />
                    ) : (
                        <p className="pd-muted pd-map-empty">Sin ubicación disponible todavía.</p>
                    )}
                </div>
            </div>
        </Modal>
    )
}

export default PatientDetailModal
