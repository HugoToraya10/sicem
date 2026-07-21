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
        numPatients,
        triageLevelId
    } = data;
    const sql = `INSERT INTO emergencies (emergency_type_id, emergency_status_id, user_profile_id,
                longitude, latitude, description, reporter_name, reporter_phone, num_patients,
                triage_level_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    db.query(sql, [emergencyTypeId, emergencyStatusId, userProfileId, longitude, latitude,
                    description, reporterName, reporterPhone, numPatients, triageLevelId || null], callback);
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
    const sql = `INSERT INTO emergency_notes (emergency_patient_id, user_profile_id, triage_level_id,
                blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate,
                consciousness_level, initial_diagnosis, treatment_applied, patient_status, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    db.query(sql, [emergencyPatientId, userProfileId, triageLevelId, bloodPressure, heartRate,
                    temperature, oxygenSaturation, respiratoryRate, consciousnessLevel,
                    initialDiagnosis, treatmentApplied, patientStatus], (e, r) => {
        if (!e && triageLevelId) escalateEmergencyTriageLevel(emergencyPatientId, triageLevelId);
        callback(e, r);
    });
}

// El color de triage mostrado para una emergencia siempre refleja el peor caso: el estimado
// del despachador (registrado directamente en emergencies.triage_level_id) o el de cualquier
// nota real de un paciente — el que sea más grave. "Más grave" = número de nivel más bajo,
// según la semilla actual (Nivel I es el más crítico). Nunca se "mejora" automáticamente con
// una nota menos grave, solo se empeora, o se fija por primera vez si no había ninguno.
const escalateEmergencyTriageLevel = (emergencyPatientId, newTriageLevelId) => {
    const findEmergencySql = `SELECT ep.emergency_id, e.triage_level_id AS current_triage_level_id
                FROM emergencies_patients ep
                JOIN emergencies e ON ep.emergency_id = e.emergency_id
                WHERE ep.emergency_patient_id = ?`;
    db.query(findEmergencySql, [emergencyPatientId], (e, rows) => {
        if (e || rows.length === 0) {
            if (e) console.error('Error buscando la emergencia para escalar el nivel de triage:', e);
            return;
        }
        const { emergency_id, current_triage_level_id } = rows[0];
        const isWorseOrFirst = current_triage_level_id === null || Number(newTriageLevelId) < Number(current_triage_level_id);
        if (!isWorseOrFirst) return;
        db.query(`UPDATE emergencies SET triage_level_id = ?, updated_at = NOW() WHERE emergency_id = ?`,
            [newTriageLevelId, emergency_id], (e2) => {
                if (e2) console.error('Error actualizando el nivel de triage de la emergencia:', e2);
            });
    });
}

const registerAssignment = (data, callback) => {
    const { emergencyId, ambulanceIds, userProfileId, notes } = data;

    const placeholders = ambulanceIds.map(id => {return '(?, ?, ?, NOW(), ?)'})
    const joins = placeholders.join(', ');

    const sql = `INSERT INTO assignments (emergency_id, ambulance_id, user_profile_id, assigned_at, notes)
                VALUES ${joins}`;

    const values = ambulanceIds.flatMap(id => [emergencyId, id, userProfileId, notes]);

    db.query(sql, values, callback);
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
                    requestingInstitutionId, receivingInstitutionId], (e, r) => {
        if (e) return callback(e, r);
        // Reserva la unidad externa mientras la solicitud está pendiente, para que deje de
        // aparecer como disponible y no la pida otra emergencia al mismo tiempo. "Reservada"
        // es distinto de "En camino": esta unidad todavía no se movió, la institución receptora
        // puede rechazar la solicitud.
        const reserveSql = `UPDATE ambulances SET ambulance_status_id =
                    (SELECT ambulance_status_id FROM ambulances_statuses WHERE name = 'Reservada' LIMIT 1),
                    updated_at = NOW() WHERE ambulance_id = ?`;
        db.query(reserveSql, [ambulanceId], (e2) => {
            if (e2) console.error('Error reservando ambulancia externa:', e2);
        });
        callback(e, r);
    });
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

