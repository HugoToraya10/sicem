import { useState } from 'react'
import './SpecialtyCapacityCard.css'

const getFillLevel = (occupiedPercent) => {
    if (occupiedPercent >= 70) return 'high'
    if (occupiedPercent >= 40) return 'mid'
    return 'low'
}

const SpecialtyCapacityCard = ({ specialty, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [inputValue, setInputValue] = useState(specialty.available_beds)
    const [saving, setSaving] = useState(false)

    const occupied = specialty.total_beds - specialty.available_beds
    const occupiedPercent = specialty.total_beds > 0
        ? Math.round((occupied / specialty.total_beds) * 100)
        : 0

    const handleStartEdit = () => {
        setInputValue(specialty.available_beds)
        setIsEditing(true)
    }

    const handleSave = () => {
        const parsed = parseInt(inputValue)
        if (isNaN(parsed) || parsed < 0 || parsed > specialty.total_beds) {
            alert(`Ingresa un número entre 0 y ${specialty.total_beds} (capacidad total de la especialidad).`)
            return
        }
        setSaving(true)
        onUpdate(specialty.institution_speciality_id, parsed)
            .then(() => setIsEditing(false))
            .finally(() => setSaving(false))
    }

    return (
        <div className="capacity-card">
            <h5>{specialty.name}</h5>
            <div className="capacity-numbers">
                <div className="cn-item">
                    <div className="cn-num available">{specialty.available_beds}</div>
                    <div className="cn-label">Disponibles</div>
                </div>
                <div className="cn-item">
                    <div className="cn-num occupied">{occupied}</div>
                    <div className="cn-label">Ocupadas</div>
                </div>
                <div className="cn-item">
                    <div className="cn-num">{specialty.total_beds}</div>
                    <div className="cn-label">Total</div>
                </div>
            </div>
            <div className="progress-bar">
                <div
                    className={`progress-fill ${getFillLevel(occupiedPercent)}`}
                    style={{ width: `${occupiedPercent}%` }}
                />
            </div>

            {isEditing ? (
                <div className="capacity-edit-row">
                    <input
                        type="number"
                        min="0"
                        max={specialty.total_beds}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={saving}
                    />
                    <button className="update-btn save" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button className="update-btn cancel" onClick={() => setIsEditing(false)} disabled={saving}>
                        Cancelar
                    </button>
                </div>
            ) : (
                <button className="update-btn" onClick={handleStartEdit}>Actualizar disponibilidad</button>
            )}
        </div>
    )
}

export default SpecialtyCapacityCard