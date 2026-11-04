import { MEXICO_VIEW, stateById, stateByName } from './mexico'

// Dónde opera quien inició sesión. Se deduce de la INSTITUCIÓN de la cuenta (coordenadas, ciudad y
// estado registrados), nunca de la IP ni del navegador — la IP suele marcar el estado equivocado.
// Prioridad: 1) coordenadas de la institución  2) estado elegido a mano (una sola vez)
//            3) capital del estado de la institución  4) vista de todo el país (sin sesgo a un estado)
export const OVERRIDE_KEY = 'sicem_region_state_override'
export const CACHE_PREFIX = 'sicem_region_'

export const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
export const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin storage: no se recuerda */ } }

const finite = (n) => Number.isFinite(Number(n)) && n !== null && n !== '' && Number(n) !== 0

// Caja de ~0.4° alrededor del centro para que el buscador priorice resultados cercanos
// (sin impedir buscar fuera: bounded=0).
const viewboxAround = ([lat, lon], delta = 0.4) => `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`

export const buildRegion = (raw, overrideStateId) => {
    const stateRow = stateById(raw?.state_id) || stateByName(raw?.state_name)
    const overrideRow = overrideStateId ? stateById(overrideStateId) : null

    let center = MEXICO_VIEW.center
    let zoom = MEXICO_VIEW.zoom
    let source = 'mexico'
    if (finite(raw?.latitude) && finite(raw?.longitude)) {
        center = [Number(raw.latitude), Number(raw.longitude)]; zoom = 13; source = 'institution'
    } else if (overrideRow) {
        center = [overrideRow.lat, overrideRow.lon]; zoom = 10; source = 'chosen'
    } else if (stateRow) {
        center = [stateRow.lat, stateRow.lon]; zoom = 10; source = 'state'
    }

    const state = raw?.state_name || stateRow?.name || overrideRow?.name || ''
    const city = raw?.city_name || ''
    const timeZone = (stateRow || overrideRow)?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
        source,
        known: source !== 'mexico',           // ¿sabemos dónde opera?
        institutionName: raw?.name || '',
        city,
        state,
        label: [city, state].filter(Boolean).join(', '),
        center,
        zoom,
        timeZone,
        // texto que se agrega a lo que escribe el usuario para buscar una dirección
        geocodeSuffix: [state, 'México'].filter(Boolean).join(', '),
        viewbox: source === 'mexico' ? null : viewboxAround(center),
    }
}

