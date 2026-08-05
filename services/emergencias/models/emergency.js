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

// El controller ya garantiza que destinationInstitutionId venga con valor real
// antes de llegar aquí (destino obligatorio a nivel de aplicación) — así que
// reception_status_id siempre se fija a "Pendiente" al registrar, resuelto por
// nombre en vivo en vez de hardcodear su ID.
const registerEmergencyPatient = (data, callback) => {
    const { emergencyId, userProfileId, notes, destinationInstitutionId, ambulanceId, destinationSpecialityId } = data;
    const sql = `INSERT INTO emergencies_patients (emergency_id, user_profile_id, notes,
                destination_institution_id, ambulance_id, destination_speciality_id, reception_status_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1), NOW())`;
    db.query(sql, [emergencyId, userProfileId, notes, destinationInstitutionId, ambulanceId || null, destinationSpecialityId || null], callback);
}

// Una misma ambulancia no puede llevar pacientes a dos hospitales destino
// distintos en la misma emergencia (físicamente solo puede ir a un lugar) —
// esto revisa si ya existe otro paciente de esta emergencia en esa unidad
// con un destino diferente al que se está por asignar.
const getConflictingAmbulanceDestination = (emergencyId, ambulanceId, destinationInstitutionId, callback) => {
    const sql = `SELECT emergency_patient_id FROM emergencies_patients
                WHERE emergency_id = ? AND ambulance_id = ? AND destination_institution_id IS NOT NULL
                    AND destination_institution_id != ?
                LIMIT 1`;
    db.query(sql, [emergencyId, ambulanceId, destinationInstitutionId], callback);
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
        glucoseLevel,
        consciousnessLevel,
        glasgowScale,
        painScale,
        pupils,
        initialDiagnosis,
        treatmentApplied,
        patientStatus
    } = data;
    const sql = `INSERT INTO emergency_notes (emergency_patient_id, user_profile_id, triage_level_id,
                blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, glucose_level,
                consciousness_level, glasgow_scale, pain_scale, pupils, initial_diagnosis, treatment_applied, patient_status, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    db.query(sql, [emergencyPatientId, userProfileId, triageLevelId, bloodPressure, heartRate,
                    temperature, oxygenSaturation, respiratoryRate, glucoseLevel, consciousnessLevel,
                    glasgowScale, painScale, pupils, initialDiagnosis, treatmentApplied, patientStatus], (e, r) => {
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

// Antes de asignar, revisa que ninguna de las unidades ya esté atada a OTRA
// emergencia sin cerrar (assignments.unassigned_at IS NULL AND su emergencia
// sigue con closed_at NULL) — sin esto una unidad podía terminar con DOS
// asignaciones abiertas al mismo tiempo (encontrado en producción: la unidad
// IMSS46-1 quedó "atendiendo" dos emergencias a la vez porque nada impedía
// asignarla de nuevo mientras la primera seguía abierta). Excluye la MISMA
// emergencyId a la que se está asignando ahora — reasignar la misma unidad a
// la emergencia que ya trae no es un conflicto real.
const getConflictingOpenAssignments = (ambulanceIds, emergencyId, callback) => {
    if (!ambulanceIds || ambulanceIds.length === 0) return callback(null, []);
    const placeholders = ambulanceIds.map(() => '?').join(',');
    const sql = `SELECT a.ambulance_id, amb.unit_number
                FROM assignments a
                JOIN emergencies e ON e.emergency_id = a.emergency_id
                LEFT JOIN ambulances amb ON amb.ambulance_id = a.ambulance_id
                WHERE a.ambulance_id IN (${placeholders})
                    AND a.unassigned_at IS NULL AND e.closed_at IS NULL AND a.emergency_id != ?`;
    db.query(sql, [...ambulanceIds, emergencyId], callback);
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

// Avanza el estado de la emergencia SOLO hacia adelante (nunca la retrocede,
// nunca toca una ya cerrada) — usado cuando se le asigna una ambulancia
// (directa o interinstitucional aceptada) para que pase sola de "Registrada"
// a "Asignada" sin que el despachador tenga que ir a cambiarla a mano por
// separado. affectedRows en el callback dice si de verdad avanzó algo (para
// saber si vale la pena avisar por socket).
const advanceEmergencyStatus = (emergencyId, targetEmergencyStatusId, callback) => {
    const sql = `UPDATE emergencies SET emergency_status_id = ?, updated_at = NOW()
                WHERE emergency_id = ? AND closed_at IS NULL AND emergency_status_id < ?`;
    db.query(sql, [targetEmergencyStatusId, emergencyId, targetEmergencyStatusId], callback);
}

// Actualizar estado de ambulancia al asignar/desasignar recibiendo un array de todas las ambulancias a actualizar
const updateAmbulanceStatus = (ambulanceIds, ambulanceStatusId, callback) => {
    const placeholders = ambulanceIds.map(id => '?').join(', ');

    const sql = `UPDATE ambulances SET ambulance_status_id = ?, updated_at = NOW() WHERE ambulance_id IN (${placeholders})`;
    const values = [ambulanceStatusId, ...ambulanceIds]; 
    db.query(sql, values, callback);
}

// Cierra la emergencia y actualiza su estado a "Cerrada" en la misma operación
// (el ID se busca por nombre, no se asume, por si difiere entre entornos).
// Antes de cerrar, bloquea si hay pacientes con destino asignado que no han sido
// recibidos (Pendiente o Rechazada) — pacientes SIN destino (dato sembrado de
// antes de que el destino fuera obligatorio) no cuentan para este bloqueo. Cuando
// bloquea, no pasa error por el primer argumento del callback (no es un fallo de
// BD, es una regla de negocio) — regresa { blocked: true, pendingCount } en su lugar.
// UPDATE crudo de cierre, sin ningún chequeo de bloqueo — lo usan tanto el
// cierre manual (closeEmergency, ya validó antes de llamar esto) como el
// auto-cierre (confirmPatientDelivery, dispara esto solo cuando ya confirmó
// que no queda nadie pendiente de entrega) y el cierre forzado por admin.
const closeEmergencyRaw = (emergencyId, closeReason, callback) => {
    const sql = `UPDATE emergencies SET closed_at = NOW(), updated_at = NOW(), close_reason = ?,
                emergency_status_id = (SELECT emergency_status_id FROM emergency_statuses WHERE name = 'Cerrada' LIMIT 1)
                WHERE emergency_id = ?`;
    db.query(sql, [closeReason || null, emergencyId], (e, r) => {
        if (e) return callback(e, r);
        cancelPendingRequestsForEmergency(emergencyId);
        // El cierre de la emergencia es lo que libera de vuelta a "Disponible"
        // las unidades que seguían asignadas (no se desasignaron antes a mano
        // — ver unassignAmbulance, que ya hace esto mismo para una unidad
        // suelta) — el paramédico NUNCA puede ponerse "Disponible" por su
        // cuenta desde sicem-mobile (ver PARAMEDIC_FORWARD_TRANSITIONS en
        // services/unidades/controllers/unit.js), así que este es uno de los
        // pocos puntos donde eso puede pasar. Ver fundamentos-legales/
        // autoridad-crum-sobre-tamp-paramedico.txt.
        //
        // EXCEPCIÓN: una unidad que sigue en estado 4 (Trasladando) NO se
        // libera aquí — significa que todavía está físicamente en el hospital
        // descargando pacientes (o a medio camino), y nadie más que el propio
        // paramédico ahí presente puede saber si de verdad ya quedó libre.
        // Esa unidad se queda como está — el ciclo concluir-traslado /
        // marcar-disponible (services/unidades/controllers/unit.js) es la
        // única vía por la que vuelve a Disponible en ese caso, sin importar
        // que la emergencia que la trajo ya se haya cerrado (ver
        // getActiveTransferByAmbulance, que a propósito NO exige que la
        // emergencia siga abierta).
        db.query(`SELECT a.ambulance_id FROM assignments a
                    JOIN ambulances amb ON amb.ambulance_id = a.ambulance_id
                    WHERE a.emergency_id = ? AND a.unassigned_at IS NULL AND amb.ambulance_status_id != 4`,
            [emergencyId], (e2, r2) => {
                if (!e2 && r2.length > 0) {
                    const ids = r2.map((row) => row.ambulance_id);
                    const placeholders = ids.map(() => '?').join(',');
                    db.query(`UPDATE ambulances SET ambulance_status_id = 1, updated_at = NOW() WHERE ambulance_id IN (${placeholders})`,
                        ids, (e3) => {
                            if (e3) console.error('Error liberando ambulancias tras cierre de emergencia:', e3);
                        });
                }
                callback(e, r);
            });
    });
}

const closeEmergency = (emergencyId, callback) => {
    const pendingCountSql = `SELECT COUNT(*) AS pending_count
                FROM emergencies_patients
                WHERE emergency_id = ?
                    AND destination_institution_id IS NOT NULL
                    AND (reception_status_id IS NULL OR reception_status_id !=
                        (SELECT request_status_id FROM request_statuses WHERE name = 'Aceptada' LIMIT 1))`;
    db.query(pendingCountSql, [emergencyId], (e0, r0) => {
        if (e0) return callback(e0, r0);
        const pendingCount = r0[0].pending_count;
        if (pendingCount > 0) {
            return callback(null, { blocked: true, pendingCount });
        }
        closeEmergencyRaw(emergencyId, null, callback);
    });
}

// Cierre forzado por admin — ignora el bloqueo de pendientes por completo
// (es justo la válvula de escape para emergencias que nunca van a resolverse
// solas: ambulancia que se canceló, paciente rechazado y nunca reasignado,
// etc.) y exige guardar el motivo.
const forceCloseEmergency = (emergencyId, closeReason, callback) => {
    closeEmergencyRaw(emergencyId, closeReason, callback);
}

// Confirma la llegada física del paciente al hospital (distinto de "Aceptada",
// que es la decisión administrativa de recibirlo ANTES de que llegue). Si
// tras esto ya no queda ningún paciente de la emergencia pendiente de
// entrega, la emergencia se cierra sola — sin esperar a que el despachador
// apriete el botón manual.
const confirmPatientDelivery = (emergencyPatientId, institutionId, callback) => {
    const sql = `UPDATE emergencies_patients SET delivered_at = NOW()
                WHERE emergency_patient_id = ? AND destination_institution_id = ?`;
    db.query(sql, [emergencyPatientId, institutionId], callback);
}

// Alta médica — el otro extremo del ciclo de una cama reservada. Aceptar la
// reserva, confirmar la llegada la ocupa de verdad, y esto (dar de alta) es
// lo único que la libera de vuelta en el caso normal (paciente atendido y
// que se va) — sin esto, "aceptar" solo restaría camas para siempre y jamás
// las devolvería salvo por el caso excepcional del cierre forzado.
const dischargePatient = (emergencyPatientId, institutionId, callback) => {
    const sql = `UPDATE emergencies_patients SET discharged_at = NOW()
                WHERE emergency_patient_id = ? AND destination_institution_id = ?`;
    db.query(sql, [emergencyPatientId, institutionId], callback);
}

// Cuenta pacientes de la emergencia que YA tienen destino asignado, no han
// sido entregados físicamente todavía, y no fueron rechazados (un rechazo ya
// no es responsabilidad de este ciclo de entrega — eso lo resuelve el
// despachador reasignando, o el admin con cierre forzado si nadie lo hace).
const getUndeliveredPendingCount = (emergencyId, callback) => {
    const sql = `SELECT COUNT(*) AS pending_count
                FROM emergencies_patients ep
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                WHERE ep.emergency_id = ?
                    AND ep.destination_institution_id IS NOT NULL
                    AND ep.delivered_at IS NULL
                    AND (rs.name IS NULL OR rs.name != 'Rechazada')`;
    db.query(sql, [emergencyId], callback);
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

// Resuelve el assignment_id abierto de una ambulancia en una emergencia —
// para cuando quien llama (p. ej. el hospital, desde la campana de fallas
// reportadas) solo conoce ambulanceId + emergencyId, no el assignmentId
// interno.
const getOpenAssignmentId = (ambulanceId, emergencyId, callback) => {
    const sql = `SELECT assignment_id FROM assignments
                WHERE ambulance_id = ? AND emergency_id = ? AND unassigned_at IS NULL
                LIMIT 1`;
    db.query(sql, [ambulanceId, emergencyId], callback);
}

// Cancela una solicitud interinstitucional. El WHERE exige que quien cancela sea
// quien la creó (user_profile_id, tomado del JWT, nunca del body) y que siga pendiente
// — así el UPDATE mismo hace de guardia de permisos, sin necesitar un SELECT previo.
// El admin (isAdmin) se salta el requisito de autoría, igual que puede editar el
// perfil de cualquier usuario en editUserProfile.
// También se puede cancelar una ya Aceptada — quien pidió la unidad puede
// darse cuenta de que ya no la necesita (p. ej. dos unidades externas
// aceptadas para un solo paciente) después de que el otro hospital dijo que
// sí. Solo Rechazada/Cancelada quedan fuera: ya están resueltas.
const cancelInterInstitutionalRequest = (interInstitutionalRequestId, userProfileId, isAdmin, callback) => {
    const ownerClause = isAdmin ? '' : 'AND user_profile_id = ?';
    const sql = `UPDATE inter_institutional_requests
                SET request_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Cancelada' LIMIT 1),
                responded_at = NOW()
                WHERE inter_institutional_request_id = ? ${ownerClause}
                AND request_status_id IN (
                    (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1),
                    (SELECT request_status_id FROM request_statuses WHERE name = 'Aceptada' LIMIT 1)
                )`;
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

// ─── Confirmación de recepción por el hospital destino ────────────────────────

// Institución del usuario que llama — nunca se confía en un institutionId mandado
// por el cliente para decidir si puede confirmar/rechazar un paciente.
const getInstitutionIdByUserProfile = (userProfileId, callback) => {
    const sql = `SELECT institution_id FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Institución dueña de cada ambulancia de la lista — para validar que un
