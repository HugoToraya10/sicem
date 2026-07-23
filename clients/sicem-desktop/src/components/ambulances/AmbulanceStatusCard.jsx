import { useState } from 'react'
import './AmbulanceStatusCard.css'

const AmbulanceStatusCard = ({ ambulance, statuses, onUpdateStatus }) => {
    const [selectedStatusId, setSelectedStatusId] = useState(ambulance.ambulance_status_id)
    const [saving, setSaving] = useState(false)

    const currentStatusName = statuses.find(s => s.ambulance_status_id === ambulance.ambulance_status_id)?.name || 'Desconocido'

    const handleUpdate = () => {
        if (parseInt(selectedStatusId) === parseInt(ambulance.ambulance_status_id)) return
        setSaving(true)
        onUpdateStatus(ambulance.ambulance_id, parseInt(selectedStatusId)).finally(() => setSaving(false))
    }

    return (
        <div className="ambulance-card">
            <h5>Unidad {ambulance.unit_number}</h5>
            <div className="ambulance-detail">Placa: {ambulance.license_plate}</div>
            <div className="ambulance-detail">Tipo: {ambulance.type_name}</div>
            <div className="ambulance-detail">Estado actual: <span className="ambulance-current-status">{currentStatusName}</span></div>

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
