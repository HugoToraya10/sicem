import {io} from 'socket.io-client'
import {UNITS_SOCKET_URL} from '../config/api'

// El servicio de unidades tiene su PROPIO servidor de Socket.IO (puerto
// 3003), separado del de emergencias (3005, ver emergencySocket.js) — son
// procesos de Node distintos, cada uno con su propia instancia de io.
// sicem-desktop no tenía ninguna conexión a este socket todavía (solo
// escuchaba emergencias) — hacía falta para poder recibir avisos que solo
// vienen de aquí, como eventAmbulanceFailureReported (falla reportada por
// el paramédico desde sicem-mobile).
const connectUnitsSocket = (token) => {
    return io(UNITS_SOCKET_URL, {
        auth: {
            token: token
        }
    })
}

export {connectUnitsSocket};
