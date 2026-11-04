// Búsqueda de direcciones con Nominatim (OpenStreetMap), acotada a la región de la institución.
// La región (estado, caja de búsqueda) viene de RegionContext — nada de esto asume un estado fijo.
//
// Devuelve varias coincidencias en vez de la primera a ciegas: una calle puede existir en varios
// lugares y, en una emergencia, mandar la unidad al sitio equivocado cuesta tiempo.
import { NOMINATIM_SEARCH_URL } from '../config/services'

const runSearch = (query, { viewbox, limit, details }) => {
    const params = new URLSearchParams({ q: query, format: 'json', limit: String(limit), countrycodes: 'mx', 'accept-language': 'es' })
    if (details) params.set('addressdetails', '1')
    if (viewbox) { params.set('viewbox', viewbox); params.set('bounded', '0') } // prioriza cerca, no excluye lo de fuera
    return fetch(`${NOMINATIM_SEARCH_URL}?${params}`).then((res) => {
        if (!res.ok) throw new Error('El buscador de direcciones no respondió.')
        return res.json()
    })
}

export const searchAddress = async (text, region, { limit = 5, details = false } = {}) => {
    const clean = String(text || '').trim()
    if (!clean) return []
    const options = { viewbox: region?.viewbox || null, limit, details }
    let results = await runSearch(region?.geocodeSuffix ? `${clean}, ${region.geocodeSuffix}` : clean, options)
    // Si con el estado no hay nada (p. ej. la dirección está en otro estado), se reintenta sin él.
    if (results.length === 0 && region?.geocodeSuffix) results = await runSearch(clean, options)
    return results.map((r) => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        label: r.display_name,
        address: r.address || null,
    }))
}