// hospital (rol 4) solo desasigne unidades de su propia institución, nunca
// las de otra (ver unassignAmbulance en el controller).
const getAmbulanceInstitutionIds = (ambulanceIds, callback) => {
    if (!ambulanceIds || ambulanceIds.length === 0) return callback(null, []);
    const sql = `SELECT ambulance_id, institution_id FROM ambulances WHERE ambulance_id IN (?)`;
    db.query(sql, [ambulanceIds], callback);
}

// ID de un estado del catálogo request_statuses por nombre, para no hardcodear
// IDs en el código (Pendiente/Aceptada/Rechazada se resuelven así en varios lados).
const getRequestStatusIdByName = (name, callback) => {
    const sql = `SELECT request_status_id FROM request_statuses WHERE name = ? LIMIT 1`;
    db.query(sql, [name], callback);
}

// Destino actual y emergencia de un paciente puntual — para validar pertenencia
// antes de confirmar/rechazar su recepción, y para saber a quién avisar por socket.
const getEmergencyPatientById = (emergencyPatientId, callback) => {
    const sql = `SELECT ep.emergency_id, ep.destination_institution_id, ep.destination_speciality_id,
                ep.reception_status_id, ep.delivered_at, ep.discharged_at, ep.ambulance_id, e.closed_at, rs.name AS reception_status_name
                FROM emergencies_patients ep
                JOIN emergencies e ON ep.emergency_id = e.emergency_id
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                WHERE ep.emergency_patient_id = ?`;
    db.query(sql, [emergencyPatientId], callback);
}

