import { useCallback, useEffect, useState } from 'react'
import { toLowerCaseKeys } from '../utils/formatData'
import { formatDate, toDateInput, todayInput } from '../utils/dates'
import { Field, Notice, ConfirmDialog } from '../components/ui'

// Alergias, condiciones y medicamentos son la misma pantalla con distintos campos y rutas.
export const KINDS = {
  allergies: {
    title: 'Alergias', singular: 'alergia', article: 'la', addLabel: 'Agregar alergia',
    lead: 'Anota todo lo que te causa reacción: medicamentos, alimentos, picaduras, látex. Es lo que más se revisa en una emergencia.',
    list: '/pacientes/alergias/0', listKey: 'allergies', create: '/pacientes/registrar-alergia',
    update: '/pacientes/actualizar-alergia', toggle: '/pacientes/alternar-alergia',
    idField: 'patient_allergy_id', idParam: 'patientAllergyId',
    empty: { name: '', severity: '' },
    fields: [
      { key: 'name', label: 'Nombre', maxLength: 150, required: true },
      { key: 'severity', label: 'Qué tan grave es', maxLength: 50, hint: 'Por ejemplo: leve, moderada, anafilaxia.' },
    ],
    details: (it) => [it.severity ? `Gravedad: ${it.severity}` : ''],
    toForm: (it) => ({ name: it.name || '', severity: it.severity || '' }),
  },
  conditions: {
    title: 'Condiciones médicas', singular: 'condición', article: 'la', addLabel: 'Agregar condición',
    lead: 'Enfermedades crónicas o diagnósticos importantes: diabetes, hipertensión, epilepsia, asma.',
    list: '/pacientes/condiciones/0', listKey: 'conditions', create: '/pacientes/registrar-condicion',
    update: '/pacientes/actualizar-condicion', toggle: '/pacientes/alternar-condicion',
    idField: 'patient_condition_id', idParam: 'patientConditionId',
    empty: { name: '', diagnosedAt: '', notes: '' },
    fields: [
      { key: 'name', label: 'Nombre', maxLength: 150, required: true },
      { key: 'diagnosedAt', label: 'Fecha de diagnóstico', type: 'date', max: todayInput() },
      { key: 'notes', label: 'Notas', maxLength: 300 },
    ],
    details: (it) => [it.diagnosed_at ? `Diagnóstico: ${formatDate(it.diagnosed_at)}` : '', it.notes || ''],
    toForm: (it) => ({ name: it.name || '', diagnosedAt: toDateInput(it.diagnosed_at), notes: it.notes || '' }),
  },
  medications: {
    title: 'Medicamentos', singular: 'medicamento', article: 'el', addLabel: 'Agregar medicamento',
    lead: 'Lo que tomas de manera regular. Evita interacciones peligrosas si te tienen que dar algo en una emergencia.',
    list: '/pacientes/medicamentos/0', listKey: 'medications', create: '/pacientes/registrar-medicacion',
    update: '/pacientes/actualizar-medicacion', toggle: '/pacientes/alternar-medicacion',
    idField: 'patient_medication_id', idParam: 'patientMedicationId',
    empty: { name: '', dosage: '', frequency: '' },
    fields: [
      { key: 'name', label: 'Nombre', maxLength: 150, required: true },
      { key: 'dosage', label: 'Dosis', maxLength: 100, hint: 'Por ejemplo: 500 mg.' },
      { key: 'frequency', label: 'Frecuencia', maxLength: 100, hint: 'Por ejemplo: cada 8 horas.' },
    ],
    details: (it) => [it.dosage ? `Dosis: ${it.dosage}` : '', it.frequency ? `Frecuencia: ${it.frequency}` : ''],
    toForm: (it) => ({ name: it.name || '', dosage: it.dosage || '', frequency: it.frequency || '' }),
  },
}

