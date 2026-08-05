import { useMap, MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './MapArea.css'

// Villahermosa, Tabasco — centro por defecto del mapa
const DEFAULT_CENTER = [17.9869, -92.9303]

const statusColors = {
    1: '#2E7D32', // Disponible
    2: '#C0272D', // En camino
    3: '#E65100', // En escena
    4: '#8E44AD', // Trasladando
    5: '#888888', // Fuera de servicio
}

const createAmbulanceIcon = (statusId) => {
    const color = statusColors[statusId] || '#888888'
    return L.divIcon({
        className: 'ambulance-marker',
        html: `<div class="ambulance-marker-dot" style="background:${color}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
    })
}

const emergencyIcon = L.divIcon({
    className: 'emergency-marker',
    html: `<div class="emergency-marker-pin"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
})

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
const MapArea = ({ ambulances = [], emergencyLocation = null, hospitals = [], onMapClick = null, flyToLocation = null, routes = [] }) => {
    return (
        <div className="map-area">
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={13}
                scrollWheelZoom={true}
                className="leaflet-container-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {flyToLocation && <MapCenterController center={flyToLocation} />}
                {onMapClick && <ClickListener onMapClick={onMapClick} />}

                {ambulances.map((amb) => (
                    amb.latitude && amb.longitude ? (
                        <Marker
                            key={amb.ambulance_id}
                            position={[parseFloat(amb.latitude), parseFloat(amb.longitude)]}
                            icon={createAmbulanceIcon(amb.ambulance_status_id)}
                        >
                            <Popup>
                                <strong>{amb.unit_number}</strong><br />
                                {amb.institution_name}
                            </Popup>
                        </Marker>
                    ) : null
                ))}

                {routes.map((route, index) => (
                    route.coordinates?.length > 0 && (
                        <Polyline
                            key={index}
                            positions={route.coordinates}
                            pathOptions={{ color: route.color || '#1565C0', weight: 4, opacity: 0.8 }}
                        />
                    )
                ))}

                {emergencyLocation && emergencyLocation.latitude && emergencyLocation.longitude && (
                    <Marker
                        position={[parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)]}
                        icon={emergencyIcon}
                    >
                        <Popup>Ubicación de la emergencia</Popup>
                    </Marker>
                )}

                {hospitals.map((hosp) => (
                    hosp.latitude && hosp.longitude ? (
                        <Marker
                            key={`hosp-${hosp.institution_id}`}
                            position={[parseFloat(hosp.latitude), parseFloat(hosp.longitude)]}
                            icon={hospitalIcon}
                        >
                            <Popup>
                                <strong>{hosp.name}</strong><br />
                                {hosp.available_beds != null ? `${hosp.available_beds} camas disponibles` : 'Camas: sin dato'}
                            </Popup>
                        </Marker>
                    ) : null
                ))}
            </MapContainer>

            <div className="map-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: '#2E7D32' }} />Disponible</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#C0272D' }} />En ruta</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#E65100' }} />En escena</div>
                {hospitals.length > 0 && <div className="legend-item"><span className="legend-dot" style={{ background: '#8E44AD' }} />Hospital</div>}
                {onMapClick && <div className="legend-hint">Haz clic para marcar la ubicación</div>}
            </div>
        </div>
    )
}

export default MapArea