// Confirma o rechaza la recepción. El WHERE vuelve a exigir que el destino
// coincida con la institución que confirma, como defensa adicional — el
// controller ya lo validó antes de llegar aquí, pero no cuesta nada repetirlo
// aquí también (mismo espíritu que el resto de UPDATEs-como-guardia en este archivo).
const updatePatientReceptionStatus = (emergencyPatientId, receptionStatusId, institutionId, rejectionReason, callback) => {
    const sql = `UPDATE emergencies_patients SET reception_status_id = ?, rejection_reason = ?
                WHERE emergency_patient_id = ? AND destination_institution_id = ?`;
    db.query(sql, [receptionStatusId, rejectionReason || null, emergencyPatientId, institutionId], callback);
}

// ─── Stock de camas al aceptar/liberar un paciente ─────────────────────────
// institutions/institutions_specialities no son "de este servicio", pero
// comparten la misma BD que el resto del monorepo (mismo patrón ya usado en
// este archivo para triage_levels, blood_types, ambulances, etc.) — se
// consulta/actualiza directo, sin llamar por HTTP a hospitales.
//
// El UPDATE con "AND available_beds > 0" en el WHERE es atómico: si dos
// aceptaciones llegan casi al mismo tiempo y solo queda 1 cama, únicamente
// una de las dos consigue affectedRows=1 — la otra ve affectedRows=0 y sabe
// que ya no había cupo, sin necesidad de un SELECT previo que dejaría una
// ventana de carrera entre leer y escribir.
const decrementInstitutionBeds = (institutionId, callback) => {
    const sql = `UPDATE institutions SET available_beds = available_beds - 1 WHERE institution_id = ? AND available_beds > 0`;
    db.query(sql, [institutionId], callback);
}

