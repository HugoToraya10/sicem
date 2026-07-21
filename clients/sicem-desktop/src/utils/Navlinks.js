// Links del navbar de sicem-desktop — mismos para admin (1) y hospital (4) por ahora.
// Se mantiene el mismo parámetro roleId que usa sicem-web para poder diferenciar
// más adelante si el rol admin necesita pantallas extra aquí también.
const baseNavLinks = [
    { to: '/pacientes-en-camino', label: 'Pacientes en Camino' },
    { to: '/capacidad', label: 'Capacidad' },
    { to: '/historial', label: 'Historial' },
    { to: '/graficas', label: 'Gráficas' },
]

export const getNavLinks = (roleId) => {
    return baseNavLinks
}
