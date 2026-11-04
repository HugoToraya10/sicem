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
