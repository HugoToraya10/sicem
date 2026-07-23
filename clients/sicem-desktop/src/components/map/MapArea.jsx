import { useMap, MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './MapArea.css'

// Villahermosa, Tabasco — centro por defecto del mapa (mismo default que sicem-web)
const DEFAULT_CENTER = [17.9869, -92.9303]

const createAmbulanceIcon = (color) => {
    return L.divIcon({
        className: 'ambulance-marker',
        html: `<div class="ambulance-marker-dot" style="background:${color || '#1565C0'}"></div>`,
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

// Ajusta la vista cuando cambian las coordenadas de interés (por ejemplo, al
// abrir el detalle de otro paciente con otra ambulancia/ubicación).
const MapCenterController = ({ center }) => {
    const map = useMap()
    useEffect(() => {
        if (center) map.flyTo(center, map.getZoom())
    }, [center])
    return null
}

// ambulanceLocation: opcional, { latitude, longitude, unitNumber, color }
// emergencyLocation: opcional, { latitude, longitude } — ubicación del incidente
// routeCoordinates: opcional, array de [lat, lng] — traza completa punto A (unidad) a
// punto B (emergencia), ya resuelta contra un servicio de ruteo
const MapArea = ({ ambulanceLocation = null, emergencyLocation = null, routeCoordinates = null }) => {
    const center = ambulanceLocation
        ? [parseFloat(ambulanceLocation.latitude), parseFloat(ambulanceLocation.longitude)]
        : (emergencyLocation ? [parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)] : DEFAULT_CENTER)

    return (
        <div className="map-area">
            <MapContainer center={center} zoom={13} scrollWheelZoom={true} className="leaflet-container-full">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterController center={center} />

                {ambulanceLocation && ambulanceLocation.latitude && ambulanceLocation.longitude && (
                    <Marker
                        position={[parseFloat(ambulanceLocation.latitude), parseFloat(ambulanceLocation.longitude)]}
                        icon={createAmbulanceIcon(ambulanceLocation.color)}
                    >
                        <Popup><strong>Unidad {ambulanceLocation.unitNumber}</strong></Popup>
                    </Marker>
                )}

                {routeCoordinates && routeCoordinates.length > 0 && (
                    <Polyline positions={routeCoordinates} pathOptions={{ color: '#1565C0', weight: 4, opacity: 0.8 }} />
                )}

                {emergencyLocation && emergencyLocation.latitude && emergencyLocation.longitude && (
                    <Marker
                        position={[parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)]}
                        icon={emergencyIcon}
                    >
                        <Popup>Ubicación de la emergencia</Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    )
}

export default MapArea
