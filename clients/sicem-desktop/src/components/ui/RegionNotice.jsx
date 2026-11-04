import { useState } from 'react'
import { useRegion } from '../../context/useRegion'
import { MEXICO_STATES } from '../../utils/mexico'
import './RegionNotice.css'

// Aviso cuando no sabemos dónde opera la institución (sin coordenadas ni ciudad registradas).
// Se resuelve una sola vez eligiendo el estado; queda guardado en este navegador. La solución
// definitiva es registrar la ubicación de la institución (Administración → Instituciones).
const RegionNotice = () => {
    const { region, chooseState } = useRegion()
    const [value, setValue] = useState('')
    if (region.known) return null

    return (
        <div className="region-notice" role="status">
            <p>
                <strong>No sabemos en qué estado opera tu institución.</strong>{' '}
                El mapa se ve completo (todo el país). Elige tu estado para centrarlo y acotar la búsqueda de direcciones.
            </p>
            <div className="region-notice-row">
                <label className="sr-only" htmlFor="region-state">Estado donde opera tu institución</label>
                <select id="region-state" value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">Elige un estado</option>
                    {MEXICO_STATES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" disabled={!value} onClick={() => chooseState(value)}>Guardar</button>
            </div>
        </div>
    )
}

export default RegionNotice
