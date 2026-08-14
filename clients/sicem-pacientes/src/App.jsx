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

const emptyEce = {
  bloodTypeId: '',
  weight: '',
  height: '',
  gender: '',
  birthplace: '',
  maritalStatus: '',
  occupation: '',
  religion: '',
  notes: '',
}

const emptyAllergy = { name: '', severity: '' }
const emptyCondition = { name: '', diagnosedAt: '', notes: '' }
const emptyMedication = { name: '', dosage: '', frequency: '' }

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
  const [profileTab, setProfileTab] = useState('datos') // datos | ece
  const [eceTab, setEceTab] = useState('expediente') // expediente | alergias | condiciones | medicamentos
  const [registerStep, setRegisterStep] = useState('curp') // curp | claim | full
  const [foundProfile, setFoundProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [eceForm, setEceForm] = useState(emptyEce)
  const [bloodTypes, setBloodTypes] = useState([])
  const [hasEce, setHasEce] = useState(false)
  const [clinicalRecordId, setClinicalRecordId] = useState(null)
  const [institutions, setInstitutions] = useState([])
  const [allergies, setAllergies] = useState([])
  const [conditions, setConditions] = useState([])
  const [medications, setMedications] = useState([])
  const [allergyForm, setAllergyForm] = useState(emptyAllergy)
  const [conditionForm, setConditionForm] = useState(emptyCondition)
  const [medicationForm, setMedicationForm] = useState(emptyMedication)
  const [editingAllergy, setEditingAllergy] = useState(null)
  const [editingCondition, setEditingCondition] = useState(null)
  const [editingMedication, setEditingMedication] = useState(null)
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`)
      .then((res) => res.json())
      .then((data) => setInstitutions((data.institutions || []).map(toLowerCaseKeys)))
      .catch(() => {})
    fetch(`${API_BASE_URL}/pacientes/tipos-sangre`)
      .then((res) => res.json())
      .then((data) => setBloodTypes((data.bloodTypes || data || []).map(toLowerCaseKeys)))
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
        if (JSON.parse(saved || '{}').profileId) loadEce(JSON.parse(saved || '{}').profileId)
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
    setEceForm(emptyEce)
    setHasEce(false)
    setClinicalRecordId(null)
    setAllergies([])
    setConditions([])
    setMedications([])
    setAllergyForm(emptyAllergy)
    setConditionForm(emptyCondition)
    setMedicationForm(emptyMedication)
    setEditingAllergy(null)
    setEditingCondition(null)
    setEditingMedication(null)
    setMode('login')
  }

  // Carga el expediente clínico (ECE) del paciente autenticado.
  const loadEce = (profileId) => {
    fetch(`${API_BASE_URL}/pacientes/ece/${profileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const raw = (data.clinicalRecord && data.clinicalRecord[0]) || null
        const ece = raw ? toLowerCaseKeys(raw) : null
        setHasEce(!!ece)
        setClinicalRecordId(ece ? ece.clinical_record_id : null)
        setEceForm(
          ece
            ? {
                bloodTypeId: ece.blood_type_id ? String(ece.blood_type_id) : '',
                weight: ece.weight ?? '',
                height: ece.height ?? '',
                gender: ece.gender || '',
                birthplace: ece.birthplace || '',
                maritalStatus: ece.marital_status || '',
                occupation: ece.occupation || '',
                religion: ece.religion || '',
                notes: ece.notes || '',
              }
            : emptyEce
        )
        if (ece) loadClinical()
      })
      .catch(() => {})
  }

  // Carga las alergias, condiciones y medicamentos del propio paciente. Los GET
  // de rol 5 ignoran el id de la ruta y resuelven su propio expediente.
  const loadClinical = () => {
    fetch(`${API_BASE_URL}/pacientes/alergias/0`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAllergies((data.allergies || []).map(toLowerCaseKeys)))
      .catch(() => {})
    fetch(`${API_BASE_URL}/pacientes/condiciones/0`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setConditions((data.conditions || []).map(toLowerCaseKeys)))
      .catch(() => {})
    fetch(`${API_BASE_URL}/pacientes/medicamentos/0`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMedications((data.medications || []).map(toLowerCaseKeys)))
      .catch(() => {})
  }

  const setEce = (field) => (e) => setEceForm((f) => ({ ...f, [field]: e.target.value }))

  // Crea o actualiza el expediente clínico del paciente.
  const handleEceSave = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || '{}')
    const url = hasEce ? `${API_BASE_URL}/pacientes/actualizar-ece` : `${API_BASE_URL}/pacientes/crear-ece`
    fetch(url, {
      method: hasEce ? 'PATCH' : 'POST',
      headers: {
        'Content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userProfileId: saved.profileId,
        bloodTypeId: eceForm.bloodTypeId || null,
        weight: eceForm.weight || null,
        height: eceForm.height || null,
        gender: eceForm.gender || null,
        birthplace: eceForm.birthplace || null,
        maritalStatus: eceForm.maritalStatus || null,
        occupation: eceForm.occupation || null,
        religion: eceForm.religion || null,
        notes: eceForm.notes || null,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setMessage(hasEce ? 'Expediente actualizado.' : 'Expediente creado.')
          setHasEce(true)
        } else {
          setError(data.message || 'No se pudo guardar el expediente.')
        }
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const setAllergy = (field) => (e) => setAllergyForm((f) => ({ ...f, [field]: e.target.value }))
  const setCondition = (field) => (e) => setConditionForm((f) => ({ ...f, [field]: e.target.value }))
  const setMedication = (field) => (e) => setMedicationForm((f) => ({ ...f, [field]: e.target.value }))

  const handleCreateAllergy = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/registrar-alergia`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(allergyForm),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setAllergyForm(emptyAllergy); setMessage('Alergia registrada.'); loadClinical() }
        else setError(data.message || 'No se pudo registrar la alergia.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleUpdateAllergy = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/actualizar-alergia`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientAllergyId: editingAllergy, ...allergyForm }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setEditingAllergy(null); setAllergyForm(emptyAllergy); setMessage('Alergia actualizada.'); loadClinical() }
        else setError(data.message || 'No se pudo actualizar la alergia.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleToggleAllergy = (a) => {
    const action = a.is_active ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Seguro que quieres ${action} la alergia "${a.name}"?`)) return
    fetch(`${API_BASE_URL}/pacientes/alternar-alergia`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientAllergyId: a.patient_allergy_id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) { setMessage(data.message); loadClinical() }
        else setError('No se pudo cambiar el estado.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
  }

  const handleCreateCondition = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/registrar-condicion`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(conditionForm),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setConditionForm(emptyCondition); setMessage('Condición registrada.'); loadClinical() }
        else setError(data.message || 'No se pudo registrar la condición.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleUpdateCondition = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/actualizar-condicion`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientConditionId: editingCondition, ...conditionForm }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setEditingCondition(null); setConditionForm(emptyCondition); setMessage('Condición actualizada.'); loadClinical() }
        else setError(data.message || 'No se pudo actualizar la condición.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleToggleCondition = (c) => {
    const action = c.is_active ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Seguro que quieres ${action} la condición "${c.name}"?`)) return
    fetch(`${API_BASE_URL}/pacientes/alternar-condicion`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientConditionId: c.patient_condition_id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) { setMessage(data.message); loadClinical() }
        else setError('No se pudo cambiar el estado.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
  }

  const handleCreateMedication = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/registrar-medicacion`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(medicationForm),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setMedicationForm(emptyMedication); setMessage('Medicamento registrado.'); loadClinical() }
        else setError(data.message || 'No se pudo registrar el medicamento.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleUpdateMedication = (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    fetch(`${API_BASE_URL}/pacientes/actualizar-medicacion`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientMedicationId: editingMedication, ...medicationForm }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { setEditingMedication(null); setMedicationForm(emptyMedication); setMessage('Medicamento actualizado.'); loadClinical() }
        else setError(data.message || 'No se pudo actualizar el medicamento.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false))
  }

  const handleToggleMedication = (m) => {
    const action = m.is_active ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Seguro que quieres ${action} el medicamento "${m.name}"?`)) return
    fetch(`${API_BASE_URL}/pacientes/alternar-medicacion`, {
      method: 'PATCH',
      headers: { 'Content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientMedicationId: m.patient_medication_id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) { setMessage(data.message); loadClinical() }
        else setError('No se pudo cambiar el estado.')
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="logo">SICEM</div>
        <p className="tagline">Portal de pacientes</p>

        {mode === 'profile' ? (
          <>
            <div className="tabs">
              <button className={profileTab === 'datos' ? 'tab active' : 'tab'} onClick={() => { setProfileTab('datos'); setError(''); setMessage('') }}>
                Mis datos
              </button>
              <button className={profileTab === 'ece' ? 'tab active' : 'tab'} onClick={() => { setProfileTab('ece'); setError(''); setMessage('') }}>
                Expediente clínico
              </button>
            </div>

            {profileTab === 'datos' ? (
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
                  <button className={eceTab === 'expediente' ? 'tab active' : 'tab'} onClick={() => { setEceTab('expediente'); setError(''); setMessage('') }}>
                    Expediente
                  </button>
                  <button className={eceTab === 'alergias' ? 'tab active' : 'tab'} onClick={() => { setEceTab('alergias'); setError(''); setMessage('') }}>
                    Alergias
                  </button>
                  <button className={eceTab === 'condiciones' ? 'tab active' : 'tab'} onClick={() => { setEceTab('condiciones'); setError(''); setMessage('') }}>
                    Condiciones
                  </button>
                  <button className={eceTab === 'medicamentos' ? 'tab active' : 'tab'} onClick={() => { setEceTab('medicamentos'); setError(''); setMessage('') }}>
                    Medicamentos
                  </button>
                </div>

                {!hasEce && (
                  <div className="ok">Aún no tienes expediente clínico. Regístralo en la pestaña "Expediente" para poder agregar alergias, condiciones y medicamentos.</div>
                )}

                {eceTab === 'expediente' && (
                  <form onSubmit={handleEceSave}>
                    <h2>Expediente clínico</h2>
                    <label className="field">
                      <span>Tipo de sangre</span>
                      <select value={eceForm.bloodTypeId} onChange={setEce('bloodTypeId')}>
                        <option value="">Selecciona…</option>
                        {bloodTypes.map((b) => (
                          <option key={b.blood_type_id} value={String(b.blood_type_id)}>
                            {b.blood_type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Peso (kg)" type="number" step="0.01" value={eceForm.weight} onChange={setEce('weight')} />
                    <Field label="Estatura (m)" type="number" step="0.01" value={eceForm.height} onChange={setEce('height')} />
                    <Field label="Género" value={eceForm.gender} onChange={setEce('gender')} maxLength={20} />
                    <Field label="Lugar de nacimiento" value={eceForm.birthplace} onChange={setEce('birthplace')} maxLength={100} />
                    <Field label="Estado civil" value={eceForm.maritalStatus} onChange={setEce('maritalStatus')} maxLength={20} />
                    <Field label="Ocupación" value={eceForm.occupation} onChange={setEce('occupation')} maxLength={100} />
                    <Field label="Religión" value={eceForm.religion} onChange={setEce('religion')} maxLength={100} />
                    <Field label="Notas" value={eceForm.notes} onChange={setEce('notes')} maxLength={500} />
                    {message && <div className="ok">{message}</div>}
                    {error && <div className="err">{error}</div>}
                    <button className="btn" type="submit" disabled={loading}>
                      {loading ? 'Guardando…' : hasEce ? 'Guardar expediente' : 'Crear expediente'}
                    </button>
                    <button className="btn ghost" type="button" onClick={handleLogout}>
                      Cerrar sesión
                    </button>
                  </form>
                )}

                {eceTab === 'alergias' && (
                  <div>
                    <h2>Alergias</h2>
                    {editingAllergy ? (
                      <form onSubmit={handleUpdateAllergy}>
                        <Field label="Nombre" value={allergyForm.name} onChange={setAllergy('name')} maxLength={150} required />
                        <Field label="Severidad" value={allergyForm.severity} onChange={setAllergy('severity')} maxLength={50} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                        <button className="btn ghost" type="button" onClick={() => { setEditingAllergy(null); setAllergyForm(emptyAllergy); setError(''); setMessage('') }}>
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateAllergy}>
                        <Field label="Nombre" value={allergyForm.name} onChange={setAllergy('name')} maxLength={150} required />
                        <Field label="Severidad" value={allergyForm.severity} onChange={setAllergy('severity')} maxLength={50} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Agregar alergia'}
                        </button>
                      </form>
                    )}

                    {allergies.length === 0 ? (
                      <p className="empty">No tienes alergias registradas.</p>
                    ) : (
                      <ul className="items">
                        {allergies.map((a) => (
                          <li key={a.patient_allergy_id}>
                            <div className="item-text">
                              <strong>{a.name}</strong>
                              <span>{a.severity ? `Severidad: ${a.severity}` : 'Severidad: —'}</span>
                            </div>
                            <div className="item-actions">
                              <button type="button" className="btn mini" onClick={() => { setEditingAllergy(a.patient_allergy_id); setAllergyForm({ name: a.name || '', severity: a.severity || '' }); setError(''); setMessage('') }}>
                                Editar
                              </button>
                              <button type="button" className="btn mini ghost" onClick={() => handleToggleAllergy(a)}>
                                {a.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {eceTab === 'condiciones' && (
                  <div>
                    <h2>Condiciones médicas</h2>
                    {editingCondition ? (
                      <form onSubmit={handleUpdateCondition}>
                        <Field label="Nombre" value={conditionForm.name} onChange={setCondition('name')} maxLength={150} required />
                        <Field label="Fecha de diagnóstico" type="date" value={conditionForm.diagnosedAt} onChange={setCondition('diagnosedAt')} />
                        <Field label="Notas" value={conditionForm.notes} onChange={setCondition('notes')} maxLength={300} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                        <button className="btn ghost" type="button" onClick={() => { setEditingCondition(null); setConditionForm(emptyCondition); setError(''); setMessage('') }}>
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateCondition}>
                        <Field label="Nombre" value={conditionForm.name} onChange={setCondition('name')} maxLength={150} required />
                        <Field label="Fecha de diagnóstico" type="date" value={conditionForm.diagnosedAt} onChange={setCondition('diagnosedAt')} />
                        <Field label="Notas" value={conditionForm.notes} onChange={setCondition('notes')} maxLength={300} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Agregar condición'}
                        </button>
                      </form>
                    )}

                    {conditions.length === 0 ? (
                      <p className="empty">No tienes condiciones registradas.</p>
                    ) : (
                      <ul className="items">
                        {conditions.map((c) => (
                          <li key={c.patient_condition_id}>
                            <div className="item-text">
                              <strong>{c.name}</strong>
                              <span>{c.diagnosed_at ? `Diagnosticada: ${c.diagnosed_at}` : 'Diagnóstico: —'}</span>
                              <span>{c.notes || ''}</span>
                            </div>
                            <div className="item-actions">
                              <button type="button" className="btn mini" onClick={() => { setEditingCondition(c.patient_condition_id); setConditionForm({ name: c.name || '', diagnosedAt: c.diagnosed_at ? c.diagnosed_at.split('T')[0] : '', notes: c.notes || '' }); setError(''); setMessage('') }}>
                                Editar
                              </button>
                              <button type="button" className="btn mini ghost" onClick={() => handleToggleCondition(c)}>
                                {c.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {eceTab === 'medicamentos' && (
                  <div>
                    <h2>Medicamentos</h2>
                    {editingMedication ? (
                      <form onSubmit={handleUpdateMedication}>
                        <Field label="Nombre" value={medicationForm.name} onChange={setMedication('name')} maxLength={150} required />
                        <Field label="Dosis" value={medicationForm.dosage} onChange={setMedication('dosage')} maxLength={100} />
                        <Field label="Frecuencia" value={medicationForm.frequency} onChange={setMedication('frequency')} maxLength={100} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                        <button className="btn ghost" type="button" onClick={() => { setEditingMedication(null); setMedicationForm(emptyMedication); setError(''); setMessage('') }}>
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateMedication}>
                        <Field label="Nombre" value={medicationForm.name} onChange={setMedication('name')} maxLength={150} required />
                        <Field label="Dosis" value={medicationForm.dosage} onChange={setMedication('dosage')} maxLength={100} />
                        <Field label="Frecuencia" value={medicationForm.frequency} onChange={setMedication('frequency')} maxLength={100} />
                        {message && <div className="ok">{message}</div>}
                        {error && <div className="err">{error}</div>}
                        <button className="btn" type="submit" disabled={loading || !hasEce}>
                          {loading ? 'Guardando…' : 'Agregar medicamento'}
                        </button>
                      </form>
                    )}

                    {medications.length === 0 ? (
                      <p className="empty">No tienes medicamentos registrados.</p>
                    ) : (
                      <ul className="items">
                        {medications.map((m) => (
                          <li key={m.patient_medication_id}>
                            <div className="item-text">
                              <strong>{m.name}</strong>
                              <span>{m.dosage ? `Dosis: ${m.dosage}` : 'Dosis: —'}</span>
                              <span>{m.frequency ? `Frecuencia: ${m.frequency}` : 'Frecuencia: —'}</span>
                            </div>
                            <div className="item-actions">
                              <button type="button" className="btn mini" onClick={() => { setEditingMedication(m.patient_medication_id); setMedicationForm({ name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '' }); setError(''); setMessage('') }}>
                                Editar
                              </button>
                              <button type="button" className="btn mini ghost" onClick={() => handleToggleMedication(m)}>
                                {m.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </>
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