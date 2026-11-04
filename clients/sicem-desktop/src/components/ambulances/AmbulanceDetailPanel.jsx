import { Drawer } from '../ui/Overlay'
import { formatDateTime } from '../../utils/time'
import './AmbulanceDetailPanel.css'

// Horario de turnos del paramédico (shift_windows: un rango por día, 1 = lunes … 7 = domingo).
const WEEKDAY_LABELS = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
const formatSchedule = (shiftWindows) => {
    if (!shiftWindows || shiftWindows.length === 0) return 'Sin horario asignado'
    return shiftWindows.map((w) => `${WEEKDAY_LABELS[parseInt(w.day)] || w.day} ${w.start}-${w.end}`).join(' · ')
}

// ¿Debería estar de turno ahora? Mismo criterio que isWithinSchedule en services/unidades (cruza medianoche).
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

// Detalle de una unidad: ficha y tripulación. Un solo panel para las dos pantallas que lo usan.
const AmbulanceDetailPanel = ({ open, onClose, ambulance, statusName, institutionName, crew = [], onlineParamedicIds = new Set() }) => (
    <Drawer open={open} onClose={onClose} title={`Unidad ${ambulance.unit_number}`} subtitle={[ambulance.type_name, ambulance.license_plate].filter(Boolean).join(' · ')} size="sm">
        <section className="adp-section">
            <h3>Ficha</h3>
            <dl className="adp-facts">
                <div><dt>Placa</dt><dd className="mono">{ambulance.license_plate || '—'}</dd></div>
                <div><dt>Tipo</dt><dd>{ambulance.type_name || '—'}</dd></div>
                {statusName && <div><dt>Estado</dt><dd>{statusName}</dd></div>}
                <div><dt>Registro</dt><dd>{ambulance.is_active ? 'Activa' : 'Inactiva'}</dd></div>
                {institutionName && <div><dt>Institución</dt><dd>{institutionName}</dd></div>}
                <div><dt>Registrada</dt><dd>{ambulance.created_at ? formatDateTime(ambulance.created_at) : '—'}</dd></div>
            </dl>
        </section>
        <section className="adp-section">
            <h3>Tripulación <span className="adp-count">{crew.length}</span></h3>
            {crew.length === 0 ? (
                <p className="adp-empty">Sin paramédicos vinculados a esta unidad.</p>
            ) : (
                <ul className="adp-crew">
                    {crew.map((p) => {
                        const isOnline = onlineParamedicIds.has(String(p.user_profile_id))
                        return (
                            <li key={p.user_profile_id}>
                                <span className={`adp-dot${isOnline ? ' on' : ''}`} aria-hidden="true" />
                                <div>
                                    <b className={isOnScheduleNow(p.shift_windows) ? 'on-schedule' : ''}>{p.first_name} {p.first_surname}</b>
                                    <small>{formatSchedule(p.shift_windows)}</small>
                                </div>
                                {isOnline && <span className="adp-online">En línea</span>}
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    </Drawer>
)

export default AmbulanceDetailPanel
