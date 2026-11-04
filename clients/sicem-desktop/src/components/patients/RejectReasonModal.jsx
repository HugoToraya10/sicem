import { useState } from 'react'
import { Modal } from '../ui/Overlay'
import './RejectReasonModal.css'

// Reemplaza a window.prompt(): Electron no lo soporta de forma confiable. Es un diálogo propio, con los
// motivos más comunes a un clic para que rechazar sea rápido, y el texto libre para el caso que no esté.
const QUICK_REASONS = ['Sin camas disponibles', 'No tenemos la especialidad', 'Sin personal suficiente', 'Fuera de nuestra capacidad']

const RejectReasonModal = ({
    onConfirm,
    onCancel,
    title = 'Motivo de rechazo',
    message = 'El despachador tendrá que reasignar al paciente a otro hospital. Dile por qué no puedes recibirlo.',
}) => {
    const [reason, setReason] = useState('')

    return (
        <Modal
            open
            onClose={onCancel}
            title={title}
            subtitle={message}
            size="sm"
            tone="danger"
            footer={(
                <>
                    <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
                    <button type="button" className="btn btn-danger" onClick={() => onConfirm(reason.trim())}>Confirmar rechazo</button>
                </>
            )}
        >
            <div className="reject-quick" role="group" aria-label="Motivos frecuentes">
                {QUICK_REASONS.map((r) => (
                    <button key={r} type="button" className={`reject-chip${reason === r ? ' on' : ''}`} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
                ))}
            </div>
            <label htmlFor="reject-reason" className="reject-label">Motivo <span className="reject-optional">(opcional, lo verá el despachador)</span></label>
            <textarea
                id="reject-reason"
                className="reject-text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                rows={3}
                data-autofocus
            />
            <p className="reject-count">{reason.length}/300</p>
        </Modal>
    )
}

export default RejectReasonModal
