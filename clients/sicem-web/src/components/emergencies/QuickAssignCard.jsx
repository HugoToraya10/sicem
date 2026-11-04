import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config/api'
import { parseResponse } from '../../utils/apiRequest'
import { toLowerCaseKeys } from '../../utils/formatData'
import { fetchRouteSummary, fetchRouteLine, straightKm } from '../../utils/osrm'
import Icon from '../ui/Icon'
import { readableTextOn } from '../../utils/color'
import { QUICK_ASSIGN_MAX_CANDIDATES as MAX_CANDIDATES } from '../../config/operations'
import './QuickAssignCard.css'

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }

const fmtMin = (min) => (min < 1 ? '<1 min' : `${Math.round(min)} min`)

// Resumen de la emergencia seleccionada en el mapa. Si todavía no tiene unidad
// (estado "Registrada"), recomienda las unidades PROPIAS disponibles más cercanas,
// con tiempo real por calle, y deja asignar sin salir del Dashboard. La asignación
// pide confirmación explícita (Confirmar / Cancelar) antes de mandarse — mismo
// criterio que el resto del sistema para acciones sensibles.
const QuickAssignCard = ({ emergency, ambulances, user, token, formatElapsed, onClose, onOpen, onAssigned, onRouteChange }) => {
    // idle | loading | ready | confirm | sending. El componente se remonta por emergencia
    // (key en Dashboard), así que el estado siempre arranca limpio.
    const [phase, setPhase] = useState(() => (emergency.status_name === 'Registrada' && user?.institutionId ? 'loading' : 'idle'))
    const [candidates, setCandidates] = useState([])
    const [chosenId, setChosenId] = useState(null)
    const [error, setError] = useState('')

    // Las ubicaciones se actualizan cada ~15 s por socket; se leen por ref para
    // no volver a pedir rutas con cada movimiento de una ambulancia.
    const ambulancesRef = useRef(ambulances)
    useEffect(() => { ambulancesRef.current = ambulances }, [ambulances])

    const emergencyId = emergency.emergency_id
    const lat = parseFloat(emergency.latitude)
    const lon = parseFloat(emergency.longitude)
    const needsUnit = emergency.status_name === 'Registrada'
    const canAssign = needsUnit && Boolean(user?.institutionId) && Number.isFinite(lat) && Number.isFinite(lon)

    // Candidatas: unidades propias disponibles, las 3 más cercanas en línea recta,
    // y de ahí la ruta real (OSRM) para ordenarlas por tiempo de llegada.
    useEffect(() => {
        if (!canAssign) return

        let cancelled = false
        fetch(`${API_BASE_URL}/unidades/ambulancias-disponibles/${user.institutionId}`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => {
                const availableIds = new Set((data || []).map((u) => String(toLowerCaseKeys(u).ambulance_id)))
                const located = ambulancesRef.current
                    .filter((a) => availableIds.has(String(a.ambulance_id)) && a.latitude && a.longitude)
                    .map((a) => ({ ...a, _km: straightKm(parseFloat(a.latitude), parseFloat(a.longitude), lat, lon) }))
                    .sort((a, b) => a._km - b._km)
                    .slice(0, MAX_CANDIDATES)
                return Promise.all(located.map((a) =>
                    fetchRouteSummary(parseFloat(a.latitude), parseFloat(a.longitude), lat, lon).then((route) => ({ unit: a, route }))
                ))
            })
            .then((entries) => {
                if (cancelled) return
                const sorted = [...entries].sort((a, b) => {
                    if (!a.route && !b.route) return 0
                    if (!a.route) return 1
                    if (!b.route) return -1
                    return a.route.durationMin - b.route.durationMin
                })
                setCandidates(sorted)
                setChosenId(sorted[0]?.unit.ambulance_id ?? null)
                setPhase('ready')
            })
            .catch((e) => { if (!cancelled) { setError(e.message || 'No se pudieron consultar las unidades.'); setPhase('ready') } })
        return () => { cancelled = true }
    }, [emergencyId, canAssign])

    // Traza en el mapa la ruta de la unidad elegida hasta la emergencia
    useEffect(() => {
        const chosen = candidates.find((c) => c.unit.ambulance_id === chosenId)
        if (!chosen) { onRouteChange(null); return }
        let cancelled = false
        fetchRouteLine(parseFloat(chosen.unit.latitude), parseFloat(chosen.unit.longitude), lat, lon).then((line) => {
            if (!cancelled) onRouteChange(line ? [{ coordinates: line }] : null)
        })
        return () => { cancelled = true }
    }, [chosenId, candidates])

    // Al cerrar la tarjeta no debe quedar una ruta fantasma en el mapa
    useEffect(() => () => onRouteChange(null), [])

    const chosen = candidates.find((c) => c.unit.ambulance_id === chosenId)

    const confirmAssign = () => {
        if (!chosen || phase === 'sending') return
        setPhase('sending')
        setError('')
        fetch(`${API_BASE_URL}/emergencias/registrar-asignacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, ambulanceIds: [chosen.unit.ambulance_id], userProfileId: user.profileId, notes: '' })
        })
            .then(parseResponse)
            .then(() => onAssigned(emergencyId, chosen.unit))
            .catch((e) => { setError(e.message || 'No se pudo asignar la unidad. Intenta de nuevo.'); setPhase('ready') })
    }

    const level = emergency.triage_level ? (ROMAN[emergency.triage_level] || emergency.triage_level) : null
    const patients = emergency.num_patients || 1

    return (
        <div className="qa" role="region" aria-label="Emergencia seleccionada">
            <div className="qa-head">
                <div className="qa-title">
                    {level && <span className="qa-tri" style={{ background: emergency.triage_hex_color, color: readableTextOn(emergency.triage_hex_color) }}>{level}</span>}
                    <h3>{emergency.type_name}</h3>
                    <span className="qa-status">{emergency.status_name}</span>
                </div>
                <button type="button" className="qa-x" onClick={onClose} aria-label="Cerrar resumen"><Icon name="x" size={16} /></button>
            </div>
            <p className="qa-sub">{emergency.description} · {patients} {patients === 1 ? 'paciente' : 'pacientes'} · {formatElapsed(emergency.created_at)}</p>

            {canAssign && (
                <div className="qa-assign">
                    {phase === 'loading' && <p className="qa-note">Buscando la unidad más cercana…</p>}

                    {(phase === 'ready' || phase === 'confirm' || phase === 'sending') && candidates.length === 0 && !error && (
                        <p className="qa-note">No hay unidades propias disponibles con ubicación. Abre la emergencia para pedir una de otra institución.</p>
                    )}

                    {candidates.length > 0 && (
                        <ul className="qa-list" role="radiogroup" aria-label="Unidades recomendadas">
                            {candidates.map(({ unit, route }, i) => (
                                <li key={unit.ambulance_id}>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={unit.ambulance_id === chosenId}
                                        className={`qa-opt ${unit.ambulance_id === chosenId ? 'qa-opt-on' : ''}`}
                                        disabled={phase === 'confirm' || phase === 'sending'}
                                        onClick={() => setChosenId(unit.ambulance_id)}
                                    >
                                        <span className="qa-unit">{unit.unit_number}</span>
                                        {i === 0 && route && <span className="qa-best"><Icon name="check" size={12} />Más cercana</span>}
                                        <span className="qa-eta">{route ? `${fmtMin(route.durationMin)} · ${route.distanceKm.toFixed(1)} km` : 'sin ruta'}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {error && <p className="qa-error" role="alert"><Icon name="alert" size={14} />{error}</p>}

                    {chosen && phase === 'ready' && (
                        <button type="button" className="qa-primary" onClick={() => setPhase('confirm')}>
                            Asignar {chosen.unit.unit_number}{chosen.route ? ` · ${fmtMin(chosen.route.durationMin)}` : ''}
                        </button>
                    )}

                    {chosen && (phase === 'confirm' || phase === 'sending') && (
                        <div className="qa-confirm">
                            <p>¿Asignar <b>{chosen.unit.unit_number}</b> a esta emergencia{chosen.route ? <> — llegaría en unos <b>{fmtMin(chosen.route.durationMin)}</b></> : ''}?</p>
                            <div className="qa-row">
                                <button type="button" className="qa-primary" onClick={confirmAssign} disabled={phase === 'sending'}>
                                    {phase === 'sending' ? 'Asignando…' : 'Confirmar asignación'}
                                </button>
                                <button type="button" className="qa-ghost" onClick={() => setPhase('ready')} disabled={phase === 'sending'}>Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!needsUnit && <p className="qa-note">Ya tiene unidad asignada o en trámite. Abre la emergencia para ver el detalle o agregar otra.</p>}

            <div className="qa-foot">
                <button type="button" className="qa-ghost" onClick={onOpen}>Abrir emergencia</button>
            </div>
        </div>
    )
}

export default QuickAssignCard
