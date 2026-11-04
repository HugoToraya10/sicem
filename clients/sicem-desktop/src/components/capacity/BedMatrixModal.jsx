import { useState } from 'react'
import { Modal } from '../ui/Overlay'
import './BedMatrixModal.css'

// Matriz visual de camas. No hay ID por cama en la base de datos, solo el conteo: cada cuadro es una cama
// y las primeras `pendingAvailable` se ven libres. Tocar un cuadro fija cuántas hay libres; los botones
// − y + ajustan de una en una. Nada se manda al servidor hasta "Confirmar cambios".
const BedMatrixModal = ({ title, totalBeds, availableBeds, onConfirm, onClose, saving }) => {
    const [pendingAvailable, setPendingAvailable] = useState(availableBeds)

    const occupied = totalBeds - pendingAvailable
    const delta = pendingAvailable - availableBeds
    const hasChanges = delta !== 0
    const pct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0

    const changeText = !hasChanges
        ? 'Sin cambios todavía.'
        : delta < 0
            ? `Vas a marcar ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'cama más' : 'camas más'} como ocupada${Math.abs(delta) === 1 ? '' : 's'}.`
            : `Vas a liberar ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'cama' : 'camas'}.`

    return (
        <Modal
            open
            onClose={() => { if (!saving) onClose() }}
            title={title}
            subtitle="Toca una cama para ajustar cuántas están libres."
            size="md"
            footer={(
                <>
                    <span className={`bm-change${hasChanges ? ' on' : ''}`} role="status">{changeText}</span>
                    <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={() => onConfirm(pendingAvailable)} disabled={!hasChanges || saving}>
                        {saving ? 'Guardando…' : 'Confirmar cambios'}
                    </button>
                </>
            )}
        >
            <div className="bm-top">
                <div className="bm-stepper" role="group" aria-label="Camas libres">
                    <button type="button" className="bm-step" onClick={() => setPendingAvailable((v) => Math.max(0, v - 1))} disabled={pendingAvailable === 0 || saving} aria-label="Una cama libre menos (ocupar)">−</button>
                    <div className="bm-count" aria-live="polite">
                        <b>{pendingAvailable}</b>
                        <span>libres de {totalBeds}</span>
                    </div>
                    <button type="button" className="bm-step" onClick={() => setPendingAvailable((v) => Math.min(totalBeds, v + 1))} disabled={pendingAvailable === totalBeds || saving} aria-label="Una cama libre más (liberar)">+</button>
                </div>
                <div className="bm-occ">
                    <div className="bm-bar" role="img" aria-label={`${pct}% de ocupación`}><span style={{ width: `${pct}%` }} /></div>
                    <p>{occupied} ocupadas · {pct}% de ocupación</p>
                </div>
            </div>

            {totalBeds === 0 ? (
                <p className="bm-empty">Esta unidad no tiene camas registradas.</p>
            ) : (
                <div className="bm-grid" role="group" aria-label="Camas">
                    {Array.from({ length: totalBeds }, (_, i) => {
                        const free = i < pendingAvailable
                        return (
                            <button
                                key={i}
                                type="button"
                                className={`bm-cell ${free ? 'free' : 'occ'}`}
                                disabled={saving}
                                aria-label={`Cama ${i + 1}: ${free ? 'libre' : 'ocupada'}. Tocar para dejar ${free ? i : i + 1} libres`}
                                title={free ? 'Libre' : 'Ocupada'}
                                // Tocar una libre la ocupa (y todas las de su derecha); tocar una ocupada la libera hasta ahí.
                                onClick={() => setPendingAvailable(free ? i : i + 1)}
                            />
                        )
                    })}
                </div>
            )}
            <div className="bm-legend"><span className="free">Libre</span><span className="occ">Ocupada</span></div>
        </Modal>
    )
}

export default BedMatrixModal
