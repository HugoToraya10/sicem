import { useState } from 'react'
import './SpecialityAdminCard.css'

const SpecialityAdminCard = ({ speciality, onUpdateCapacity, onToggleActive }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [inputValue, setInputValue] = useState(speciality.total_beds)
    const [saving, setSaving] = useState(false)

    const handleStartEdit = () => {
        setInputValue(speciality.total_beds)
        setIsEditing(true)
    }

    const handleSave = () => {
        const parsed = parseInt(inputValue)
        if (isNaN(parsed) || parsed < speciality.available_beds) {
            alert(`La capacidad total no puede ser menor que las camas disponibles actuales (${speciality.available_beds}).`)
            return
        }
        setSaving(true)
        onUpdateCapacity(speciality.institution_speciality_id, parsed)
            .then(() => setIsEditing(false))
            .finally(() => setSaving(false))
    }

    return (
        <div className={`speciality-admin-card ${speciality.is_active ? '' : 'speciality-admin-card-inactive'}`}>
            <div className="speciality-admin-header">
                <h5>{speciality.name}</h5>
                <span className={`speciality-admin-status ${speciality.is_active ? 'status-active' : 'status-inactive'}`}>
                    {speciality.is_active ? 'Activa' : 'Inactiva'}
                </span>
            </div>

            <div className="speciality-admin-numbers">
                <div className="sa-item">
                    <div className="sa-num">{speciality.available_beds}</div>
                    <div className="sa-label">Disponibles</div>
                </div>
                <div className="sa-item">
                    <div className="sa-num">{speciality.total_beds}</div>
                    <div className="sa-label">Capacidad total</div>
                </div>
            </div>
            <p className="speciality-admin-hint">Las camas disponibles se editan desde Capacidad.</p>

            {isEditing ? (
                <div className="speciality-admin-edit-row">
                    <input
                        type="number"
                        min={speciality.available_beds}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={saving}
                    />
                    <button className="sa-btn save" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button className="sa-btn cancel" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar</button>
                </div>
            ) : (
                <div className="speciality-admin-actions">
                    <button className="sa-btn" onClick={handleStartEdit}>Editar capacidad total</button>
                    <button className="sa-btn" onClick={() => onToggleActive(speciality)}>
                        {speciality.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default SpecialityAdminCard
