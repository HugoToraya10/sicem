import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './layout/Navbar'
import { getNavLinks } from '../utils/Navlinks'

// Esta app es exclusiva para admin (1) y hospital (4) — mismo criterio que Login.jsx
// usa antes de guardar la sesión. Si por lo que sea llega aquí un token/usuario que
// no cumple, se trata igual que "no hay sesión válida".
const PrivateRoute = () => {
    const { user, token } = useAuth()
    const isAuthorized = Boolean(token) && Boolean(user) &&
        (parseInt(user.roleId) === 1 || parseInt(user.roleId) === 4)

    if (!isAuthorized) {
        return <Navigate to="/login" replace />
    }

    return (
        <>
            <Navbar
                userName={user.firstName || 'Usuario'}
                roleLabel={parseInt(user.roleId) === 1 ? 'Administrador' : 'Hospital'}
                links={getNavLinks(user.roleId)}
            />
            <Outlet />
        </>
    )
}

export default PrivateRoute
