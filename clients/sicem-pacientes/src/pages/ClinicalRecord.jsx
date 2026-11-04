import { useEffect, useState } from 'react'
import { toLowerCaseKeys } from '../utils/formatData'
import { Field, Notice } from '../components/ui'

const emptyEce = { bloodTypeId: '', weight: '', height: '', gender: '', birthplace: '', maritalStatus: '', occupation: '', religion: '', notes: '' }

// Datos generales del expediente clínico (ECE). Crear el expediente habilita alergias, condiciones y medicamentos.
const ClinicalRecord = ({ call, profileId, hasEce, onSaved }) => {
  const [form, setForm] = useState(emptyEce)
  const [bloodTypes, setBloodTypes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([call('/pacientes/tipos-sangre'), call(`/pacientes/ece/${profileId}`)]).then(([blood, ece]) => {
      if (cancelled) return
      setBloodTypes((blood.data.bloodTypes || []).map(toLowerCaseKeys))
      const raw = ece.data.clinicalRecord?.[0]
      const rec = raw ? toLowerCaseKeys(raw) : null
      if (rec) {
        setForm({
          bloodTypeId: rec.blood_type_id ? String(rec.blood_type_id) : '', weight: rec.weight ?? '', height: rec.height ?? '',
          gender: rec.gender || '', birthplace: rec.birthplace || '', maritalStatus: rec.marital_status || '',
          occupation: rec.occupation || '', religion: rec.religion || '', notes: rec.notes || '',
        })
      }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [call, profileId])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setNotice(null)
    setSaving(true)
    const { ok, data } = await call(hasEce ? '/pacientes/actualizar-ece' : '/pacientes/crear-ece', {
      method: hasEce ? 'PATCH' : 'POST',
      body: {
        userProfileId: profileId, bloodTypeId: form.bloodTypeId || null, weight: form.weight || null, height: form.height || null,
        gender: form.gender || null, birthplace: form.birthplace || null, maritalStatus: form.maritalStatus || null,
        occupation: form.occupation || null, religion: form.religion || null, notes: form.notes || null,
      },
    })
    setSaving(false)
    if (ok) { setNotice({ kind: 'ok', text: hasEce ? 'Expediente actualizado.' : 'Expediente creado. Ya puedes agregar alergias, condiciones y medicamentos.' }); onSaved() }
    else setNotice({ kind: 'err', text: data.message || 'No se pudo guardar el expediente.' })
  }

  if (!loaded) return <p className="empty" role="status">Cargando tu expediente…</p>

  return (
    <form className="form" onSubmit={handleSave}>
      {!hasEce && <Notice kind="info">Todavía no tienes expediente. Llena lo que sepas y guárdalo: es lo primero que verá el personal de emergencias.</Notice>}
      <Field label="Tipo de sangre" as="select" value={form.bloodTypeId} onChange={set('bloodTypeId')}>
        <option value="">No lo sé</option>
        {bloodTypes.map((b) => <option key={b.blood_type_id} value={String(b.blood_type_id)}>{b.blood_type}</option>)}
      </Field>
      <div className="grid-2">
        <Field label="Peso (kg)" type="number" inputMode="decimal" step="0.01" min="0" max="500" value={form.weight} onChange={set('weight')} />
        <Field label="Estatura (m)" type="number" inputMode="decimal" step="0.01" min="0" max="2.7" value={form.height} onChange={set('height')} hint="Por ejemplo, 1.68" />
        <Field label="Género" value={form.gender} onChange={set('gender')} maxLength={20} />
        <Field label="Estado civil" value={form.maritalStatus} onChange={set('maritalStatus')} maxLength={20} />
        <Field label="Lugar de nacimiento" value={form.birthplace} onChange={set('birthplace')} maxLength={100} />
        <Field label="Ocupación" value={form.occupation} onChange={set('occupation')} maxLength={100} />
      </div>
      <Field label="Religión (opcional)" value={form.religion} onChange={set('religion')} maxLength={100} />
      <Field label="Notas para el personal médico" as="textarea" rows={3} value={form.notes} onChange={set('notes')} maxLength={500} hint="Por ejemplo: usa marcapasos, no acepta transfusiones." />
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : hasEce ? 'Guardar expediente' : 'Crear expediente'}</button>
      </div>
    </form>
  )
}

export default ClinicalRecord
