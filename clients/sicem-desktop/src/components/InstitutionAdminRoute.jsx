import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Se anida DENTRO de PrivateRoute (que ya garantiza sesión válida) — aquí solo
// se exige además is_institution_admin. No basta con ocultar el link del
// navbar: si alguien escribe la URL directo, esto lo redirige igual.
const InstitutionAdminRoute = () => {
    const { user } = useAuth()

    if (!user?.isInstitutionAdmin) {
        return <Navigate to="/pacientes-en-camino" replace />
    }

    return <Outlet />
}

export default InstitutionAdminRoute
