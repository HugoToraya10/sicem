// Servicios externos que usa el mapa y las rutas. Todos se pueden apuntar a un servidor propio
// desde el .env (VITE_*), sin tocar código: lo recomendable en producción, porque los servidores
// públicos gratuitos tienen límites de uso (ver el aviso en utils/osrm.js).
const env = import.meta.env

// Mosaicos del mapa
export const TILE_URL = env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Rutas por calle (OSRM): termina en /route/v1/driving
export const OSRM_ROUTE_URL = (env.VITE_OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '') + '/route/v1/driving'

// Búsqueda de direcciones (Nominatim)
export const NOMINATIM_SEARCH_URL = (env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '') + '/search'
