// Envuelve la respuesta de fetch: si el servidor respondió con un código de error
// (403, 500, etc.), rechaza la promesa con el mensaje real del backend en vez de
// dejar pasar el body de error como si fuera un éxito. Úsalo en vez de `res => res.json()`
// en cualquier acción iniciada por el usuario (crear, editar, alternar, cancelar...).
export function parseResponse(res) {
    return res.json().then((body) => {
        if (!res.ok) {
            throw new Error(body?.message || 'Ocurrió un error inesperado.')
        }
        return body
    })
}
