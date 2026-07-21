const findDuplicate = (list, field, value) => {
    const normalized = String(value ?? '').trim().toLowerCase()
    if (!normalized) return null
    return list.find((item) => String(item[field] ?? '').trim().toLowerCase() === normalized)
}

// Revisa si ya existe un registro con ese valor (activo o inactivo) y avisa al usuario.
// Devuelve true si se encontró un duplicado (y por lo tanto no se debe enviar el POST).
export const blockIfDuplicate = (list, field, value, label) => {
    const existing = findDuplicate(list, field, value)
    if (!existing) return false

    if (existing.is_active) {
        alert(`Ya existe un registro activo con ese ${label}.`)
    } else {
        alert(`Ya existe un registro con ese ${label}, actualmente inactivo. Actívalo en lugar de crear uno duplicado.`)
    }
    return true
}
