// Texto claro u oscuro que se lee bien sobre un color de fondo (hex de 6 dígitos), elegido por
// la relación de contraste real (fórmula WCAG), no por una aproximación de brillo: así el naranja
// o el amarillo de los niveles de triage no quedan con letra blanca ilegible.
// Si el color no es un hex válido, devuelve blanco.
const DARK_TEXT = '#1c1500'

const channel = (value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const readableTextOn = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#fff'
    const l = luminance(hex)
    const withWhite = 1.05 / (l + 0.05)
    const withDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05)
    return withWhite >= withDark ? '#fff' : DARK_TEXT
}
