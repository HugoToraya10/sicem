import { useState } from 'react'
import './AmbulanceAdminCard.css'
import AmbulanceDetailPanel from '../ambulances/AmbulanceDetailPanel'

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
                        <h2>Unidad {ambulance.unit_number}</h2>
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

            <AmbulanceDetailPanel
                open={Boolean(detailOpen)}
                onClose={onToggleDetail}
                ambulance={ambulance}
                statusName={ambulance.status_name}
                crew={crewForAmbulance}
                onlineParamedicIds={onlineParamedicIds}
            />
        </div>
    )
}

export default AmbulanceAdminCard
