import { useMap, MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import { readableTextOn } from '../../utils/color'
import { useRegion } from '../../context/useRegion'
import { TILE_URL, TILE_ATTRIBUTION } from '../../config/services'
import 'leaflet/dist/leaflet.css'
import './MapArea.css'


// Colores como variables de tokens.css, para que sigan al tema (claro/oscuro)
const statusColors = {
    1: 'var(--u-free)',     // Disponible
    2: 'var(--u-route)',    // En camino
    3: 'var(--u-scene)',    // En escena
    4: 'var(--u-transfer)', // Trasladando
    5: 'var(--u-off)',      // Fuera de servicio
}

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }

// El nivel de triage puede llegar como número (1) o ya en romano ('I'); se normaliza a número.
const levelNumber = (level) => Number(level) || ({ I: 1, II: 2, III: 3, IV: 4, V: 5 })[String(level).toUpperCase()] || null

// Cache: react-leaflet recrea el marcador si el objeto icon cambia, y eso reinicia
// las animaciones. Mismo estado visual = mismo objeto icon.
const iconCache = new Map()
const cached = (key, make) => {
    if (!iconCache.has(key)) iconCache.set(key, make())
    return iconCache.get(key)
}

const createAmbulanceIcon = (statusId) => cached(`amb-${statusId}`, () => {
    const color = statusColors[statusId] || 'var(--u-off)'
    return L.divIcon({
        className: 'ambulance-marker',
        html: `<div class="ambulance-marker-dot" style="background:${color}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
    })
})

const emergencyIcon = L.divIcon({
    className: 'emergency-marker',
    html: `<div class="emergency-marker-pin"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
})

// Marcador de una emergencia activa: círculo con el nivel de triage en romano, del
// color del triage; las de nivel I y II pulsan para que se vean de lejos.
const createEmergencyPinIcon = (em, selected) => {
    const level = levelNumber(em.triage_level)
    const color = em.triage_hex_color || 'var(--t1)'
    const critical = level !== null && level <= 2
    return cached(`em-${level}-${color}-${selected}`, () => L.divIcon({
        className: 'em-marker',
        html: `<div class="em-marker-wrap ${selected ? 'selected' : ''}" style="--c:${color}">
                 ${critical ? '<span class="em-marker-pulse"></span>' : ''}
                 <span class="em-marker-dot" style="color:${readableTextOn(color)}">${ROMAN[level] || ''}</span>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    }))
}

// Leaflet calcula su tamaño al montarse; si el contenedor cambia después (ventana,
// paneles) el mapa queda a medias con una franja gris. Esto lo recalcula.
// Entrega la instancia del mapa a quien lo contiene (para controles externos: zoom, encuadre…)
const MapReady = ({ onMapReady }) => {
    const map = useMap()
    useEffect(() => { onMapReady(map) }, [map])
    return null
}

const ResizeFix = () => {
    const map = useMap()
    useEffect(() => {
        const el = map.getContainer()
        const observer = new ResizeObserver(() => map.invalidateSize())
        observer.observe(el)
        return () => observer.disconnect()
    }, [map])
    return null
}

// Morado — mismo color que usa sicem-mobile para el hospital destino en su
// propio mapa (mapa.js), y el mismo que aquí arriba ya representa
// "Trasladando" en las ambulancias — mismo lenguaje visual para "hospital"
// en todo el proyecto.
const hospitalIcon = L.divIcon({
    className: 'hospital-marker',
    html: `<div class="hospital-marker-badge">H</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
})

// Componente auxiliar — no dibuja nada visible, solo escucha clics en el mapa.
// react-leaflet exige que los listeners de eventos del mapa vivan en un
// componente hijo de MapContainer.
const ClickListener = ({ onMapClick }) => {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}

// Mueve la vista del mapa cuando cambian las coordenadas del centro deseado
// (por ejemplo, cuando el geocoding de Nominatim encuentra una dirección)
// Cuando se conoce la región de la institución (después de cargarla), centra el mapa ahí.
// No actúa si la pantalla ya enfoca algo concreto (una emergencia, una búsqueda).
const RegionView = ({ region, enabled }) => {
    const map = useMap()
    useEffect(() => {
        if (enabled && region.known) map.setView(region.center, region.zoom, { animate: false })
    }, [enabled, region.source, region.center[0], region.center[1]])
    return null
}

const MapCenterController = ({ center }) => {
    const map = useMap()
    useEffect(() => {
        if (center) {
            map.flyTo(center, map.getZoom())
        }
    }, [center])
    return null
}

// ambulances: array de objetos con latitude, longitude, ambulance_status_id, unit_number
// emergencyLocation: opcional, { latitude, longitude } para marcar una emergencia específica
// hospitals: opcional, array de instituciones con latitude, longitude, name, available_beds —
// mismo shape que ya regresa /hospitales/instituciones-destino (con latitude/longitude
// agregados). Se descartan en silencio las que no traigan coordenadas, igual que ambulances.
// onMapClick: opcional, (lat, lng) => {} — se llama cuando el usuario hace clic en el mapa
// routes: opcional, array de { coordinates: [[lat,lng], ...], color? } — una o varias trazas
// completas (p. ej. de cada unidad asignada hasta la emergencia), ya resueltas contra un
// servicio de ruteo
// emergencies: opcional, array de emergencias activas con latitude, longitude, triage_level,
// triage_hex_color — se pintan como marcadores con su nivel de triage
const MapArea = ({ ambulances = [], emergencyLocation = null, hospitals = [], emergencies = [], selectedEmergencyId = null, onEmergencyClick = null, onMapClick = null, flyToLocation = null, routes = [], legendCentered = false, hideZoomControl = false, onMapReady = null }) => {
    const { region } = useRegion()
    const focusLat = parseFloat(emergencyLocation?.latitude)
    const focusLon = parseFloat(emergencyLocation?.longitude)
    const hasFocus = Number.isFinite(focusLat) && Number.isFinite(focusLon)

    return (
        <div className="map-area">
            <MapContainer
                center={hasFocus ? [focusLat, focusLon] : region.center}
                zoom={hasFocus ? 14 : region.zoom}
                scrollWheelZoom={true}
                zoomControl={!hideZoomControl}
                className="leaflet-container-full"
            >
                <TileLayer
                    attribution={TILE_ATTRIBUTION}
                    url={TILE_URL}
                />
                <ResizeFix />
                <RegionView region={region} enabled={!hasFocus && !flyToLocation} />
                {onMapReady && <MapReady onMapReady={onMapReady} />}
                {flyToLocation && <MapCenterController center={flyToLocation} />}
                {onMapClick && <ClickListener onMapClick={onMapClick} />}

                {ambulances.map((amb) => (
                    amb.latitude && amb.longitude ? (
                        <Marker
                            key={amb.ambulance_id}
                            position={[parseFloat(amb.latitude), parseFloat(amb.longitude)]}
                            icon={createAmbulanceIcon(amb.ambulance_status_id)}
                            title={`Unidad ${amb.unit_number}`}
                            alt={`Unidad ${amb.unit_number}`}
                        >
                            <Popup>
                                <strong>{amb.unit_number}</strong><br />
                                {amb.institution_name}
                            </Popup>
                        </Marker>
                    ) : null
                ))}

                {(routes || []).map((route, index) => (
                    route.coordinates?.length > 0 && (
                        <Polyline
                            key={index}
                            positions={route.coordinates}
                            pathOptions={{ color: route.color || '#1D6B66', weight: 4, opacity: 0.85 }}
                        />
                    )
                ))}

                {emergencyLocation && emergencyLocation.latitude && emergencyLocation.longitude && (
                    <Marker
                        position={[parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)]}
                        icon={emergencyIcon}
                        title="Ubicación de la emergencia"
                        alt="Ubicación de la emergencia"
                    >
                        <Popup>Ubicación de la emergencia</Popup>
                    </Marker>
                )}

                {emergencies.map((em) => (
                    em.latitude && em.longitude ? (
                        <Marker
                            key={`em-${em.emergency_id}`}
                            position={[parseFloat(em.latitude), parseFloat(em.longitude)]}
                            icon={createEmergencyPinIcon(em, String(em.emergency_id) === String(selectedEmergencyId))}
                            title={`${em.type_name || 'Emergencia'}${em.triage_level ? `, nivel ${em.triage_level}` : ''}. ${em.description || ''}`}
                            alt={`${em.type_name || 'Emergencia'}${em.triage_level ? `, nivel ${em.triage_level}` : ''}`}
                            zIndexOffset={String(em.emergency_id) === String(selectedEmergencyId) ? 1000 : 500}
                            eventHandlers={onEmergencyClick ? { click: () => onEmergencyClick(em) } : undefined}
                        />
                    ) : null
                ))}

                {hospitals.map((hosp) => (
                    hosp.latitude && hosp.longitude ? (
                        <Marker
                            key={`hosp-${hosp.institution_id}`}
                            position={[parseFloat(hosp.latitude), parseFloat(hosp.longitude)]}
                            icon={hospitalIcon}
                            title={hosp.name}
                            alt={hosp.name}
                        >
                            <Popup>
                                <strong>{hosp.name}</strong><br />
                                {hosp.available_beds != null ? `${hosp.available_beds} camas disponibles` : 'Camas: sin dato'}
                            </Popup>
                        </Marker>
                    ) : null
                ))}
            </MapContainer>

            <div className={`map-legend ${legendCentered ? 'map-legend-centered' : ''}`}>
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--u-free)' }} />Disponible</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--u-route)' }} />En ruta</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--u-scene)' }} />En escena</div>
                {emergencies.length > 0 && <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--t1)' }} />Emergencia (nivel de triage)</div>}
                {hospitals.length > 0 && <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--hosp)' }} />Hospital</div>}
                {onMapClick && <div className="legend-hint">Haz clic para marcar la ubicación</div>}
            </div>
        </div>
    )
}

export default MapArea