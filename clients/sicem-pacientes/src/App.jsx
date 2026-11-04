import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { toLowerCaseKeys } from './utils/formatData'
import { useSummary } from './useSummary'
import AuthPage from './pages/AuthPage'
import Profile from './pages/Profile'
import ClinicalRecord from './pages/ClinicalRecord'
import ClinicalList from './pages/ClinicalList'
import MedicalCard from './components/MedicalCard'
import SkinMenu from './SkinMenu'

const TOKEN_KEY = 'sicem_paciente_token'
const USER_KEY = 'sicem_paciente_user'

const readUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}') } catch { return {} }
}

// Un solo nivel de navegación: cada sección es una pantalla. Íconos simples en trazo, sin dependencias.
const ICONS = {
  resumen: <path d="M3 12 12 4l9 8M5 10v10h14V10" />,
  datos: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  general: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  allergies: <><path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  conditions: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />,
  medications: <><rect x="3" y="9" width="18" height="8" rx="4" transform="rotate(-35 12 13)" /><path d="m8.5 8.5 7 7" /></>,
}
const NAV = [
  { id: 'resumen', label: 'Resumen', short: 'Resumen' },
  { id: 'datos', label: 'Mis datos', short: 'Datos' },
  { id: 'general', label: 'Datos generales', short: 'Expediente' },
  { id: 'allergies', label: 'Alergias', short: 'Alergias' },
  { id: 'conditions', label: 'Condiciones', short: 'Condiciones' },
  { id: 'medications', label: 'Medicamentos', short: 'Medicinas' },
]
const TITLES = {
  resumen: ['Tu tarjeta médica', 'Esto es lo que verá el personal de emergencias si necesitas atención.'],
  datos: ['Mis datos', 'Mantén tus datos de contacto al día para que podamos avisar a tu familia.'],
  general: ['Datos generales', 'Tu tipo de sangre, peso, estatura y notas importantes para el personal médico.'],
}

const NavIcon = ({ id }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[id]}</svg>
)

const App = () => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [profileId, setProfileId] = useState(() => readUser().profileId || null)
  const [institutions, setInstitutions] = useState([])
  const [expiredNotice, setExpiredNotice] = useState('')
  const [view, setView] = useState('resumen')
  const [hasEce, setHasEce] = useState(false)
  const [version, setVersion] = useState(0)

  const logout = useCallback((reason = '') => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setProfileId(null)
    setHasEce(false)
    setView('resumen')
    setExpiredNotice(reason)
  }, [])

  // Llamadas autenticadas: si el servidor responde 401 la sesión caducó (dura 8 h) y se regresa al inicio de sesión.
  const call = useCallback(async (path, options) => {
    const result = await api(path, { ...options, token })
    if (result.status === 401) logout('Tu sesión caducó. Inicia sesión de nuevo para continuar.')
    return result
  }, [token, logout])

  useEffect(() => {
    api('/usuarios/obtener-instituciones').then(({ data }) => {
      const list = (data.institutions || []).map(toLowerCaseKeys).sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setInstitutions(list)
    })
  }, [])

  // ¿Ya existe el expediente? Habilita alergias, condiciones y medicamentos.
  const refreshEce = useCallback(async () => {
    if (!profileId) return
    const { data } = await call(`/pacientes/ece/${profileId}`)
    setHasEce(Boolean(data.clinicalRecord?.[0]))
  }, [call, profileId])

  useEffect(() => { if (token) refreshEce() }, [token, refreshEce])

  // La tarjeta médica se vuelve a cargar cada vez que cambias de sección (algo pudo haber cambiado)
  const { summary } = useSummary(token ? call : () => Promise.resolve({ data: {} }), token ? profileId : null, hasEce, `${view}-${version}`)

  const institutionName = useMemo(
    () => institutions.find((i) => String(i.institution_id) === String(summary?.institutionId))?.name,
    [institutions, summary?.institutionId]
  )

  const handleLogin = ({ token: newToken, user }) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setProfileId(user.profileId || null)
    setExpiredNotice('')
    setToken(newToken)
  }

  const go = (id) => { setView(id); window.scrollTo({ top: 0 }) }
  const onSaved = () => { refreshEce(); setVersion((v) => v + 1) }
  const logged = token && profileId

  return (
    <>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">+</span>
            <span>
              <span className="brand-name">SICEM</span>
              <span className="brand-sub">Portal de pacientes</span>
            </span>
          </div>
          <div className="topbar-actions">
            <SkinMenu />
            {logged && <button type="button" className="btn btn-sm" onClick={() => logout()}>Cerrar sesión</button>}
          </div>
        </div>
      </header>

      {!logged ? (
        <main className="wrap" id="contenido">
          <AuthPage institutions={institutions} onLogin={handleLogin} initialNotice={expiredNotice} />
        </main>
      ) : (
        <div className="shell" data-view={view}>
          <nav className="nav" aria-label="Secciones">
            {NAV.map((n) => (
              <button key={n.id} type="button" className="nav-item" aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
                <NavIcon id={n.id} />
                <span className="nav-long">{n.label}</span>
                <span className="nav-short">{n.short}</span>
              </button>
            ))}
          </nav>

          <main className="content" id="contenido">
            {TITLES[view] ? (
              <>
                <h1 className="view-title">{TITLES[view][0]}</h1>
                <p className="view-lead">{TITLES[view][1]}</p>
              </>
            ) : null}

            {view === 'resumen' && <MedicalCard summary={summary} institutionName={institutionName} onNavigate={go} />}
            <div className={view === 'resumen' ? 'hidden' : 'panel'}>
              {view === 'datos' && <Profile call={call} profileId={profileId} institutions={institutions} onSaved={onSaved} />}
              {view === 'general' && <ClinicalRecord call={call} profileId={profileId} hasEce={hasEce} onSaved={onSaved} />}
              {['allergies', 'conditions', 'medications'].includes(view) && <ClinicalList key={view} call={call} kind={view} hasEce={hasEce} onChanged={onSaved} onNavigate={go} />}
            </div>
          </main>

          <aside className="aside" aria-label="Tarjeta médica">
            <MedicalCard summary={summary} institutionName={institutionName} onNavigate={go} compact />
          </aside>
        </div>
      )}
    </>
  )
}

export default App
