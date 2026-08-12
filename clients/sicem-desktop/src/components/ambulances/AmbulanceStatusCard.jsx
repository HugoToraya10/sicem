import { useState } from 'react'
import './AmbulanceStatusCard.css'

// Formato legible del horario de turnos del paramédico (shift_windows: un
// rango de hora POR día, 1=lunes..7=domingo — mismo formato del resto del
// proyecto).
const WEEKDAY_LABELS = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
const formatSchedule = (shiftWindows) => {
    if (!shiftWindows || shiftWindows.length === 0) return 'Sin horario asignado'
    return shiftWindows
        .map((w) => `${WEEKDAY_LABELS[parseInt(w.day)] || w.day} ${w.start}-${w.end}`)
        .join(' · ')
}

// ¿Debería estar de turno AHORA? Mismo criterio que isWithinSchedule en
// services/unidades (rangos que cruzan medianoche incluidos).
const isOnScheduleNow = (shiftWindows) => {
    if (!shiftWindows || shiftWindows.length === 0) return false
    const now = new Date()
    const isoDay = now.getDay() === 0 ? 7 : now.getDay()
    const todayWindow = shiftWindows.find((w) => parseInt(w.day) === isoDay)
    if (!todayWindow) return false
    const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const start = toMinutes(todayWindow.start)
    const end = toMinutes(todayWindow.end)
    return start <= end ? (nowMinutes >= start && nowMinutes <= end) : (nowMinutes >= start || nowMinutes <= end)
}

// IDs fijos del catálogo ambulances_statuses (ver sicem_backup.sql) — se
// mapean a color aquí en vez de guardar un color en la base de datos,
// porque son 7 valores fijos que casi nunca cambian y así no hace falta
// tocar el backend solo para ajustar un color.
const STATUS_COLOR_CLASS = {
    1: 'status-available',   // Disponible
    2: 'status-enroute',     // En camino
    3: 'status-onscene',     // En escena
    4: 'status-transporting',// Trasladando
    5: 'status-outofservice',// Fuera de servicio
    6: 'status-maintenance', // En mantenimiento
    7: 'status-reserved',    // Reservada
}

const AmbulanceStatusCard = ({ ambulance, statuses, onUpdateStatus, crew = [], onlineParamedicIds = new Set(), institutionName, detailOpen, onToggleDetail }) => {
    const [selectedStatusId, setSelectedStatusId] = useState(ambulance.ambulance_status_id)
    const [saving, setSaving] = useState(false)

    const currentStatusName = statuses.find(s => s.ambulance_status_id === ambulance.ambulance_status_id)?.name || 'Desconocido'
    const colorClass = STATUS_COLOR_CLASS[parseInt(ambulance.ambulance_status_id)] || 'status-unknown'

    const crewForAmbulance = crew.filter((p) =>
        p.assigned_ambulance_id && String(p.assigned_ambulance_id) === String(ambulance.ambulance_id)
    )

    const handleUpdate = () => {
        if (parseInt(selectedStatusId) === parseInt(ambulance.ambulance_status_id)) return
        setSaving(true)
        onUpdateStatus(ambulance.ambulance_id, parseInt(selectedStatusId)).finally(() => setSaving(false))
    }

    return (
        <div className={`ambulance-card ${colorClass}`}>
            <h5>Unidad {ambulance.unit_number}</h5>
            <div className="ambulance-detail">Placa: {ambulance.license_plate}</div>
            <div className="ambulance-detail">Tipo: {ambulance.type_name}</div>
            <div className="ambulance-detail">
                Estado actual: <span className={`ambulance-status-badge ${colorClass}`}>{currentStatusName}</span>
            </div>

            <div className="ambulance-status-row">
                <select value={selectedStatusId} onChange={(e) => setSelectedStatusId(e.target.value)} disabled={saving}>
                    {statuses.map((s) => (
                        <option key={s.ambulance_status_id} value={s.ambulance_status_id}>{s.name}</option>
                    ))}
                </select>
                <button className="update-btn" onClick={handleUpdate} disabled={saving}>
                    {saving ? 'Actualizando...' : 'Actualizar estado'}
                </button>
            </div>

            <button className="detail-btn" onClick={onToggleDetail}>Ver detalle</button>

            {detailOpen && (
                <div className="modal-backdrop" onClick={onToggleDetail}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Unidad {ambulance.unit_number}</span>
                            <button className="modal-close" onClick={onToggleDetail} title="Cerrar">×</button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-panel-title">Detalle de la unidad</div>
                            <div className="ambulance-detail">Placa: {ambulance.license_plate}</div>
                            <div className="ambulance-detail">Tipo: {ambulance.type_name}</div>
                            <div className="ambulance-detail">Estado: {currentStatusName}</div>
                            <div className="ambulance-detail">Institución: {institutionName || `#${ambulance.institution_id}`}</div>
                            <div className="ambulance-detail">Activa: {ambulance.is_active ? 'Sí' : 'No'}</div>
                            <div className="ambulance-detail">ID interno: {ambulance.ambulance_id}</div>
                            <div className="ambulance-detail">
                                Registrada: {ambulance.created_at ? new Date(ambulance.created_at).toLocaleString('es-MX') : '—'}
                            </div>

                            <div className="detail-panel-title">Tripulación</div>
                            {crewForAmbulance.length === 0 ? (
                                <div className="ambulance-crew-empty">Sin paramédicos vinculados a esta unidad.</div>
                            ) : (
                                crewForAmbulance.map((p) => {
                                    const isOnline = onlineParamedicIds.has(String(p.user_profile_id))
                                    return (
                                        <div key={p.user_profile_id} className="ambulance-crew-row">
                                            {isOnline && <span className="crew-online-dot" title="En línea ahora mismo" />}
                                            <span className={`crew-name ${isOnScheduleNow(p.shift_windows) ? 'crew-on-schedule' : ''}`}>
                                                {p.first_name} {p.first_surname}
                                            </span>
                                            <span className="crew-schedule">{formatSchedule(p.shift_windows)}</span>
                                            {isOnline && <span className="crew-online-label">En línea</span>}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AmbulanceStatusCard
