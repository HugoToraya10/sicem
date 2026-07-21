import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import IncomingPatients from './pages/IncomingPatients'
import Capacity from './pages/Capacity'
import History from './pages/History'
import Charts from './pages/Charts'

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
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<RootRedirect />} />

                    <Route element={<PrivateRoute />}>
                        <Route path="/pacientes-en-camino" element={<IncomingPatients />} />
                        <Route path="/capacidad" element={<Capacity />} />
                        <Route path="/historial" element={<History />} />
                        <Route path="/graficas" element={<Charts />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
