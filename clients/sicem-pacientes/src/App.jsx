import { useEffect, useState } from 'react'
import { toLowerCaseKeys } from './utils/formatData'

const API_BASE_URL = 'http://localhost:3000'

const TOKEN_KEY = 'sicem_paciente_token'
const USER_KEY = 'sicem_paciente_user'

const emptyForm = {
  email: '',
  password: '',
  firstName: '',
  firstSurname: '',
  secondSurname: '',
  phone: '',
  birthDate: '',
  curp: '',
  identificationNumber: '',
  institutionId: '',
  emergencyContact: '',
  emergencyPhone: '',
}

// La BD manda birth_date en formato ISO ("2002-06-06T05:00:00.000Z"), pero el
// input type="date" y MySQL esperan "yyyy-MM-dd". Normalizamos a la fecha local.
const toDateInput = (value) => {
  if (!value) return ''
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const App = () => {
  const [mode, setMode] = useState('login') // login | register | profile
  const [registerStep, setRegisterStep] = useState('curp') // curp | claim | full
  const [foundProfile, setFoundProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [institutions, setInstitutions] = useState([])
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`)
      .then((res) => res.json())
      .then((data) => setInstitutions((data.institutions || []).map(toLowerCaseKeys)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!token) return
    setMode('profile')
    const saved = localStorage.getItem(USER_KEY)
    if (saved) setForm({ ...emptyForm, ...JSON.parse(saved) })
    fetch(`${API_BASE_URL}/usuarios/obtener-usuario-id/${JSON.parse(saved || '{}').profileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const u = (data.user && data.user[0]) || {}
        const profile = {
          email: u.email || '',
          password: '',
          firstName: u.first_name || '',
          firstSurname: u.first_surname || '',
          secondSurname: u.second_surname || '',
          phone: u.phone_number || '',
          birthDate: toDateInput(u.birth_date),
          curp: u.curp || '',
          identificationNumber: u.identification_number || '',
          institutionId: u.institution_id ? String(u.institution_id) : '',
          emergencyContact: u.emergency_contact || '',
          emergencyPhone: u.emergency_phone || '',
        }
        setForm((f) => ({ ...f, ...profile }))
        localStorage.setItem(USER_KEY, JSON.stringify({ ...JSON.parse(saved || '{}'), ...profile }))
      })
      .catch(() => {})
  }, [token])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.jwtToken) {
          localStorage.setItem(TOKEN_KEY, data.jwtToken)
          localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}))
          setToken(data.jwtToken)
        } else {
          setError(data.message || 'Credenciales incorrectas.')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleRegister = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/usuarios/registro-paciente`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        firstSurname: form.firstSurname,
        secondSurname: form.secondSurname,
        phone: form.phone,
        birthDate: form.birthDate,
        cveUnicaRegistroPob: form.curp,
        identificationNumber: form.identificationNumber,
        institutionId: form.institutionId,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setMessage('Registro exitoso. Ya puedes iniciar sesión.')
          setMode('login')
          setForm(emptyForm)
        } else {
          setError(data.message || 'No se pudo registrar.')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  // Paso 1 del registro: el paciente escribe su CURP para ver si ya existe un
  // perfil (registrado por un paramédico o el hospital). Si existe sin
  // credenciales, solo se le piden email+contraseña para reclamarla.
  const handleCurpLookup = (e) => {
    e.preventDefault()
    if (!form.curp.trim()) return
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${form.curp.trim().toUpperCase()}`)
      .then((res) => res.json())
      .then(({ data }) => {
        if (data && data.length > 0) {
          const profile = toLowerCaseKeys(data[0])
          if (profile.user_credential_id) {
            setFoundProfile(profile)
            setRegisterStep('claim')
            setError('Esa CURP ya está vinculada a una cuenta. Inicia sesión con tu correo para entrar.')
            return
          }
          setFoundProfile(profile)
          setForm((f) => ({
            ...f,
            curp: profile.curp || f.curp,
            firstName: profile.first_name || f.firstName,
            firstSurname: profile.first_surname || f.firstSurname,
            secondSurname: profile.second_surname || f.secondSurname,
            phone: profile.phone_number || f.phone,
            birthDate: toDateInput(profile.birth_date),
            identificationNumber: profile.identification_number || f.identificationNumber,
            institutionId: profile.institution_id ? String(profile.institution_id) : f.institutionId,
          }))
          setRegisterStep('claim')
        } else {
          setRegisterStep('full')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  // Paso 2: la CURP ya existe → solo email+contraseña para vincularla.
  const handleClaim = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/usuarios/vincular-cuenta-curp`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({ curp: form.curp, email: form.email, password: form.password, institutionId: form.institutionId }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setMessage('Cuenta vinculada a tu CURP. Ya puedes iniciar sesión.')
          setMode('login')
          setRegisterStep('curp')
          setFoundProfile(null)
          setForm(emptyForm)
        } else {
          setError(data.message || 'No se pudo vincular la cuenta.')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleUpdate = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || '{}')
    fetch(`${API_BASE_URL}/usuarios/actualizar-perfil`, {
      method: 'PATCH',
      headers: {
        'Content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userProfileId: saved.profileId,
        firstName: form.firstName,
        firstSurname: form.firstSurname,
        secondSurname: form.secondSurname,
        phone: form.phone,
        birthDate: form.birthDate,
        cveUnicaRegistroPob: form.curp,
        identificationNumber: form.identificationNumber,
        institutionId: form.institutionId,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setMessage('Datos actualizados.')
        } else {
          setError(data.message || 'No se pudieron actualizar los datos.')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setForm(emptyForm)
    setMode('login')
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="logo">SICEM</div>
        <p className="tagline">Portal de pacientes</p>

        {mode === 'profile' ? (
          <form onSubmit={handleUpdate}>
            <h2>Mis datos</h2>
            <Field label="Nombre" value={form.firstName} onChange={set('firstName')} maxLength={100} required />
            <Field label="Primer apellido" value={form.firstSurname} onChange={set('firstSurname')} maxLength={150} />
            <Field label="Segundo apellido" value={form.secondSurname} onChange={set('secondSurname')} maxLength={150} />
            <Field label="Teléfono" value={form.phone} onChange={set('phone')} maxLength={10} />
            <Field label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={set('birthDate')} />
            <Field label="CURP" value={form.curp} onChange={set('curp')} maxLength={18} />
            <Field label="Identificador de afiliación (NSS, IMSS, ISSSTE, etc.)" value={form.identificationNumber} onChange={set('identificationNumber')} maxLength={20} />
            <label className="field">
              <span>Institución de afiliación</span>
              <select value={form.institutionId} onChange={set('institutionId')}>
                <option value="">Selecciona…</option>
                {institutions.map((i) => (
                  <option key={i.institution_id} value={String(i.institution_id)}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Contacto de emergencia" value={form.emergencyContact} onChange={set('emergencyContact')} maxLength={200} />
            <Field label="Teléfono de emergencia" value={form.emergencyPhone} onChange={set('emergencyPhone')} maxLength={10} />
            {message && <div className="ok">{message}</div>}
            {error && <div className="err">{error}</div>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="btn ghost" type="button" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </form>
        ) : (
          <>
            <div className="tabs">
              <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError(''); setMessage('') }}>
                Iniciar sesión
              </button>
              <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setRegisterStep('curp'); setFoundProfile(null); setError(''); setMessage('') }}>
                Registrarme
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin}>
                <Field label="Correo" type="email" value={form.email} onChange={set('email')} maxLength={150} required />
                <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} required />
                {error && <div className="err">{error}</div>}
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Entrando…' : 'Entrar'}
                </button>
              </form>
            ) : registerStep === 'curp' ? (
              <form onSubmit={handleCurpLookup}>
                <Field label="CURP" value={form.curp} onChange={set('curp')} maxLength={18} required />
                {error && <div className="err">{error}</div>}
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Buscando…' : 'Buscar mi CURP'}
                </button>
              </form>
            ) : registerStep === 'claim' && foundProfile ? (
              <form onSubmit={handleClaim}>
                <div className="ok">
                  Encontramos tu expediente: <strong>{foundProfile.first_name} {foundProfile.first_surname || ''} {foundProfile.second_surname || ''}</strong>{foundProfile.user_credential_id ? '' : '. Verifica tus datos y solo completa correo y contraseña para vincularlo a tu cuenta.'}
                </div>
                <Field label="Nombre" value={form.firstName} onChange={() => {}} readOnly />
                <Field label="Primer apellido" value={form.firstSurname} onChange={() => {}} readOnly />
                <Field label="Segundo apellido" value={form.secondSurname} onChange={() => {}} readOnly />
                <Field label="Teléfono" value={form.phone} onChange={() => {}} readOnly />
                <Field label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={() => {}} readOnly />
                <Field label="CURP" value={form.curp} onChange={() => {}} readOnly maxLength={18} />
                <Field label="Identificador de afiliación (NSS, IMSS, ISSSTE, etc.)" value={form.identificationNumber} onChange={() => {}} readOnly maxLength={20} />
                <label className="field">
                  <span>Institución de afiliación</span>
                  <select value={form.institutionId} onChange={set('institutionId')}>
                    <option value="">Selecciona…</option>
                    {institutions.map((i) => (
                      <option key={i.institution_id} value={String(i.institution_id)}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!foundProfile.user_credential_id && (
                  <>
                    <Field label="Correo" type="email" value={form.email} onChange={set('email')} maxLength={150} required />
                    <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} required />
                  </>
                )}
                {message && <div className="ok">{message}</div>}
                {error && <div className="err">{error}</div>}
                {!foundProfile.user_credential_id && (
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Vinculando…' : 'Vincular cuenta'}
                  </button>
                )}
                <button className="btn ghost" type="button" onClick={() => { setRegisterStep('curp'); setFoundProfile(null); setError(''); setMessage('') }}>
                  {foundProfile.user_credential_id ? 'Ir a iniciar sesión' : 'Volver'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <Field label="CURP" value={form.curp} onChange={set('curp')} maxLength={18} required />
                <Field label="Correo" type="email" value={form.email} onChange={set('email')} maxLength={150} required />
                <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} required />
                <Field label="Nombre" value={form.firstName} onChange={set('firstName')} maxLength={100} required />
                <Field label="Primer apellido" value={form.firstSurname} onChange={set('firstSurname')} maxLength={150} />
                <Field label="Segundo apellido" value={form.secondSurname} onChange={set('secondSurname')} maxLength={150} />
                <Field label="Teléfono" value={form.phone} onChange={set('phone')} maxLength={10} />
                <Field label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={set('birthDate')} />
                <Field label="Identificador de afiliación (NSS, IMSS, ISSSTE, etc.)" value={form.identificationNumber} onChange={set('identificationNumber')} maxLength={20} />
                <label className="field">
                  <span>Institución de afiliación</span>
                  <select value={form.institutionId} onChange={set('institutionId')} required>
                    <option value="">Selecciona…</option>
                    {institutions.map((i) => (
                      <option key={i.institution_id} value={String(i.institution_id)}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Contacto de emergencia" value={form.emergencyContact} onChange={set('emergencyContact')} maxLength={200} />
                <Field label="Teléfono de emergencia" value={form.emergencyPhone} onChange={set('emergencyPhone')} maxLength={10} />
                {message && <div className="ok">{message}</div>}
                {error && <div className="err">{error}</div>}
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Registrando…' : 'Registrarme'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const Field = ({ label, value, onChange, type = 'text', required = false, maxLength, readOnly = false }) => (
  <label className="field">
    <span>{label}</span>
    <input type={type} value={value} onChange={onChange} required={required} maxLength={maxLength} readOnly={readOnly} />
  </label>
)

export default App