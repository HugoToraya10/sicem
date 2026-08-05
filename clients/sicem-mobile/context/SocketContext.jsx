import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Alert, Vibration } from 'react-native'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { SOCKET_URL, UNITS_SOCKET_URL, API_BASE_URL } from '../constants/api'
import { toLowerCaseKeys } from '../utils/formatData'

// La BD regresa nombres de columna en MAYÚSCULAS para varias tablas
// (LATITUDE, DESCRIPTION, etc.) — sicem-web lo compensa al leer sus propias
// respuestas REST con este mismo toLowerCaseKeys, pero lo que llega por
// SOCKET (eventEmergencyAssignedToMe) nunca pasaba por esa normalización,
// así que campos como em.latitude quedaban undefined y el mapa no podía
// dibujar nada. Se aplica aquí a lo que llega tanto por socket como por la
// recuperación REST. toLowerCaseKeys no admite null/undefined (revienta con
// Object.entries), por eso cada uso de abajo lo cubre antes de llamarla.

// Los sockets del proyecto se conectan directo al servicio de emergencias
// (puerto 3005), sin pasar por el gateway — mismo patrón que sicem-web/desktop.
const SocketContext = createContext(null)

const SocketProvider = ({ children }) => {
    const { token, logout } = useAuth()
    const socketRef = useRef(null)
    const unitsSocketRef = useRef(null)

    // pendingAlert: emergencia recién asignada, esperando que el paramédico
    // la "vea" (acknowledgeAlert — no es un aceptar/rechazar, ver comentario
    // ahí abajo). acceptedEmergency: la que ya se reconoció y está en curso
    // (sigue disponible aunque cambies de pestaña, por eso vive aquí y no en
    // la pantalla).
    const [pendingAlert, setPendingAlert] = useState(null)
    const [acceptedEmergency, setAcceptedEmergency] = useState(null)
    // Se incrementa cada vez que llega eventPatientRegistered para MI
    // emergencia — paciente.js lo agrega como dependencia de su fetch para
    // refrescar la lista al instante en vez de esperar el poll/focus manual
    // (antes había que salir y volver a entrar a la pestaña para ver a un
    // paciente recién registrado desde sicem-web/NewEmergency.jsx).
    const [patientListVersion, setPatientListVersion] = useState(0)
    // Para el foquito de "conectado/sin conexión" en la pestaña Alerta — si
    // esto está en false, el paramédico NO puede confiar en que "no me ha
    // sonado nada" signifique "no hay nada".
    const [connected, setConnected] = useState(false)
    // El efecto de abajo solo vuelve a correr cuando cambia `token`, así que
    // su closure de "connect" quedaría con el pendingAlert de cuando se creó
    // (obsoleto) si se leyera el state directo — esta ref siempre tiene el
    // valor más reciente sin necesidad de reconectar el socket por eso.
    const pendingAlertRef = useRef(null)
    useEffect(() => { pendingAlertRef.current = pendingAlert }, [pendingAlert])
    // Mismo motivo que pendingAlertRef — el efecto del socket solo depende de
    // `token`, así que necesita esto para saber, en cualquier momento, cuál
    // es la emergencia aceptada VIGENTE sin reconectar el socket por eso.
    const acceptedEmergencyRef = useRef(null)
    useEffect(() => { acceptedEmergencyRef.current = acceptedEmergency }, [acceptedEmergency])

    useEffect(() => {
        if (!token) {
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
            setConnected(false)
            return
        }

        const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] })
        socketRef.current = socket

        socket.on('connect', () => {
            setConnected(true)
            // "Ponerse al día" — por si se perdió una alerta mientras el socket
            // estuvo desconectado (pasa solo: segundo plano, WiFi que parpadea).
            // Se corre en CADA conexión, no solo la primera, porque cada
            // reconexión es exactamente el momento en el que pudo haberse
            // perdido algo.
            fetch(`${API_BASE_URL}/emergencias/mi-emergencia-actual`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then((res) => res.json())
                .then(({ data }) => {
                    if (!data) {
                        // El backend ya no reporta NINGUNA emergencia activa para mi
                        // turno — si el celular seguía mostrando una, hay que
                        // soltarla: pudo haberse cerrado desde sicem-web/desktop
                        // mientras el socket estuvo desconectado. Es la misma regla
                        // que eventEmergencyClosed de abajo: el paramédico nunca
                        // decide esto por su cuenta, solo lo reconcilia con lo que
                        // diga el backend.
                        setAcceptedEmergency(null)
                        return
                    }
                    setAcceptedEmergency((current) => {
                        // Si ya coincide con lo que dice el backend, no hay nada que
                        // reconciliar.
                        if (current && String(current.emergencyId) === String(data.emergency_id)) return current
                        // Si hay un aviso pendiente de aceptar (pendingAlert) para
                        // ESTA MISMA emergencia, se deja que el flujo normal de
                        // aceptar/rechazar lo maneje — no hay que adelantarse.
                        if (pendingAlertRef.current && String(pendingAlertRef.current.emergencyId) === String(data.emergency_id)) return current
                        // BUG REAL corregido: antes, si `current` ya tenía CUALQUIER
                        // valor (aunque fuera de una emergencia VIEJA que el backend
                        // ya había dejado de considerar "la mía" — p. ej. porque el
                        // despachador asignó la unidad a una emergencia nueva y el
                        // aviso en vivo no llegó a tiempo), esta función lo dejaba
                        // intacto y el celular se quedaba mostrando la emergencia
                        // vieja para siempre (con sus pacientes viejos, no los de la
                        // nueva). El backend (mi-emergencia-actual, que ya elige la
                        // asignación más reciente de la unidad) es quien manda: se
                        // trata como YA ACEPTADA (no como pendiente de
                        // Aceptar/Rechazar) — el despachador ya asignó la unidad y la
                        // marcó "En camino" independientemente de si el aviso llegó o
                        // no, no tiene sentido hacer que el paramédico "acepte" algo
                        // que operativamente ya está en curso.
                        return { emergencyId: data.emergency_id, ambulanceId: data.ambulance_id, notes: data.notes, emergency: toLowerCaseKeys(data) }
                    })
                    // Un pendingAlert que ya no coincide con lo que el backend
                    // considera vigente (p. ej. la unidad se reasignó antes de que
                    // se llegara a acuse de recibido) ya no debe seguir pidiendo
                    // que se acepte — quedaría un banner fantasma.
                    setPendingAlert((currentPending) =>
                        (currentPending && String(currentPending.emergencyId) !== String(data.emergency_id)) ? null : currentPending
                    )
                })
                .catch((error) => console.error('Error revisando si hay una emergencia en curso perdida. ', error))
        })
        socket.on('disconnect', () => setConnected(false))

        socket.on('eventEmergencyAssignedToMe', (payload) => {
            setPendingAlert({ ...payload, emergency: payload.emergency ? toLowerCaseKeys(payload.emergency) : null })
            // Vibración insistente (patrón repetido) para que sea imposible no
            // notarla — se detiene sola al aceptar/rechazar (ver abajo). No usa
            // sonido de sistema porque esto es un evento de socket con la app
            // ABIERTA, no una notificación push del sistema operativo (esa ya
            // trae su propio sonido).
            Vibration.vibrate([0, 600, 300, 600, 300, 600], true)
        })

        // Único lugar legítimo donde se suelta una emergencia en curso en el
        // celular: cuando el CRUM/hospital de VERDAD la cerró
        // (closeEmergency/forceCloseEmergency, roles 1/2 en emergencias, que
        // emiten esto al room 'paramedic'). El paramédico no tiene — ni debe
        // tener — un botón para esto: ver fundamentos-legales/
        // autoridad-crum-sobre-tamp-paramedico.txt. Antes existía un botón
        // "Terminar seguimiento" en mapa.js que llamaba a esto manualmente —
        // se quitó porque solo limpiaba la pantalla del celular sin avisarle
        // a nadie ni cerrar nada de verdad en el backend, dejando la unidad
        // "perdida" (seguía Trasladando, la emergencia seguía abierta, y
        // nadie en sicem-web/desktop se enteraba de que el paramédico ya no
        // la estaba siguiendo).
        socket.on('eventEmergencyClosed', ({ emergencyId }) => {
            setAcceptedEmergency((current) => (current && String(current.emergencyId) === String(emergencyId)) ? null : current)
            setPendingAlert((current) => (current && String(current.emergencyId) === String(emergencyId)) ? null : current)
        })

        // El despachador (o el hospital, si la unidad tuvo una falla) desasignó
        // TU unidad de esta emergencia — antes esto solo le llegaba a
        // sicem-web/desktop, el celular se enteraba hasta la próxima
        // reconexión del socket (cerrar e iniciar sesión de nuevo). Se trata
        // igual que eventEmergencyClosed (única forma legítima de soltar una
        // emergencia en curso — ver el comentario de arriba), más un aviso
        // explícito de por qué.
        socket.on('eventAmbulanceUnassigned', ({ emergencyId, reason }) => {
            const current = acceptedEmergencyRef.current
            if (!current || String(current.emergencyId) !== String(emergencyId)) return
            setAcceptedEmergency(null)
            setPendingAlert((currentPending) => (currentPending && String(currentPending.emergencyId) === String(emergencyId)) ? null : currentPending)
            Alert.alert(
                'Unidad desasignada',
                reason === 'ambulance_failure'
                    ? 'Tu unidad fue desasignada de esta emergencia debido a la falla reportada.'
                    : 'Tu unidad fue desasignada de esta emergencia.'
            )
        })

        // El hospital destino rechazó recibir a un paciente que llevas —
        // antes esto solo le llegaba al despachador/hospital, nunca a quien
        // sigue con el paciente físicamente encima. Se manda dirigido (ver
        // confirmPatientReception en emergencias), así que si llega aquí es
        // porque de verdad te toca a ti saberlo.
        socket.on('eventPatientReceptionUpdated', ({ accepted, rejectionReason }) => {
            if (accepted) return
            Alert.alert(
                'Recepción rechazada',
                rejectionReason
                    ? `Tu hospital destino rechazó recibir al paciente: ${rejectionReason}`
                    : 'Tu hospital destino rechazó recibir al paciente. Consulta con tu CRUM/hospital cómo proceder.'
            )
        })

        // Paciente registrado (desde este mismo celular, o desde
        // NewEmergency.jsx en sicem-web para la misma emergencia) — antes esto
        // solo le llegaba a 'hospital', ver registerEmergencyPatient en
        // services/emergencias/controllers/emergency.js. Solo cuenta si es
        // para la emergencia que tengo aceptada ahora mismo.
        socket.on('eventPatientRegistered', ({ emergencyId }) => {
            const current = acceptedEmergencyRef.current
            if (current && String(current.emergencyId) === String(emergencyId)) {
                setPatientListVersion((v) => v + 1)
            }
        })

        return () => { socket.disconnect(); socketRef.current = null; setConnected(false) }
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

    // NO es un "aceptar/rechazar" — el despachador (CRUM, misma institución)
    // ya decidió y ya marcó la unidad "En camino"; el paramédico no tiene
    // margen para decidir si atiende o no una asignación directa de su
    // propia institución (ver fundamentos-legales/ — el paramédico ejecuta,
    // no decide la disponibilidad operativa de la unidad). Esto es solo un
    // acuse de recibido: "ya la vi, voy para allá". Un verdadero
    // aceptar/rechazar solo tendría sentido para una solicitud
    // INTERINSTITUCIONAL (esa la acepta/rechaza el HOSPITAL desde
    // sicem-desktop, no el paramédico desde el celular — ver
    // registerInterInstitutionalRequest en el backend, es un flujo aparte
    // que ni siquiera le llega a esta pantalla).
    const acknowledgeAlert = () => {
        if (!pendingAlert) return
        Vibration.cancel()
        setAcceptedEmergency(pendingAlert)
        setPendingAlert(null)
    }

    return (
        <SocketContext.Provider value={{ pendingAlert, acceptedEmergency, acknowledgeAlert, connected, patientListVersion }}>
            {children}
        </SocketContext.Provider>
    )
}

const useSocketAlerts = () => useContext(SocketContext)

export { SocketProvider, useSocketAlerts }
