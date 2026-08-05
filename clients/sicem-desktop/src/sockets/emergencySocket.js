import {io} from 'socket.io-client'
import {SOCKET_URL} from '../config/api'

const connectEmergencySocket = (token) => {
    return io(SOCKET_URL, {
        auth: {
            token: token
        }
    })
}

export {connectEmergencySocket};