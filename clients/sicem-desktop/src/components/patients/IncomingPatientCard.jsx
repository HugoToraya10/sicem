import Icon from '../ui/Icon'
import { readableTextOn } from '../../utils/color'
import { formatElapsed } from '../../utils/time'
import { triageRoman } from '../../utils/triage'
import './IncomingPatientCard.css'

const IncomingPatientCard = ({ patient, hospitalInstitutionId, onViewDetail, onAccept, onReject }) => {
    const fullName = [patient.first_name, patient.first_surname, patient.second_surname]
        .filter(Boolean).join(' ') || 'Paciente no identificado'

    const allergyList = patient.allergies ? patient.allergies.split(', ') : []
    const conditionList = patient.conditions ? patient.conditions.split(', ') : []

    const unitLabel = patient.unit_number
        ? `Unidad ${patient.unit_number} · ${patient.institution_name || 'Institución desconocida'}`
        : 'Unidad aún no asignada'

    const isPending = parseInt(patient.reception_status_id) === 1
    const hasMultiplePatients = parseInt(patient.num_patients) > 1

    // Detección de afiliación: si el paciente tiene institución de afiliación distinta a la que lo
    // va a recibir, es "de otra institución" y conviene que el hospital lo sepa (y en su caso se
    // reasigne el destino).
    // Un paciente sin CURP ni número de afiliación (no identificado) se registra con la institución de la ambulancia
    // solo como relleno: eso NO es una afiliación real y no debe mostrarse como tal.
    const isIdentified = Boolean(patient.curp || patient.patient_identification_number)
    const isOtherInstitution = isIdentified && Boolean(patient.patient_institution_id)
        && parseInt(patient.patient_institution_id) !== parseInt(hospitalInstitutionId)

    const elapsedMinutes = patient.created_at ? (Date.now() - new Date(patient.created_at).getTime()) / 60000 : null
    // "Vencido" = ya lleva esperando más del tiempo máximo que su propio nivel de triage tolera:
    // señal directa de que se está quedando atrás, no solo un cronómetro decorativo.
    const isOverdue = patient.max_wait_minutes !== null && patient.max_wait_minutes !== undefined
        && elapsedMinutes !== null && elapsedMinutes > Number(patient.max_wait_minutes)

    // El paramédico ya tocó "Concluir traslado" desde sicem-mobile: la ambulancia dice haber
    // llegado aunque el paciente TODAVÍA esté "Pendiente" de aceptar (lo más probable en la
    // práctica: la ambulancia puede llegar antes de que el hospital termine de decidir).
    const isUrgent = Boolean(patient.paramedic_concluded_at) && !patient.delivered_at

    const triageColor = patient.triage_hex_color || 'var(--text-3)'
    const level = triageRoman(patient.triage_level)

    return (
        <article
            className={`ipc${isUrgent ? ' ipc-urgent' : ''}`}
            style={{ '--c': isUrgent ? 'var(--brand)' : triageColor }}
            aria-label={`${fullName}${level ? `, nivel ${level}` : ''}`}
        >
            <span className="ipc-rail" />

            <div className="ipc-main">
                <div className="ipc-top">
                    {level && (
                        <span className="tri" style={{ '--c': triageColor, color: readableTextOn(patient.triage_hex_color) }} title={patient.triage_color_name ? `Triage nivel ${level} (${patient.triage_color_name})` : `Triage nivel ${level}`}>
                            {level}
                        </span>
                    )}
                    <h3 className="ipc-name">{fullName}</h3>
                    {isUrgent && <span className="chip chip-brand"><Icon name="alert" />Unidad ya llegó</span>}
                    {elapsedMinutes !== null && (
                        <span
                            className={`chip ${isOverdue ? 'chip-brand' : ''}`}
                            title={isOverdue ? `Superó el tiempo máximo de espera de su triage (${patient.max_wait_minutes} min)` : 'Tiempo esperando desde que se registró'}
                        >
                            <Icon name="clock" />{isOverdue && 'Vencido · '}{formatElapsed(patient.created_at)}
                        </span>
                    )}
                    {hasMultiplePatients && (
                        <span className="chip" title="Esta emergencia tiene más pacientes registrados">
                            +{parseInt(patient.num_patients) - 1} más
                        </span>
                    )}
                    {isOtherInstitution && (
                        <span className="chip chip-warn" title={`Este paciente está afiliado a ${patient.patient_institution_name || 'otra institución'}`}>
                            Afiliado a {patient.patient_institution_name || 'otra institución'}
                        </span>
                    )}
                </div>

                <p className="ipc-desc">{patient.description || 'Sin descripción'}</p>
                <p className="ipc-meta">
                    {unitLabel} · CURP: {patient.curp || 'sin CURP'}
                    {patient.patient_identification_number && ` · ID: ${patient.patient_identification_number}`}
                </p>

                <div className="ipc-tags">
                    {patient.blood_type && <span className="chip chip-steel">Sangre {patient.blood_type}</span>}
                    {allergyList.length > 0
                        ? allergyList.map((a) => <span key={a} className="chip chip-brand"><Icon name="alert" />Alergia: {a}</span>)
                        : <span className="chip" title="No hay alergias capturadas; no significa que no existan">Alergias: sin registro</span>}
                    {conditionList.map((c) => <span key={c} className="chip chip-warn">{c}</span>)}
                </div>
            </div>

            <div className="ipc-actions">
                {isPending ? (
                    <>
                        <button type="button" className="btn btn-ok" onClick={() => onAccept(patient.emergency_patient_id)}>
                            <Icon name="check" size={16} />Aceptar
                        </button>
                        <button type="button" className="btn btn-outline-danger" onClick={() => onReject(patient.emergency_patient_id)}>
                            Rechazar
                        </button>
                    </>
                ) : (
                    <span className={`chip ${patient.delivered_at ? 'chip-steel' : 'chip-ok'}`}>
                        {patient.delivered_at ? 'Entregado' : 'Confirmado'}
                    </span>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => onViewDetail(patient)}>Ver detalle</button>
            </div>
        </article>
    )
}

export default IncomingPatientCard
