import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './EmergencyDetail.css';
import { getNavLinks } from '../utils/Navlinks';
import { parseResponse } from '../utils/apiRequest';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

// Secuencia fija de avance manual. "Cerrada" nunca aparece aquí a propósito —
// el cierre es exclusivo del botón "Cerrar Emergencia".
const STATUS_SEQUENCE = ['Registrada', 'Asignada', 'En atención', 'Trasladando']

const formatDateTime = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Arma la línea de tiempo cronológica combinando los timestamps ya disponibles:
// registro, asignaciones/desasignaciones de ambulancia, notas de urgencia y cierre.
const buildTimeline = (emergencyData, assignments, patients, notesByPatient) => {
    const events = []

    if (emergencyData?.created_at) {
        events.push({
            at: emergencyData.created_at,
            label: 'Emergencia registrada',
            detail: emergencyData.type_name || '',
        })
    }

    assignments.forEach((a) => {
        if (a.assigned_at) {
            events.push({
                at: a.assigned_at,
                label: 'Ambulancia asignada',
                detail: a.unit_number ? `Unidad ${a.unit_number}` : '',
            })
        }
        if (a.unassigned_at) {
            events.push({
                at: a.unassigned_at,
                label: 'Ambulancia desasignada',
                detail: a.unit_number ? `Unidad ${a.unit_number}` : '',
            })
        }
    })

    const patientById = Object.fromEntries(patients.map(p => [p.emergency_patient_id, p]))
    Object.entries(notesByPatient).forEach(([emergencyPatientId, notes]) => {
        const patient = patientById[emergencyPatientId]
        const patientName = patient?.first_name
            ? `${patient.first_name} ${patient.first_surname || ''}`.trim()
            : 'Paciente sin identificar'
        notes.forEach((note) => {
            if (note.recorded_at) {
                events.push({
                    at: note.recorded_at,
                    label: 'Nota de urgencia registrada',
                    detail: `${patientName}${note.initial_diagnosis ? ` — ${note.initial_diagnosis}` : ''}`,
                })
            }
        })
    })

    if (emergencyData?.closed_at) {
        events.push({
            at: emergencyData.closed_at,
            label: 'Emergencia cerrada',
            detail: '',
        })
    }

    return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

const EmergencyDetail = () => {
    const { emergencyId } = useParams();
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencyData, setEmergencyData] = useState(null);
    const [patients, setPatients] = useState([]);
    const [notesByPatient, setNotesByPatient] = useState({});
    const [assignments, setAssignments] = useState([]);
    const [emergencyStatuses, setEmergencyStatuses] = useState([]);
    const [clinicalByPatient, setClinicalByPatient] = useState({});

    // Identificar paciente sin datos
    const [identifyingPatientId, setIdentifyingPatientId] = useState(null);
    const [identifyForm, setIdentifyForm] = useState({ firstName: '', firstSurname: '', secondSurname: '', cveUnicaRegistroPob: '', birthDate: '', phone: '' });

    // Agregar paciente a la emergencia en curso
    const [showAddPatientForm, setShowAddPatientForm] = useState(false);
    const [addPatientForm, setAddPatientForm] = useState({ curp: '', found: null, userProfileId: null, firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '', notes: '' });
    const [addPatientCurpBusy, setAddPatientCurpBusy] = useState(false);

    // Agregar ambulancia adicional a la emergencia en curso
    const [showAddAmbulanceForm, setShowAddAmbulanceForm] = useState(false);
    const [availableUnitsForAdd, setAvailableUnitsForAdd] = useState([]);
    const [selectedUnitsToAdd, setSelectedUnitsToAdd] = useState([]);

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchEmergencyData = () => {
        fetch(`http://localhost:3000/emergencias/emergencia/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setEmergencyData(toLowerCaseKeys(data)))
            .catch(error => console.error('Ocurrió un error al consultar esta emergencia. ', error))
    }
    useEffect(() => { fetchEmergencyData() }, [emergencyId]);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/estados-emergencia', { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setEmergencyStatuses((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de emergencia. ', error))
    }, []);

    const fetchPatients = () => {
        fetch(`http://localhost:3000/emergencias/pacientes/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data.map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error consultando pacientes. ', error))
    }
    useEffect(() => { fetchPatients() }, [emergencyId]);

    useEffect(() => {
        patients.forEach((patient) => {
            fetch(`http://localhost:3000/emergencias/notas/${patient.emergency_patient_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(({ data }) => {
                    setNotesByPatient((prev) => ({
                        ...prev,
                        [patient.emergency_patient_id]: data.map(n => toLowerCaseKeys(n))
                    }))
                })
                .catch(error => console.error('Error consultando notas de paciente. ', error))
        })
    }, [patients]);

    // Alergias/condiciones/medicamentos del expediente clínico de cada paciente identificado
    // (el tipo de sangre ya viene incluido en /emergencias/pacientes/:emergencyId, no hace falta pedirlo aparte)
    useEffect(() => {
        patients.forEach((patient) => {
            if (!patient.user_profile_id) return
            fetch(`http://localhost:3000/pacientes/ece/${patient.user_profile_id}`, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(({ clinicalRecord }) => {
                    const record = Array.isArray(clinicalRecord) ? clinicalRecord[0] : null
                    if (!record) return
                    const clinicalRecordId = toLowerCaseKeys(record).clinical_record_id
                    Promise.all([
                        fetch(`http://localhost:3000/pacientes/alergias/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                        fetch(`http://localhost:3000/pacientes/condiciones/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                        fetch(`http://localhost:3000/pacientes/medicamentos/${clinicalRecordId}`, {
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                        }).then(res => res.json()),
                    ]).then(([allergiesRes, conditionsRes, medicationsRes]) => {
                        setClinicalByPatient((prev) => ({
                            ...prev,
                            [patient.emergency_patient_id]: {
                                allergies: (allergiesRes.allergies || []).map(a => toLowerCaseKeys(a)),
                                conditions: (conditionsRes.conditions || []).map(c => toLowerCaseKeys(c)),
                                medications: (medicationsRes.medications || []).map(m => toLowerCaseKeys(m)),
                            }
                        }))
                    })
                })
                .catch(error => console.error('Error consultando expediente clínico del paciente. ', error))
        })
    }, [patients]);

    const fetchAssignments = () => {
        fetch(`http://localhost:3000/emergencias/asignaciones/${emergencyId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAssignments(data.map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando asignaciones. ', error))
    }
    useEffect(() => { fetchAssignments() }, [emergencyId]);

    //---------------------------------registrar, posts--------------------------------------------------

    const handleCloseEmergency = () => {
        if (!window.confirm('¿Seguro que quieres cerrar esta emergencia? Esta acción no se puede deshacer.')) return
        fetch('http://localhost:3000/emergencias/cerrar-emergencia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId })
        })
            .then(parseResponse)
            .then(() => navigate('/dashboard'))
            .catch(error => { console.error('Error cerrando la emergencia. ', error); alert(error.message) })
    }

    const handleAdvanceStatus = (emergencyStatusId) => {
        fetch('http://localhost:3000/emergencias/actualizar-estado-emergencia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, emergencyStatusId })
        })
            .then(parseResponse)
            .then(() => fetchEmergencyData())
            .catch(error => { console.error('Error actualizando el estado de la emergencia. ', error); alert(error.message) })
    }

    const handleUnassignAmbulance = (a) => {
        if (!window.confirm(`¿Seguro que quieres desasignar la unidad ${a.unit_number} de esta emergencia?`)) return
        fetch('http://localhost:3000/emergencias/desasignar-ambulancia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ assignmentId: a.assignment_id, ambulanceIds: [a.ambulance_id] })
        })
            .then(parseResponse)
            .then(() => fetchAssignments())
            .catch(error => { console.error('Error desasignando ambulancia. ', error); alert(error.message) })
    }

    //---------------------------------agregar ambulancia adicional a la emergencia en curso--------------------------------------------------

    const openAddAmbulanceForm = () => {
        setShowAddAmbulanceForm(true)
        setSelectedUnitsToAdd([])
        fetch(`http://localhost:3000/unidades/ambulancias-disponibles/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => setAvailableUnitsForAdd((data || []).map(u => toLowerCaseKeys(u))))
            .catch(error => { console.error('Error consultando unidades disponibles. ', error); alert(error.message) })
    }

    const toggleUnitToAdd = (ambulanceId) => {
        setSelectedUnitsToAdd((prev) => prev.includes(ambulanceId) ? prev.filter(id => id !== ambulanceId) : [...prev, ambulanceId])
    }

    const handleAddAmbulance = (e) => {
        e.preventDefault();
        if (selectedUnitsToAdd.length === 0) { alert('Selecciona al menos una unidad.'); return }
        fetch('http://localhost:3000/emergencias/registrar-asignacion', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, ambulanceIds: selectedUnitsToAdd, userProfileId: user.profileId, notes: '' })
        })
            .then(parseResponse)
            .then(() => { setShowAddAmbulanceForm(false); setSelectedUnitsToAdd([]); fetchAssignments(); })
            .catch(error => { console.error('Error agregando ambulancia. ', error); alert(error.message) })
    }

    //---------------------------------identificar paciente--------------------------------------------------

    const openIdentifyForm = (patient) => {
        setIdentifyingPatientId(patient.emergency_patient_id)
        setIdentifyForm({
            firstName: '', firstSurname: '', secondSurname: '',
            cveUnicaRegistroPob: '', birthDate: '', phone: patient.phone_number || '',
        })
    }

    const handleIdentifyPatient = (e, patient) => {
        e.preventDefault();
        fetch('http://localhost:3000/hospitales/identificar-paciente', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userProfileId: patient.user_profile_id,
                firstName: identifyForm.firstName,
                firstSurname: identifyForm.firstSurname,
                secondSurname: identifyForm.secondSurname,
                cveUnicaRegistroPob: identifyForm.cveUnicaRegistroPob,
                birthDate: identifyForm.birthDate,
                phone: identifyForm.phone,
            })
        })
            .then(parseResponse)
            .then(() => { setIdentifyingPatientId(null); fetchPatients(); })
            .catch(error => { console.error('Error identificando al paciente. ', error); alert(error.message) })
    }

    //---------------------------------agregar paciente a la emergencia en curso--------------------------------------------------

    const handleAddPatientCurpSearch = () => {
        const curp = addPatientForm.curp.trim()
        if (!curp) return
        setAddPatientCurpBusy(true)
        fetch(`http://localhost:3000/usuarios/obtener-usuario-curp/${curp}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const found = toLowerCaseKeys(data[0])
                    setAddPatientForm((prev) => ({
                        ...prev, found: true, userProfileId: found.user_profile_id,
                        firstName: found.first_name || '', firstSurname: found.first_surname || '',
                        secondSurname: found.second_surname || '', phone: found.phone_number || '',
                        birthDate: found.birth_date ? found.birth_date.split('T')[0] : '',
                    }))
                } else {
                    setAddPatientForm((prev) => ({ ...prev, found: false, userProfileId: null }))
                }
            })
            .catch(error => console.error('Error buscando por CURP. ', error))
            .finally(() => setAddPatientCurpBusy(false))
    }

    const linkPatientToEmergency = (userProfileId) => {
        return fetch('http://localhost:3000/emergencias/registrar-paciente', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyId, userProfileId, notes: addPatientForm.notes })
        }).then(parseResponse)
    }

    const handleAddPatient = (e) => {
        e.preventDefault();
        const emptyForm = { curp: '', found: null, userProfileId: null, firstName: '', firstSurname: '', secondSurname: '', phone: '', birthDate: '', notes: '' }

        const afterLink = () => {
            setAddPatientForm(emptyForm)
            setShowAddPatientForm(false)
            fetchPatients()
        }

        if (addPatientForm.userProfileId) {
            linkPatientToEmergency(addPatientForm.userProfileId).then(afterLink)
                .catch(error => { console.error('Error agregando paciente. ', error); alert(error.message) })
            return
        }

        fetch('http://localhost:3000/usuarios/registro-paciente', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: user.institutionId,
                firstName: addPatientForm.firstName || 'No identificado',
                firstSurname: addPatientForm.firstSurname || '',
                secondSurname: addPatientForm.secondSurname || '',
                phone: addPatientForm.phone,
                birthDate: addPatientForm.birthDate || null,
                cveUnicaRegistroPob: addPatientForm.curp || null,
                emergencyContact: '', emergencyPhone: '',
            })
        })
            .then(parseResponse)
            .then((newProfile) => linkPatientToEmergency(newProfile.userProfileId))
            .then(afterLink)
            .catch(error => { console.error('Error agregando paciente. ', error); alert(error.message) })
    }

    //---------------------------------registrar, posts--------------------------------------------------

    const timeline = buildTimeline(emergencyData, assignments, patients, notesByPatient)

    // Busca el siguiente estado de la secuencia por nombre (usando los IDs reales del
    // catálogo ya consultado), nunca asumiendo que el orden numérico coincide.
    const currentSequenceIndex = emergencyData ? STATUS_SEQUENCE.indexOf(emergencyData.status_name) : -1
    const nextStatusName = currentSequenceIndex >= 0 && currentSequenceIndex < STATUS_SEQUENCE.length - 1
        ? STATUS_SEQUENCE[currentSequenceIndex + 1]
        : null
    const nextStatus = nextStatusName
        ? emergencyStatuses.find(s => s.name === nextStatusName)
        : null

    if (emergencyData === null) {
        return <div className="detail-loading">Cargando...</div>
    }

    return (
        <div className="emergency-detail-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="detail-body">
                <div className="detail-header">
                    <h2>{emergencyData.type_name}</h2>
                    <span className="detail-status">{emergencyData.status_name}</span>
                    {emergencyData.triage_level && (
                        <span className="detail-triage-badge" style={{ background: emergencyData.triage_hex_color }}>
                            Triage Nivel {emergencyData.triage_level} — {emergencyData.triage_color_name}
                        </span>
                    )}
                    {parseInt(user?.roleId) === 2 && emergencyData.closed_at === null && nextStatus && (
                        <button
                            className="detail-advance-btn"
                            onClick={() => handleAdvanceStatus(nextStatus.emergency_status_id)}
                        >
                            Avanzar a: {nextStatus.name}
                        </button>
                    )}
                    {emergencyData.closed_at === null && (
                        <button className="detail-close-btn" onClick={handleCloseEmergency}>
                            Cerrar Emergencia
                        </button>
                    )}
                </div>

                <div className="detail-grid">
                    <div className="detail-field">
                        <span className="field-label">Descripción</span>
                        <span className="field-value">{emergencyData.description}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Reportante</span>
                        <span className="field-value">{emergencyData.reporter_name}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Teléfono</span>
                        <span className="field-value">{emergencyData.reporter_phone}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Pacientes reportados / registrados</span>
                        <span className="field-value">Pacientes reportados: {emergencyData.num_patients} · Pacientes registrados: {patients.length}</span>
                    </div>
                    <div className="detail-field">
                        <span className="field-label">Ubicación (coordenadas)</span>
                        <span className="field-value">{emergencyData.latitude}, {emergencyData.longitude}</span>
                    </div>
                </div>

                <div className="detail-section">
                    <div className="section-header-row">
                        <h3>Ambulancias Asignadas ({assignments.length})</h3>
                        {[1, 2].includes(parseInt(user?.roleId)) && emergencyData.closed_at === null && (
                            <button className="add-patient-btn" onClick={openAddAmbulanceForm}>+ Agregar ambulancia</button>
                        )}
                    </div>

                    {showAddAmbulanceForm && (
                        <form className="patient-form" onSubmit={handleAddAmbulance} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            {availableUnitsForAdd.length === 0 ? (
                                <p className="detail-empty">No hay unidades disponibles en tu institución ahorita mismo.</p>
                            ) : (
                                <div className="unit-cards-grid">
                                    {availableUnitsForAdd.map((u) => (
                                        <label key={u.ambulance_id} className={`unit-card ${selectedUnitsToAdd.includes(u.ambulance_id) ? 'selected' : ''}`}>
                                            <input type="checkbox" checked={selectedUnitsToAdd.includes(u.ambulance_id)} onChange={() => toggleUnitToAdd(u.ambulance_id)} />
                                            <div className="unit-card-info">
                                                <span className="unit-card-number">{u.unit_number}</span>
                                                <span className="unit-card-plate">{u.license_plate}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                            <div className="institutions-form-actions">
                                <button type="submit" className="institutions-form-submit">Asignar unidades seleccionadas</button>
                                <button type="button" className="institutions-form-cancel" onClick={() => setShowAddAmbulanceForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {assignments.length === 0 ? (
                        <p className="detail-empty">Sin ambulancias asignadas todavía.</p>
                    ) : (
                        <div className="assignments-list">
                            {assignments.map((a) => (
                                <div key={a.assignment_id} className="assignment-card">
                                    <span className="assignment-unit">{a.unit_number}</span>
                                    <span className="assignment-plate">{a.license_plate}</span>
                                    <span className="assignment-paramedic">
                                        {a.first_name ? `${a.first_name} ${a.first_surname}` : 'Sin paramédico asignado'}
                                    </span>
                                    {a.unassigned_at ? (
                                        <span className="assignment-tag">Desasignada</span>
                                    ) : (
                                        parseInt(user?.roleId) === 2 && (
                                            <button
                                                className="assignment-unassign-btn"
                                                onClick={() => handleUnassignAmbulance(a)}
                                            >
                                                Desasignar
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="detail-section">
                    <div className="section-header-row">
                        <h3>Pacientes ({patients.length})</h3>
                        {[1, 2, 3].includes(parseInt(user?.roleId)) && (
                            <button className="add-patient-btn" onClick={() => setShowAddPatientForm(!showAddPatientForm)}>
                                + Agregar paciente
                            </button>
                        )}
                    </div>
                    <p className="detail-note-hint">
                        Los pacientes y sus notas de urgencia son registrados por el paramédico en campo desde la app móvil.
                    </p>

                    {showAddPatientForm && (
                        <form className="patient-form" onSubmit={handleAddPatient} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div className="patient-id-curp-row">
                                <input
                                    type="text" placeholder="CURP"
                                    value={addPatientForm.curp}
                                    onChange={(e) => setAddPatientForm(p => ({ ...p, curp: e.target.value }))}
                                    maxLength={18}
                                />
                                <button type="button" onClick={handleAddPatientCurpSearch} disabled={addPatientCurpBusy || !addPatientForm.curp.trim()}>
                                    {addPatientCurpBusy ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>
                            {addPatientForm.found === true && <p className="patient-id-found">✓ Paciente encontrado — datos cargados automáticamente</p>}
                            {addPatientForm.found === false && <p className="patient-id-notfound">No se encontró. Llena los datos manualmente si los tienes.</p>}
                            <div className="patient-id-row">
                                <input type="text" placeholder="Nombre(s)" value={addPatientForm.firstName} onChange={(e) => setAddPatientForm(p => ({ ...p, firstName: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={100} />
                                <input type="text" placeholder="Apellido paterno" value={addPatientForm.firstSurname} onChange={(e) => setAddPatientForm(p => ({ ...p, firstSurname: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={150} />
                            </div>
                            <div className="patient-id-row">
                                <input type="text" placeholder="Apellido materno" value={addPatientForm.secondSurname} onChange={(e) => setAddPatientForm(p => ({ ...p, secondSurname: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={150} />
                                <input type="text" placeholder="Teléfono" value={addPatientForm.phone} onChange={(e) => setAddPatientForm(p => ({ ...p, phone: e.target.value }))} readOnly={addPatientForm.found === true} maxLength={10} />
                            </div>
                            <textarea placeholder="Notas (opcional)" value={addPatientForm.notes} onChange={(e) => setAddPatientForm(p => ({ ...p, notes: e.target.value }))} maxLength={300} />
                            <div className="institutions-form-actions">
                                <button type="submit" className="institutions-form-submit">Agregar paciente</button>
                                <button type="button" className="institutions-form-cancel" onClick={() => setShowAddPatientForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {patients.length === 0 ? (
                        <p className="detail-empty">Sin pacientes registrados todavía.</p>
                    ) : (
                        patients.map((patient) => (
                            <div key={patient.emergency_patient_id} className="patient-card">
                                <div className="patient-header">
                                    <span className="patient-name">
                                        {patient.first_name
                                            ? `${patient.first_name} ${patient.first_surname || ''}`
                                            : 'Paciente sin identificar'}
                                    </span>
                                    {patient.curp && <span className="patient-curp">{patient.curp}</span>}
                                    {patient.blood_type && <span className="patient-blood-type">Tipo {patient.blood_type}</span>}
                                    {!patient.first_name && [1, 4].includes(parseInt(user?.roleId)) && (
                                        <button className="add-note-btn" onClick={() => openIdentifyForm(patient)}>Identificar paciente</button>
                                    )}
                                </div>
                                {patient.notes && <p className="patient-notes">{patient.notes}</p>}

                                {identifyingPatientId === patient.emergency_patient_id && (
                                    <form className="note-form" onSubmit={(e) => handleIdentifyPatient(e, patient)}>
                                        <div className="note-form-row">
                                            <input type="text" placeholder="Nombre(s)" value={identifyForm.firstName} onChange={(e) => setIdentifyForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required />
                                            <input type="text" placeholder="Apellido paterno" value={identifyForm.firstSurname} onChange={(e) => setIdentifyForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required />
                                        </div>
                                        <div className="note-form-row">
                                            <input type="text" placeholder="Apellido materno" value={identifyForm.secondSurname} onChange={(e) => setIdentifyForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} />
                                            <input type="text" placeholder="CURP" maxLength={18} value={identifyForm.cveUnicaRegistroPob} onChange={(e) => setIdentifyForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} />
                                        </div>
                                        <div className="note-form-row">
                                            <input type="date" value={identifyForm.birthDate} onChange={(e) => setIdentifyForm(p => ({ ...p, birthDate: e.target.value }))} />
                                            <input type="text" placeholder="Teléfono" value={identifyForm.phone} onChange={(e) => setIdentifyForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} />
                                        </div>
                                        <button type="submit">Guardar identidad</button>
                                        <button type="button" className="institutions-form-cancel" onClick={() => setIdentifyingPatientId(null)}>Cancelar</button>
                                    </form>
                                )}

                                {clinicalByPatient[patient.emergency_patient_id] && (
                                    <div className="patient-clinical-info">
                                        {clinicalByPatient[patient.emergency_patient_id].allergies.length > 0 && (
                                            <div className="clinical-row"><strong>Alergias:</strong> {clinicalByPatient[patient.emergency_patient_id].allergies.map(a => a.name).join(', ')}</div>
                                        )}
                                        {clinicalByPatient[patient.emergency_patient_id].conditions.length > 0 && (
                                            <div className="clinical-row"><strong>Condiciones:</strong> {clinicalByPatient[patient.emergency_patient_id].conditions.map(c => c.name).join(', ')}</div>
                                        )}
                                        {clinicalByPatient[patient.emergency_patient_id].medications.length > 0 && (
                                            <div className="clinical-row"><strong>Medicamentos:</strong> {clinicalByPatient[patient.emergency_patient_id].medications.map(m => m.name).join(', ')}</div>
                                        )}
                                    </div>
                                )}

                                {notesByPatient[patient.emergency_patient_id]?.map((note) => (
                                    <div key={note.emergency_note_id} className="triage-note">
                                        <span className="triage-badge" style={{ background: note.color }}>
                                            Nivel {note.level}
                                        </span>
                                        <div className="vitals-grid">
                                            <span>PA: {note.blood_pressure}</span>
                                            <span>FC: {note.heart_rate}</span>
                                            <span>Temp: {note.temperature}°C</span>
                                            <span>SpO2: {note.oxygen_saturation}%</span>
                                        </div>
                                        <p className="triage-diagnosis">{note.initial_diagnosis}</p>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className="detail-section">
                    <h3>Línea de Tiempo</h3>
                    {timeline.length === 0 ? (
                        <p className="detail-empty">Sin eventos registrados todavía.</p>
                    ) : (
                        <div className="timeline">
                            {timeline.map((event, index) => (
                                <div key={index} className="timeline-item">
                                    <div className="timeline-marker">
                                        <span className="timeline-dot" />
                                        {index < timeline.length - 1 && <span className="timeline-line" />}
                                    </div>
                                    <div className="timeline-content">
                                        <span className="timeline-time">{formatDateTime(event.at)}</span>
                                        <span className="timeline-label">{event.label}</span>
                                        {event.detail && <span className="timeline-detail">{event.detail}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default EmergencyDetail;