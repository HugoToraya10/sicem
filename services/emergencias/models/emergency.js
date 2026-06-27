const db = require('../config/db');

// ─── POST ────────────────────────────────────────────────────────────────────

const registerEmergency = (data, callback) => {
    const {
        emergencyTypeId,
        emergencyStatusId,
        userProfileId,
        longitude,
        latitude,
        description,
        reporterName,
        reporterPhone,
        numPatients
    } = data;
    const sql = `INSERT INTO emergencies (emergency_type_id, emergency_status_id, user_profile_id,
                longitude, latitude, description, reporter_name, reporter_phone, num_patients,
                created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    db.query(sql, [emergencyTypeId, emergencyStatusId, userProfileId, longitude, latitude,
                    description, reporterName, reporterPhone, numPatients], callback);
}

const registerEmergencyPatient = (data, callback) => {
    const { emergencyId, userProfileId, notes } = data;
    const sql = `INSERT INTO emergencies_patients (emergency_id, user_profile_id, notes, created_at)
                VALUES (?, ?, ?, NOW())`;
    db.query(sql, [emergencyId, userProfileId, notes], callback);
}

const registerEmergencyNote = (data, callback) => {
    const {
        emergencyPatientId,
        userProfileId,
        triageLevelId,
        bloodPressure,
        heartRate,
        temperature,
        oxygenSaturation,
        respiratoryRate,
        consciousnessLevel,
        initialDiagnosis,
        treatmentApplied,
        patientStatus
    } = data;
    const sql = `INSERT INTO emergency_notes (emergency_patient_id, user_profile_id, triage_levels_id,
                blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate,
                consciousness_level, initial_diagnosis, treatment_applied, patient_status, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    db.query(sql, [emergencyPatientId, userProfileId, triageLevelId, bloodPressure, heartRate,
                    temperature, oxygenSaturation, respiratoryRate, consciousnessLevel,
                    initialDiagnosis, treatmentApplied, patientStatus], callback);
}

const registerAssignment = (data, callback) => {
    const { emergencyId, ambulanceId, userProfileId, notes } = data;
    const sql = `INSERT INTO assignments (emergency_id, ambulance_id, user_profile_id, assigned_at, notes)
                VALUES (?, ?, ?, NOW(), ?)`;
    db.query(sql, [emergencyId, ambulanceId, userProfileId, notes], callback);
}

const registerInterInstitutionalRequest = (data, callback) => {
    const {
        emergencyId,
        ambulanceId,
        userProfileId,
        requestStatusId,
        requestingInstitutionId,
        receivingInstitutionId
    } = data;
    const sql = `INSERT INTO inter_institutional_requests (emergency_id, ambulance_id, user_profile_id,
                request_status_id, requesting_institution_id, receiving_institution_id, requested_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())`;
    db.query(sql, [emergencyId, ambulanceId, userProfileId, requestStatusId,
                    requestingInstitutionId, receivingInstitutionId], callback);
}

const createEmergencyType = (name, description, callback) => {
    const sql = `INSERT INTO emergency_types (name, description) VALUES (?, ?)`;
    db.query(sql, [name, description], callback);
}

const createEmergencyStatus = (name, description, callback) => {
    const sql = `INSERT INTO emergency_statuses (name, description) VALUES (?, ?)`;
    db.query(sql, [name, description], callback);
}

const createRequestStatus = (name, description, callback) => {
    const sql = `INSERT INTO request_statuses (name, description) VALUES (?, ?)`;
    db.query(sql, [name, description], callback);
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

const updateEmergencyStatus = (emergencyId, emergencyStatusId, callback) => {
    const sql = `UPDATE emergencies SET emergency_status_id = ?, updated_at = NOW()
                WHERE emergency_id = ?`;
    db.query(sql, [emergencyStatusId, emergencyId], callback);
}

const updateEmergencyAmbulance = (emergencyId, ambulanceId, callback) => {
    const sql = `UPDATE emergencies SET ambulance_id = ?, updated_at = NOW()
                WHERE emergency_id = ?`;
    db.query(sql, [ambulanceId, emergencyId], callback);
}

// Actualizar estado de ambulancia al asignar/desasignar
const updateAmbulanceStatus = (ambulanceId, ambulanceStatusId, callback) => {
    const sql = `UPDATE ambulances SET ambulance_status_id = ?, updated_at = NOW() WHERE ambulance_id = ?`;
    db.query(sql, [ambulanceStatusId, ambulanceId], callback);
}

const closeEmergency = (emergencyId, callback) => {
    const sql = `UPDATE emergencies SET closed_at = NOW(), updated_at = NOW()
                WHERE emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

const unassignAmbulance = (assignmentId, callback) => {
    const sql = `UPDATE assignments SET unassigned_at = NOW() WHERE assignment_id = ?`;
    db.query(sql, [assignmentId], callback);
}

const respondInterInstitutionalRequest = (data, callback) => {
    const { interInstitutionalRequestId, requestStatusId, rejectionReason } = data;
    const sql = `UPDATE inter_institutional_requests SET request_status_id = ?,
                rejection_reason = ?, responded_at = NOW()
                WHERE inter_institutional_request_id = ?`;
    db.query(sql, [requestStatusId, rejectionReason, interInstitutionalRequestId], callback);
}

const toggleEmergencyType = (emergencyTypeId, callback) => {
    const sql = `UPDATE emergency_types SET is_active = NOT is_active WHERE emergency_type_id = ?`;
    db.query(sql, [emergencyTypeId], callback);
}

const toggleEmergencyStatus = (emergencyStatusId, callback) => {
    const sql = `UPDATE emergency_statuses SET is_active = NOT is_active WHERE emergency_status_id = ?`;
    db.query(sql, [emergencyStatusId], callback);
}

const toggleRequestStatus = (requestStatusId, callback) => {
    const sql = `UPDATE request_statuses SET is_active = NOT is_active WHERE request_status_id = ?`;
    db.query(sql, [requestStatusId], callback);
}

const toggleTriageLevel = (triageLevelId, callback) => {
    const sql = `UPDATE triage_levels SET is_active = NOT is_active WHERE triage_levels_id = ?`;
    db.query(sql, [triageLevelId], callback);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

// Emergencias activas (sin closed_at)
const getAllActiveEmergencies = (callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                WHERE e.closed_at IS NULL
                ORDER BY e.created_at DESC`;
    db.query(sql, callback);
}

// Historial de emergencias cerradas
const getAllClosedEmergencies = (callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                WHERE e.closed_at IS NOT NULL
                ORDER BY e.closed_at DESC`;
    db.query(sql, callback);
}

// Emergencia por ID
const getEmergencyById = (emergencyId, callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                WHERE e.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Pacientes de una emergencia
const getPatientsByEmergency = (emergencyId, callback) => {
    const sql = `SELECT ep.*, up.first_name, up.first_surname, up.second_surname,
                up.curp, up.phone_number, up.blood_type_id
                FROM emergencies_patients ep
                LEFT JOIN user_profiles up ON ep.user_profile_id = up.user_profile_id
                WHERE ep.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Notas de urgencia de un paciente en una emergencia
const getNotesByEmergencyPatient = (emergencyPatientId, callback) => {
    const sql = `SELECT en.*, tl.level, tl.color, tl.description AS triage_description
                FROM emergency_notes en
                LEFT JOIN triage_levels tl ON en.triage_levels_id = tl.triage_levels_id
                WHERE en.emergency_patient_id = ?`;
    db.query(sql, [emergencyPatientId], callback);
}

// Asignaciones de una emergencia
const getAssignmentsByEmergency = (emergencyId, callback) => {
    const sql = `SELECT a.*, amb.unit_number, amb.license_plate,
                up.first_name, up.first_surname
                FROM assignments a
                LEFT JOIN ambulances amb ON a.ambulance_id = amb.ambulance_id
                LEFT JOIN user_profiles up ON a.user_profile_id = up.user_profile_id
                WHERE a.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Solicitudes interinstitucionales activas (pendientes)
const getPendingInterInstitutionalRequests = (callback) => {
    const sql = `SELECT ir.*, rs.name AS status_name,
                i1.name AS requesting_institution,
                i2.name AS receiving_institution
                FROM inter_institutional_requests ir
                LEFT JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                LEFT JOIN institutions i1 ON ir.requesting_institution_id = i1.institution_id
                LEFT JOIN institutions i2 ON ir.receiving_institution_id = i2.institution_id
                WHERE ir.request_status_id = 1
                ORDER BY ir.requested_at DESC`;
    db.query(sql, callback);
}

// Todas las solicitudes interinstitucionales
const getAllInterInstitutionalRequests = (callback) => {
    const sql = `SELECT ir.*, rs.name AS status_name,
                i1.name AS requesting_institution,
                i2.name AS receiving_institution
                FROM inter_institutional_requests ir
                LEFT JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                LEFT JOIN institutions i1 ON ir.requesting_institution_id = i1.institution_id
                LEFT JOIN institutions i2 ON ir.receiving_institution_id = i2.institution_id
                ORDER BY ir.requested_at DESC`;
    db.query(sql, callback);
}

// Catálogos
const getAllEmergencyTypes = (callback) => {
    const sql = `SELECT * FROM emergency_types WHERE is_active = 1`;
    db.query(sql, callback);
}

const getAllEmergencyStatuses = (callback) => {
    const sql = `SELECT * FROM emergency_statuses WHERE is_active = 1`;
    db.query(sql, callback);
}

const getAllRequestStatuses = (callback) => {
    const sql = `SELECT * FROM request_statuses WHERE is_active = 1`;
    db.query(sql, callback);
}

const getAllTriageLevels = (callback) => {
    const sql = `SELECT * FROM triage_levels WHERE is_active = 1 ORDER BY triage_levels_id ASC`;
    db.query(sql, callback);
}

module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote,
    registerAssignment, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus,
    // PATCH
    updateEmergencyStatus, updateEmergencyAmbulance, closeEmergency,
    unassignAmbulance, respondInterInstitutionalRequest,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels
}