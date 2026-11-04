import { useEffect, useRef, useState } from 'react'

// Campo con etiqueta visible (la etiqueta envuelve al control: se lee y se toca como una sola cosa).
export const Field = ({ label, hint, as = 'input', children, ...props }) => {
  const Control = as
  return (
    <label className="field">
      <span>{label}</span>
      <Control {...props}>{children}</Control>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export const PasswordField = ({ label = 'Contraseña', hint, ...props }) => {
  const [visible, setVisible] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <span className="pw">
        <input {...props} type={visible ? 'text' : 'password'} />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export const InstitutionSelect = ({ institutions, ...props }) => (
  <Field label="Institución de afiliación" as="select" {...props}>
    <option value="">Selecciona tu institución…</option>
    {institutions.map((i) => (
      <option key={i.institution_id} value={String(i.institution_id)}>{i.name}</option>
    ))}
  </Field>
)

// Aviso accesible: los errores se anuncian de inmediato (alert), los demás con calma (status).
export const Notice = ({ kind = 'info', children }) => (
  <div className={`notice notice-${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div>
)

export const Tabs = ({ tabs, value, onChange, label, sub = false }) => (
  <div className={`tabs${sub ? ' sub' : ''}`} role="tablist" aria-label={label}>
    {tabs.map((t) => (
      <button key={t.id} type="button" role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
        {t.label}
      </button>
    ))}
  </div>
)

export const ConfirmDialog = ({ title, message, confirmLabel = 'Confirmar', onConfirm, onCancel }) => {
  const confirmRef = useRef(null)
  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="dlg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
        <h2 id="dlg-title">{title}</h2>
        <p id="dlg-msg">{message}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
          <button type="button" ref={confirmRef} className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
