import { useEffect, useState } from 'react'
import { toDateInput, todayInput } from '../utils/dates'
import { Field, InstitutionSelect, Notice } from '../components/ui'
import { AFFILIATION_LABEL } from './AuthPage'

const emptyProfile = {
  email: '', firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '', curp: '',
  identificationNumber: '', institutionId: '', emergencyContact: '', emergencyPhone: '',
}

// "Mis datos": datos personales y de contacto. Se leen del servidor (no solo de lo guardado al iniciar sesión).
const Profile = ({ call, profileId, institutions, onSaved }) => {
  const [form, setForm] = useState(emptyProfile)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    call(`/usuarios/obtener-usuario-id/${profileId}`).then(({ ok, data }) => {
      if (cancelled) return
      const u = data.user?.[0]
      if (!ok || !u) { setNotice({ kind: 'err', text: data.message || 'No pudimos cargar tus datos.' }); return }
      setForm({
        email: u.email || '', firstName: u.first_name || '', firstSurname: u.first_surname || '',
        secondSurname: u.second_surname || '', phone: u.phone_number || '', birthDate: toDateInput(u.birth_date),
        curp: u.curp || '', identificationNumber: u.identification_number || '',
        institutionId: u.institution_id ? String(u.institution_id) : '',
        emergencyContact: u.emergency_contact || '', emergencyPhone: u.emergency_phone || '',
      })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [call, profileId])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setNotice(null)
    setSaving(true)
    const { ok, data } = await call('/usuarios/actualizar-perfil', {
      method: 'PATCH',
      body: {
        userProfileId: profileId, firstName: form.firstName, firstSurname: form.firstSurname,
        secondSurname: form.secondSurname, phone: form.phone, birthDate: form.birthDate,
        cveUnicaRegistroPob: form.curp.toUpperCase(), identificationNumber: form.identificationNumber,
        institutionId: form.institutionId, emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
      },
    })
    setSaving(false)
    setNotice(ok ? { kind: 'ok', text: 'Datos guardados.' } : { kind: 'err', text: data.message || 'No se pudieron guardar tus datos.' })
    if (ok) onSaved?.()
  }

  if (!loaded && !notice) return <p className="empty" role="status">Cargando tus datos…</p>

  return (
    <form className="form" onSubmit={handleSave}>
      {form.email && <Field label="Correo de tu cuenta" value={form.email} readOnly />}
      <div className="grid-2">
        <Field label="Nombre" value={form.firstName} onChange={set('firstName')} maxLength={100} autoComplete="given-name" required />
        <Field label="Primer apellido" value={form.firstSurname} onChange={set('firstSurname')} maxLength={150} autoComplete="family-name" />
        <Field label="Segundo apellido" value={form.secondSurname} onChange={set('secondSurname')} maxLength={150} />
        <Field label="Fecha de nacimiento" type="date" max={todayInput()} value={form.birthDate} onChange={set('birthDate')} autoComplete="bday" />
      </div>
      <Field label="CURP" value={form.curp} onChange={(e) => setForm((f) => ({ ...f, curp: e.target.value.toUpperCase() }))} maxLength={18} autoCapitalize="characters" spellCheck={false} />
      <Field label="Teléfono" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} maxLength={10} pattern="[0-9]{10}" title="10 dígitos, sin espacios" hint="10 dígitos." />
      <Field label={AFFILIATION_LABEL} value={form.identificationNumber} onChange={set('identificationNumber')} maxLength={20} />
      <InstitutionSelect institutions={institutions} value={form.institutionId} onChange={set('institutionId')} />
      <div className="grid-2">
        <Field label="Contacto de emergencia" value={form.emergencyContact} onChange={set('emergencyContact')} maxLength={200} />
        <Field label="Teléfono de emergencia" type="tel" inputMode="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} maxLength={10} pattern="[0-9]{10}" title="10 dígitos, sin espacios" />
      </div>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={saving || !loaded}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

export default Profile
