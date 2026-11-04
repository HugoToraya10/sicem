import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTheme, isDarkReady } from './utils/theme'
import { RegionProvider } from './context/RegionContext'
import { DialogsProvider } from './context/DialogsContext'
import { AuthProvider, useAuth } from './context/AuthContext'

// Cada pantalla se descarga solo cuando se abre (antes el sistema completo — mapas, gráficas y
// generador de PDF incluidos — se bajaba al abrir la primera): la app arranca bastante más rápido.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const EmergencyDetail = lazy(() => import('./pages/EmergencyDetail'))
const Requests = lazy(() => import('./pages/Requests'))
const Users = lazy(() => import('./pages/admin/Users'))
const Institutions = lazy(() => import('./pages/admin/Institutions'))
const Ambulances = lazy(() => import('./pages/admin/Ambulances'))
const Patients = lazy(() => import('./pages/admin/Patients'))
const EmergencyCatalogs = lazy(() => import('./pages/admin/EmergencyCatalogs'))
const NewEmergency = lazy(() => import('./pages/NewEmergency'))
const Hospitals = lazy(() => import('./pages/Hospitals'))
const Charts = lazy(() => import('./pages/Charts'))
const History = lazy(() => import('./pages/History'))
const Profile = lazy(() => import('./pages/Profile'))

// Cada ruta pide sesión y un rol permitido. Sin sesión va al inicio de sesión (y regresa a donde iba);
// con un rol que no corresponde, al tablero. Así nadie ve pantallas que el servidor le va a negar.
function RequireRole({ roles, children }) {
  const { token, user } = useAuth()
  const location = useLocation()
  if (!token || !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(parseInt(user.roleId))) return <Navigate to="/dashboard" replace />
  return children
}
const STAFF = [1, 2]
const ADMIN = [1]

// Aplica el tema al <html> según la ruta: el oscuro solo en pantallas que ya
// lo soportan (ver DARK_READY_PATHS en utils/theme.js).
function ThemeGate() {
  const { pathname } = useLocation()
  const theme = useTheme()
  useEffect(() => {
    const active = isDarkReady(pathname) ? theme : 'light'
    document.documentElement.dataset.theme = active
  }, [pathname, theme])
  return null
}

function App() {
  return (
    <AuthProvider>
      <RegionProvider>
      <DialogsProvider>
      <BrowserRouter>
        <ThemeGate />
        <Suspense fallback={<div className="route-loading" role="status" aria-label="Cargando"><span className="route-bar" /><span className="route-block skeleton" /><span className="route-block route-block-sm skeleton" /></div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireRole roles={STAFF}><Dashboard /></RequireRole>} />
          

          <Route path="/emergencias/nueva" element={<RequireRole roles={STAFF}><NewEmergency /></RequireRole>} />
          <Route path="/emergencias/:emergencyId" element={<RequireRole roles={STAFF}><EmergencyDetail /></RequireRole>} />
          
          <Route path="/solicitudes" element={<RequireRole roles={STAFF}><Requests /></RequireRole>} />

          <Route path="/hospitales" element={<RequireRole roles={STAFF}><Hospitals /></RequireRole>} />

          <Route path="/graficas" element={<RequireRole roles={STAFF}><Charts /></RequireRole>} />

          <Route path="/historial" element={<RequireRole roles={STAFF}><History /></RequireRole>} />

          <Route path="/perfil" element={<RequireRole roles={STAFF}><Profile /></RequireRole>} />

          <Route path="/admin/usuarios" element={<RequireRole roles={ADMIN}><Users /></RequireRole>} />
          <Route path="/admin/instituciones" element={<RequireRole roles={ADMIN}><Institutions /></RequireRole>} />
          <Route path="/admin/ambulancias" element={<RequireRole roles={ADMIN}><Ambulances /></RequireRole>} />
          <Route path="/admin/pacientes" element={<RequireRole roles={ADMIN}><Patients /></RequireRole>} />
          <Route path="/admin/catalogos-emergencias" element={<RequireRole roles={ADMIN}><EmergencyCatalogs /></RequireRole>} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </DialogsProvider>
      </RegionProvider>
    </AuthProvider>
  )
}

export default App