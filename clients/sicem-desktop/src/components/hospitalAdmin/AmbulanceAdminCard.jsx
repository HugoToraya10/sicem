import { useState } from 'react'
import './AmbulanceAdminCard.css'

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

const AmbulanceAdminCard = ({ ambulance, types, onUpdate, onToggleActive, crew = [], onlineParamedicIds = new Set(), detailOpen, onToggleDetail }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [form, setForm] = useState({
        unitNumber: ambulance.unit_number,
        licensePlate: ambulance.license_plate,
        ambulanceTypeId: ambulance.ambulance_type_id,
    })
    const [saving, setSaving] = useState(false)

    const handleStartEdit = () => {
        setForm({
            unitNumber: ambulance.unit_number,
            licensePlate: ambulance.license_plate,
            ambulanceTypeId: ambulance.ambulance_type_id,
        })
        setIsEditing(true)
    }

    const handleSave = () => {
        setSaving(true)
        onUpdate(ambulance.ambulance_id, form)
            .then(() => setIsEditing(false))
            .finally(() => setSaving(false))
    }

    const crewForAmbulance = crew.filter((p) =>
        p.assigned_ambulance_id && String(p.assigned_ambulance_id) === String(ambulance.ambulance_id)
    )

    return (
        <div className={`ambulance-admin-card ${ambulance.is_active ? '' : 'ambulance-admin-card-inactive'}`}>
            {isEditing ? (
                <div className="ambulance-admin-edit-form">
                    <label>Número de unidad</label>
                    <input type="text" value={form.unitNumber} onChange={(e) => setForm(p => ({ ...p, unitNumber: e.target.value }))} maxLength={8} disabled={saving} />
                    <label>Placa</label>
                    <input type="text" value={form.licensePlate} onChange={(e) => setForm(p => ({ ...p, licensePlate: e.target.value }))} maxLength={9} disabled={saving} />
                    <label>Tipo</label>
                    <select value={form.ambulanceTypeId} onChange={(e) => setForm(p => ({ ...p, ambulanceTypeId: e.target.value }))} disabled={saving}>
                        {types.map((t) => (
                            <option key={t.ambulance_type_id} value={t.ambulance_type_id}>{t.ambulance_type}</option>
                        ))}
                    </select>
                    <div className="ambulance-admin-edit-actions">
                        <button className="aa-btn save" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                        <button className="aa-btn cancel" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="ambulance-admin-header">
                        <h5>Unidad {ambulance.unit_number}</h5>
                        <span className={`ambulance-admin-status ${ambulance.is_active ? 'status-active' : 'status-inactive'}`}>
                            {ambulance.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    <div className="ambulance-admin-detail">Placa: {ambulance.license_plate}</div>
                    <div className="ambulance-admin-detail">Tipo: {ambulance.type_name}</div>

                    <div className="ambulance-admin-actions">
                        <button className="aa-btn" onClick={handleStartEdit}>Editar</button>
                        <button className="aa-btn" onClick={() => onToggleActive(ambulance)}>
                            {ambulance.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="aa-btn" onClick={onToggleDetail}>Ver detalle</button>
                    </div>
                </>
            )}

            {detailOpen && (
                <div className="modal-backdrop" onClick={onToggleDetail}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Unidad {ambulance.unit_number}</span>
                            <button className="modal-close" onClick={onToggleDetail} title="Cerrar">×</button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-panel-title">Detalle de la unidad</div>
                            <div className="ambulance-admin-detail">Placa: {ambulance.license_plate}</div>
                            <div className="ambulance-admin-detail">Tipo: {ambulance.type_name}</div>
                            <div className="ambulance-admin-detail">Estado: {ambulance.is_active ? 'Activa' : 'Inactiva'}</div>
                            <div className="ambulance-admin-detail">ID interno: {ambulance.ambulance_id}</div>
                            <div className="ambulance-admin-detail">
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

export default AmbulanceAdminCard
