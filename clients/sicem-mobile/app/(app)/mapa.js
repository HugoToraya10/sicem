import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native'
import { Alert } from '../../utils/alert'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors } from '../../constants/theme'
import { Button, Chip, StepTracker, TriageBadge } from '../../components/ui'

// Duración y distancia legibles: "47 min", "2 h 5 min", "850 m", "12.4 km".
const formatDuration = (minutes) => {
    const m = Math.max(0, Math.round(minutes))
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`
}
const formatMeters = (meters) => {
    const m = Math.round(meters)
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}


// Nada de Google Maps (cobra y necesita API key) — el resto del proyecto
// (sicem-web, MapArea.jsx) usa Leaflet + tiles de OpenStreetMap, así que el
// celular hace lo mismo dentro de un WebView (React Native no tiene DOM, no
// se puede montar Leaflet directo como en el navegador). El HTML se genera
// aquí mismo con los datos ya resueltos — sin backend propio para esto ni
// dependencias nativas de mapas.
//
// hospitalLocation (opcional) es el hospital destino del paciente que va en
// MI ambulancia — se dibuja siempre que ya se conozca (aunque todavía no sea
// la etapa de "Trasladando"), así el paramédico ya sabe hacia dónde va a
// terminar yendo. Morado (#6A4C9C) porque es el mismo color que sicem-web usa
// para el estado "Trasladando" (MapArea.jsx, statusColors) — mismo lenguaje
// visual en todo el proyecto.
//
// IMPORTANTE: esta función arma el HTML SOLO UNA VEZ (initialCenter y los
// puntos fijos —emergencia, hospital— rara vez cambian). Mi ubicación en
// vivo y la ruta NO van aquí — si fueran parte del HTML, cada actualización
// de GPS forzaría al WebView a recargar la página COMPLETA (se perdía el
// zoom/pan que el paramédico ya había hecho, y parpadeaba cada pocos
// segundos — justo lo que reportó Hugo probando con la ruta simulada del
// emulador). En vez de eso, el mapa expone funciones globales
// (window.updateMyLocation / window.updateRoute) que el lado de React Native
// llama con injectJavaScript() para mover el marcador/la línea DENTRO de la
// página ya cargada, sin recargar nada.
const buildMapHtml = ({ initialCenter, emergencyLocation, hospitalLocation }) => {
    // El useMemo que llama a esto se ejecuta SIEMPRE (así deben ser los
    // Hooks), incluso cuando el mapa no se va a mostrar en pantalla — pasa en
    // cuanto em se vuelve null (p. ej. justo cuando eventEmergencyClosed
    // limpia la emergencia aceptada), y sin esta guarda tronaba.
    if (!initialCenter) return '<!DOCTYPE html><html><body></body></html>'
    const emergencyMarkerJs = emergencyLocation
        ? `L.marker([${emergencyLocation.latitude}, ${emergencyLocation.longitude}], { icon: L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#C21F2D;transform:rotate(-45deg);border:2px solid #fff"></div>', iconSize:[20,20], iconAnchor:[10,20] }) }).addTo(map).bindPopup('Emergencia');`
        : ''
    const hospitalMarkerJs = hospitalLocation
        ? `L.marker([${hospitalLocation.latitude}, ${hospitalLocation.longitude}], { icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:4px;background:#6A4C9C;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;border:2px solid #fff">H</div>', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(map).bindPopup(${JSON.stringify(hospitalLocation.name || 'Hospital destino')});`
        : ''

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;padding:0;}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { zoomControl: false }).setView([${initialCenter.latitude}, ${initialCenter.longitude}], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
${emergencyMarkerJs}
${hospitalMarkerJs}

var myMarker = null;
var routeLine = null;
var routeEnd = null;

window.updateMyLocation = function(lat, lng, recenter) {
  if (!myMarker) {
    myMarker = L.circleMarker([lat, lng], { radius: 8, color: '#0F766E', fillColor: '#0F766E', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup('Tu ubicación');
  } else {
    myMarker.setLatLng([lat, lng]);
  }
  if (recenter) map.setView([lat, lng], map.getZoom());
};

window.updateRoute = function(coordsJson) {
  var coords = JSON.parse(coordsJson);
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (coords && coords.length > 0) {
    routeLine = L.polyline(coords, { color: '#0F766E', weight: 4, opacity: 0.8 }).addTo(map);
    // Cuando cambia el destino de la ruta (escena -> hospital) se encuadra completa (con margen para la tarjeta de arriba y los botones).
    var endKey = coords[coords.length - 1].join(',');
    if (endKey !== routeEnd) {
      routeEnd = endKey;
      map.fitBounds(routeLine.getBounds(), { paddingTopLeft: [24, 110], paddingBottomRight: [76, 24], maxZoom: 16 });
    }
  }
};

// Botón "centrar en mí" — recentra sobre la última posición conocida sin
// tocar el zoom que el paramédico ya tenía. Usa la posición del marcador (no
// pide lat/lng desde React Native) para no depender de si justo en ese
// instante ya llegó una actualización nueva de GPS.
window.centerMap = function() {
  if (myMarker) {
    map.setView(myMarker.getLatLng(), map.getZoom());
  } else {
    map.setView([${initialCenter.latitude}, ${initialCenter.longitude}], map.getZoom());
  }
};
</script>
</body>
</html>`
}

// Distancia en línea recta (Haversine, metros) — para detectar "ya casi
// llegas al hospital" (ver ARRIVAL_THRESHOLD_METERS abajo) no hace falta la
// distancia de RUTA real (que ya se calcula aparte con OSRM para mostrar el
// ETA), basta con qué tan cerca está el punto azul del marcador del
// hospital — más simple y no depende de que OSRM haya respondido a tiempo.
const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000
    const toRad = (deg) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Confirmado con Hugo: 100m resultó muy poco margen en la práctica (el GPS
// en campo no es tan preciso), se subió a 300m. Se usa en DOS puntos del
// flujo: para poder pasar de "En camino" a "En escena" (cerca de la
// emergencia) y para poder "Concluir traslado" (cerca del hospital destino)
// — mismo margen para los dos, por consistencia.
const ARRIVAL_THRESHOLD_METERS = 300

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

// El paramédico solo puede AVANZAR la unidad en esta secuencia — nunca
// retroceder, saltar pasos ni volver a "Disponible" por su cuenta (eso lo
// hace el CRUM/hospital al cerrar la emergencia). El backend
// (services/unidades/controllers/unit.js, PARAMEDIC_FORWARD_TRANSITIONS)
// hace cumplir exactamente esta misma secuencia — esto es solo la UI, no la
// autoridad real. Ver fundamentos-legales/autoridad-crum-sobre-tamp-paramedico.txt.
const FORWARD_TRANSITIONS = {
    2: { next: 3, label: 'Llegué a la escena', target: 'En escena' },
    3: { next: 4, label: 'Iniciar traslado al hospital', target: 'Trasladando' },
}
const PHASES = ['En camino', 'En escena', 'Traslado', 'Entregado']

const MapaScreen = () => {
    const { token } = useAuth()
    const { activeAmbulanceId, ambulanceStatusId, refreshShift } = useAmbulance()
    const { acceptedEmergency } = useSocketAlerts()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [myLocation, setMyLocation] = useState(null)
    const [route, setRoute] = useState(null)
    const [hospitalDestination, setHospitalDestination] = useState(null)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    // Estado del ciclo "llegada al hospital" (concluir traslado -> el hospital
    // confirma llegada física -> marcar disponible) — viene de un endpoint
    // dedicado (mi-traslado-actual) en vez de derivarse de acceptedEmergency,
    // porque este ciclo tiene que seguir funcionando AUNQUE la emergencia ya
    // se haya cerrado del lado del backend (ver el comentario en
    // closeEmergencyRaw, services/emergencias/models/emergency.js — una
    // unidad en Trasladando ya no se libera sola al cerrarse la emergencia,
    // se queda esperando este ciclo). Null mientras no aplique.
    const [activeTransfer, setActiveTransfer] = useState(null)
    const [concludingTransfer, setConcludingTransfer] = useState(false)
    const [markingAvailable, setMarkingAvailable] = useState(false)
    // Centro con el que se construye el mapa la PRIMERA vez — se congela en
    // cuanto se conoce uno (ver el useEffect de abajo) y ya no se vuelve a
    // tocar, para que mapHtml no dependa de myLocation (si dependiera, cada
    // actualización de GPS regeneraría el HTML y el WebView recargaría la
    // página entera).
    const [initialCenter, setInitialCenter] = useState(null)
    const [mapReady, setMapReady] = useState(false)
    // Se incrementa cada vez que el WebView termina de cargar: si la página se recarga por cualquier motivo,
    // el estado vivo (mi ubicación, la ruta) se vuelve a inyectar en vez de quedarse perdido.
    const [mapEpoch, setMapEpoch] = useState(0)
    const router = useRouter()
    const { width: screenWidth } = useWindowDimensions()
    const sideBySide = screenWidth >= 820
    // "Seguir" = el mapa se recentra solo con cada actualización de GPS
    // (como una app de navegación normal). Empieza en true porque para
    // seguir una ambulancia en movimiento es lo que más sirve por defecto;
    // el botón de abajo lo apaga si el paramédico quiere explorar el mapa
    // sin que se le mueva la vista cada pocos segundos.
    const [isFollowing, setIsFollowing] = useState(true)
    const webviewRef = useRef(null)
    const hasCenteredOnMeRef = useRef(false)

    const em = acceptedEmergency?.emergency

    // ambulanceStatusId viene de AmbulanceContext (turno activo) — se pide de
    // nuevo cada vez que aparece una emergencia aceptada y después de cada
    // cambio de estado, para no llevar un estado optimista aparte que se
    // pueda desincronizar del backend (que es quien de verdad decide qué
    // transición es válida).
    useEffect(() => { if (em) refreshShift() }, [em?.emergency_id])

    useEffect(() => {
        let subscription = null
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
            if (status !== 'granted') return
            // watchPositionAsync (una SUSCRIPCIÓN en vivo), no
            // getCurrentPositionAsync (una sola lectura al montar la
            // pantalla). Con la lectura única, si el emulador todavía no
            // tenía ningún fix de GPS en el instante EXACTO en que se abrió
            // el mapa (pasa seguido: abres la pantalla antes de darle Play a
            // la ruta simulada en Extended Controls > Location > Routes),
            // myLocation se quedaba en null PARA SIEMPRE — nunca se
            // reintentaba, así que el aviso de "no se pudo obtener tu
            // ubicación" no se quitaba aunque el emulador ya estuviera
            // avanzando. Con la suscripción, en cuanto empieza a llegar
            // cualquier posición (Extended Controls, GPS real, lo que sea) la
            // pantalla la recoge sola — y de paso el puntito azul se mueve de
            // verdad en el mapa según avanza la ruta simulada.
            // BestForNavigation (no Balanced) — Balanced usa ubicación
            // aproximada por WiFi/red celular (FusedLocationProvider en
            // modo ahorro), y un emulador no tiene ninguna de las dos cosas
            // reales; por eso agarraba UN punto suelto (probablemente el
            // último conocido, si acaso) y luego se quedaba trabado o
            // directamente fallaba. Extended Controls > Location > Routes
            // alimenta específicamente el proveedor de GPS — hay que pedirle
            // a expo-location esa misma fuente de forma explícita. En un
            // dispositivo real esto simplemente usa el GPS real, sin ningún
            // efecto negativo.
            Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 10 },
                (pos) => setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
            )
                .then((sub) => { subscription = sub })
                // GPS apagado o no disponible — no debe tumbar la pantalla,
                // solo se queda sin marcar "mi ubicación".
                .catch((error) => console.warn('No se pudo suscribir a tu ubicación (¿GPS apagado?). ', error.message))
        }).catch((error) => console.warn('Error pidiendo permiso de ubicación. ', error.message))

        return () => { if (subscription) subscription.remove() }
    }, [])

    // El hospital destino se elige DESPUÉS de asignar la ambulancia — el
    // paramédico lo llena él mismo al registrar al paciente (ver
    // registrar-paciente.js), o lo puede reasignar el despachador/hospital
    // desde sicem-web/desktop. No hay un evento de socket dedicado para esto
    // todavía, así que se hace polling ligero (cada 15s) sobre el endpoint
    // que ya existe (mismo que usa paciente.js/notas.js) mientras haya una
    // emergencia en curso — de los pacientes de la emergencia, se toma el que
    // vaya en MI ambulancia y ya tenga destino asignado.
    useEffect(() => {
        if (!em?.emergency_id || !activeAmbulanceId) { setHospitalDestination(null); return }
        const fetchDestination = () => {
            fetch(`${API_BASE_URL}/emergencias/pacientes/${em.emergency_id}`, { headers })
                .then((res) => res.json())
                .then(({ data }) => {
                    const patients = (data || []).map(toLowerCaseKeys)
                    const mine = patients.find((p) =>
                        String(p.ambulance_id) === String(activeAmbulanceId)
                        && p.destination_institution_id
                        && p.destination_latitude && p.destination_longitude
                    )
                    const next = mine ? {
                        name: mine.destination_institution_name,
                        latitude: parseFloat(mine.destination_latitude),
                        longitude: parseFloat(mine.destination_longitude),
                    } : null
                    // Solo se actualiza si cambió de verdad: un objeto nuevo en cada sondeo reconstruía el HTML del
                    // mapa y el WebView se recargaba cada 15 s (perdía zoom, ruta y marcador).
                    setHospitalDestination((prev) => (
                        prev && next && prev.name === next.name && prev.latitude === next.latitude && prev.longitude === next.longitude
                            ? prev : next
                    ))
                })
                .catch((err) => console.error('Error consultando hospital destino de mis pacientes. ', err))
        }
        fetchDestination()
        const interval = setInterval(fetchDestination, 15000)
        return () => clearInterval(interval)
    }, [em?.emergency_id, activeAmbulanceId])

    // Ciclo "llegada al hospital" — se sondea SIEMPRE que la unidad esté
    // Trasladando (4), sin importar si acceptedEmergency sigue viva o no (ver
    // comentario junto a activeTransfer arriba). Cada 5s: suficientemente
    // rápido para que "Concluir traslado"/"Marcar Disponible" aparezcan sin
    // que el paramédico tenga que salir y volver a entrar a la pestaña.
    useEffect(() => {
        if (ambulanceStatusId !== 4) { setActiveTransfer(null); return }
        const fetchTransfer = () => {
            fetch(`${API_BASE_URL}/unidades/mi-traslado-actual`, { headers })
                .then((res) => res.json())
                .then(({ data }) => setActiveTransfer(data || null))
                .catch((err) => console.error('Error consultando tu traslado actual. ', err))
        }
        fetchTransfer()
        const interval = setInterval(fetchTransfer, 5000)
        return () => clearInterval(interval)
    }, [ambulanceStatusId])

    const hasEmergencyLocation = em?.latitude && em?.longitude
    const emergencyLocation = hasEmergencyLocation ? { latitude: parseFloat(em.latitude), longitude: parseFloat(em.longitude) } : null

    // Se congela la PRIMERA ubicación conocida (emergencia, hospital o la
    // mía, lo que llegue primero) como centro inicial del mapa — una sola
    // vez. Si initialCenter dependiera directamente de myLocation en cada
    // render, mapHtml (más abajo) se regeneraría con cada actualización de
    // GPS y el WebView recargaría la página entera.
    useEffect(() => {
        if (initialCenter) return
        const first = emergencyLocation || hospitalDestination || myLocation
        if (first) setInitialCenter(first)
    }, [initialCenter, emergencyLocation, hospitalDestination, myLocation])

    // Si cambia la emergencia en curso (o se limpia), el centro congelado de
    // arriba pertenece a la anterior — hay que soltarlo para que la próxima
    // se centre en lo suyo, no en un punto viejo.
    useEffect(() => {
        setInitialCenter(null)
        setMapReady(false)
        setIsFollowing(true)
        hasCenteredOnMeRef.current = false
    }, [em?.emergency_id])

    // Primero a la escena, luego al hospital — nunca al revés. Mientras la
    // unidad no esté "Trasladando" (4), la ruta/ETA apunta a la emergencia
    // (ahí sigue el paciente). En cuanto pasa a Trasladando, ya se recogió al
    // paciente, así que la ruta cambia sola al hospital — sin que el
    // paramédico tenga que hacer nada aparte de avanzar el estado.
    const routingToHospital = ambulanceStatusId === 4 && !!hospitalDestination
    const routeTargetLocation = routingToHospital ? hospitalDestination : emergencyLocation
    const routeTargetLabel = routingToHospital ? `Hospital: ${hospitalDestination.name}` : 'Escena de la emergencia'

    useEffect(() => {
        if (!myLocation || !routeTargetLocation) { setRoute(null); return }
        fetchRoute(myLocation.latitude, myLocation.longitude, routeTargetLocation.latitude, routeTargetLocation.longitude).then(setRoute)
        // myLocation ahora se actualiza en vivo (watchPositionAsync) — se
        // recalcula la ruta cada vez que se mueve de verdad (o el emulador
        // simula que se mueve), no memoiza por lat/lng exactos porque
        // siempre van a variar un poco entre actualizaciones.
    }, [myLocation, routeTargetLocation?.latitude, routeTargetLocation?.longitude])

    // Mueve el marcador de "mi ubicación" DENTRO del WebView ya cargado
    // (injectJavaScript), en vez de reconstruir el HTML — así el mapa no
    // parpadea ni pierde el zoom/pan cada vez que llega una posición nueva.
    // Se recentra la vista si isFollowing está activo (botón de "seguir"), y
    // SIEMPRE la primera vez que aparece el punto azul (aunque el paramédico
    // haya apagado "seguir" antes de que llegara el primer fix — si no,
    // nunca llegaría a verse en pantalla).
    useEffect(() => {
        if (!mapReady || !myLocation || !webviewRef.current) return
        const recenter = isFollowing || !hasCenteredOnMeRef.current
        hasCenteredOnMeRef.current = true
        webviewRef.current.injectJavaScript(
            `window.updateMyLocation && window.updateMyLocation(${myLocation.latitude}, ${myLocation.longitude}, ${recenter}); true;`
        )
    }, [mapReady, mapEpoch, myLocation, isFollowing])

    // Mismo criterio para la línea de ruta — se actualiza en el mapa ya
    // cargado, nunca reconstruyendo el HTML.
    useEffect(() => {
        if (!mapReady || !webviewRef.current) return
        const coords = (route?.coordinates || []).map((c) => [c.latitude, c.longitude])
        webviewRef.current.injectJavaScript(
            `window.updateRoute && window.updateRoute(${JSON.stringify(JSON.stringify(coords))}); true;`
        )
    }, [mapReady, mapEpoch, route])

    const handleCenterMap = () => {
        if (!webviewRef.current) return
        webviewRef.current.injectJavaScript('window.centerMap && window.centerMap(); true;')
    }

    // Prender "seguir" ya recentra solo (el useEffect de arriba reacciona a
    // isFollowing), así que no hace falta llamar a handleCenterMap aquí.
    const handleToggleFollow = () => setIsFollowing((f) => !f)

    const applyStatusUpdate = (statusId) => {
        if (!activeAmbulanceId) return
        setUpdatingStatus(true)
        fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ ambulanceId: activeAmbulanceId, ambulanceStatusId: statusId })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo actualizar el estado.')
                // El backend es la fuente de verdad de qué transición fue
                // realmente válida — se vuelve a pedir en vez de asumir que
                // statusId ya quedó aplicado.
                refreshShift()
            }))
            .catch((err) => { console.error('Error actualizando estado. ', err); Alert.alert('Error', err.message) })
            .finally(() => setUpdatingStatus(false))
    }

    // Distancia en línea recta a la escena de la emergencia — mismo criterio
    // (Haversine, ARRIVAL_THRESHOLD_METERS) que ya se usa para "Concluir
    // traslado" en el hospital más abajo. Confirmado con Hugo: no se puede
    // pasar a "En escena" si no
    // estás de verdad cerca — evita que se marque por accidente o de
    // antemano, antes de haber llegado en realidad.
    const distanceToEmergencyMeters = (myLocation && emergencyLocation)
        ? haversineMeters(myLocation.latitude, myLocation.longitude, emergencyLocation.latitude, emergencyLocation.longitude)
        : null
    const withinSceneArrivalRange = distanceToEmergencyMeters != null && distanceToEmergencyMeters <= ARRIVAL_THRESHOLD_METERS

    // Un solo paso a la vez, con confirmación — no hay marcha atrás una vez
    // aceptada (ver PARAMEDIC_FORWARD_TRANSITIONS), así que el diálogo lo dice
    // explícitamente en vez de dejar que un toque accidental avance la unidad.
    const handleAdvanceStatus = () => {
        const step = FORWARD_TRANSITIONS[ambulanceStatusId]
        if (!step) return
        // Defensa extra además de ocultar el botón (ver render más abajo) —
        // por si esta función se llegara a invocar por otro camino.
        if (ambulanceStatusId === 2 && !withinSceneArrivalRange) return
        Alert.alert(
            'Confirmar cambio de estado',
            `Vas a marcar la unidad como "${step.target}". No podrás regresar al paso anterior — solo tu CRUM/hospital puede cerrar o reasignar la emergencia. ¿Confirmas?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar', onPress: () => applyStatusUpdate(step.next) },
            ]
        )
    }

    // Hospital contra el que se mide la distancia de llegada — se prefiere el
    // que trae activeTransfer (funciona incluso si acceptedEmergency ya se
    // limpió) y se cae a hospitalDestination mientras activeTransfer todavía
    // no responde la primera vez.
    const arrivalHospital = activeTransfer?.hospitalLatitude
        ? { name: activeTransfer.hospitalName, latitude: parseFloat(activeTransfer.hospitalLatitude), longitude: parseFloat(activeTransfer.hospitalLongitude) }
        : hospitalDestination

    const distanceToHospitalMeters = (myLocation && arrivalHospital)
        ? haversineMeters(myLocation.latitude, myLocation.longitude, arrivalHospital.latitude, arrivalHospital.longitude)
        : null

    const withinArrivalRange = distanceToHospitalMeters != null && distanceToHospitalMeters <= ARRIVAL_THRESHOLD_METERS

    // "Concluir traslado" — tipo Uber "terminar viaje". No cambia el estado de
    // la unidad todavía: solo le avisa (destacado, en rojo) al hospital
    // destino que confirme la llegada física de sus pacientes (acción que ya
    // existe en sicem-desktop, ver Tracking.jsx). Ver concludeTransfer en
    // services/unidades/controllers/unit.js para la validación real.
    const handleConcludeTransfer = () => {
        Alert.alert(
            'Concluir traslado',
            'Se avisará a tu hospital destino que ya llegaste, para que confirme la llegada física de tu(s) paciente(s). ¿Confirmas?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar', onPress: () => {
                        setConcludingTransfer(true)
                        fetch(`${API_BASE_URL}/unidades/concluir-traslado`, { method: 'PATCH', headers })
                            .then((res) => res.json().then((body) => {
                                if (!res.ok) throw new Error(body.message || 'No se pudo concluir el traslado.')
                            }))
                            .then(() => {
                                fetch(`${API_BASE_URL}/unidades/mi-traslado-actual`, { headers })
                                    .then((res) => res.json())
                                    .then(({ data }) => setActiveTransfer(data || null))
                            })
                            .catch((err) => { console.error('Error concluyendo traslado. ', err); Alert.alert('Error', err.message) })
                            .finally(() => setConcludingTransfer(false))
                    }
                },
            ]
        )
    }

    // Único botón que puede regresar la unidad a Disponible desde el celular
    // (ver PARAMEDIC_FORWARD_TRANSITIONS más arriba) — el backend vuelve a
    // validar las dos condiciones (concluí traslado + hospital confirmó a
    // todos), esto solo controla cuándo se OFRECE el botón.
    const handleMarkAvailable = () => {
        setMarkingAvailable(true)
        fetch(`${API_BASE_URL}/unidades/marcar-disponible`, { method: 'PATCH', headers })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo marcar la unidad como disponible.')
            }))
            .then(() => { setActiveTransfer(null); refreshShift() })
            .catch((err) => { console.error('Error marcando unidad disponible. ', err); Alert.alert('Error', err.message) })
            .finally(() => setMarkingAvailable(false))
    }

    // Antes esto esperaba a que myLocation estuviera listo para dibujar
    // CUALQUIER cosa — si el GPS tardaba o estaba apagado (pasa seguido en
    // emuladores, y puede pasar en campo también), el mapa se quedaba
    // cargando para siempre aunque ya se supiera dónde está la emergencia.
    // Ahora dibuja en cuanto tenga AL MENOS una ubicación conocida (mía, de
    // la emergencia, o del hospital), centrado en la que sí tenga.
    const canRenderMap = !!initialCenter

    // Memoizado — y ahora SOLO depende de initialCenter (se congela una vez,
    // ver el useEffect de arriba) y de los puntos fijos (emergencia,
    // hospital) — YA NO de myLocation ni de route, esos se inyectan en el
    // WebView ya cargado (ver los dos useEffect de arriba con
    // injectJavaScript). Si mapHtml dependiera de myLocation, cada
    // actualización de GPS reconstruiría el HTML entero y el WebView
    // recargaría la página completa — que es justo el parpadeo/pérdida de
    // zoom que reportó Hugo probando con la ruta simulada del emulador.
    //
    // TIENE que estar ANTES del "if (!em) return" de abajo — los Hooks de
    // React (useMemo incluido) deben llamarse siempre en el mismo orden en
    // CADA render, nunca después de un return condicional. Estaba después
    // del return en una versión anterior, y en cuanto em pasaba de "algo" a
    // null ese render dejaba de llegar hasta el useMemo — React lo detecta
    // como "se llamaron menos hooks de los esperados" y truena toda la
    // pantalla. Esta regla aplica a TODOS los hooks, no solo a este.
    const mapHtml = useMemo(
        () => buildMapHtml({ initialCenter, emergencyLocation, hospitalLocation: hospitalDestination }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialCenter, emergencyLocation?.latitude, emergencyLocation?.longitude, hospitalDestination?.latitude, hospitalDestination?.longitude, hospitalDestination?.name]
    )

    // Ciclo "llegada al hospital" cuando la unidad está Trasladando (4). Vive en un endpoint propio
    // (activeTransfer) que no depende de acceptedEmergency: sigue funcionando aunque la emergencia ya se cerró.
    const renderTransferStatus = () => {
        if (!activeTransfer) {
            return <ActivityIndicator color={colors.steel} style={{ marginVertical: 8 }} />
        }
        if (!activeTransfer.paramedicConcludedAt) {
            if (withinArrivalRange) {
                return <Button label="Llegué al hospital — avisar" tone="primary" onPress={handleConcludeTransfer} loading={concludingTransfer} />
            }
            return (
                <>
                    <Button label="Llegué al hospital — avisar" tone="primary" disabled onPress={() => {}} />
                    <Text style={styles.hint}>
                        {distanceToHospitalMeters != null
                            ? `Te faltan ${formatMeters(distanceToHospitalMeters)}. Se activa a menos de ${ARRIVAL_THRESHOLD_METERS} m del hospital.`
                            : `Se activa a menos de ${ARRIVAL_THRESHOLD_METERS} m del hospital.`}
                    </Text>
                </>
            )
        }
        if (activeTransfer.allPatientsDelivered) {
            return <Button label="Unidad disponible" tone="ok" onPress={handleMarkAvailable} loading={markingAvailable} />
        }
        return (
            <View style={styles.waitingBox}>
                <ActivityIndicator color={colors.steel} />
                <Text style={styles.waitingText}>
                    Esperando que el hospital confirme la llegada{activeTransfer.patientsTotal > 1 ? ` (${activeTransfer.patientsDelivered}/${activeTransfer.patientsTotal} pacientes)` : ''}. Después podrás dejar la unidad disponible.
                </Text>
            </View>
        )
    }

    // Fase actual para la barra de pasos
    const phaseIndex = (() => {
        if (ambulanceStatusId === 3) return 1
        if (ambulanceStatusId === 4) return activeTransfer?.paramedicConcludedAt ? 3 : 2
        return 0
    })()

    // Traslado que sigue pendiente aunque la emergencia ya se cerró en el backend (p. ej. el hospital ya confirmó
    // la llegada): la unidad sigue en "Trasladando" hasta que el paramédico la deje disponible.
    if (!em && ambulanceStatusId === 4) {
        const delivered = Boolean(activeTransfer?.allPatientsDelivered)
        return (
            <View style={styles.sheetOnly}>
                <StepTracker steps={PHASES} current={phaseIndex} />
                <View style={styles.finalBox}>
                    <View style={[styles.finalIcon, delivered && { backgroundColor: colors.okSoft }]}>
                        <Ionicons name={delivered ? 'checkmark-circle' : 'time-outline'} size={44} color={delivered ? colors.ok : colors.steel} />
                    </View>
                    <Text style={styles.finalTitle}>{delivered ? 'Paciente entregado' : 'Traslado en curso'}</Text>
                    {activeTransfer?.hospitalName ? <Text style={styles.finalText}>{activeTransfer.hospitalName}</Text> : null}
                    <Text style={styles.finalText}>
                        {delivered ? 'El hospital confirmó la llegada. Deja la unidad disponible para recibir nuevas emergencias.' : 'Sigue las indicaciones de abajo.'}
                    </Text>
                </View>
                <View>{renderTransferStatus()}</View>
            </View>
        )
    }

    if (!em) {
        return (
            <View style={styles.centered}>
                <Text style={styles.emptyTitle}>Sin emergencia en curso</Text>
                <Text style={styles.hint}>Cuando te asignen una, aquí verás la ruta y los pasos de la atención.</Text>
            </View>
        )
    }

    const primaryAction = () => {
        if (ambulanceStatusId == null) return <ActivityIndicator color={colors.steel} />
        if (ambulanceStatusId === 2) {
            return withinSceneArrivalRange ? (
                <Button label={FORWARD_TRANSITIONS[2].label} tone="primary" onPress={handleAdvanceStatus} loading={updatingStatus} />
            ) : (
                <>
                    <Button label={FORWARD_TRANSITIONS[2].label} tone="primary" disabled onPress={() => {}} />
                    <Text style={styles.hint}>
                        {distanceToEmergencyMeters != null
                            ? `Te faltan ${formatMeters(distanceToEmergencyMeters)}. Se activa a menos de ${ARRIVAL_THRESHOLD_METERS} m de la escena.`
                            : 'Esperando tu ubicación…'}
                    </Text>
                </>
            )
        }
        if (FORWARD_TRANSITIONS[ambulanceStatusId]) {
            return <Button label={FORWARD_TRANSITIONS[ambulanceStatusId].label} tone="primary" onPress={handleAdvanceStatus} loading={updatingStatus} />
        }
        if (ambulanceStatusId === 4) return renderTransferStatus()
        return <Text style={styles.hint}>Consulta con tu CRUM: el estado de la unidad no coincide con esta emergencia.</Text>
    }

    return (
        <View style={[styles.container, sideBySide && { flexDirection: 'row' }]}>
            <View style={styles.mapWrapper}>
                {canRenderMap ? (
                    <>
                        <WebView
                            ref={webviewRef}
                            style={{ flex: 1 }}
                            originWhitelist={['*']}
                            source={{ html: mapHtml }}
                            onLoadEnd={() => { setMapReady(true); setMapEpoch((e) => e + 1) }}
                        />
                        <TouchableOpacity style={styles.centerButton} onPress={handleCenterMap} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Centrar el mapa en mi ubicación">
                            <Ionicons name="locate" size={24} color={colors.steel} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.followButton, isFollowing && styles.followButtonActive]}
                            onPress={handleToggleFollow}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isFollowing }}
                            accessibilityLabel={isFollowing ? 'Dejar de seguir mi ubicación' : 'Seguir mi ubicación'}
                        >
                            <Ionicons name="navigate" size={22} color={isFollowing ? '#fff' : colors.steel} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.centered}>
                        <ActivityIndicator color={colors.steel} />
                        <Text style={styles.hint}>Obteniendo ubicación…</Text>
                    </View>
                )}

                {/* Resumen de la ruta, siempre a la vista sobre el mapa */}
                {route && (
                    <View style={styles.routeCard} accessibilityLabel={`${routeTargetLabel}: ${formatDuration(route.durationMin)}, ${route.distanceKm.toFixed(1)} kilómetros`}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.routeLabel, routingToHospital && { color: colors.hosp }]} numberOfLines={1}>{routeTargetLabel}</Text>
                            <Text style={styles.routeBig}>{formatDuration(route.durationMin)} <Text style={styles.routeSmall}>· {route.distanceKm.toFixed(route.distanceKm < 100 ? 1 : 0)} km</Text></Text>
                        </View>
                    </View>
                )}
                {!myLocation && (
                    <View style={styles.locationWarningBanner}>
                        <Text style={styles.locationWarningText}>No se pudo obtener tu ubicación. Revisa que el GPS esté activado.</Text>
                    </View>
                )}
            </View>

            {/* Panel inferior fijo: el paso actual y la acción principal siempre a la vista, sin desplazarse */}
            <View style={[styles.sheet, sideBySide && styles.sheetSide]}>
                <StepTracker steps={PHASES} current={phaseIndex} />
                <View style={styles.sheetTitleRow}>
                    <Text style={styles.emergencyType} numberOfLines={1}>{em?.type_name || 'Emergencia'}</Text>
                    {em?.triage_level ? <TriageBadge level={em.triage_level} /> : null}
                </View>
                {em?.description ? <Text style={styles.desc} numberOfLines={2}>{em.description}</Text> : null}
                {hospitalDestination && (
                    <View style={styles.destRow}>
                        <Chip label={`Destino: ${hospitalDestination.name}`} tone={routingToHospital ? 'steel' : 'neutral'} />
                    </View>
                )}

                <View style={styles.primary}>{primaryAction()}</View>

                <View style={styles.quickRow}>
                    <Button label="Paciente" tone="neutral" style={styles.quick} icon={<Ionicons name="people-outline" size={20} color={colors.text} />} onPress={() => router.push('/paciente')} />
                    <Button label="Nota" tone="neutral" style={styles.quick} icon={<Ionicons name="document-text-outline" size={20} color={colors.text} />} onPress={() => router.push('/notas')} />
                </View>
            </View>
        </View>
    )
}

