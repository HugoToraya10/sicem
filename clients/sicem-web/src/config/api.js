// Todo lo REST pasa por el gateway (puerto 3000).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Los sockets son la excepción — se conectan directo a cada servicio, sin
// pasar por el gateway (mismo patrón que sicem-desktop y sicem-mobile).
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3005'
export const UNITS_SOCKET_URL = import.meta.env.VITE_UNITS_SOCKET_URL || 'http://localhost:3003'
