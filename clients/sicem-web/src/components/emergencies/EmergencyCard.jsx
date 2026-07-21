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
const EmergencyCard = ({ type, location, elapsedLabel, unitCode, statusLabel, severity, color, triageLevel, onCardClick }) => {
    const borderColor = color || severityColor[severity] || severityColor.stable
    return (
        <div
            className="emergency-card"
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
            <span
                className="ec-badge"
                style={{
                    color: borderColor,
                    background: `${borderColor}1a`,
                }}
            >
                {statusLabel}
            </span>
        </div>
    )
}

export default EmergencyCard