// LEAST(...) evita que una restauración (p. ej. tras un cierre forzado) deje
// available_beds por encima de bed_capacity si algo se restauró de más.
const incrementInstitutionBeds = (institutionId, callback) => {
    const sql = `UPDATE institutions SET available_beds = LEAST(available_beds + 1, bed_capacity) WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

const decrementSpecialityBeds = (institutionId, specialityId, callback) => {
    const sql = `UPDATE institutions_specialities SET available_beds = available_beds - 1
                WHERE institution_id = ? AND speciality_id = ? AND available_beds > 0`;
    db.query(sql, [institutionId, specialityId], callback);
}

const incrementSpecialityBeds = (institutionId, specialityId, callback) => {
    const sql = `UPDATE institutions_specialities SET available_beds = LEAST(available_beds + 1, total_beds)
                WHERE institution_id = ? AND speciality_id = ?`;
    db.query(sql, [institutionId, specialityId], callback);
}

// Pacientes que ya habían reservado cama (Aceptada) pero nunca llegaron a
// confirmarse entregados — al forzar el cierre de la emergencia (Parte 5),
// sus camas reservadas se liberan de vuelta, porque ese cierre significa
// justamente "esto no va a pasar" (ambulancia cancelada, etc.).
const getAcceptedUndeliveredPatients = (emergencyId, callback) => {
    const sql = `SELECT ep.destination_institution_id, ep.destination_speciality_id
                FROM emergencies_patients ep
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                WHERE ep.emergency_id = ? AND ep.delivered_at IS NULL
                    AND ep.destination_institution_id IS NOT NULL AND rs.name = 'Aceptada'`;
    db.query(sql, [emergencyId], callback);
}

// Reasigna destino (y opcionalmente ambulancia) de un paciente ya registrado, y
// resetea su reception_status_id a "Pendiente" — el hospital nuevo empieza desde
// cero aunque el anterior lo haya rechazado. COALESCE deja ambulance_id intacto
// si newAmbulanceId no vino (es opcional), en vez de tener que armar SQL dinámico.
const reassignPatientDestination = (data, callback) => {
    const { emergencyPatientId, newDestinationInstitutionId, newAmbulanceId, newDestinationSpecialityId } = data;
    const sql = `UPDATE emergencies_patients SET
                destination_institution_id = ?,
                ambulance_id = COALESCE(?, ambulance_id),
                destination_speciality_id = COALESCE(?, destination_speciality_id),
                reception_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1)
                WHERE emergency_patient_id = ?`;
    db.query(sql, [newDestinationInstitutionId, newAmbulanceId || null, newDestinationSpecialityId || null, emergencyPatientId], callback);
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
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color,
                tl.max_wait_minutes,
                (SELECT COUNT(*) FROM emergencies_patients ep
                    WHERE ep.emergency_id = e.emergency_id
                        AND ep.destination_institution_id IS NOT NULL
                        AND ep.reception_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1)) AS pending_patients_count,
                (SELECT COUNT(*) FROM emergencies_patients ep
                    WHERE ep.emergency_id = e.emergency_id
                        AND ep.destination_institution_id IS NOT NULL
                        AND ep.reception_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Rechazada' LIMIT 1)) AS rejected_patients_count
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
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color
                FROM emergencies e
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
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

// Pacientes de una emergencia. Incluye el nombre del estado de recepción y el
// nombre de la institución destino actual — sin excluir nada por estado, el
// despachador necesita ver TODOS los estados (incluyendo Rechazada) para saber
// a quién reasignar.
const getPatientsByEmergency = (emergencyId, callback) => {
    const sql = `SELECT ep.*, up.first_name, up.first_surname, up.second_surname,
                up.curp, up.phone_number, cr.blood_type_id, bt.blood_type,
                rs.name AS reception_status_name, di.name AS destination_institution_name,
                di.latitude AS destination_latitude, di.longitude AS destination_longitude,
                sp.name AS speciality_name, amb.unit_number
                FROM emergencies_patients ep
                LEFT JOIN user_profiles up ON ep.user_profile_id = up.user_profile_id
                LEFT JOIN clinical_records cr ON up.user_profile_id = cr.user_profile_id
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                LEFT JOIN institutions di ON ep.destination_institution_id = di.institution_id
                LEFT JOIN specialities sp ON ep.destination_speciality_id = sp.speciality_id
                LEFT JOIN ambulances amb ON ep.ambulance_id = amb.ambulance_id
                WHERE ep.emergency_id = ?`;
    db.query(sql, [emergencyId], callback);
}

// Asigna qué unidad transporta a un paciente específico — a diferencia de
// reassignPatientDestination, esto NO toca destino ni reception_status_id.
// "Agregar ambulancia" solo mete la unidad al pool de la emergencia; esto es
// lo que de verdad la liga a un paciente concreto, en vez de dejarla flotando
// sin dueño.
const assignAmbulanceToPatient = (emergencyPatientId, ambulanceId, callback) => {
    const sql = `UPDATE emergencies_patients SET ambulance_id = ? WHERE emergency_patient_id = ?`;
    db.query(sql, [ambulanceId || null, emergencyPatientId], callback);
}

// Pacientes con destino asignado a esta institución, de emergencias todavía activas
// (para que el hospital vea quién viene en camino)
const getIncomingPatientsByInstitution = (institutionId, callback) => {
    const sql = `SELECT ep.*, e.emergency_type_id, e.description, e.closed_at,
                e.latitude AS emergency_latitude, e.longitude AS emergency_longitude,
                e.reporter_name, e.reporter_phone, e.num_patients,
                up.first_name, up.first_surname, up.second_surname, up.curp,
                amb.unit_number, i.name AS institution_name, rs.name AS reception_status_name,
                sp.name AS speciality_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color,
                tl.description AS triage_description, tl.max_wait_minutes,
                bt.blood_type, cr.weight, cr.height, cr.notes AS clinical_record_notes,
                MAX(a.paramedic_concluded_at) AS paramedic_concluded_at,
                GROUP_CONCAT(DISTINCT pa.name SEPARATOR ', ') AS allergies,
                GROUP_CONCAT(DISTINCT pc.name SEPARATOR ', ') AS conditions,
                GROUP_CONCAT(DISTINCT pm.name SEPARATOR ', ') AS medications
                FROM emergencies_patients ep
                JOIN emergencies e ON ep.emergency_id = e.emergency_id
                LEFT JOIN user_profiles up ON ep.user_profile_id = up.user_profile_id
                LEFT JOIN ambulances amb ON ep.ambulance_id = amb.ambulance_id
                LEFT JOIN institutions i ON amb.institution_id = i.institution_id
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                LEFT JOIN specialities sp ON ep.destination_speciality_id = sp.speciality_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
                LEFT JOIN clinical_records cr ON up.user_profile_id = cr.user_profile_id
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                LEFT JOIN patient_allergies pa ON cr.clinical_record_id = pa.clinical_record_id AND pa.is_active = 1
                LEFT JOIN patient_conditions pc ON cr.clinical_record_id = pc.clinical_record_id AND pc.is_active = 1
                LEFT JOIN patient_medications pm ON cr.clinical_record_id = pm.clinical_record_id AND pm.is_active = 1
                -- "Concluir traslado" (sicem-mobile, mapa.js) marca esto en la
                -- asignación ABIERTA de la ambulancia que trae a este paciente —
                -- se usa para resaltar en rojo la tarjeta aunque el paciente
                -- siga "Pendiente" (todavía no aceptado): antes el aviso solo
                -- se veía si el paciente ya estaba "Aceptada" (Seguimiento), y
                -- en la práctica la ambulancia puede llegar sin que el hospital
                -- lo haya aceptado todavía, dejando el aviso invisible.
                LEFT JOIN assignments a ON a.ambulance_id = ep.ambulance_id AND a.emergency_id = ep.emergency_id AND a.unassigned_at IS NULL
                WHERE ep.destination_institution_id = ? AND e.closed_at IS NULL
                -- Un paciente "Rechazado" por este hospital ya no es su problema — el
                -- despachador se encarga de reasignarlo (Parte 4). "Pendiente" y "Aceptada"
                -- sí se siguen mostrando (la ambulancia va en camino en ambos casos); el
                -- frontend los separa en 2 secciones usando reception_status_name. Un
                -- reception_status_id NULL (dato sembrado de antes de esta columna) se trata
                -- igual que "no rechazado todavía": sigue apareciendo.
                AND (rs.name IS NULL OR rs.name != 'Rechazada')
                -- Si la ambulancia de este paciente llegó vía solicitud interinstitucional
                -- (existe una fila en inter_institutional_requests para esa emergencia + esa
                -- ambulancia) y esa solicitud sigue "Pendiente" o fue "Rechazada", la unidad
                -- todavía no confirmó que va a ir — el paciente no debe aparecer como "en camino"
                -- todavía. Se usa NOT EXISTS en vez de LEFT JOIN para no duplicar la fila del
                -- paciente si esa combinación emergencia+ambulancia llegó a tener más de una
                -- solicitud (p. ej. una rechazada y luego otra nueva). Ambulancias propias (sin
                -- ninguna solicitud asociada) no entran en este NOT EXISTS y no se filtran.
                AND NOT EXISTS (
                    SELECT 1 FROM inter_institutional_requests ir
                    JOIN request_statuses rs2 ON ir.request_status_id = rs2.request_status_id
                    WHERE ir.emergency_id = ep.emergency_id
                        AND ir.ambulance_id = ep.ambulance_id
                        AND rs2.name IN ('Pendiente', 'Rechazada')
                )
                -- Los LEFT JOIN a alergias/condiciones/medicamentos activos multiplican filas
                -- (un paciente con 2 alergias y 3 medicamentos produciría 6 filas antes de
                -- agrupar) — GROUP BY ep.emergency_patient_id colapsa eso de vuelta a una fila
                -- por paciente, y el DISTINCT dentro de cada GROUP_CONCAT evita duplicados
                -- cruzados entre las tres tablas.
                GROUP BY ep.emergency_patient_id`;
    db.query(sql, [institutionId], callback);
}

// Historial completo (abiertas y cerradas, aceptadas y rechazadas) de
// pacientes que alguna vez tuvieron a esta institución como destino — a
// diferencia de getIncomingPatientsByInstitution, aquí NO se excluyen
// cerradas ni rechazadas: es para buscar/consultar casos pasados, no para la
// vista operativa de "en camino ahora mismo".
const getPatientHistoryByInstitution = (institutionId, callback) => {
    const sql = `SELECT ep.*, e.emergency_type_id, e.description, e.closed_at,
                e.latitude AS emergency_latitude, e.longitude AS emergency_longitude,
                e.reporter_name, e.reporter_phone, e.num_patients,
                up.first_name, up.first_surname, up.second_surname, up.curp,
                amb.unit_number, i.name AS institution_name, rs.name AS reception_status_name,
                sp.name AS speciality_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color,
                tl.description AS triage_description, tl.max_wait_minutes,
                bt.blood_type, cr.weight, cr.height, cr.notes AS clinical_record_notes,
                MAX(a.paramedic_concluded_at) AS paramedic_concluded_at,
                GROUP_CONCAT(DISTINCT pa.name SEPARATOR ', ') AS allergies,
                GROUP_CONCAT(DISTINCT pc.name SEPARATOR ', ') AS conditions,
                GROUP_CONCAT(DISTINCT pm.name SEPARATOR ', ') AS medications
                FROM emergencies_patients ep
                JOIN emergencies e ON ep.emergency_id = e.emergency_id
                LEFT JOIN user_profiles up ON ep.user_profile_id = up.user_profile_id
                LEFT JOIN ambulances amb ON ep.ambulance_id = amb.ambulance_id
                LEFT JOIN institutions i ON amb.institution_id = i.institution_id
                LEFT JOIN request_statuses rs ON ep.reception_status_id = rs.request_status_id
                LEFT JOIN specialities sp ON ep.destination_speciality_id = sp.speciality_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
                LEFT JOIN clinical_records cr ON up.user_profile_id = cr.user_profile_id
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                LEFT JOIN patient_allergies pa ON cr.clinical_record_id = pa.clinical_record_id AND pa.is_active = 1
                LEFT JOIN patient_conditions pc ON cr.clinical_record_id = pc.clinical_record_id AND pc.is_active = 1
                LEFT JOIN patient_medications pm ON cr.clinical_record_id = pm.clinical_record_id AND pm.is_active = 1
                LEFT JOIN assignments a ON a.ambulance_id = ep.ambulance_id AND a.emergency_id = ep.emergency_id AND a.unassigned_at IS NULL
                WHERE ep.destination_institution_id = ?
                GROUP BY ep.emergency_patient_id
                ORDER BY ep.created_at DESC`;
    db.query(sql, [institutionId], callback);
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
    const sql = `SELECT a.*, amb.unit_number, amb.license_plate, amb.ambulance_status_id,
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