const createTriageLevel = (data, callback) => {
    const { level, color, hexColor, description, maxWaitMinutes } = data;
    const sql = `INSERT INTO triage_levels (level, color, hex_color, description, max_wait_minutes) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [level, color, hexColor || null, description, maxWaitMinutes], callback);
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

const updateEmergencyStatus = (emergencyId, emergencyStatusId, callback) => {
    const sql = `UPDATE emergencies SET emergency_status_id = ?, updated_at = NOW()
                WHERE emergency_id = ?`;
    db.query(sql, [emergencyStatusId, emergencyId], callback);
}

// Actualizar estado de ambulancia al asignar/desasignar recibiendo un array de todas las ambulancias a actualizar
const updateAmbulanceStatus = (ambulanceIds, ambulanceStatusId, callback) => {
    const placeholders = ambulanceIds.map(id => '?').join(', ');

    const sql = `UPDATE ambulances SET ambulance_status_id = ?, updated_at = NOW() WHERE ambulance_id IN (${placeholders})`;
    const values = [ambulanceStatusId, ...ambulanceIds]; 
    db.query(sql, values, callback);
}

// Cierra la emergencia y actualiza su estado a "Cerrada" en la misma operación
// (el ID se busca por nombre, no se asume, por si difiere entre entornos)
const closeEmergency = (emergencyId, callback) => {
    const sql = `UPDATE emergencies SET closed_at = NOW(), updated_at = NOW(),
                emergency_status_id = (SELECT emergency_status_id FROM emergency_statuses WHERE name = 'Cerrada' LIMIT 1)
                WHERE emergency_id = ?`;
    db.query(sql, [emergencyId], (e, r) => {
        if (e) return callback(e, r);
        cancelPendingRequestsForEmergency(emergencyId);
        callback(e, r);
    });
}

// Al cerrar una emergencia, ninguna solicitud interinstitucional debe quedar "Pendiente" ni
// ninguna ambulancia externa reservada indefinidamente — cancela cada una reutilizando
// exactamente cancelInterInstitutionalRequest (con isAdmin=true porque esto lo dispara el
// cierre de la emergencia, no la persona que creó la solicitud).
const cancelPendingRequestsForEmergency = (emergencyId) => {
    const sql = `SELECT inter_institutional_request_id FROM inter_institutional_requests
                WHERE emergency_id = ? AND request_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1)`;
    db.query(sql, [emergencyId], (e, rows) => {
        if (e) { console.error('Error consultando solicitudes pendientes al cerrar emergencia:', e); return; }
        rows.forEach((row) => {
            cancelInterInstitutionalRequest(row.inter_institutional_request_id, null, true, (e2) => {
                if (e2) console.error('Error cancelando solicitud pendiente al cerrar emergencia:', e2);
            });
        });
    });
}

const unassignAmbulance = (assignmentId, callback) => {
    const sql = `UPDATE assignments SET unassigned_at = NOW() WHERE assignment_id = ?`;
    db.query(sql, [assignmentId], callback);
}

// Cancela una solicitud interinstitucional. El WHERE exige que quien cancela sea
// quien la creó (user_profile_id, tomado del JWT, nunca del body) y que siga pendiente
// — así el UPDATE mismo hace de guardia de permisos, sin necesitar un SELECT previo.
// El admin (isAdmin) se salta el requisito de autoría, igual que puede editar el
// perfil de cualquier usuario en editUserProfile.
const cancelInterInstitutionalRequest = (interInstitutionalRequestId, userProfileId, isAdmin, callback) => {
    const ownerClause = isAdmin ? '' : 'AND user_profile_id = ?';
    const sql = `UPDATE inter_institutional_requests
                SET request_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Cancelada' LIMIT 1),
                responded_at = NOW()
                WHERE inter_institutional_request_id = ? ${ownerClause}
                AND request_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1)`;
    const values = isAdmin ? [interInstitutionalRequestId] : [interInstitutionalRequestId, userProfileId];
    db.query(sql, values, (e, r) => {
        if (e || !r || r.affectedRows === 0) return callback(e, r);
        // La cancelación sí aplicó — libera la ambulancia reservada de vuelta a "Disponible",
        // igual que unassignAmbulance hace para una asignación directa.
        db.query(`SELECT ambulance_id FROM inter_institutional_requests WHERE inter_institutional_request_id = ?`,
            [interInstitutionalRequestId], (e2, r2) => {
                if (!e2 && r2.length > 0) {
                    db.query(`UPDATE ambulances SET ambulance_status_id = 1, updated_at = NOW() WHERE ambulance_id = ?`,
                        [r2[0].ambulance_id], (e3) => {
                            if (e3) console.error('Error revirtiendo estado de ambulancia tras cancelación:', e3);
                        });
                }
                callback(e, r);
            });
    });
}

const respondInterInstitutionalRequest = (data, callback) => {
    const { interInstitutionalRequestId, requestStatusId, rejectionReason } = data;
    const sql = `UPDATE inter_institutional_requests SET request_status_id = ?,
                rejection_reason = ?, responded_at = NOW()
                WHERE inter_institutional_request_id = ?`;
    db.query(sql, [requestStatusId, rejectionReason, interInstitutionalRequestId], (e, r) => {
        if (e) return callback(e, r);
        // Si la respuesta fue "Rechazada", libera la ambulancia reservada. Si fue "Aceptada",
        // se queda reservada/comprometida — la solicitud ya es un compromiso real, no hace
        // falta revertir nada.
        const checkSql = `SELECT ir.ambulance_id, rs.name AS status_name
                    FROM inter_institutional_requests ir
                    JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                    WHERE ir.inter_institutional_request_id = ?`;
        db.query(checkSql, [interInstitutionalRequestId], (e2, r2) => {
            if (!e2 && r2.length > 0 && r2[0].status_name === 'Rechazada') {
                db.query(`UPDATE ambulances SET ambulance_status_id = 1, updated_at = NOW() WHERE ambulance_id = ?`,
                    [r2[0].ambulance_id], (e3) => {
                        if (e3) console.error('Error revirtiendo estado de ambulancia tras rechazo:', e3);
                    });
            }
            callback(e, r);
        });
    });
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
    const sql = `UPDATE triage_levels SET is_active = NOT is_active WHERE triage_level_id = ?`;
    db.query(sql, [triageLevelId], callback);
}

// Actualizar nombre/descripción de los catálogos (no confundir con updateEmergencyStatus,
// que cambia el estado de una emergencia puntual, no del catálogo)
const updateEmergencyType = (emergencyTypeId, name, description, callback) => {
    const sql = `UPDATE emergency_types SET name = ?, description = ? WHERE emergency_type_id = ?`;
    db.query(sql, [name, description, emergencyTypeId], callback);
}

const updateEmergencyStatusCatalog = (emergencyStatusId, name, description, callback) => {
    const sql = `UPDATE emergency_statuses SET name = ?, description = ? WHERE emergency_status_id = ?`;
    db.query(sql, [name, description, emergencyStatusId], callback);
}

const updateRequestStatus = (requestStatusId, name, description, callback) => {
    const sql = `UPDATE request_statuses SET name = ?, description = ? WHERE request_status_id = ?`;
    db.query(sql, [name, description, requestStatusId], callback);
}

const updateTriageLevel = (data, callback) => {
    const { triageLevelId, level, color, hexColor, description, maxWaitMinutes } = data;
    const sql = `UPDATE triage_levels SET level = ?, color = ?, hex_color = ?, description = ?, max_wait_minutes = ? WHERE triage_level_id = ?`;
    db.query(sql, [level, color, hexColor || null, description, maxWaitMinutes, triageLevelId], callback);
}

// ─── GET ─────────────────────────────────────────────────────────────────────

// Emergencias activas (sin closed_at)
const getAllActiveEmergencies = (callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
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
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
                WHERE e.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Pacientes de una emergencia
const getPatientsByEmergency = (emergencyId, callback) => {
    const sql = `SELECT ep.*, up.first_name, up.first_surname, up.second_surname,
                up.curp, up.phone_number, cr.blood_type_id, bt.blood_type
                FROM emergencies_patients ep
                LEFT JOIN user_profiles up ON ep.user_profile_id = up.user_profile_id
                LEFT JOIN clinical_records cr ON up.user_profile_id = cr.user_profile_id
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                WHERE ep.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Notas de urgencia de un paciente en una emergencia
const getNotesByEmergencyPatient = (emergencyPatientId, callback) => {
    const sql = `SELECT en.*, tl.level, tl.color, tl.description AS triage_description
                FROM emergency_notes en
                LEFT JOIN triage_levels tl ON en.triage_level_id = tl.triage_level_id
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

// Historial de una ambulancia: todas las emergencias que ha atendido
const getAssignmentsByAmbulance = (ambulanceId, callback) => {
    const sql = `SELECT a.*, e.description, e.created_at AS emergency_created_at, e.closed_at,
                et.name AS emergency_type_name, es.name AS status_name
                FROM assignments a
                LEFT JOIN emergencies e ON a.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                WHERE a.ambulance_id = ?
                ORDER BY a.assigned_at DESC`;
    db.query(sql, [ambulanceId], callback);
}

// Historial de emergencias de un paciente específico (para que él mismo lo consulte)
const getEmergenciesByPatient = (userProfileId, callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name
                FROM emergencies_patients ep
                JOIN emergencies e ON ep.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                WHERE ep.user_profile_id = ?
                ORDER BY e.created_at DESC`;
    db.query(sql, [userProfileId], callback);
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
                i2.name AS receiving_institution,
                amb.unit_number,
                et.name AS emergency_type_name,
                e.description AS emergency_description
                FROM inter_institutional_requests ir
                LEFT JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                LEFT JOIN institutions i1 ON ir.requesting_institution_id = i1.institution_id
                LEFT JOIN institutions i2 ON ir.receiving_institution_id = i2.institution_id
                LEFT JOIN ambulances amb ON ir.ambulance_id = amb.ambulance_id
                LEFT JOIN emergencies e ON ir.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
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
    const sql = `SELECT * FROM triage_levels WHERE is_active = 1 ORDER BY triage_level_id ASC`;
    db.query(sql, callback);
}

