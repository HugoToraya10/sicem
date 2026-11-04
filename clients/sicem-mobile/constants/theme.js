// Colores y medidas de la app del paramédico. Mismos valores que tokens.css de sicem-web
// (rojo = marca/urgencia, verde azulado = acento, verde = confirmado). Tema claro fijo:
// se usa a pleno sol y con guantes, donde el contraste alto importa más que un modo oscuro.
export const colors = {
    bg: '#F4F6F8',
    surface: '#FFFFFF',
    surface2: '#F0F3F6',
    line: '#E3E8EE',
    lineStrong: '#CBD3DD',
    text: '#14181F',
    text2: '#4A5360',
    text3: '#5C6676',
    brand: '#C21F2D',
    brandSoft: '#FDECEE',
    steel: '#0F766E',
    steelSoft: '#DFF3F0',
    ok: '#187A3E',
    okSoft: '#E3F5EA',
    warn: '#8F5A00',
    warnSoft: '#FDF0D9',
    hosp: '#6A4C9C',
}

// Tamaño mínimo táctil recomendado (guantes, vehículo en movimiento)
export const TOUCH = 48

// Tamaño mínimo de texto legible en pantalla pequeña
export const MIN_FONT = 13

// En tablets el contenido no se estira de lado a lado: se centra en una columna legible.
export const CONTENT_MAX = 720
export const contentColumn = { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }
