import { useMap, MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import { useRegion } from '../../context/useRegion'
import { TILE_URL, TILE_ATTRIBUTION } from '../../config/services'
import 'leaflet/dist/leaflet.css'
import './MapArea.css'

const createAmbulanceIcon = (color) => {
    return L.divIcon({
        className: 'ambulance-marker',
        html: `<div class="ambulance-marker-dot" style="background:${color || 'var(--steel)'}"></div>`,
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
    }, [center?.[0], center?.[1]])
    return null
}

// Leaflet calcula su tamaño al montarse; si el contenedor cambia después (ventana, modal)
// el mapa queda a medias con una franja gris. Esto lo recalcula.
const ResizeFix = () => {
    const map = useMap()
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize())
        observer.observe(map.getContainer())
        return () => observer.disconnect()
    }, [map])
    return null
}

// ambulanceLocation: opcional, { latitude, longitude, unitNumber, color }
// emergencyLocation: opcional, { latitude, longitude } — ubicación del incidente
// routeCoordinates: opcional, array de [lat, lng] — traza completa punto A (unidad) a
// punto B (emergencia), ya resuelta contra un servicio de ruteo
// Sin ninguna ubicación, el mapa se centra en la región de la institución del usuario.
const MapArea = ({ ambulanceLocation = null, emergencyLocation = null, routeCoordinates = null }) => {
    const { region } = useRegion()
    const hasAmbulance = Boolean(ambulanceLocation?.latitude && ambulanceLocation?.longitude)
    const hasEmergency = Boolean(emergencyLocation?.latitude && emergencyLocation?.longitude)
    const center = hasAmbulance
        ? [parseFloat(ambulanceLocation.latitude), parseFloat(ambulanceLocation.longitude)]
        : (hasEmergency ? [parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)] : region.center)
    const zoom = hasAmbulance || hasEmergency ? 13 : region.zoom

    return (
        <div className="map-area">
            <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className="leaflet-container-full">
                <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
                <MapCenterController center={center} />
                <ResizeFix />

                {hasAmbulance && (
                    <Marker
                        position={[parseFloat(ambulanceLocation.latitude), parseFloat(ambulanceLocation.longitude)]}
                        icon={createAmbulanceIcon(ambulanceLocation.color)}
                        title={`Unidad ${ambulanceLocation.unitNumber}`}
                        alt={`Unidad ${ambulanceLocation.unitNumber}`}
                    >
                        <Popup><strong>Unidad {ambulanceLocation.unitNumber}</strong></Popup>
                    </Marker>
                )}

                {routeCoordinates && routeCoordinates.length > 0 && (
                    <Polyline positions={routeCoordinates} pathOptions={{ color: '#2F6B8F', weight: 4, opacity: 0.8 }} />
                )}

                {hasEmergency && (
                    <Marker
                        position={[parseFloat(emergencyLocation.latitude), parseFloat(emergencyLocation.longitude)]}
                        icon={emergencyIcon}
                        title="Ubicación de la emergencia"
                        alt="Ubicación de la emergencia"
                    >
                        <Popup>Ubicación de la emergencia</Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    )
}

export default MapArea
