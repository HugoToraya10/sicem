// Links del navbar de sicem-desktop — mismos para admin (1) y hospital (4) por ahora.
// Se mantiene el mismo parámetro roleId que usa sicem-web para poder diferenciar
// más adelante si el rol admin necesita pantallas extra aquí también.
const baseNavLinks = [
    { to: '/pacientes-en-camino', label: 'Pacientes en Camino' },
    { to: '/seguimiento', label: 'Seguimiento' },
    { to: '/solicitudes-unidad', label: 'Solicitudes de Unidad' },
    { to: '/capacidad', label: 'Capacidad' },
    { to: '/historial', label: 'Historial' },
    { to: '/graficas', label: 'Gráficas' },
]

export const getNavLinks = (roleId, isInstitutionAdmin) => {
    const links = [...baseNavLinks]
    // Mis Ambulancias es de cualquier usuario rol 4 (hospital), sin importar si
    // además es admin de su institución.
    if (parseInt(roleId) === 4) {
        links.push({ to: '/mis-ambulancias', label: 'Mis Ambulancias' })
    }
    // Administración solo aparece si el usuario tiene is_institution_admin — la
    // ruta en sí también se protege con InstitutionAdminRoute, esto solo oculta
    // el link.
    if (isInstitutionAdmin) {
        links.push({ to: '/administracion', label: 'Administración' })
    }
    return links
}
