import { useState } from 'react'
import { api } from '../api'
import { toLowerCaseKeys } from '../utils/formatData'
import { toDateInput, todayInput } from '../utils/dates'
import { Field, PasswordField, InstitutionSelect, Notice, Tabs } from '../components/ui'

const emptyForm = {
  email: '', password: '', firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '',
  curp: '', identificationNumber: '', institutionId: '', emergencyContact: '', emergencyPhone: '',
}

const AFFILIATION_LABEL = 'Número de afiliación (NSS, ISSSTE u otro)'

// Inicio de sesión y registro. El registro empieza por la CURP: si un paramédico u hospital ya
// capturó al paciente, solo hay que vincular la cuenta (correo y contraseña) en vez de duplicar el perfil.
const AuthPage = ({ institutions, onLogin, initialNotice }) => {
  const [mode, setMode] = useState('login') // login | register
  const [step, setStep] = useState('curp') // curp | claim | full
  const [found, setFound] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [notice, setNotice] = useState(initialNotice ? { kind: 'info', text: initialNotice } : null)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setUpper = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value.toUpperCase() }))
  const fail = (data) => setNotice({ kind: 'err', text: data?.message || 'Algo salió mal. Inténtalo de nuevo.' })

  const switchMode = (next) => { setMode(next); setStep('curp'); setFound(null); setNotice(null) }

  const submit = (handler) => async (e) => {
    e.preventDefault()
    setNotice(null)
    setLoading(true)
    try { await handler() } finally { setLoading(false) }
  }

  const handleLogin = submit(async () => {
    const { ok, data } = await api('/usuarios/login', { method: 'POST', body: { email: form.email.trim(), password: form.password } })
    if (ok && data.jwtToken) {
      // Este portal es solo para pacientes; el personal entra por su propia aplicación.
      if (parseInt(data.user?.roleId) !== 5) return fail({ message: 'Esta cuenta es del personal del sistema. El portal de pacientes es solo para pacientes.' })
      onLogin({ token: data.jwtToken, user: data.user || {} })
    } else fail({ message: data.message || 'Correo o contraseña incorrectos.' })
  })

  const handleLookup = submit(async () => {
    const curp = form.curp.trim().toUpperCase()
    const { ok, data } = await api(`/usuarios/obtener-usuario-curp/${encodeURIComponent(curp)}`)
    if (!ok) return fail(data)
    const profile = data.data?.[0] ? toLowerCaseKeys(data.data[0]) : null
    if (!profile) { setForm((f) => ({ ...f, curp })); setStep('full'); return }
    if (profile.user_credential_id) {
      setFound(profile)
      setStep('claim')
      setNotice({ kind: 'info', text: 'Esa CURP ya tiene una cuenta. Inicia sesión con tu correo.' })
      return
    }
    setFound(profile)
    setForm((f) => ({
      ...f,
      curp: profile.curp || curp,
      firstName: profile.first_name || '',
      firstSurname: profile.first_surname || '',
      secondSurname: profile.second_surname || '',
      phone: profile.phone_number || '',
      birthDate: toDateInput(profile.birth_date),
      identificationNumber: profile.identification_number || '',
      institutionId: profile.institution_id ? String(profile.institution_id) : f.institutionId,
    }))
    setStep('claim')
  })

  const afterAccountCreated = (text) => {
    setMode('login'); setStep('curp'); setFound(null)
    setForm({ ...emptyForm, email: form.email })
    setNotice({ kind: 'ok', text })
  }

  const handleClaim = submit(async () => {
    const { ok, data } = await api('/usuarios/vincular-cuenta-curp', {
      method: 'POST',
      body: { curp: form.curp, email: form.email.trim(), password: form.password, institutionId: form.institutionId },
    })
    if (ok) afterAccountCreated('Listo: tu cuenta quedó vinculada a tu expediente. Ya puedes iniciar sesión.')
    else fail(data)
  })

  const handleRegister = submit(async () => {
    const { ok, data } = await api('/usuarios/registro-paciente', {
      method: 'POST',
      body: {
        email: form.email.trim(), password: form.password, firstName: form.firstName, firstSurname: form.firstSurname,
        secondSurname: form.secondSurname, phone: form.phone, birthDate: form.birthDate, cveUnicaRegistroPob: form.curp,
        identificationNumber: form.identificationNumber, institutionId: form.institutionId,
        emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
      },
    })
    if (ok) afterAccountCreated('Cuenta creada. Ya puedes iniciar sesión.')
    else fail(data)
  })

  const noticeEl = notice && <Notice kind={notice.kind}>{notice.text}</Notice>
  const stepIndex = { curp: 0, claim: 1, full: 1 }[step]
  const hasAccount = Boolean(found?.user_credential_id)

  return (
    <div className="auth-grid">
      <div className="auth-intro">
        <h1 className="view-title">{mode === 'login' ? 'Entrar a tu cuenta' : 'Crear mi cuenta'}</h1>
        <p className="view-lead">
          {mode === 'login'
            ? 'Consulta y mantén al día tus datos y tu expediente clínico. Si tienes una emergencia, el personal médico los verá al instante.'
            : 'Con tu expediente al día, el personal de emergencias sabrá tu tipo de sangre, alergias y medicamentos antes de que llegues.'}
        </p>
        <ul className="auth-points">
          <li><b>Tu sangre y alergias, al instante.</b> Se muestran al personal médico cuando más importa.</li>
          <li><b>Tú decides qué registrar.</b> Puedes editar o quitar cualquier dato cuando quieras.</li>
          <li><b>Funciona en tu celular.</b> Sin instalar nada.</li>
        </ul>
      </div>

      <div className="panel">
        <Tabs
          label="Acceso"
          value={mode}
          onChange={switchMode}
          tabs={[{ id: 'login', label: 'Iniciar sesión' }, { id: 'register', label: 'Crear cuenta' }]}
        />

        {mode === 'login' && (
          <form className="form" onSubmit={handleLogin}>
            <Field label="Correo electrónico" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} maxLength={150} required />
            <PasswordField autoComplete="current-password" value={form.password} onChange={set('password')} required />
            {noticeEl}
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <>
            <ol className="steps" aria-label="Pasos del registro">
              <li className={stepIndex > 0 ? 'done' : ''} aria-current={stepIndex === 0 ? 'step' : undefined}>1. Tu CURP</li>
              <li aria-current={stepIndex === 1 ? 'step' : undefined}>2. Tus datos</li>
            </ol>

            {step === 'curp' && (
              <form className="form" onSubmit={handleLookup}>
                <Field
                  label="CURP" value={form.curp} onChange={setUpper('curp')} minLength={18} maxLength={18} required
                  autoCapitalize="characters" autoComplete="off" spellCheck={false}
                  hint="18 caracteres. Si ya te atendieron en una ambulancia u hospital, encontraremos tu expediente."
                />
                {noticeEl}
                <div className="actions">
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Continuar'}</button>
                </div>
              </form>
            )}

            {step === 'claim' && found && (
              <form className="form" onSubmit={handleClaim}>
                <Notice kind="ok">
                  Encontramos tu expediente: <strong>{[found.first_name, found.first_surname, found.second_surname].filter(Boolean).join(' ')}</strong>.
                  {!hasAccount && ' Revisa tus datos y completa tu correo y contraseña para vincularlo a tu cuenta.'}
                </Notice>
                <div className="grid-2">
                  <Field label="Nombre" value={form.firstName} readOnly />
                  <Field label="Primer apellido" value={form.firstSurname} readOnly />
                  <Field label="Segundo apellido" value={form.secondSurname} readOnly />
                  <Field label="CURP" value={form.curp} readOnly />
                </div>
                <InstitutionSelect institutions={institutions} value={form.institutionId} onChange={set('institutionId')} />
                {!hasAccount && (
                  <>
                    <Field label="Correo electrónico" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} maxLength={150} required />
                    <PasswordField autoComplete="new-password" value={form.password} onChange={set('password')} minLength={8} required hint="Mínimo 8 caracteres." />
                  </>
                )}
                {noticeEl}
                <div className="actions">
                  {!hasAccount && <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Vinculando…' : 'Vincular mi cuenta'}</button>}
                  <button className="btn" type="button" onClick={hasAccount ? () => switchMode('login') : () => { setStep('curp'); setFound(null); setNotice(null) }}>
                    {hasAccount ? 'Ir a iniciar sesión' : 'Volver'}
                  </button>
                </div>
              </form>
            )}

            {step === 'full' && (
              <form className="form" onSubmit={handleRegister}>
                <Notice kind="info">No encontramos esa CURP, así que crearemos tu perfil desde cero.</Notice>
                <Field label="CURP" value={form.curp} readOnly />
                <div className="grid-2">
                  <Field label="Nombre" value={form.firstName} onChange={set('firstName')} maxLength={100} autoComplete="given-name" required />
                  <Field label="Primer apellido" value={form.firstSurname} onChange={set('firstSurname')} maxLength={150} autoComplete="family-name" />
                  <Field label="Segundo apellido" value={form.secondSurname} onChange={set('secondSurname')} maxLength={150} />
                  <Field label="Fecha de nacimiento" type="date" max={todayInput()} value={form.birthDate} onChange={set('birthDate')} autoComplete="bday" />
                </div>
                <Field label="Teléfono" type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={set('phone')} maxLength={10} pattern="[0-9]{10}" title="10 dígitos, sin espacios" hint="10 dígitos." />
                <Field label={AFFILIATION_LABEL} value={form.identificationNumber} onChange={set('identificationNumber')} maxLength={20} />
                <InstitutionSelect institutions={institutions} value={form.institutionId} onChange={set('institutionId')} required />
                <div className="grid-2">
                  <Field label="Contacto de emergencia" value={form.emergencyContact} onChange={set('emergencyContact')} maxLength={200} />
                  <Field label="Teléfono de emergencia" type="tel" inputMode="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} maxLength={10} pattern="[0-9]{10}" title="10 dígitos, sin espacios" />
                </div>
                <Field label="Correo electrónico" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} maxLength={150} required />
                <PasswordField autoComplete="new-password" value={form.password} onChange={set('password')} minLength={8} required hint="Mínimo 8 caracteres." />
                {noticeEl}
                <div className="actions">
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
                  <button className="btn" type="button" onClick={() => { setStep('curp'); setNotice(null) }}>Volver</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AuthPage
export { AFFILIATION_LABEL }
