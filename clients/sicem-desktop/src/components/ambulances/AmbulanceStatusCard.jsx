import { useState } from 'react'
import './AmbulanceStatusCard.css'

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

const AmbulanceStatusCard = ({ ambulance, statuses, onUpdateStatus }) => {
    const [selectedStatusId, setSelectedStatusId] = useState(ambulance.ambulance_status_id)
    const [saving, setSaving] = useState(false)

    const currentStatusName = statuses.find(s => s.ambulance_status_id === ambulance.ambulance_status_id)?.name || 'Desconocido'
    const colorClass = STATUS_COLOR_CLASS[parseInt(ambulance.ambulance_status_id)] || 'status-unknown'

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
        </div>
    )
}

export default AmbulanceStatusCard
