import Icon from '../ui/Icon'
import { readableTextOn } from '../../utils/color'
import './EmergencyCard.css'

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }

// severity: 'critical' | 'warning' | 'stable' — usado solo como respaldo cuando la
// emergencia todavía no tiene ningún nivel de triage (ni estimado ni de una nota real).
const severityColor = {
    critical: 'var(--t1)',
    warning: 'var(--t2)',
    stable: 'var(--t4)',
}

// `color` (hex_color del triage, peor caso entre el estimado del despachador y las notas
// reales) tiene prioridad sobre `severity`, que ahora es solo el valor de respaldo.
// pendingCount/rejectedCount vienen de emergencias-activas — solo cuentan pacientes con
// destino asignado. Si hay rechazados, ese chip manda (es lo más urgente); si no hay
// rechazados pero sí pendientes, se muestra ese en su lugar.
const EmergencyCard = ({ type, location, elapsedLabel, unitCode, statusLabel, severity, color, triageLevel, pendingCount, rejectedCount, isStalled, isSelected, onCardClick, onLocate, onHover }) => {
    const accent = color || severityColor[severity] || severityColor.stable
    const hasRejected = rejectedCount > 0
    const hasPending = !hasRejected && pendingCount > 0
    const level = triageLevel ? (ROMAN[triageLevel] || triageLevel) : null

    return (
        <div
            className="ec-wrap"
            onMouseEnter={onHover ? () => onHover(true) : undefined}
            onMouseLeave={onHover ? () => onHover(false) : undefined}
        >
        <button
            type="button"
            className={`ec ${isStalled ? 'ec-is-stalled' : ''} ${isSelected ? 'ec-is-selected' : ''} ${triageLevel === 1 ? 'ec-critical' : ''}`}
            style={{ '--c': accent }}
            onClick={onCardClick}
            aria-label={`${type}${level ? `, nivel ${level}` : ''}, ${statusLabel}. Abrir detalle`}
        >
            <span className="ec-rail" />
            <span className="ec-body">
                <span className="ec-top">
                    {level && <span className="ec-tri" style={{ color: readableTextOn(accent) }}>{level}</span>}
                    <span className="ec-type">{type}</span>
                    <span className="ec-time">{elapsedLabel}</span>
                </span>
                <span className="ec-loc"><Icon name="pin" size={14} />{location}</span>
                <span className="ec-chips">
                    <span className="ec-chip"><span className="ec-chip-dot" />{statusLabel}</span>
                    {unitCode && <span className="ec-unit">{unitCode}</span>}
                    {hasRejected && (
                        <span className="ec-chip ec-chip-rejected">
                            <Icon name="alert" size={13} />Rechazado{rejectedCount > 1 ? ` (${rejectedCount})` : ''}
                        </span>
                    )}
                    {hasPending && (
                        <span className="ec-chip ec-chip-pending">
                            Pendiente de confirmación{pendingCount > 1 ? ` (${pendingCount})` : ''}
                        </span>
                    )}
                    {isStalled && (
                        <span className="ec-chip ec-chip-stalled">
                            <Icon name="clock" size={13} />Sin movimiento
                        </span>
                    )}
                </span>
            </span>
        </button>
        {onLocate && (
            <button type="button" className="ec-locate" onClick={onLocate} aria-label="Ver en el mapa" title="Ver en el mapa">
                <Icon name="crosshair" size={15} />
            </button>
        )}
        </div>
    )
}

export default EmergencyCard
