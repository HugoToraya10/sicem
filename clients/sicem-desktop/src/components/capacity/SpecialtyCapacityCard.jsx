import { useState } from 'react'
import BedMatrixModal from './BedMatrixModal'
import './SpecialtyCapacityCard.css'

const getFillLevel = (occupiedPercent) => {
    if (occupiedPercent >= 70) return 'high'
    if (occupiedPercent >= 40) return 'mid'
    return 'low'
}

const SpecialtyCapacityCard = ({ specialty, onUpdate }) => {
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const occupied = specialty.total_beds - specialty.available_beds
    const occupiedPercent = specialty.total_beds > 0
        ? Math.round((occupied / specialty.total_beds) * 100)
        : 0

    const handleConfirm = (newAvailable) => {
        setSaving(true)
        onUpdate(specialty.institution_speciality_id, newAvailable)
            .then(() => setModalOpen(false))
            .finally(() => setSaving(false))
    }

    return (
        <div className="capacity-card">
            <h3>{specialty.name}</h3>
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
            <div className="progress-bar" role="img" aria-label={`${occupiedPercent}% ocupado`}>
                <div
                    className={`progress-fill ${getFillLevel(occupiedPercent)}`}
                    style={{ width: `${occupiedPercent}%` }}
                />
            </div>

            <button type="button" className="btn" onClick={() => setModalOpen(true)}>Gestionar camas</button>

            {modalOpen && (
                <BedMatrixModal
                    title={specialty.name}
                    totalBeds={specialty.total_beds}
                    availableBeds={specialty.available_beds}
                    saving={saving}
                    onConfirm={handleConfirm}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </div>
    )
}

export default SpecialtyCapacityCard
