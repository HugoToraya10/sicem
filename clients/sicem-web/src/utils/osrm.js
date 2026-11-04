import { OSRM_ROUTE_URL } from '../config/services'

// Ruteo real por calle con OSRM. OJO: es el servidor demo PÚBLICO
// (router.project-osrm.org): gratuito pero pensado para pruebas y bajo volumen.
// Si el sistema crece en uso real, lo correcto es alojar OSRM propio con el mapa de México.
const BASE = OSRM_ROUTE_URL

// Solo distancia y tiempo (liviano, para ordenar varias unidades)
export const fetchRouteSummary = (originLat, originLon, destLat, destLon) =>
    fetch(`${BASE}/${originLon},${originLat};${destLon},${destLat}?overview=false`)
        .then((res) => res.json())
        .then((data) => {
            if (data.code !== 'Ok' || !data.routes?.[0]) return null
            return { distanceKm: data.routes[0].distance / 1000, durationMin: data.routes[0].duration / 60 }
        })
        .catch(() => null)

// Trazo completo para dibujar en el mapa. OSRM entrega [lon, lat]; Leaflet quiere [lat, lon].
export const fetchRouteLine = (originLat, originLon, destLat, destLon) =>
    fetch(`${BASE}/${originLon},${originLat};${destLon},${destLat}?overview=full&geometries=geojson`)
        .then((res) => res.json())
        .then((data) => {
            if (data.code !== 'Ok' || !data.routes?.[0]) return null
            return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
        })
        .catch(() => null)

// Distancia en línea recta (km): solo para preseleccionar candidatas antes de pedir rutas reales
export const straightKm = (lat1, lon1, lat2, lon2) => {
    const rad = (d) => (d * Math.PI) / 180
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(a))
}
