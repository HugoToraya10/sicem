import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import * as Location from 'expo-location'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'

const toLowerCaseKeys = (obj) => {
    const out = {}
    for (const key in obj) out[key.toLowerCase()] = obj[key]
    return out
}

// Misma ruta real (no línea recta) que usa NewEmergency.jsx en sicem-web —
// servidor demo público de OSRM, mismo ecosistema OSM que el resto del proyecto.
const fetchRoute = (originLat, originLon, destLat, destLon) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson`
    return fetch(url)
        .then((res) => res.json())
        .then((data) => {
            if (data.code !== 'Ok' || !data.routes?.[0]) return null
            return {
                distanceKm: data.routes[0].distance / 1000,
                durationMin: data.routes[0].duration / 60,
                coordinates: data.routes[0].geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
            }
        })
        .catch((error) => { console.error('Error consultando ruta en OSRM. ', error); return null })
}

const MapaScreen = () => {
    const { token } = useAuth()
    const { activeAmbulanceId } = useAmbulance()
    const { acceptedEmergency, clearAcceptedEmergency } = useSocketAlerts()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [myLocation, setMyLocation] = useState(null)
    const [route, setRoute] = useState(null)
    const [statuses, setStatuses] = useState([])
    const [updatingStatus, setUpdatingStatus] = useState(false)

    const em = acceptedEmergency?.emergency

    useEffect(() => {
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
            if (status !== 'granted') return
            Location.getCurrentPositionAsync({})
                .then((pos) => {
                    setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                })
                // GPS apagado o no disponible (común en emuladores) — no debe
                // tumbar la pantalla, solo se queda sin marcar "mi ubicación".
                .catch((error) => console.warn('No se pudo obtener tu ubicación (¿GPS apagado?). ', error.message))
        }).catch((error) => console.warn('Error pidiendo permiso de ubicación. ', error.message))
    }, [])

    useEffect(() => {
        fetch(`${API_BASE_URL}/unidades/estados-ambulancia`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => setStatuses((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando estados de ambulancia. ', err))
    }, [])

    useEffect(() => {
        if (!myLocation || !em?.latitude || !em?.longitude) { setRoute(null); return }
        fetchRoute(myLocation.latitude, myLocation.longitude, parseFloat(em.latitude), parseFloat(em.longitude)).then(setRoute)
    }, [myLocation, em])

    const handleUpdateStatus = (statusId) => {
        if (!activeAmbulanceId) return
        setUpdatingStatus(true)
        fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ ambulanceId: activeAmbulanceId, ambulanceStatusId: statusId })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo actualizar el estado.')
            }))
            .catch((err) => { console.error('Error actualizando estado. ', err); Alert.alert('Error', err.message) })
            .finally(() => setUpdatingStatus(false))
    }

    if (!em) {
        return (
            <View style={styles.centered}>
                <Text style={styles.hint}>No tienes ninguna emergencia en curso. Cuando aceptes una desde la pestaña Alerta, aquí verás la navegación.</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.mapWrapper}>
                {myLocation ? (
                    <MapView
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: myLocation.latitude,
                            longitude: myLocation.longitude,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                    >
                        <Marker coordinate={myLocation} title="Tu ubicación" pinColor="#1565C0" />
                        {em?.latitude && em?.longitude && (
                            <Marker
                                coordinate={{ latitude: parseFloat(em.latitude), longitude: parseFloat(em.longitude) }}
                                title="Emergencia"
                                pinColor="#C0272D"
                            />
                        )}
                        {route?.coordinates && <Polyline coordinates={route.coordinates} strokeColor="#C0272D" strokeWidth={4} />}
                    </MapView>
                ) : (
                    <View style={styles.centered}><ActivityIndicator color="#1565C0" /></View>
                )}
            </View>

            <ScrollView style={styles.bottomPanel} contentContainerStyle={{ padding: 14 }}>
                <Text style={styles.emergencyType}>{em?.type_name || 'Emergencia'}</Text>
                {em?.description ? <Text style={styles.hint}>{em.description}</Text> : null}

                {route && (
                    <View style={styles.metrics}>
                        <View>
                            <Text style={styles.metricLabel}>Tiempo estimado</Text>
                            <Text style={[styles.metricValue, { color: '#C0272D' }]}>{Math.round(route.durationMin)} min</Text>
                        </View>
                        <View>
                            <Text style={styles.metricLabel}>Distancia</Text>
                            <Text style={styles.metricValue}>{route.distanceKm.toFixed(1)} km</Text>
                        </View>
                    </View>
                )}

                <Text style={styles.sectionTitle}>Estado de la unidad</Text>
                <View style={styles.statusRow}>
                    {statuses.map((s) => (
                        <TouchableOpacity
                            key={s.ambulance_status_id}
                            style={styles.statusChip}
                            onPress={() => handleUpdateStatus(s.ambulance_status_id)}
                            disabled={updatingStatus}
                        >
                            <Text style={styles.statusChipText}>{s.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.finishButton} onPress={clearAcceptedEmergency}>
                    <Text style={styles.finishButtonText}>Terminar seguimiento de esta emergencia</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    mapWrapper: { flex: 1 },
    bottomPanel: { maxHeight: 260, borderTopWidth: 1, borderTopColor: '#eee' },
    emergencyType: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
    hint: { fontSize: 12, color: '#888', marginTop: 4, marginBottom: 8 },
    metrics: { flexDirection: 'row', gap: 24, marginVertical: 8 },
    metricLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
    metricValue: { fontSize: 18, fontWeight: '700', color: '#222' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    statusChip: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
    statusChipText: { color: '#1565C0', fontSize: 12, fontWeight: '600' },
    finishButton: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 10, alignItems: 'center' },
    finishButtonText: { color: '#666', fontSize: 12 },
})

export default MapaScreen
