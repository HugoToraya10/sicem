import { useCallback, useEffect, useRef, useState } from 'react'
import { DialogsContext } from './useDialogs'
import Icon from '../components/ui/Icon'
import { Modal } from '../components/ui/Overlay'
import './DialogsContext.css'

const TOAST_MS = { info: 5000, ok: 4000, error: 8000 }

// Avisos (toast), confirmaciones y preguntas de texto con el estilo del sistema. Ver useDialogs.js.
// Las confirmaciones y las preguntas usan el mismo <Modal> que el resto de la app: mismo foco, mismo Esc, mismo aspecto.
export const DialogsProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])
    const [dialog, setDialog] = useState(null)
    const [answer, setAnswer] = useState('')
    const resolveRef = useRef(null)

    const dismiss = useCallback((id) => setToasts((current) => current.filter((t) => t.id !== id)), [])

    const notify = useCallback((message, tone = 'info') => {
        const id = Date.now() + Math.random()
        setToasts((current) => [...current.slice(-3), { id, message: String(message), tone }])
        setTimeout(() => dismiss(id), TOAST_MS[tone] || 5000)
    }, [dismiss])

    // Permite avisar desde utilidades que no son componentes (por ejemplo, la revisión de duplicados).
    useEffect(() => {
        const onNotify = (e) => notify(e.detail?.message || '', e.detail?.tone || 'info')
        window.addEventListener('sicem:notify', onNotify)
        return () => window.removeEventListener('sicem:notify', onNotify)
    }, [notify])

    const confirm = useCallback((options) => new Promise((resolve) => {
        resolveRef.current = resolve
        setDialog({ kind: 'confirm', title: 'Confirmar', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', danger: false, ...options })
    }), [])

    // prompt({ title, message, label, confirmLabel, required, multiline, placeholder, danger }) -> Promise<string | null>
    const prompt = useCallback((options) => new Promise((resolve) => {
        resolveRef.current = resolve
        setAnswer(options?.defaultValue || '')
        setDialog({ kind: 'prompt', title: 'Escribe un dato', confirmLabel: 'Aceptar', cancelLabel: 'Cancelar', danger: false, required: false, multiline: true, ...options })
    }), [])

    const close = (result) => {
        resolveRef.current?.(result)
        resolveRef.current = null
        setDialog(null)
    }

    const isPrompt = dialog?.kind === 'prompt'
    const canSubmit = !isPrompt || !dialog.required || answer.trim().length > 0
    const submit = () => { if (canSubmit) close(isPrompt ? answer.trim() : true) }

    return (
        <DialogsContext.Provider value={{ notify, confirm, prompt }}>
            {children}

            <div className="toast-region" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.tone}`}>
                        <Icon name={t.tone === 'ok' ? 'check' : t.tone === 'error' ? 'alert' : 'bell'} size={16} />
                        <span>{t.message}</span>
                        <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso"><Icon name="x" size={14} /></button>
                    </div>
                ))}
            </div>

            <Modal
                open={Boolean(dialog)}
                onClose={() => close(isPrompt ? null : false)}
                size="sm"
                tone={dialog?.danger ? 'danger' : undefined}
                title={dialog?.title}
                subtitle={isPrompt ? dialog?.message : undefined}
                footer={dialog && (
                    <>
                        <button type="button" className="btn" onClick={() => close(isPrompt ? null : false)}>{dialog.cancelLabel}</button>
                        <button
                            type="button"
                            data-autofocus={isPrompt ? undefined : true}
                            className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                            onClick={submit}
                            disabled={!canSubmit}
                        >
                            {dialog.confirmLabel}
                        </button>
                    </>
                )}
            >
                {dialog && !isPrompt && <p className="dlg-message">{dialog.message}</p>}
                {isPrompt && (
                    <div className="dlg-field">
                        {dialog.label && <label htmlFor="dlg-answer">{dialog.label}</label>}
                        {dialog.multiline
                            ? <textarea id="dlg-answer" rows={3} value={answer} maxLength={300} placeholder={dialog.placeholder} onChange={(e) => setAnswer(e.target.value)} />
                            : <input id="dlg-answer" type="text" value={answer} maxLength={150} placeholder={dialog.placeholder} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />}
                    </div>
                )}
            </Modal>
        </DialogsContext.Provider>
    )
}
