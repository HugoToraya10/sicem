import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

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
// terminar yendo. Morado (#8E44AD) porque es el mismo color que sicem-web usa
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
        ? `L.marker([${emergencyLocation.latitude}, ${emergencyLocation.longitude}], { icon: L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#C0272D;transform:rotate(-45deg);border:2px solid #fff"></div>', iconSize:[20,20], iconAnchor:[10,20] }) }).addTo(map).bindPopup('Emergencia');`
        : ''
    const hospitalMarkerJs = hospitalLocation
        ? `L.marker([${hospitalLocation.latitude}, ${hospitalLocation.longitude}], { icon: L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:4px;background:#8E44AD;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;border:2px solid #fff">H</div>', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(map).bindPopup(${JSON.stringify(hospitalLocation.name || 'Hospital destino')});`
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

window.updateMyLocation = function(lat, lng, recenter) {
  if (!myMarker) {
    myMarker = L.circleMarker([lat, lng], { radius: 8, color: '#1565C0', fillColor: '#1565C0', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup('Tu ubicación');
  } else {
    myMarker.setLatLng([lat, lng]);
  }
  if (recenter) map.setView([lat, lng], map.getZoom());
};

window.updateRoute = function(coordsJson) {
  var coords = JSON.parse(coordsJson);
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (coords && coords.length > 0) {
    routeLine = L.polyline(coords, { color: '#1565C0', weight: 4, opacity: 0.8 }).addTo(map);
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
const FORWARD_TRANSITIONS = { 2: { next: 3, label: 'Pasar a "En escena"' }, 3: { next: 4, label: 'Pasar a "Trasladando"' } }

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
                    setHospitalDestination(mine ? {
                        name: mine.destination_institution_name,
                        latitude: parseFloat(mine.destination_latitude),
                        longitude: parseFloat(mine.destination_longitude),
                    } : null)
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
                .then(({ data }) => setActiveTransfer(data ? toLowerCaseKeys(data) : null))
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
    }, [mapReady, myLocation, isFollowing])

    // Mismo criterio para la línea de ruta — se actualiza en el mapa ya
    // cargado, nunca reconstruyendo el HTML.
    useEffect(() => {
        if (!mapReady || !webviewRef.current) return
        const coords = (route?.coordinates || []).map((c) => [c.latitude, c.longitude])
        webviewRef.current.injectJavaScript(
            `window.updateRoute && window.updateRoute(${JSON.stringify(JSON.stringify(coords))}); true;`
        )
    }, [mapReady, route])

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
            `Vas a marcar la unidad como "${step.label.replace('Pasar a ', '')}". No podrás regresar al paso anterior — solo tu CRUM/hospital puede cerrar o reasignar la emergencia. ¿Confirmas?`,
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
                                    .then(({ data }) => setActiveTransfer(data ? toLowerCaseKeys(data) : null))
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
        [initialCenter, emergencyLocation?.latitude, emergencyLocation?.longitude, hospitalDestination]
    )

    // Contenido del ciclo "llegada al hospital" para cuando la unidad está
    // Trasladando (4) — se usa tanto dentro del mapa normal (mientras
    // acceptedEmergency sigue viva) como en la pantalla de remate de abajo
    // (cuando ya se cerró pero el ciclo todavía no termina). Ver activeTransfer
    // arriba: viene de un endpoint dedicado que no depende de acceptedEmergency.
    const renderTransferStatus = () => {
        if (!activeTransfer) {
            return <ActivityIndicator color="#1565C0" style={{ marginVertical: 8 }} />
        }
        if (!activeTransfer.paramedicConcludedAt) {
            if (withinArrivalRange) {
                return (
                    <TouchableOpacity style={styles.advanceButton} onPress={handleConcludeTransfer} disabled={concludingTransfer}>
                        {concludingTransfer
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.advanceButtonText}>Concluir traslado (avisar al hospital)</Text>}
                    </TouchableOpacity>
                )
            }
            return (
                <Text style={styles.hint}>
                    Trasladando al paciente.{distanceToHospitalMeters != null ? ` Te faltan ${Math.round(distanceToHospitalMeters)} m para poder concluir el traslado.` : ` En cuanto estés a menos de ${ARRIVAL_THRESHOLD_METERS} m del hospital, podrás concluir el traslado.`}
                </Text>
            )
        }
        if (activeTransfer.allPatientsDelivered) {
            return (
                <TouchableOpacity style={[styles.advanceButton, styles.availableButton]} onPress={handleMarkAvailable} disabled={markingAvailable}>
                    {markingAvailable
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.advanceButtonText}>Marcar unidad como Disponible</Text>}
                </TouchableOpacity>
            )
        }
        return (
            <Text style={styles.hint}>
                Traslado concluido — esperando que tu hospital confirme la llegada física
                {activeTransfer.patientsTotal > 1 ? ` (${activeTransfer.patientsDelivered}/${activeTransfer.patientsTotal} pacientes)` : ''}. En cuanto confirme, podrás marcar tu unidad como Disponible.
            </Text>
        )
    }

    // Cuando acceptedEmergency ya se limpió (la emergencia se cerró del lado
    // del backend) PERO la unidad sigue Trasladando esperando el ciclo
    // concluir-traslado/marcar-disponible, no tiene caso mostrar el mapa
    // completo (ya no hay em.latitude/longitude ni ruta que trazar) — pero
    // TAMPOCO se puede caer al placeholder de "no tienes ninguna emergencia",
    // porque el paramédico todavía tiene algo pendiente que hacer aquí. Ver
    // closeEmergencyRaw (services/emergencias) para por qué la unidad se
    // queda en 4 en vez de liberarse sola.
    if (!em && ambulanceStatusId === 4) {
        return (
            <View style={styles.centered}>
                <Text style={styles.emergencyType}>Traslado en curso</Text>
                {activeTransfer?.hospitalName && <Text style={styles.hint}>Hospital: {activeTransfer.hospitalName}</Text>}
                <View style={{ width: '100%', marginTop: 12 }}>
                    {renderTransferStatus()}
                </View>
            </View>
        )
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
                {canRenderMap ? (
                    <>
                        <WebView
                            ref={webviewRef}
                            style={{ flex: 1 }}
                            originWhitelist={['*']}
                            source={{ html: mapHtml }}
                            onLoadEnd={() => setMapReady(true)}
                        />
                        {/* El mapa ya no se recentra solo después del primer fix
                        (a propósito — para no pelearse con el zoom/pan que el
                        paramédico haya hecho), así que hace falta un botón
                        manual para volver a encontrar "dónde estoy" en el mapa. */}
                        <TouchableOpacity style={styles.centerButton} onPress={handleCenterMap} activeOpacity={0.8}>
                            <Ionicons name="locate" size={22} color="#1565C0" />
                        </TouchableOpacity>
                        {/* Seguir = el mapa se recentra solo con cada actualización
                        de GPS, como una app de navegación. Se apaga si el
                        paramédico quiere moverse por el mapa libremente sin que
                        la vista se le mueva cada pocos segundos. */}
                        <TouchableOpacity
                            style={[styles.followButton, isFollowing && styles.followButtonActive]}
                            onPress={handleToggleFollow}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="navigate" size={20} color={isFollowing ? '#fff' : '#1565C0'} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.centered}>
                        <ActivityIndicator color="#1565C0" />
                        <Text style={styles.hint}>Obteniendo ubicación...</Text>
                    </View>
                )}
                {!myLocation && (
                    <View style={styles.locationWarningBanner}>
                        <Text style={styles.locationWarningText}>No se pudo obtener tu ubicación — revisa que el GPS esté activado.</Text>
                    </View>
                )}
            </View>

            <ScrollView style={styles.bottomPanel} contentContainerStyle={{ padding: 14 }}>
                <Text style={styles.emergencyType}>{em?.type_name || 'Emergencia'}</Text>
                {em?.description ? <Text style={styles.hint}>{em.description}</Text> : null}

                {hospitalDestination && (
                    <Text style={[styles.hint, { color: routingToHospital ? '#8E44AD' : '#888', fontWeight: routingToHospital ? '700' : '400' }]}>
                        Hospital destino: {hospitalDestination.name}
                    </Text>
                )}

                {route && (
                    <>
                        <Text style={[styles.routeLabel, routingToHospital && { color: '#8E44AD' }]}>Ruta a: {routeTargetLabel}</Text>
                        <View style={styles.metrics}>
                            <View>
                                <Text style={styles.metricLabel}>Tiempo estimado</Text>
                                <Text style={[styles.metricValue, { color: routingToHospital ? '#8E44AD' : '#C0272D' }]}>{Math.round(route.durationMin)} min</Text>
                            </View>
                            <View>
                                <Text style={styles.metricLabel}>Distancia</Text>
                                <Text style={styles.metricValue}>{route.distanceKm.toFixed(1)} km</Text>
                            </View>
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>Estado de la unidad</Text>
                {ambulanceStatusId == null ? (
                    <ActivityIndicator color="#1565C0" style={{ marginBottom: 12 }} />
                ) : ambulanceStatusId === 2 ? (
                    // En camino -> En escena: exige estar a ≤ARRIVAL_THRESHOLD_METERS de la
                    // escena de la emergencia — no se puede marcar de
                    // antemano ni por accidente antes de llegar de verdad.
                    withinSceneArrivalRange ? (
                        <TouchableOpacity
                            style={styles.advanceButton}
                            onPress={handleAdvanceStatus}
                            disabled={updatingStatus}
                        >
                            {updatingStatus
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.advanceButtonText}>{FORWARD_TRANSITIONS[2].label}</Text>}
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.hint}>
                            Todavía no puedes marcar "En escena" — estás lejos de la ubicación reportada.{distanceToEmergencyMeters != null ? ` Te faltan ${Math.round(distanceToEmergencyMeters)} m.` : ' Esperando tu ubicación...'}
                        </Text>
                    )
                ) : FORWARD_TRANSITIONS[ambulanceStatusId] ? (
                    <TouchableOpacity
                        style={styles.advanceButton}
                        onPress={handleAdvanceStatus}
                        disabled={updatingStatus}
                    >
                        {updatingStatus
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.advanceButtonText}>{FORWARD_TRANSITIONS[ambulanceStatusId].label}</Text>}
                    </TouchableOpacity>
                ) : ambulanceStatusId === 4 ? (
                    // Trasladando — a partir de aquí el flujo "llegada al
                    // hospital" (concluir traslado -> hospital confirma ->
                    // marcar disponible) toma el control, ver renderTransferStatus.
                    renderTransferStatus()
                ) : (
                    // Estado inesperado para tener una emergencia en curso
                    // (ej. Disponible/Fuera de servicio) — no debería pasar en
                    // flujo normal, pero no hay ningún botón que ofrecer aquí.
                    <Text style={styles.hint}>Consulta con tu CRUM — el estado de la unidad no coincide con esta emergencia.</Text>
                )}
                {/* No hay botón de "terminar seguimiento" fuera del flujo de
                arriba — cualquier cierre real pasa por concluir-traslado +
                confirmación del hospital (Trasladando) o por que el
                CRUM/hospital cierre la emergencia (los demás estados). La
                pantalla se limpia sola cuando eso pasa — ver
                eventEmergencyClosed en SocketContext.jsx. */}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    mapWrapper: { flex: 1 },
    locationWarningBanner: { position: 'absolute', top: 10, left: 10, right: 10, backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#e0a800', borderRadius: 8, padding: 8 },
    locationWarningText: { color: '#7a5c00', fontSize: 11, fontWeight: '600', textAlign: 'center' },
    centerButton: {
        position: 'absolute', bottom: 16, right: 16,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3,
    },
    followButton: {
        position: 'absolute', bottom: 68, right: 16,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3,
    },
    followButtonActive: { backgroundColor: '#1565C0' },
    bottomPanel: { maxHeight: 260, borderTopWidth: 1, borderTopColor: '#eee' },
    emergencyType: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
    hint: { fontSize: 12, color: '#888', marginTop: 4, marginBottom: 8 },
    routeLabel: { fontSize: 11, fontWeight: '700', color: '#1565C0', textTransform: 'uppercase', marginTop: 6 },
    metrics: { flexDirection: 'row', gap: 24, marginVertical: 8 },
    metricLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
    metricValue: { fontSize: 18, fontWeight: '700', color: '#222' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
    advanceButton: { backgroundColor: '#1565C0', borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    advanceButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    availableButton: { backgroundColor: '#2E7D32' },
})

export default MapaScreen
