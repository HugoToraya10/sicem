import { useState } from 'react'
import './RejectReasonModal.css'

// Reemplaza a window.prompt() — Electron no soporta ese diálogo nativo de
// forma confiable (se cierra devolviendo null de inmediato sin mostrar nada
// en algunos empaquetados), lo que hacía que rechazar pareciera no hacer
// nada. Este es un modal propio, mismo patrón visual que el resto de la app.
const RejectReasonModal = ({
    onConfirm,
    onCancel,
    title = 'Motivo de rechazo',
    message = '¿Por qué rechazas a este paciente? (sin camas, sin la especialidad, etc.) El despachador tendrá que reasignarlo a otro hospital.',
}) => {
    const [reason, setReason] = useState('')

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="reject-reason-box" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    rows={3}
                    autoFocus
                    placeholder="Motivo (opcional)"
                />
                <div className="reject-reason-actions">
                    <button className="btn-reject" onClick={() => onConfirm(reason)}>Confirmar rechazo</button>
                    <button className="btn-cancel-reject" onClick={onCancel}>Cancelar</button>
                </div>
            </div>
        </div>
    )
}

export default RejectReasonModal
