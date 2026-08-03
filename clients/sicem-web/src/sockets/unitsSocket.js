import {io} from 'socket.io-client'

// El servicio de unidades tiene su PROPIO servidor de Socket.IO (puerto
// 3003), separado del de emergencias (3005, ver emergencySocket.js) — son
// procesos de Node distintos, cada uno con su propia instancia de io. Hace
// falta esta conexión aparte para recibir eventAmbulanceStatusChanged
// (emitido al iniciar/terminar turno o cambiar el estado de una unidad).
const connectUnitsSocket = (token) => {
    return io('http://localhost:3003', {
        auth: {
            token: token
        }
    })
}

export {connectUnitsSocket};
