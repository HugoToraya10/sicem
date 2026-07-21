// Links base del navbar del despachador — visibles para cualquier rol autenticado en sicem-web
const baseNavLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/emergencias/nueva', label: 'Nueva Emergencia' },
    { to: '/solicitudes', label: 'Solicitudes' },
    { to: '/hospitales', label: 'Hospitales' },
    { to: '/graficas', label: 'Gráficas' },
    { to: '/historial', label: 'Historial' },
]

// Menú desplegable de administración — solo visible para el rol admin.
// Es un objeto con "children" en lugar de "to", para que Navbar sepa
// renderizarlo como dropdown en vez de un link directo.
const adminDropdown = {
    label: 'Administrador',
    children: [
        { to: '/admin/usuarios', label: 'Usuarios' },
        { to: '/admin/instituciones', label: 'Instituciones' },
        { to: '/admin/ambulancias', label: 'Ambulancias' },
        { to: '/admin/pacientes', label: 'Pacientes' },
        { to: '/admin/catalogos-emergencias', label: 'Catálogos de Emergencias' },

    ]
}

// Función que arma el navbar completo según el rol del usuario logueado
export const getNavLinks = (roleId) => {
    if (parseInt(roleId) === 1) {
        return [...baseNavLinks, adminDropdown]
    }
    return baseNavLinks
}