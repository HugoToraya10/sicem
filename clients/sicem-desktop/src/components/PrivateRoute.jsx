import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './layout/Navbar'
import { getNavLinks } from '../utils/Navlinks'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { ensureNotificationPermission, alertNewPatient } from '../utils/notify'

// Esta app es exclusiva para admin (1) y hospital (4) — mismo criterio que Login.jsx
// usa antes de guardar la sesión. Si por lo que sea llega aquí un token/usuario que
// no cumple, se trata igual que "no hay sesión válida".
const PrivateRoute = () => {
    const { user, token } = useAuth()
    const isAuthorized = Boolean(token) && Boolean(user) &&
        (parseInt(user.roleId) === 1 || parseInt(user.roleId) === 4)

    // Este aviso vive aquí (montado siempre, en toda la sesión) y no dentro de
    // IncomingUnitRequests.jsx — si viviera solo ahí, un hospital que tuviera
    // abierta cualquier otra pantalla (lo normal, ya que "Pacientes en Camino"
    // es la de aterrizaje) nunca se hubiera enterado de la solicitud nueva.
    useEffect(() => {
        if (!isAuthorized) return
        ensureNotificationPermission()
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventInterInstitutionalRequest', (data) => {
            if (data?.receivingInstitutionId && parseInt(data.receivingInstitutionId) === parseInt(user.institutionId)) {
                alertNewPatient('Nueva solicitud de unidad', 'Otra institución quiere pedir prestada una de tus ambulancias.')
            }
        })
        // El despachador puede cancelar una solicitud que este hospital YA había
        // aceptado (p. ej. pidió dos unidades de más) — como sí se había
        // comprometido la unidad, merece el mismo aviso que una solicitud nueva.
        emergencySocket.on('eventInterInstitutionalRequestResponded', (data) => {
            if (parseInt(data?.requestStatusId) === 4 && data?.receivingInstitutionId && parseInt(data.receivingInstitutionId) === parseInt(user.institutionId)) {
                alertNewPatient('Solicitud de unidad cancelada', 'El despachador ya no necesita una unidad que habías aceptado.')
            }
        })
        return () => emergencySocket.disconnect()
    }, [isAuthorized, token, user])

    if (!isAuthorized) {
        return <Navigate to="/login" replace />
    }

    return (
        <>
            <Navbar
                userName={user.firstName || 'Usuario'}
                roleLabel={parseInt(user.roleId) === 1 ? 'Administrador' : 'Hospital'}
                links={getNavLinks(user.roleId, user.isInstitutionAdmin)}
            />
            <Outlet />
        </>
    )
}

export default PrivateRoute