// Solicitudes pendientes dirigidas a una institución específica — para que un
// hospital (sicem-desktop) vea qué le están pidiendo prestado. Trae todo lo
// que hace falta para decidir sin más vueltas: datos de la unidad, de la
// emergencia (para el mapa) y del triage, en una sola consulta.
const getPendingRequestsByReceivingInstitution = (institutionId, callback) => {
    const sql = `SELECT ir.*, rs.name AS status_name,
                i1.name AS requesting_institution,
                amb.unit_number, amb.license_plate, amb.ambulance_type_id,
                at.ambulance_type AS ambulance_type_name,
                e.description AS emergency_description, e.latitude AS emergency_latitude, e.longitude AS emergency_longitude,
                e.reporter_name, e.reporter_phone, e.num_patients, e.created_at AS emergency_created_at,
                et.name AS emergency_type_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color, tl.max_wait_minutes
                FROM inter_institutional_requests ir
                LEFT JOIN request_statuses rs ON ir.request_status_id = rs.request_status_id
                LEFT JOIN institutions i1 ON ir.requesting_institution_id = i1.institution_id
                LEFT JOIN ambulances amb ON ir.ambulance_id = amb.ambulance_id
                LEFT JOIN ambulance_types at ON amb.ambulance_type_id = at.ambulance_type_id
                LEFT JOIN emergencies e ON ir.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
                WHERE ir.receiving_institution_id = ?
                    AND ir.request_status_id = (SELECT request_status_id FROM request_statuses WHERE name = 'Pendiente' LIMIT 1)
                ORDER BY ir.requested_at ASC`;
    db.query(sql, [institutionId], callback);
}

