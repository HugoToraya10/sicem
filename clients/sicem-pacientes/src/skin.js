import { useSyncExternalStore } from 'react'

// Tema visual ("skin") elegido por la persona usuaria. Es independiente del claro/oscuro:
// cada skin cambia colores, tipografía, formas y sombras de todo el sistema a la vez.
// Se recuerda en localStorage (solo una comodidad: si no hay storage, queda el clásico).
export const SKINS = [
    { id: 'clasico', label: 'Clásico', desc: 'El diseño de siempre: cálido y sobrio.', colors: ['#F3F2EE', '#25272C', '#C21F2D', '#0F766E'], radius: 10 },
    { id: 'triage', label: 'Triage', desc: 'Tarjetas de triage: bloques de color, números grandes y bordes gruesos.', colors: ['#F2F2EF', '#0c0c0c', '#E30613', '#E8710A'], radius: 0 },
    { id: 'suave', label: 'Triage suave', desc: 'La misma identidad, con esquinas redondeadas y sombras suaves.', colors: ['#F2F2EF', '#0c0c0c', '#E30613', '#E8710A'], radius: 14 },
    { id: 'sobrio', label: 'Sobrio', desc: 'Casi sin color, filetes finos y una tipografía muy cuidada.', colors: ['#F6F7F9', '#FFFFFF', '#0F1115', '#D92D3A'], radius: 8 },
]

const KEY = 'sicem_skin'
const listeners = new Set()
const valid = (id) => SKINS.some((s) => s.id === id)

const read = () => {
    try { const v = localStorage.getItem(KEY); return valid(v) ? v : 'clasico' } catch { return 'clasico' }
}

const apply = (id) => {
    if (id === 'clasico') delete document.documentElement.dataset.skin
    else document.documentElement.dataset.skin = id
}

export const setSkin = (id) => {
    if (!valid(id)) return
    try { localStorage.setItem(KEY, id) } catch { /* sin storage: no se recuerda */ }
    apply(id)
    listeners.forEach((l) => l())
}

const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const useSkin = () => useSyncExternalStore(subscribe, read, () => 'clasico')

// Se aplica al cargar el módulo (el <script> del index.html ya lo hizo antes del primer pintado).
if (typeof document !== 'undefined') apply(read())
