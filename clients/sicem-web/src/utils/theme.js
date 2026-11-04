import { useSyncExternalStore } from 'react'

// Preferencia de tema (claro/oscuro) recordada en localStorage. Es solo una
// comodidad por usuario: si el storage no está disponible, queda en claro.
const KEY = 'sicem_theme'
const listeners = new Set()

const read = () => {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export const setTheme = (theme) => {
    try { localStorage.setItem(KEY, theme) } catch { /* sin storage: no se recuerda */ }
    listeners.forEach((l) => l())
}

const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const useTheme = () => useSyncExternalStore(subscribe, read, () => 'light')

// Rutas que ya soportan el tema oscuro. Las demás pantallas siguen en claro
// hasta que se rediseñen (así el oscuro nunca se ve a medias).
export const DARK_READY_PATHS = ['/login', '/perfil', '/dashboard', '/emergencias/nueva', '/historial', '/solicitudes', '/hospitales', '/graficas']
// Prefijos de rutas con parámetros (p. ej. /emergencias/:id)
const DARK_READY_PREFIXES = ['/emergencias/', '/admin/']

export const isDarkReady = (pathname) =>
    DARK_READY_PATHS.includes(pathname) || DARK_READY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
