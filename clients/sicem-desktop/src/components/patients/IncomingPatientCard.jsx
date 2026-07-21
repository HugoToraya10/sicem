import './IncomingPatientCard.css'

const IncomingPatientCard = ({ patient, onViewDetail }) => {
    const fullName = [patient.first_name, patient.first_surname, patient.second_surname]
        .filter(Boolean).join(' ') || 'Paciente no identificado'

    const allergyList = patient.allergies ? patient.allergies.split(', ') : []
    const conditionList = patient.conditions ? patient.conditions.split(', ') : []

    const paramedicName = patient.paramedic_first_name
        ? `${patient.paramedic_first_name} ${patient.paramedic_first_surname || ''}`.trim()
        : 'Sin paramédico asignado'

    const unitLabel = patient.unit_number
        ? `Unidad ${patient.unit_number} · ${patient.ambulance_institution_name || 'Institución desconocida'}`
        : 'Unidad aún no asignada'

    return (
        <div className="patient-card" style={{ borderLeftColor: patient.triage_color || '#1565C0' }}>
            <div className="pc-info">
                <div className="pc-name">{fullName}</div>
                <div className="pc-type">{patient.emergency_description || 'Sin descripción'}</div>
                <div className="pc-detail">{unitLabel} · CURP: {patient.curp || 'Sin CURP'}</div>
                <div className="pc-detail">Paramédico: {paramedicName}</div>
            </div>

            <div className="pc-tags">
                {patient.blood_type && <span className="tag blood">{patient.blood_type}</span>}
                {allergyList.length > 0
                    ? allergyList.map((a) => <span key={a} className="tag allergy">Alergia: {a}</span>)
                    : <span className="tag allergy">Sin alergias registradas</span>}
                {conditionList.map((c) => <span key={c} className="tag condition">{c}</span>)}
            </div>

            <div className="pc-status">
                <span className="pc-status-pill">En camino</span>
            </div>

            <button className="btn-detail" onClick={() => onViewDetail(patient)}>Ver detalle</button>
        </div>
    )
}

export default IncomingPatientCard