import {io} from 'socket.io-client'

const connectEmergencySocket = (token) => {
    return io('http://localhost:3005', {
        auth: {
            token: token
        }
    })
}

export {connectEmergencySocket};