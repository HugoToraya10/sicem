import './IncomingPatientCard.css'

const formatElapsed = (createdAt) => {
    if (!createdAt) return null
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes < 60) return `${minutes} min`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`
}

const IncomingPatientCard = ({ patient, onViewDetail, onAccept, onReject }) => {
    const fullName = [patient.first_name, patient.first_surname, patient.second_surname]
        .filter(Boolean).join(' ') || 'Paciente no identificado'

    const allergyList = patient.allergies ? patient.allergies.split(', ') : []
    const conditionList = patient.conditions ? patient.conditions.split(', ') : []

    const unitLabel = patient.unit_number
        ? `Unidad ${patient.unit_number} · ${patient.institution_name || 'Institución desconocida'}`
        : 'Unidad aún no asignada'

    const isPending = parseInt(patient.reception_status_id) === 1
    const hasMultiplePatients = parseInt(patient.num_patients) > 1

    const elapsedMinutes = patient.created_at ? (Date.now() - new Date(patient.created_at).getTime()) / 60000 : null
    // "Vencido" = ya lleva esperando más del tiempo máximo que su propio nivel
    // de triage tolera — señal directa de que se está quedando atrás, no solo
    // un cronómetro decorativo.
    const isOverdue = patient.max_wait_minutes !== null && patient.max_wait_minutes !== undefined
        && elapsedMinutes !== null && elapsedMinutes > Number(patient.max_wait_minutes)

    // El paramédico ya tocó "Concluir traslado" (tipo Uber "terminar viaje")
    // desde sicem-mobile — la ambulancia dice haber llegado, aunque el
    // paciente TODAVÍA esté "Pendiente" de aceptar (que es lo más probable en
    // la práctica: la ambulancia puede llegar antes de que el hospital
    // termine de decidir). Antes esto solo se resaltaba en Seguimiento (una
    // vez "Aceptada"), así que en este escenario tan común el aviso nunca se
    // veía en ningún lado.
    const isUrgent = Boolean(patient.paramedic_concluded_at) && !patient.delivered_at

    return (
        <div
            className={`patient-card${isUrgent ? ' pc-urgent' : ''}`}
            style={{ borderLeftColor: isUrgent ? '#C0272D' : (patient.triage_hex_color || '#1565C0') }}
        >
            <div className="pc-info">
                <div className="pc-name-row">
                    <div className="pc-name">{fullName}</div>
                    {isUrgent && <span className="pc-urgent-badge">🚑 Unidad ya llegó</span>}
                    {patient.triage_level && (
                        <span className="pc-triage-badge" style={{ background: patient.triage_hex_color || '#888' }}>
                            {patient.triage_level} · {patient.triage_color_name}
                        </span>
                    )}
                    {elapsedMinutes !== null && (
                        <span className={`pc-wait-badge ${isOverdue ? 'overdue' : ''}`} title={isOverdue ? `Superó el tiempo máximo de espera de su triage (${patient.max_wait_minutes} min)` : 'Tiempo esperando desde que se registró'}>
                            {isOverdue && '⚠ '}⏱ {formatElapsed(patient.created_at)}
                        </span>
                    )}
                    {hasMultiplePatients && (
                        <span className="pc-multi-badge" title="Esta emergencia tiene más pacientes registrados">
                            +{parseInt(patient.num_patients) - 1} más
                        </span>
                    )}
                </div>
                <div className="pc-type">{patient.description || 'Sin descripción'}</div>
                <div className="pc-detail">{unitLabel} · CURP: {patient.curp || 'Sin CURP'}</div>
            </div>

            <div className="pc-tags">
                {patient.blood_type && <span className="tag blood">{patient.blood_type}</span>}
                {allergyList.length > 0
                    ? allergyList.map((a) => <span key={a} className="tag allergy">Alergia: {a}</span>)
                    : <span className="tag allergy">Sin alergias registradas</span>}
                {conditionList.map((c) => <span key={c} className="tag condition">{c}</span>)}
            </div>

            {isPending ? (
                <div className="pc-actions">
                    <button className="btn-accept" onClick={() => onAccept(patient.emergency_patient_id)}>Aceptar</button>
                    <button className="btn-reject" onClick={() => onReject(patient.emergency_patient_id)}>Rechazar</button>
                </div>
            ) : (
                <div className="pc-status">
                    <span className={`pc-status-pill ${patient.delivered_at ? 'delivered' : 'confirmed'}`}>
                        {patient.delivered_at ? 'Entregado' : 'Confirmado'}
                    </span>
                </div>
            )}

            <button className="btn-detail" onClick={() => onViewDetail(patient)}>Ver detalle</button>
        </div>
    )
}

export default IncomingPatientCard