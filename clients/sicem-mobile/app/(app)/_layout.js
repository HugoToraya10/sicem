import { useEffect, useRef } from 'react'
import { Tabs } from 'expo-router'
import * as Location from 'expo-location'
import { AmbulanceProvider, useAmbulance } from '../../context/AmbulanceContext'
import { SocketProvider } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'

// Reporta la ubicación mientras haya turno activo (no solo cuando ya te
// asignaron una emergencia) — el resto del sistema (recomendación de unidad
// más cercana en NewEmergency.jsx de sicem-web) necesita ubicación reciente
// también de las unidades DISPONIBLES, no solo de las ocupadas, para poder
// recomendar cuál mandar. Vive en el _layout (no en una pantalla) para que
// siga corriendo sin importar en qué pestaña estés.
const LocationReporter = () => {
    const { token } = useAuth()
    const { activeAmbulanceId, refreshShift } = useAmbulance()
    const subscriptionRef = useRef(null)

    useEffect(() => {
        let cancelled = false

        const start = async () => {
            if (!activeAmbulanceId || !token) return
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status !== 'granted' || cancelled) return

            subscriptionRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
                (position) => {
                    fetch(`${API_BASE_URL}/unidades/registrar-ubicacion`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            ambulanceId: activeAmbulanceId,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        })
                    }).then((res) => {
                        // 403 = el backend ya no reconoce este dispositivo como el
                        // que tiene turno activo en esta unidad (otro dispositivo lo
                        // tomó, o el turno se cerró/expiró) — se resincroniza el
                        // estado local para que la app deje de creer que sigue en
                        // turno y vuelva sola a la pantalla de "Iniciar turno".
                        if (res.status === 403) refreshShift()
                    }).catch((error) => console.error('Error reportando ubicación. ', error))
                }
            )
        }

        start()

        return () => {
            cancelled = true
            if (subscriptionRef.current) {
                subscriptionRef.current.remove()
                subscriptionRef.current = null
            }
        }
    }, [activeAmbulanceId, token])

    return null
}

const AppLayout = () => {
    return (
        <AmbulanceProvider>
            <SocketProvider>
                <LocationReporter />
                <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#2E7D32' }}>
                    <Tabs.Screen name="index" options={{ title: 'Alerta', tabBarLabel: 'Alerta' }} />
                    <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarLabel: 'Mapa' }} />
                    <Tabs.Screen name="paciente" options={{ title: 'Paciente', tabBarLabel: 'Paciente' }} />
                    <Tabs.Screen name="stats" options={{ title: 'Estadísticas', tabBarLabel: 'Stats' }} />
                    {/* Pantallas alcanzables desde "Paciente", pero no son su propia pestaña */}
                    <Tabs.Screen name="registrar-paciente" options={{ href: null, title: 'Registrar paciente' }} />
                    <Tabs.Screen name="notas" options={{ href: null, title: 'Nota de urgencia' }} />
                </Tabs>
            </SocketProvider>
        </AmbulanceProvider>
    )
}

export default AppLayout
