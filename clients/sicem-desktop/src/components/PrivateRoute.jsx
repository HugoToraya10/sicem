import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './layout/Navbar'
import { getNavLinks } from '../utils/Navlinks'
import { connectEmergencySocket } from '../sockets/emergencySocket'
import { connectUnitsSocket } from '../sockets/unitsSocket'
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

    // Falla reportada por el paramédico desde sicem-mobile (solo avisa — no
    // cambia el estado de la unidad por su cuenta, eso lo decide este
    // hospital). Va en un socket aparte (unidades, puerto 3003) porque es el
    // servicio dueño de esa información, no emergencias.
    useEffect(() => {
        if (!isAuthorized) return
        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventAmbulanceFailureReported', (data) => {
            if (data?.institutionId && parseInt(data.institutionId) === parseInt(user.institutionId)) {
                const who = data.paramedicName ? `${data.paramedicName} — ` : ''
                alertNewPatient(`Falla reportada: ${data.unitNumber || 'unidad'}`, `${who}${data.note || ''}`)
            }
        })
        // "Concluir traslado" (tipo Uber "terminar viaje") desde sicem-mobile —
        // el resaltado en rojo vive en Tracking.jsx (la tarjeta del paciente),
        // esto es solo la notificación nativa para que se entere aunque tenga
        // abierta otra pantalla (Pacientes en Camino, Historial, etc.).
        unitsSocket.on('eventTransferConcluded', (data) => {
            const mine = (data?.hospitalInstitutionIds || []).some((id) => parseInt(id) === parseInt(user.institutionId))
            if (mine) {
                const who = data.paramedicName ? `${data.paramedicName} — ` : ''
                alertNewPatient(`${data.unitNumber || 'Unidad'} dice haber llegado`, `${who}Confirma la llegada física en Seguimiento.`)
            }
        })
        return () => unitsSocket.disconnect()
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
