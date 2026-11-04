import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from './AuthContext'
import { RegionContext } from './useRegion'
import { buildRegion, readJson, writeJson, OVERRIDE_KEY, CACHE_PREFIX } from '../utils/region'

// Carga dónde opera la institución de la cuenta (coordenadas, ciudad, estado) y lo comparte con la app.
// Ver utils/region.js para las reglas de prioridad.
export const RegionProvider = ({ children }) => {
    const { user, token } = useAuth() || {}
    const institutionId = user?.institutionId
    const [raw, setRaw] = useState(() => (institutionId ? readJson(CACHE_PREFIX + institutionId) : null))
    const [override, setOverride] = useState(() => { try { return localStorage.getItem(OVERRIDE_KEY) || '' } catch { return '' } })

    useEffect(() => {
        if (!institutionId || !token) return
        let cancelled = false
        fetch(`${API_BASE_URL}/hospitales/contexto-regional/${institutionId}`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (cancelled || !body?.data) return
                setRaw(body.data)
                writeJson(CACHE_PREFIX + institutionId, body.data)
            })
            .catch(() => { /* sin red: se usa lo guardado */ })
        return () => { cancelled = true }
    }, [institutionId, token])

    const region = useMemo(() => buildRegion(institutionId ? raw : null, override), [raw, override, institutionId])

    const chooseState = (stateId) => {
        try { localStorage.setItem(OVERRIDE_KEY, String(stateId)) } catch { /* sin storage */ }
        setOverride(String(stateId))
    }

    return <RegionContext.Provider value={{ region, chooseState }}>{children}</RegionContext.Provider>
}