//-------- gets para administración: sin filtrar por is_active, el admin necesita ver todo --------
const getAllEmergencyTypesAdmin = (callback) => {
    const sql = `SELECT * FROM emergency_types`;
    db.query(sql, callback);
}

const getAllEmergencyStatusesAdmin = (callback) => {
    const sql = `SELECT * FROM emergency_statuses`;
    db.query(sql, callback);
}

const getAllRequestStatusesAdmin = (callback) => {
    const sql = `SELECT * FROM request_statuses`;
    db.query(sql, callback);
}

const getAllTriageLevelsAdmin = (callback) => {
    const sql = `SELECT * FROM triage_levels ORDER BY triage_level_id ASC`;
    db.query(sql, callback);
}

//-------------------------------consultas GET para las estadísticas--------------------------------------//
// Conteo de emergencias por tipo, del mes actual
const getEmergenciesByType = (callback) => {
    const sql = `SELECT et.name, COUNT(e.emergency_id) AS total
                FROM emergencies e
                JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                WHERE MONTH(e.created_at) = MONTH(CURDATE()) AND YEAR(e.created_at) = YEAR(CURDATE())
                GROUP BY et.emergency_type_id, et.name
                ORDER BY total DESC`;
    db.query(sql, callback);
}

// Conteo de solicitudes interinstitucionales por estado
const getRequestsByStatus = (callback) => {
    const sql = `SELECT rs.name, COUNT(ir.inter_institutional_request_id) AS total
                FROM inter_institutional_requests ir
                JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                GROUP BY rs.request_status_id, rs.name`;
    db.query(sql, callback);
}

