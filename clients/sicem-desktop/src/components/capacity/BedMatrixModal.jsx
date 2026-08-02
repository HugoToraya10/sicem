import { useState } from 'react'
import './BedMatrixModal.css'

// Matriz visual de camillas: cada celda es una cama individual (no hay ID real
// por cama en la BD, solo el conteo — esto es una representación visual del
// conteo, las primeras `pendingAvailable` celdas se ven libres, el resto
// ocupadas). Ocupar/Desocupar cambian el conteo de a una en memoria; nada se
// manda al backend hasta "Confirmar cambios" — evita pegarle al servidor por
// cada click y permite cancelar sin dejar rastro.
const BedMatrixModal = ({ title, totalBeds, availableBeds, onConfirm, onClose, saving }) => {
    const [pendingAvailable, setPendingAvailable] = useState(availableBeds)

    const occupied = totalBeds - pendingAvailable
    const delta = pendingAvailable - availableBeds
    const hasChanges = delta !== 0

    const handleOcupar = () => {
        if (pendingAvailable > 0) setPendingAvailable((v) => v - 1)
    }
    const handleDesocupar = () => {
        if (pendingAvailable < totalBeds) setPendingAvailable((v) => v + 1)
    }

    return (
        <div className="bed-matrix-overlay" onClick={onClose}>
            <div className="bed-matrix-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bed-matrix-header">
                    <h3>{title}</h3>
                    <button className="bed-matrix-close" onClick={onClose} disabled={saving}>&times;</button>
                </div>

                <div className="bed-matrix-summary">
                    <span className="bed-matrix-available">{pendingAvailable} disponibles</span>
                    <span className="bed-matrix-occupied">{occupied} ocupadas</span>
                    <span className="bed-matrix-total">{totalBeds} totales</span>
                </div>

                <div className="bed-matrix-grid">
                    {totalBeds === 0 && <p className="empty-state">Sin camas registradas.</p>}
                    {Array.from({ length: totalBeds }, (_, i) => (
                        <div
                            key={i}
                            className={`bed-matrix-cell ${i < pendingAvailable ? 'bed-free' : 'bed-occupied'}`}
                            title={i < pendingAvailable ? 'Disponible' : 'Ocupada'}
                        />
                    ))}
                </div>

                <div className="bed-matrix-actions">
                    <button className="bed-matrix-btn occupy" onClick={handleOcupar} disabled={pendingAvailable === 0 || saving}>
                        Ocupar cama
                    </button>
                    <button className="bed-matrix-btn free" onClick={handleDesocupar} disabled={pendingAvailable === totalBeds || saving}>
                        Desocupar cama
                    </button>
                </div>

                {/* Siempre se renderiza (aunque no haya cambios) para reservar el
                    espacio de esta línea — si se monta/desmonta con hasChanges, el
                    modal "brinca" (los botones de abajo suben/bajan) cada vez que
                    pasas de 0 cambios a 1 o viceversa. En vez de eso, se oculta con
                    visibility (no display) para que el hueco no se me mueva. */}
                <p className={`bed-matrix-delta ${hasChanges ? (delta < 0 ? 'delta-occupied' : 'delta-freed') : 'delta-none'}`}>
                    {delta < 0
                        ? `Camas ocupadas: +${Math.abs(delta)}`
                        : `Camas desocupadas: +${Math.abs(delta)}`}
                </p>

                <div className="bed-matrix-footer">
                    <button className="bed-matrix-cancel" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button className="bed-matrix-confirm" onClick={() => onConfirm(pendingAvailable)} disabled={!hasChanges || saving}>
                        {saving ? 'Guardando...' : 'Confirmar cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default BedMatrixModal