// Una sola solicitud, con su receiving_institution_id crudo — se usa solo
// para validar que quien responde de verdad pertenece a esa institución antes
// de dejarlo aceptar/rechazar.
const getInterInstitutionalRequestById = (interInstitutionalRequestId, callback) => {
    const sql = `SELECT inter_institutional_request_id, receiving_institution_id, request_status_id,
                ambulance_id, emergency_id
                FROM inter_institutional_requests WHERE inter_institutional_request_id = ?`;
    db.query(sql, [interInstitutionalRequestId], callback);
}

// Si una solicitud se rechaza o cancela, esa unidad ya no va a llegar — si
// algún paciente de esa misma emergencia la tenía asignada (desde
// EmergencyDetail, antes de saber si se aceptaría), hay que soltarla para que
// el despachador pueda asignarle otra sin que quede una unidad fantasma.
const clearAmbulanceFromEmergencyPatients = (emergencyId, ambulanceId, callback) => {
    const sql = `UPDATE emergencies_patients SET ambulance_id = NULL WHERE emergency_id = ? AND ambulance_id = ?`;
    db.query(sql, [emergencyId, ambulanceId], callback);
}

// Todas las solicitudes interinstitucionales
const getAllInterInstitutionalRequests = (callback) => {
    const sql = `SELECT ir.*, rs.name AS status_name,
                i1.name AS requesting_institution,
                i2.name AS receiving_institution,
                amb.unit_number, amb.ambulance_status_id,
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

//-----------------------------analíticas filtradas por hospital (a diferencia de las de arriba, que son globales)-----------------------------//
// Conteo de pacientes recibidos por esta institución, agrupados por tipo de emergencia
const getPatientsByTypeForInstitution = (institutionId, callback) => {
    const sql = `SELECT et.name AS type_name, COUNT(*) AS patient_count
                FROM emergencies_patients ep
                INNER JOIN emergencies e ON ep.emergency_id = e.emergency_id
                INNER JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                WHERE ep.destination_institution_id = ?
                GROUP BY et.emergency_type_id, et.name
                ORDER BY patient_count DESC`;
    db.query(sql, [institutionId], callback);
}

// Conteo de pacientes recibidos por esta institución, agrupados por mes
const getPatientsByMonthForInstitution = (institutionId, callback) => {
    const sql = `SELECT DATE_FORMAT(ep.created_at, '%Y-%m') AS month, COUNT(*) AS patient_count
                FROM emergencies_patients ep
                WHERE ep.destination_institution_id = ?
                GROUP BY month
                ORDER BY month ASC`;
    db.query(sql, [institutionId], callback);
}

// Tiempo promedio de traslado (minutos entre el registro del paciente y el cierre de
// la emergencia) para los pacientes recibidos por esta institución
const getAvgTransferTimeForInstitution = (institutionId, callback) => {
    const sql = `SELECT AVG(TIMESTAMPDIFF(MINUTE, ep.created_at, e.closed_at)) AS avg_minutes
                FROM emergencies_patients ep
                INNER JOIN emergencies e ON ep.emergency_id = e.emergency_id
                WHERE ep.destination_institution_id = ? AND e.closed_at IS NOT NULL`;
    db.query(sql, [institutionId], callback);
}

// ambulance_shifts "pertenece" a unidades, pero se consulta directo aquí —
// mismo patrón ya usado en este archivo para institutions/institutions_specialities
// (comparten la misma BD, no se llama por HTTP a otro servicio). Sirve para
// saber a QUIÉN dirigir la notificación cuando se le asigna esta unidad a una
// emergencia: solo al paramédico con turno activo ahora mismo en esa unidad,
// no a todos los paramédicos conectados.
// No hace falta filtrar turnos "vencidos" (horario laboral + gracia ya
// pasado) aquí — un barrido periódico en el servicio de unidades
// (startShiftExpirySweep, cada ~20s) ya se encarga de cerrar esos
// (shift_end = NOW()) apenas se cumple STALE_GRACE_MINUTES, así que
// shift_end IS NULL es casi siempre confiable como "turno de verdad activo".
const getActiveShiftUserByAmbulance = (ambulanceId, callback) => {
    const sql = `SELECT user_profile_id FROM ambulance_shifts WHERE ambulance_id = ? AND shift_end IS NULL LIMIT 1`;
    db.query(sql, [ambulanceId], callback);
}

// "user_profiles" no es de este servicio, pero se consulta directo — mismo
// patrón que getActiveShiftUserByAmbulance arriba. Sirve para poder
// mandarle una notificación push (FCM) al paramédico aunque tenga la app
// cerrada — el socket (eventEmergencyAssignedToMe) solo funciona con la app
// abierta y conectada, esto es el respaldo para cuando no lo está.
const getUserPushToken = (userProfileId, callback) => {
    const sql = `SELECT push_token FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// "Recuperación" — el socket (eventEmergencyAssignedToMe) solo llega si el
// celular está conectado en ESE instante exacto; si se cayó la conexión un
// momento (pasa solo, celulares se van a segundo plano, WiFi parpadea), la
// alerta se pierde para siempre y el paramédico nunca se entera. Esta
// consulta es el respaldo: dado el turno activo del paramédico, busca si su
// unidad YA tiene una emergencia asignada y sin cerrar — sicem-mobile la usa
// al conectar el socket para "ponerse al día" sola.
// Mismo enriquecimiento (type_name, status_name, triage) que getEmergencyById
// arriba — así el celular recibe exactamente la misma forma sin importar si
// la emergencia le llegó por socket en vivo o por esta recuperación.
const getMyCurrentEmergency = (userProfileId, callback) => {
    const sql = `SELECT e.*, et.name AS type_name, es.name AS status_name,
                tl.level AS triage_level, tl.color AS triage_color_name, tl.hex_color AS triage_hex_color,
                a.ambulance_id, a.notes
                FROM ambulance_shifts s
                JOIN assignments a ON a.ambulance_id = s.ambulance_id AND a.unassigned_at IS NULL
                JOIN emergencies e ON a.emergency_id = e.emergency_id AND e.emergency_status_id != 5
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                LEFT JOIN emergency_statuses es ON e.emergency_status_id = es.emergency_status_id
                LEFT JOIN triage_levels tl ON e.triage_level_id = tl.triage_level_id
                WHERE s.user_profile_id = ? AND s.shift_end IS NULL
                ORDER BY a.assigned_at DESC LIMIT 1`;
    db.query(sql, [userProfileId], callback);
}

// Estadísticas personales del paramédico — no existe una tabla que diga
// "este paramédico atendió esta emergencia" directamente, así que se infiere
// cruzando assignments (qué unidad fue asignada a qué emergencia, y cuándo)
// contra ambulance_shifts (quién traía esa unidad en ese momento). Es una
// aproximación razonable: cuenta como "atendida por él" toda asignación que
// cayó dentro de una de sus ventanas de turno en esa unidad.
const getMyAssignmentCountThisMonth = (userProfileId, callback) => {
    const sql = `SELECT COUNT(*) AS total
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                WHERE s.user_profile_id = ?
                    AND MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())`;
    db.query(sql, [userProfileId], callback);
}

const getMyAvgResponseTimeThisMonth = (userProfileId, callback) => {
    const sql = `SELECT AVG(TIMESTAMPDIFF(MINUTE, e.created_at, a.assigned_at)) AS avg_minutes
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                JOIN emergencies e ON a.emergency_id = e.emergency_id
                WHERE s.user_profile_id = ?
                    AND MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())`;
    db.query(sql, [userProfileId], callback);
}

const getMyAssignmentsByTypeThisMonth = (userProfileId, callback) => {
    const sql = `SELECT et.name, COUNT(*) AS total
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                JOIN emergencies e ON a.emergency_id = e.emergency_id
                JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                WHERE s.user_profile_id = ?
                    AND MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())
                GROUP BY et.emergency_type_id, et.name
                ORDER BY total DESC`;
    db.query(sql, [userProfileId], callback);
}

const getMyAssignmentsByWeekThisMonth = (userProfileId, callback) => {
    const sql = `SELECT WEEK(a.assigned_at, 3) - WEEK(DATE_SUB(a.assigned_at, INTERVAL DAYOFMONTH(a.assigned_at) - 1 DAY), 3) + 1 AS week_of_month,
                COUNT(*) AS total
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                WHERE s.user_profile_id = ?
                    AND MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())
                GROUP BY week_of_month
                ORDER BY week_of_month`;
    db.query(sql, [userProfileId], callback);
}

// Pacientes (no solo emergencias) atendidos este mes — una emergencia puede
// traer más de un paciente, así que este número siempre es >= totalThisMonth.
const getMyPatientCountThisMonth = (userProfileId, callback) => {
    const sql = `SELECT COUNT(DISTINCT ep.emergency_patient_id) AS total
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                JOIN emergencies_patients ep ON ep.emergency_id = a.emergency_id
                WHERE s.user_profile_id = ?
                    AND MONTH(a.assigned_at) = MONTH(CURDATE()) AND YEAR(a.assigned_at) = YEAR(CURDATE())`;
    db.query(sql, [userProfileId], callback);
}

// Notas de urgencia (signos vitales/evaluación) que él mismo registró este
// mes — directo, emergency_notes ya trae user_profile_id de quien la levantó.
const getMyNoteCountThisMonth = (userProfileId, callback) => {
    const sql = `SELECT COUNT(*) AS total FROM emergency_notes
                WHERE user_profile_id = ?
                    AND MONTH(recorded_at) = MONTH(CURDATE()) AND YEAR(recorded_at) = YEAR(CURDATE())`;
    db.query(sql, [userProfileId], callback);
}

// Horas de turno trabajadas este mes — un turno sin cerrar (shift_end NULL,
// sigue activo ahora mismo) cuenta hasta NOW(), no se descarta.
const getMyShiftMinutesThisMonth = (userProfileId, callback) => {
    const sql = `SELECT SUM(TIMESTAMPDIFF(MINUTE, shift_start, COALESCE(shift_end, NOW()))) AS total_minutes
                FROM ambulance_shifts
                WHERE user_profile_id = ?
                    AND MONTH(shift_start) = MONTH(CURDATE()) AND YEAR(shift_start) = YEAR(CURDATE())`;
    db.query(sql, [userProfileId], callback);
}

// Últimas 5 emergencias atendidas (sin restringir al mes — es un feed de
// "lo más reciente", no una métrica del mes) — para que la pantalla de stats
// no sea solo números sueltos, también dé contexto de qué fue cada cosa.
const getMyRecentActivity = (userProfileId, callback) => {
    const sql = `SELECT e.emergency_id, e.description, e.created_at, et.name AS type_name, a.assigned_at
                FROM assignments a
                JOIN ambulance_shifts s ON a.ambulance_id = s.ambulance_id
                    AND a.assigned_at BETWEEN s.shift_start AND COALESCE(s.shift_end, NOW())
                JOIN emergencies e ON a.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id
                WHERE s.user_profile_id = ?
                ORDER BY a.assigned_at DESC
                LIMIT 5`;
    db.query(sql, [userProfileId], callback);
}


module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote, getConflictingAmbulanceDestination,
    registerAssignment, getConflictingOpenAssignments, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus, createTriageLevel,
    // PATCH
    updateEmergencyStatus, advanceEmergencyStatus, closeEmergency, forceCloseEmergency,
    unassignAmbulance, respondInterInstitutionalRequest, cancelInterInstitutionalRequest, updateAmbulanceStatus,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    updateEmergencyType, updateEmergencyStatusCatalog, updateRequestStatus, updateTriageLevel,
    // Confirmación de recepción / reasignación de destino / entrega física
    getInstitutionIdByUserProfile, getAmbulanceInstitutionIds, getOpenAssignmentId, getRequestStatusIdByName, getEmergencyPatientById,
    updatePatientReceptionStatus, reassignPatientDestination, assignAmbulanceToPatient,
    confirmPatientDelivery, dischargePatient, getUndeliveredPendingCount, closeEmergencyRaw,
    decrementInstitutionBeds, incrementInstitutionBeds, decrementSpecialityBeds, incrementSpecialityBeds, getAcceptedUndeliveredPatients,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getIncomingPatientsByInstitution, getPatientHistoryByInstitution, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getAssignmentsByAmbulance, getEmergenciesByPatient,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests,
    getPendingRequestsByReceivingInstitution, getInterInstitutionalRequestById, clearAmbulanceFromEmergencyPatients,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels,
    getAllEmergencyTypesAdmin, getAllEmergencyStatusesAdmin, getAllRequestStatusesAdmin, getAllTriageLevelsAdmin,
    //GETs de estadísticas
    getEmergenciesByType, getRequestsByStatus, getResponseTimeByDay, getResponseTimeToday, getEmergenciesByInstitution,
    //GETs de estadísticas filtradas por hospital
    getPatientsByTypeForInstitution, getPatientsByMonthForInstitution, getAvgTransferTimeForInstitution,
    getActiveShiftUserByAmbulance, getUserPushToken, getMyCurrentEmergency,
    getMyAssignmentCountThisMonth, getMyAvgResponseTimeThisMonth, getMyAssignmentsByTypeThisMonth, getMyAssignmentsByWeekThisMonth,
    getMyPatientCountThisMonth, getMyNoteCountThisMonth, getMyShiftMinutesThisMonth, getMyRecentActivity
}