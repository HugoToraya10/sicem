import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { SOCKET_URL, UNITS_SOCKET_URL } from '../constants/api'

// Los sockets del proyecto se conectan directo al servicio de emergencias
// (puerto 3005), sin pasar por el gateway — mismo patrón que sicem-web/desktop.
const SocketContext = createContext(null)

const SocketProvider = ({ children }) => {
    const { token, logout } = useAuth()
    const socketRef = useRef(null)
    const unitsSocketRef = useRef(null)

    // pendingAlert: emergencia recién asignada, esperando Aceptar/Rechazar.
    // acceptedEmergency: la que ya se aceptó y está en curso (sigue disponible
    // aunque cambies de pestaña, por eso vive aquí y no en la pantalla).
    const [pendingAlert, setPendingAlert] = useState(null)
    const [acceptedEmergency, setAcceptedEmergency] = useState(null)

    useEffect(() => {
        if (!token) {
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
            return
        }

        const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] })
        socketRef.current = socket

        socket.on('eventEmergencyAssignedToMe', (payload) => {
            setPendingAlert(payload)
        })

        return () => { socket.disconnect(); socketRef.current = null }
    }, [token])

    // Conexión aparte al servicio de unidades (puerto 3003, su propio
    // servidor de Socket.IO) — solo para recibir eventForceLogout: cuando el
    // backend cierra un turno solo porque ya pasó el horario laboral +
    // gracia, avisa por aquí para que el celular cierre la sesión sin que el
    // paramédico tenga que hacer nada.
    useEffect(() => {
        if (!token) {
            if (unitsSocketRef.current) { unitsSocketRef.current.disconnect(); unitsSocketRef.current = null }
            return
        }

        const unitsSocket = io(UNITS_SOCKET_URL, { auth: { token }, transports: ['websocket'] })
        unitsSocketRef.current = unitsSocket

        unitsSocket.on('eventForceLogout', ({ reason }) => {
            Alert.alert('Turno finalizado', reason || 'Tu turno se cerró automáticamente porque terminó tu horario laboral.')
            logout()
        })

        return () => { unitsSocket.disconnect(); unitsSocketRef.current = null }
    }, [token])

    const acceptAlert = () => {
        if (!pendingAlert) return
        setAcceptedEmergency(pendingAlert)
        setPendingAlert(null)
    }

    const rejectAlert = () => {
        // TODO: avisarle al despachador que esta unidad no puede atender —
        // por ahora solo la descarta localmente, no hay endpoint para esto todavía.
        setPendingAlert(null)
    }

    const clearAcceptedEmergency = () => setAcceptedEmergency(null)

    return (
        <SocketContext.Provider value={{ pendingAlert, acceptedEmergency, acceptAlert, rejectAlert, clearAcceptedEmergency }}>
            {children}
        </SocketContext.Provider>
    )
}

const useSocketAlerts = () => useContext(SocketContext)

export { SocketProvider, useSocketAlerts }
