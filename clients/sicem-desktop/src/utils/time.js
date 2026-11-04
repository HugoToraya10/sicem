// Tiempo transcurrido legible: minutos -> "1 h 05 min" -> "hace 3 días" (nunca "1909h 32min").
export const formatElapsed = (createdAt) => {
    if (!createdAt) return ''
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
    const days = Math.floor(hours / 24)
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

export const formatDateTime = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export const formatDate = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

const WEEKDAY_SHORT = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
// shift_windows -> "Todos los días 00:00-23:59" / "Lun, Mié 08:00-16:00 · Vie 20:00-06:00"
export const compactSchedule = (windows) => {
    if (!windows || windows.length === 0) return 'Sin horario'
    const byRange = new Map()
    ;[...windows].sort((a, b) => a.day - b.day).forEach((w) => {
        const key = `${w.start}-${w.end}`
        byRange.set(key, [...(byRange.get(key) || []), parseInt(w.day)])
    })
    return [...byRange.entries()]
        .map(([range, days]) => `${days.length === 7 ? 'Todos los días' : days.map((d) => WEEKDAY_SHORT[d]).join(', ')} ${range}`)
        .join(' · ')
}