const SHADOW = { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 }

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
    sheetOnly: { flex: 1, padding: 18, paddingTop: 24, paddingBottom: 14, backgroundColor: colors.surface, justifyContent: 'space-between' },
    finalBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
    finalIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.steelSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    finalTitle: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
    finalText: { fontSize: 16, color: colors.text2, textAlign: 'center', lineHeight: 22 },
    mapWrapper: { flex: 1 },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
    locationWarningBanner: { position: 'absolute', bottom: 10, left: 10, right: 76, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: '#C99A2E', borderRadius: 8, padding: 8 },
    locationWarningText: { color: colors.warn, fontSize: 13, fontWeight: '600' },
    routeCard: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, ...SHADOW },
    routeLabel: { fontSize: 13, fontWeight: '700', color: colors.steel },
    routeBig: { fontSize: 26, fontWeight: '800', color: colors.text },
    routeSmall: { fontSize: 17, fontWeight: '600', color: colors.text2 },
    centerButton: { position: 'absolute', bottom: 14, right: 14, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...SHADOW },
    followButton: { position: 'absolute', bottom: 76, right: 14, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...SHADOW },
    followButtonActive: { backgroundColor: colors.steel },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 12, ...SHADOW },
    sheetSide: { width: 400, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderLeftWidth: 1, borderLeftColor: colors.line, justifyContent: 'center' },
    sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
    emergencyType: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
    desc: { fontSize: 14, color: colors.text2, marginTop: 2 },
    destRow: { marginTop: 8 },
    primary: { marginTop: 12 },
    quickRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    quick: { flex: 1, minHeight: 48 },
    hint: { fontSize: 14, color: colors.text2, marginTop: 8, textAlign: 'center' },
    waitingBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.steelSoft, borderRadius: 10, padding: 14 },
    waitingText: { flex: 1, fontSize: 14, color: colors.steel, fontWeight: '600', lineHeight: 20 },
})

export default MapaScreen
