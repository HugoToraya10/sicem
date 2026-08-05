import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useAuth } from './AuthContext'
import { API_BASE_URL } from '../constants/api'

// Turno real, respaldado por el backend (tabla ambulance_shifts) — ya no es
// solo una selección guardada en el celular. Al abrir la app se pregunta si
// ya había un turno activo (por si se cerró la app sin terminarlo), y al
// iniciar/terminar turno se llama al backend de verdad — así el sistema sabe
// a quién dirigirle la alerta cuando le asignan una unidad a una emergencia.
const AmbulanceContext = createContext(null)

const AmbulanceProvider = ({ children }) => {
    const { token, logout } = useAuth()
    // { ambulanceId, unitNumber, scheduledEnd (string ISO o null), ambulanceStatusId } | null —
    // scheduledEnd y unitNumber son para el contador de turno y la tarjeta de
    // "en qué unidad estás" en la pestaña Alerta. ambulanceStatusId es la
    // fuente de verdad que usa mapa.js para saber qué botón "Pasar a X"
    // mostrarle al paramédico — se vuelve a pedir con refreshShift() después
    // de cada cambio de estado, en vez de llevar un estado optimista aparte.
    const [activeShift, setActiveShift] = useState(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const fetchActiveShift = useCallback(() => {
        if (!token) { setLoading(false); return }
        fetch(`${API_BASE_URL}/unidades/mi-turno-activo`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setActiveShift(data ? {
                ambulanceId: data.ambulance_id,
                unitNumber: data.unit_number,
                scheduledEnd: data.scheduled_end,
                ambulanceStatusId: data.ambulance_status_id,
            } : null))
            .catch((err) => console.error('Error consultando turno activo. ', err))
            .finally(() => setLoading(false))
    }, [token])

    useEffect(() => { fetchActiveShift() }, [fetchActiveShift])

    const activeAmbulanceId = activeShift?.ambulanceId ?? null

    // El aviso por socket (eventForceLogout, ver SocketContext.jsx) es rápido
    // cuando llega, pero depende de que el socket esté conectado en ese
    // instante — si el celular está quieto (sin moverse, el reporte de
    // ubicación tampoco dispara solo) o el socket se cayó un momento, nunca
    // se enteraría. Este poll es el respaldo confiable: cada 10s (mismo
    // intervalo que el barrido del backend, SHIFT_EXPIRY_SWEEP_INTERVAL_MS en
    // controllers/unit.js), mientras haya un turno activo LOCALMENTE, se le
    // pregunta al backend si sigue siendo cierto. Si el backend ya dice que
    // no (lo cerró el barrido de vencimiento de horario, u otro dispositivo),
    // la pantalla se cancela YA (vuelve a "Iniciar turno") y se cierra la
    // sesión, igual que si hubiera llegado el aviso por socket.
    useEffect(() => {
        if (!activeAmbulanceId || !token) return
        const interval = setInterval(() => {
            fetch(`${API_BASE_URL}/unidades/mi-turno-activo`, { headers })
                .then((res) => res.json())
                .then(({ data }) => {
                    if (!data) {
                        setActiveShift(null)
                        Alert.alert('Turno finalizado', 'Tu turno se cerró automáticamente porque terminó tu horario laboral.')
                        logout()
                    }
                })
                .catch((err) => console.error('Error revisando si el turno sigue activo. ', err))
        }, 10000)
        return () => clearInterval(interval)
    }, [activeAmbulanceId, token])

    const startShift = (ambulanceId) => {
        setBusy(true)
        return fetch(`${API_BASE_URL}/unidades/iniciar-turno`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ambulanceId })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo iniciar el turno.')
                // Se vuelve a pedir el turno completo (no solo el ID) para tener
                // scheduledEnd/unitNumber ya listos para la pantalla.
                return fetchActiveShift()
            }))
            .finally(() => setBusy(false))
    }

    const endShift = () => {
        setBusy(true)
        return fetch(`${API_BASE_URL}/unidades/terminar-turno`, { method: 'PATCH', headers })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo terminar el turno.')
                setActiveShift(null)
            }))
            .finally(() => setBusy(false))
    }

    return (
        <AmbulanceContext.Provider value={{
            activeAmbulanceId, unitNumber: activeShift?.unitNumber ?? null, scheduledEnd: activeShift?.scheduledEnd ?? null,
            ambulanceStatusId: activeShift?.ambulanceStatusId ?? null,
            loading, busy, startShift, endShift, refreshShift: fetchActiveShift,
        }}>
            {children}
        </AmbulanceContext.Provider>
    )
}

const useAmbulance = () => useContext(AmbulanceContext)

export { AmbulanceProvider, useAmbulance }