// Tiempo promedio de respuesta (minutos entre registro y asignación), últimos 7 días, por día
const getResponseTimeByDay = (callback) => {
    const sql = `SELECT DAYNAME(e.created_at) AS day, DAYOFWEEK(e.created_at) AS day_order,
                AVG(TIMESTAMPDIFF(MINUTE, e.created_at, a.assigned_at)) AS avg_minutes
                FROM emergencies e
                JOIN assignments a ON e.emergency_id = a.emergency_id
                WHERE e.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DAYNAME(e.created_at), DAYOFWEEK(e.created_at)
                ORDER BY day_order`;
    db.query(sql, callback);
}

// Tiempo promedio de respuesta (minutos entre registro y asignación), solo del día actual
const getResponseTimeToday = (callback) => {
    const sql = `SELECT AVG(TIMESTAMPDIFF(MINUTE, e.created_at, a.assigned_at)) AS avg_minutes
                FROM emergencies e
                JOIN assignments a ON e.emergency_id = a.emergency_id
                WHERE DATE(e.created_at) = CURDATE()`;
    db.query(sql, callback);
}

// Conteo de emergencias atendidas por institución, del mes actual
const getEmergenciesByInstitution = (callback) => {
    const sql = `SELECT i.name, COUNT(DISTINCT a.emergency_id) AS total
                FROM assignments a
                JOIN ambulances amb ON a.ambulance_id = amb.ambulance_id
                JOIN institutions i ON amb.institution_id = i.institution_id
                WHERE MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())
                GROUP BY i.institution_id, i.name
                ORDER BY total DESC`;
    db.query(sql, callback);
}


module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote,
    registerAssignment, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus, createTriageLevel,
    // PATCH
    updateEmergencyStatus, closeEmergency,
    unassignAmbulance, respondInterInstitutionalRequest, cancelInterInstitutionalRequest, updateAmbulanceStatus,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    updateEmergencyType, updateEmergencyStatusCatalog, updateRequestStatus, updateTriageLevel,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getAssignmentsByAmbulance, getEmergenciesByPatient,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels,
    getAllEmergencyTypesAdmin, getAllEmergencyStatusesAdmin, getAllRequestStatusesAdmin, getAllTriageLevelsAdmin,
    //GETs de estadísticas
    getEmergenciesByType, getRequestsByStatus, getResponseTimeByDay, getResponseTimeToday, getEmergenciesByInstitution
}