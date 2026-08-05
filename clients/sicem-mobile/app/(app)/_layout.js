import { useEffect, useRef } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { AmbulanceProvider, useAmbulance } from '../../context/AmbulanceContext'
import { SocketProvider } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { registerForPushNotificationsAsync } from '../../utils/pushNotifications'

// Registra (o renueva) el token de notificaciones push apenas hay sesión —
// una vez que el backend lo tiene guardado, puede avisarle a este celular de
// una emergencia asignada AUNQUE la app esté cerrada (ver
// registerAssignment en services/emergencias, que manda por FCM además de
// por socket). No hace falta turno activo para esto, a diferencia del
// reporte de ubicación — el aviso de emergencia asignada debe llegar siempre
// que el paramédico tenga sesión iniciada.
const PushNotificationRegistrar = () => {
    const { token } = useAuth()

    useEffect(() => {
        if (!token) return
        let cancelled = false

        registerForPushNotificationsAsync().then((pushToken) => {
            if (!pushToken || cancelled) return
            fetch(`${API_BASE_URL}/usuarios/registrar-push-token`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ pushToken })
            }).catch((error) => console.error('Error registrando token de notificaciones. ', error))
        })

        return () => { cancelled = true }
    }, [token])

    return null
}

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

            try {
                // Mismo intervalo/precisión que usa mapa.js para su propio
                // punto azul (BestForNavigation, 3s/10m) — antes esto
                // reportaba cada 15s/30m, así que el dashboard/NewEmergency en
                // sicem-web (que solo pueden ser tan rápidos como lo que el
                // celular les manda) se sentían más lentos que el mapa del
                // propio celular. OJO: esto corre TODO el turno, no solo
                // mientras se ve la pantalla del mapa — reportar tan seguido
                // consume más batería/datos que antes; si eso se vuelve un
                // problema real, hay que subir estos números de nuevo.
                subscriptionRef.current = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 10 },
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
            } catch (error) {
                // GPS/servicios de ubicación apagados o no disponibles (común en
                // emuladores sin ubicación configurada) — no debe tumbar la app,
                // solo se deja de reportar ubicación hasta que haya señal.
                console.warn('No se pudo iniciar el reporte de ubicación (¿GPS apagado?). ', error.message)
            }
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
                <PushNotificationRegistrar />
                {/* Sin tabBarIcon, expo-router/React Navigation reservaba el
                espacio del ícono igual pero sin nada válido que dibujar ahí —
                de ahí el "recuadrito que no cargó" que veía Hugo en las 4
                pestañas visibles. Ionicons ya se usaba en mapa.js (el botón de
                centrar mapa), aquí es el mismo paquete, solo que antes nadie
                lo había conectado al propio tab bar. */}
                <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#2E7D32' }}>
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: 'Alerta', tabBarLabel: 'Alerta',
                            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />,
                        }}
                    />
                    <Tabs.Screen
                        name="mapa"
                        options={{
                            title: 'Mapa', tabBarLabel: 'Mapa',
                            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />,
                        }}
                    />
                    <Tabs.Screen
                        name="paciente"
                        options={{
                            title: 'Paciente', tabBarLabel: 'Paciente',
                            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />,
                        }}
                    />
                    <Tabs.Screen
                        name="stats"
                        options={{
                            title: 'Estadísticas', tabBarLabel: 'Stats',
                            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={size} color={color} />,
                        }}
                    />
                    {/* Pantallas alcanzables desde "Paciente", pero no son su propia pestaña */}
                    <Tabs.Screen name="registrar-paciente" options={{ href: null, title: 'Registrar paciente' }} />
                    <Tabs.Screen name="notas" options={{ href: null, title: 'Nota de urgencia' }} />
                    <Tabs.Screen name="expediente" options={{ href: null, title: 'Expediente clínico' }} />
                    <Tabs.Screen name="perfil" options={{ href: null, title: 'Mi perfil' }} />
                </Tabs>
            </SocketProvider>
        </AmbulanceProvider>
    )
}

export default AppLayout