const ClinicalList = ({ call, kind, hasEce, onChanged, onNavigate }) => {
  const cfg = KINDS[kind]
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(cfg.empty)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(null)

  const load = useCallback(async () => {
    const { ok, data } = await call(cfg.list)
    if (ok) setItems((data[cfg.listKey] || []).map(toLowerCaseKeys))
    else { setItems([]); setNotice({ kind: 'err', text: data.message || 'No pudimos cargar la lista.' }) }
  }, [call, cfg])

  useEffect(() => { if (hasEce) load(); else setItems([]) }, [hasEce, load])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const reset = () => { setEditingId(null); setForm(cfg.empty) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNotice(null)
    setSaving(true)
    const { ok, data } = editingId
      ? await call(cfg.update, { method: 'PATCH', body: { [cfg.idParam]: editingId, ...form } })
      : await call(cfg.create, { method: 'POST', body: form })
    setSaving(false)
    if (ok) {
      setNotice({ kind: 'ok', text: editingId ? 'Cambios guardados.' : `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} agregad${cfg.singular === 'medicamento' ? 'o' : 'a'}.` })
      reset()
      load()
      onChanged?.()
    } else setNotice({ kind: 'err', text: data.message || 'No se pudo guardar.' })
  }

  const doToggle = async (item) => {
    setConfirming(null)
    const { ok, data } = await call(cfg.toggle, { method: 'PATCH', body: { [cfg.idParam]: item[cfg.idField] } })
    if (ok && data.message) { setNotice({ kind: 'ok', text: data.message }); load(); onChanged?.() }
    else setNotice({ kind: 'err', text: data.message || 'No se pudo cambiar el estado.' })
  }

  const handleToggle = (item) => (item.is_active ? setConfirming(item) : doToggle(item))

  return (
    <div>
      <h1 className="view-title">{cfg.title}</h1>
      <p className="view-lead">{cfg.lead}</p>

      {!hasEce ? (
        <Notice kind="info">Primero crea tu expediente en «Datos generales»; después podrás agregar {cfg.title.toLowerCase()}. {onNavigate && <button type="button" className="btn-inline" onClick={() => onNavigate('general')}>Ir a Datos generales</button>}</Notice>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          {cfg.fields.map((f) => (
            <Field key={f.key} label={f.label} type={f.type || 'text'} max={f.max} value={form[f.key]} onChange={set(f.key)} maxLength={f.maxLength} required={f.required} hint={f.hint} />
          ))}
          {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : cfg.addLabel}</button>
            {editingId && <button className="btn" type="button" onClick={() => { reset(); setNotice(null) }}>Cancelar</button>}
          </div>
        </form>
      )}

      {hasEce && items && (
        items.length === 0 ? (
          <p className="empty">Aún no registras ninguna. Si no tienes, no necesitas agregar nada.</p>
        ) : (
          <ul className="items" aria-label={cfg.title}>
            {items.map((it) => (
              <li key={it[cfg.idField]} className={`item${it.is_active ? '' : ' off'}`}>
                <div className="item-text">
                  <strong>{it.name} {!it.is_active && <span className="chip">Desactivado</span>}</strong>
                  {cfg.details(it).filter(Boolean).map((line) => <span key={line}>{line}</span>)}
                </div>
                <div className="item-actions">
                  <button type="button" className="btn btn-sm" aria-label={`Editar ${it.name}`} onClick={() => { setEditingId(it[cfg.idField]); setForm(cfg.toForm(it)); setNotice(null) }}>Editar</button>
                  <button type="button" className="btn btn-sm btn-link" aria-label={`${it.is_active ? 'Desactivar' : 'Activar'} ${it.name}`} onClick={() => handleToggle(it)}>
                    {it.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {confirming && (
        <ConfirmDialog
          title={`Desactivar ${cfg.singular}`}
          message={`«${confirming.name}» dejará de mostrarse al personal médico. Puedes volver a activarla cuando quieras.`}
          confirmLabel="Desactivar"
          onConfirm={() => doToggle(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

export default ClinicalList
