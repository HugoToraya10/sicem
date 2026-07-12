import './EmergencyCard.css'

// severity: 'critical' | 'warning' | 'stable'
const severityColor = {
    critical: '#C0272D',
    warning: '#E65100',
    stable: '#2E7D32',
}

const EmergencyCard = ({ type, location, elapsedLabel, unitCode, statusLabel, severity, onCardClick }) => {
    return (
        <div
            className="emergency-card"
            style={{ borderLeftColor: severityColor[severity] }}
            onClick={onCardClick}
        >
            <div className="ec-type">{type}</div>
            <div className="ec-loc">{location}</div>
            <div className="ec-meta">
                <span className="ec-time">{elapsedLabel}</span>
                <span className="ec-unit">{unitCode}</span>
            </div>
            <span
                className="ec-badge"
                style={{
                    color: severityColor[severity],
                    background: `${severityColor[severity]}1a`,
                }}
            >
                {statusLabel}
            </span>
        </div>
    )
}

export default EmergencyCard