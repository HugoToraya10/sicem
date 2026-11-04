// En desarrollo y en una red local el API vive en el mismo equipo que sirve el portal (puerto 3000);
// en producción se fija con VITE_API_URL (ver .env.example).
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`

const OFFLINE = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

// Devuelve siempre { ok, status, data }; nunca lanza. Los componentes deciden qué mostrar.
export const api = async (path, { method = 'GET', body, token } = {}) => {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    let data = {}
    try { data = await res.json() } catch { /* respuesta sin cuerpo */ }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { message: OFFLINE } }
  }
}
