import './EmergencyCard.css'

// severity: 'critical' | 'warning' | 'stable' — usado solo como respaldo cuando la
// emergencia todavía no tiene ningún nivel de triage (ni estimado ni de una nota real).
const severityColor = {
    critical: '#C0272D',
    warning: '#E65100',
    stable: '#2E7D32',
}

// `color` (hex_color del triage, peor caso entre el estimado del despachador y las notas
// reales) tiene prioridad sobre `severity`, que ahora es solo el valor de respaldo.
// pendingCount/rejectedCount vienen de emergencias-activas (Parte 1) — solo cuentan
// pacientes con destino asignado. Si hay rechazados, ese badge manda (es lo más urgente);
// si no hay rechazados pero sí pendientes, se muestra ese en su lugar. Si ambos son 0,
// no se muestra ningún badge de recepción — no ensuciar tarjetas sin novedad.
const EmergencyCard = ({ type, location, elapsedLabel, unitCode, statusLabel, severity, color, triageLevel, pendingCount, rejectedCount, isStalled, onCardClick }) => {
    const borderColor = color || severityColor[severity] || severityColor.stable
    const hasRejected = rejectedCount > 0
    const hasPending = !hasRejected && pendingCount > 0
    return (
        <div
            className={`emergency-card ${isStalled ? 'emergency-card-stalled' : ''}`}
            style={{ borderLeftColor: borderColor }}
            onClick={onCardClick}
        >
            <div className="ec-type">
                {type}
                {triageLevel && (
                    <span className="ec-triage-badge" style={{ background: borderColor }}>
                        Nivel {triageLevel}
                    </span>
                )}
            </div>
            <div className="ec-loc">{location}</div>
            <div className="ec-meta">
                <span className="ec-time">{elapsedLabel}</span>
                <span className="ec-unit">{unitCode}</span>
            </div>
            <div className="ec-badges">
                <span
                    className="ec-badge"
                    style={{
                        color: borderColor,
                        background: `${borderColor}1a`,
                    }}
                >
                    {statusLabel}
                </span>
                {hasRejected && (
                    <span className="ec-reception-badge ec-reception-rechazada">
                        Rechazado{rejectedCount > 1 ? ` (${rejectedCount})` : ''}
                    </span>
                )}
                {hasPending && (
                    <span className="ec-reception-badge ec-reception-pendiente">
                        Pendiente de confirmación{pendingCount > 1 ? ` (${pendingCount})` : ''}
                    </span>
                )}
                {isStalled && (
                    <span className="ec-reception-badge ec-reception-stalled">
                        ⚠ Estancada — revisar
                    </span>
                )}
            </div>
        </div>
    )
}

export default EmergencyCard