// Roles del sistema (mismos `role_id` que la tabla `roles`). Un solo lugar: antes cada pantalla
// repetía su propio diccionario y alguna mostraba un rol fijo.
export const ROLE_IDS = { ADMIN: 1, DISPATCHER: 2, PARAMEDIC: 3, HOSPITAL: 4, PATIENT: 5 }

export const ROLE_LABELS = {
    [ROLE_IDS.ADMIN]: 'Administrador',
    [ROLE_IDS.DISPATCHER]: 'Despachador',
    [ROLE_IDS.PARAMEDIC]: 'Paramédico',
    [ROLE_IDS.HOSPITAL]: 'Hospital',
    [ROLE_IDS.PATIENT]: 'Paciente',
}

export const roleLabel = (roleId) => ROLE_LABELS[parseInt(roleId)] || ''
