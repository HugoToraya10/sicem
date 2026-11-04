// Los 32 estados de México (mismo `state_id` que la tabla `states` de la BD), con la capital
// y la zona horaria. SOLO se usan como respaldo cuando la institución del usuario no tiene
// coordenadas propias: la fuente principal de "dónde estamos" es SIEMPRE la institución de la
// cuenta (nunca la IP, que se equivoca de estado).
export const MEXICO_STATES = [
    { id: 1,  name: 'Aguascalientes',      lat: 21.8853, lon: -102.2916, tz: 'America/Mexico_City' },
    { id: 2,  name: 'Baja California',     lat: 32.6245, lon: -115.4523, tz: 'America/Tijuana' },
    { id: 3,  name: 'Baja California Sur', lat: 24.1426, lon: -110.3128, tz: 'America/Mazatlan' },
    { id: 4,  name: 'Campeche',            lat: 19.8301, lon: -90.5349,  tz: 'America/Merida' },
    { id: 5,  name: 'Chiapas',             lat: 16.7528, lon: -93.1152,  tz: 'America/Mexico_City' },
    { id: 6,  name: 'Chihuahua',           lat: 28.6353, lon: -106.0889, tz: 'America/Chihuahua' },
    { id: 7,  name: 'Ciudad de México',    lat: 19.4326, lon: -99.1332,  tz: 'America/Mexico_City' },
    { id: 8,  name: 'Coahuila',            lat: 25.4232, lon: -100.9926, tz: 'America/Monterrey' },
    { id: 9,  name: 'Colima',              lat: 19.2433, lon: -103.7250, tz: 'America/Mexico_City' },
    { id: 10, name: 'Durango',             lat: 24.0277, lon: -104.6532, tz: 'America/Mexico_City' },
    { id: 11, name: 'Guanajuato',          lat: 21.0190, lon: -101.2574, tz: 'America/Mexico_City' },
    { id: 12, name: 'Guerrero',            lat: 17.5506, lon: -99.5058,  tz: 'America/Mexico_City' },
    { id: 13, name: 'Hidalgo',             lat: 20.1011, lon: -98.7591,  tz: 'America/Mexico_City' },
    { id: 14, name: 'Jalisco',             lat: 20.6597, lon: -103.3496, tz: 'America/Mexico_City' },
    { id: 15, name: 'Estado de México',    lat: 19.2826, lon: -99.6557,  tz: 'America/Mexico_City' },
    { id: 16, name: 'Michoacán',           lat: 19.7060, lon: -101.1950, tz: 'America/Mexico_City' },
    { id: 17, name: 'Morelos',             lat: 18.9242, lon: -99.2216,  tz: 'America/Mexico_City' },
    { id: 18, name: 'Nayarit',             lat: 21.5042, lon: -104.8946, tz: 'America/Mazatlan' },
    { id: 19, name: 'Nuevo León',          lat: 25.6866, lon: -100.3161, tz: 'America/Monterrey' },
    { id: 20, name: 'Oaxaca',              lat: 17.0732, lon: -96.7266,  tz: 'America/Mexico_City' },
    { id: 21, name: 'Puebla',              lat: 19.0414, lon: -98.2063,  tz: 'America/Mexico_City' },
    { id: 22, name: 'Querétaro',           lat: 20.5888, lon: -100.3899, tz: 'America/Mexico_City' },
    { id: 23, name: 'Quintana Roo',        lat: 18.5001, lon: -88.2961,  tz: 'America/Cancun' },
    { id: 24, name: 'San Luis Potosí',     lat: 22.1565, lon: -100.9855, tz: 'America/Mexico_City' },
    { id: 25, name: 'Sinaloa',             lat: 24.8091, lon: -107.3940, tz: 'America/Mazatlan' },
    { id: 26, name: 'Sonora',              lat: 29.0729, lon: -110.9559, tz: 'America/Hermosillo' },
    { id: 27, name: 'Tabasco',             lat: 17.9869, lon: -92.9303,  tz: 'America/Mexico_City' },
    { id: 28, name: 'Tamaulipas',          lat: 23.7369, lon: -99.1411,  tz: 'America/Monterrey' },
    { id: 29, name: 'Tlaxcala',            lat: 19.3139, lon: -98.2404,  tz: 'America/Mexico_City' },
    { id: 30, name: 'Veracruz',            lat: 19.5438, lon: -96.9102,  tz: 'America/Mexico_City' },
    { id: 31, name: 'Yucatán',             lat: 20.9674, lon: -89.5926,  tz: 'America/Merida' },
    { id: 32, name: 'Zacatecas',           lat: 22.7709, lon: -102.5832, tz: 'America/Mexico_City' },
]

// Vista de todo el país: lo que se muestra mientras no se sabe dónde opera la institución
// (sin inclinarse hacia ningún estado).
export const MEXICO_VIEW = { center: [23.6345, -102.5528], zoom: 5 }

export const stateById = (id) => MEXICO_STATES.find((s) => Number(s.id) === Number(id)) || null
export const stateByName = (name) => {
    const n = String(name || '').trim().toLowerCase()
    return MEXICO_STATES.find((s) => s.name.toLowerCase() === n) || null
}
