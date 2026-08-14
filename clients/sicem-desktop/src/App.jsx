import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import InstitutionAdminRoute from './components/InstitutionAdminRoute'
import Login from './pages/Login'
import IncomingPatients from './pages/IncomingPatients'
import Patients from './pages/Patients'
import Tracking from './pages/Tracking'
import IncomingUnitRequests from './pages/IncomingUnitRequests'
import Capacity from './pages/Capacity'
import History from './pages/History'
import Charts from './pages/Charts'
import MyAmbulances from './pages/MyAmbulances'
import HospitalAdmin from './pages/HospitalAdmin'

// "/" no tiene pantalla propia: solo decide a dónde mandar según si hay
// sesión válida (mismo criterio que PrivateRoute).
const RootRedirect = () => {
    const { user, token } = useAuth()
    const isAuthorized = Boolean(token) && Boolean(user) &&
        (parseInt(user.roleId) === 1 || parseInt(user.roleId) === 4)
    return <Navigate to={isAuthorized ? '/pacientes-en-camino' : '/login'} replace />
}

function App() {
    return (
        <AuthProvider>
            <HashRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<RootRedirect />} />

                    <Route element={<PrivateRoute />}>
                        <Route path="/pacientes-en-camino" element={<IncomingPatients />} />
                        <Route path="/pacientes" element={<Patients />} />
                        <Route path="/seguimiento" element={<Tracking />} />
                        <Route path="/solicitudes-unidad" element={<IncomingUnitRequests />} />
                        <Route path="/capacidad" element={<Capacity />} />
                        <Route path="/historial" element={<History />} />
                        <Route path="/graficas" element={<Charts />} />
                        <Route path="/mis-ambulancias" element={<MyAmbulances />} />

                        <Route element={<InstitutionAdminRoute />}>
                            <Route path="/administracion" element={<HospitalAdmin />} />
                        </Route>
                    </Route>
                </Routes>
            </HashRouter>
        </AuthProvider>
    )
}

export default App
