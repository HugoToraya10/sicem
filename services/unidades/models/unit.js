const db = require('../config/db');

// ============================================================================
// AJUSTABLE — minutos de gracia DESPUÉS de que termina el horario laboral
// del paramédico antes de que su turno se considere abandonado y se libere
// solo (unidad marcada sin tripulación + sesión cerrada en su celular). Es
// para darle tiempo de terminar "cositas más" (papeleo, dejar la unidad,
// etc.) antes de que el sistema lo cierre por él.
// Bájalo a 1 para probar rápido que el auto-cierre funciona.
// ============================================================================
const STALE_GRACE_MINUTES = 1;

// Turnos iniciados por rol 1 (admin) no tienen horario asociado (bypass de
// prueba/soporte — ver startShift en el controller), así que no tienen
// scheduled_end. Para que ESOS no se queden abiertos para siempre si alguien
// se olvida de cerrarlos, se les aplica este límite plano de respaldo en vez
// del horario del paramédico.
const ADMIN_BYPASS_FALLBACK_HOURS = 12;

// Institución, rol y privilegio de administrador de institución del usuario que
// llama — se deriva SIEMPRE server-side desde user_profiles, nunca se confía en
// un institutionId mandado por el cliente para decisiones de permiso.
const getUserInstitutionInfo = (userProfileId, callback) => {
    const sql = `SELECT institution_id, role_id, is_institution_admin FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Institución dueña de una ambulancia puntual — para validar que un rol 4 solo
// administre ambulancias de SU institución.
const getInstitutionIdByAmbulanceId = (ambulanceId, callback) => {
    const sql = `SELECT institution_id FROM ambulances WHERE ambulance_id = ?`;
    db.query(sql, [ambulanceId], callback);
}

// "user_profiles" no es de este servicio, pero se consulta directo — mismo
// patrón ya usado para institutions/ambulances desde otros servicios. Sirve
// para bloquear iniciar-turno si el paramédico intenta entrar fuera de su
// horario asignado (shift_windows — un rango de hora por día).
const getUserSchedule = (userProfileId, callback) => {
    const sql = `SELECT shift_windows FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Nombre básico de un paramédico — para poder decir "esta unidad ya tiene
// turno con Fulano" en el mensaje de error de conflicto de turnos.
const getUserBasicName = (userProfileId, callback) => {
    const sql = `SELECT first_name, first_surname FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

//----creates---------
const registerLocations = (data, callback) => {
    const {
        ambulanceId,
        longitude,
        latitude
    } = data
    const sql = `INSERT INTO locations (ambulance_id, longitude, latitude, recorded_at)
    VALUES (?, ?, ?, NOW())`;
    db.query(sql, [ambulanceId, longitude, latitude], callback);
}

const registerAmbulance = (data, callback) => {
    const {
        ambulanceStatusId,
        institutionId,
        ambulanceTypeId,
        unitNumber,
        licensePlate
    } = data;
    const sql = `INSERT INTO ambulances (ambulance_status_id, institution_id, ambulance_type_id,
    unit_number, license_plate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`;
    db.query(sql, [ambulanceStatusId, institutionId, ambulanceTypeId, unitNumber, licensePlate], callback)
} 

const createAmbulanceType = (ambulanceType, callback) => {
    const sql = `INSERT INTO ambulance_types (ambulance_type) VALUES (?)`;
    db.query(sql, [ambulanceType], callback)
}

const registerAmbulanceStatus = (name, description, callback) => {
    const sql = `INSERT INTO ambulances_statuses (name, description) VALUES (?, ?)`;
    db.query(sql, [name, description], callback);
}


//----- patches --------------------
const toggleAmbulance = (ambulanceId, callback) => {
    const sql = `UPDATE ambulances SET is_active = NOT is_active, updated_at = NOW() WHERE ambulance_id = ?`;
    db.query(sql, [ambulanceId], callback);
}

const toggleAmbulanceType = (ambulanceTypeId, callback) => {
    const sql = `UPDATE ambulance_types SET is_active = NOT is_active WHERE ambulance_type_id = ?`;
    db.query(sql, [ambulanceTypeId], callback)
}

const toggleAmbulanceStatus = (ambulanceStatusId, callback) => {
    const sql = `UPDATE ambulances_statuses SET is_active = NOT is_active WHERE ambulance_status_id = ?`;
    db.query(sql, [ambulanceStatusId], callback);
}

const updateAmbulanceType = (ambulanceTypeId, ambulanceType, callback) => {
    const sql = `UPDATE ambulance_types SET ambulance_type = ? WHERE ambulance_type_id = ?`;
    db.query(sql, [ambulanceType, ambulanceTypeId], callback);
}

const updateAmbulanceStatusCatalog = (ambulanceStatusId, name, description, callback) => {
    const sql = `UPDATE ambulances_statuses SET name = ?, description = ? WHERE ambulance_status_id = ?`;
    db.query(sql, [name, description, ambulanceStatusId], callback);
}

const updateAmbulance = (data, callback) => {
    const { ambulanceId, unitNumber, licensePlate, ambulanceTypeId, institutionId } = data;
    const sql = `UPDATE ambulances SET unit_number = ?, license_plate = ?, ambulance_type_id = ?,
                institution_id = ?, updated_at = NOW() WHERE ambulance_id = ?`;
    db.query(sql, [unitNumber, licensePlate, ambulanceTypeId, institutionId, ambulanceId], callback);
}

// Estado del día a día de una ambulancia puntual (Disponible/En camino/etc.) —
// distinto de updateAmbulance, que edita datos administrativos (número, placa,
// tipo, institución dueña).
const updateAmbulanceStatus = (ambulanceId, ambulanceStatusId, callback) => {
    const sql = `UPDATE ambulances SET ambulance_status_id = ?, updated_at = NOW() WHERE ambulance_id = ?`;
    db.query(sql, [ambulanceStatusId, ambulanceId], callback);
}

// El estado de la emergencia avanza junto con el de la ambulancia (En
// escena -> "En atención", Trasladando -> "Trasladando") — antes eran
// totalmente independientes y el despachador tenía que ir a cambiar el de la
// emergencia a mano por separado cada vez, duplicando el trabajo que la
// unidad ya está reportando sola. Solo avanza HACIA ADELANTE
// (emergency_status_id < targetEmergencyStatusId) — nunca retrocede una
// emergencia que ya iba más avanzada por otra unidad, y nunca toca una ya
// cerrada. Cruce directo a `emergencies`/`assignments` (tablas del servicio
// emergencias, misma BD compartida) — mismo patrón ya usado en
// getOpenAssignmentByAmbulance.
const advanceEmergencyStatusForAmbulance = (ambulanceId, targetEmergencyStatusId, callback) => {
    const sql = `UPDATE emergencies e
                JOIN assignments a ON a.emergency_id = e.emergency_id
                SET e.emergency_status_id = ?, e.updated_at = NOW()
                WHERE a.ambulance_id = ? AND a.unassigned_at IS NULL
                    AND e.closed_at IS NULL AND e.emergency_status_id < ?`;
    db.query(sql, [targetEmergencyStatusId, ambulanceId, targetEmergencyStatusId], (e, r) => {
        if (e) return callback(e, null);
        if (!r.affectedRows) return callback(null, null);
        // El UPDATE con JOIN no regresa qué emergencia se tocó — se vuelve a
        // consultar para poder avisar por socket con el emergencyId real.
        const selectSql = `SELECT e.emergency_id, e.emergency_status_id, es.name AS status_name
                    FROM emergencies e
                    JOIN assignments a ON a.emergency_id = e.emergency_id
                    JOIN emergency_statuses es ON es.emergency_status_id = e.emergency_status_id
                    WHERE a.ambulance_id = ? AND a.unassigned_at IS NULL
                    LIMIT 1`;
        db.query(selectSql, [ambulanceId], (e2, r2) => {
            if (e2) return callback(e2, null);
            callback(null, r2.length > 0 ? r2[0] : null);
        });
    });
}

// Cruce directo a assignments/emergencies (tablas del servicio emergencias,
// misma BD compartida — mismo patrón de queries cruzadas que ya se usa en
// todo el proyecto). "Abierta" = con una fila en assignments sin desasignar
// (unassigned_at IS NULL) apuntando a una emergencia que todavía no se cerró
// (closed_at IS NULL). Se usa para que iniciar/terminar turno NUNCA le borre
// encima a la ambulancia su estado real (En escena, Trasladando, etc.)
// mientras sigue atada a una emergencia sin resolver — ver el comentario en
// startShift/endShift del controller, ahí está el bug real que esto corrige
// (una unidad terminaba "Disponible" en el mapa del despachador a mitad de
// una emergencia solo porque el paramédico cerró sesión y volvió a entrar).
const getOpenAssignmentByAmbulance = (ambulanceId, callback) => {
    const sql = `SELECT a.assignment_id, a.emergency_id FROM assignments a
                JOIN emergencies e ON e.emergency_id = a.emergency_id
                WHERE a.ambulance_id = ? AND a.unassigned_at IS NULL AND e.closed_at IS NULL
                LIMIT 1`;
    db.query(sql, [ambulanceId], callback);
}

// Registro (histórico) de una falla reportada por el paramédico — NO cambia
// ambulance_status_id solo (ver fundamentos-legales/
// autoridad-crum-sobre-tamp-paramedico.txt: el paramédico reporta, el
// CRUM/hospital decide qué hacer — reasignar, sacarla de servicio, etc.).
// emergencyId es opcional (puede reportar una falla sin tener una emergencia
// activa en ese momento).
const reportAmbulanceFailure = (ambulanceId, userProfileId, emergencyId, note, callback) => {
    const sql = `INSERT INTO ambulance_failure_reports (ambulance_id, user_profile_id, emergency_id, note, reported_at)
                VALUES (?, ?, ?, ?, NOW())`;
    db.query(sql, [ambulanceId, userProfileId, emergencyId || null, note], callback);
}

// Contexto para armar el aviso (número de unidad, institución dueña —para
// filtrar a quién le llega el socket—, y nombre del paramédico que reporta).
const getFailureReportContext = (ambulanceId, userProfileId, callback) => {
    const sql = `SELECT a.unit_number, a.institution_id, up.first_name, up.first_surname
                FROM ambulances a, user_profiles up
                WHERE a.ambulance_id = ? AND up.user_profile_id = ?`;
    db.query(sql, [ambulanceId, userProfileId], callback);
}


//---- GETs ------------------------
const getAllAmbulances = (callback) => {
    const sql = `SELECT * FROM ambulances WHERE is_active = 1`;
    db.query(sql, callback);
}

// Ambulancias propias disponibles de la institución del despachador (asignación
// directa). Si esa institución es parte de la red CRUM fusionada
// (is_crum_institution = 1), "propias" se extiende a CUALQUIER institución que
// también sea CRUM — no solo el institution_id exacto (esa misma condición ya
// incluye a la institución que pidió, así que no hace falta un OR aparte). Si
// no es CRUM, el comportamiento es EXACTAMENTE el de siempre (comparación
// exacta de institution_id) — es el caso más común, no se toca.
const getAvailableAmbulances = (institutionId, callback) => {
    const crumCheckSql = `SELECT is_crum_institution FROM institutions WHERE institution_id = ?`;
    db.query(crumCheckSql, [institutionId], (e, r) => {
        if (e) return callback(e, r);
        const isCrum = r.length > 0 && Boolean(r[0].is_crum_institution);
        if (isCrum) {
            const sql = `SELECT a.* FROM ambulances a
                        JOIN institutions i ON a.institution_id = i.institution_id
                        WHERE a.is_active = 1 AND a.ambulance_status_id = 1 AND i.is_crum_institution = 1`;
            db.query(sql, [], callback);
        } else {
            const sql = `SELECT * FROM ambulances WHERE is_active = 1 AND ambulance_status_id = 1 AND institution_id = ?`;
            db.query(sql, [institutionId], callback);
        }
    });
}

// Todas las ambulancias activas de instituciones CRUM, sin filtrar por
// estado — a diferencia de getAvailableAmbulances (que solo trae las
// "Disponibles" para asignar a una emergencia), esto es para elegir a qué
// unidad se liga PERMANENTEMENTE un paramédico nuevo desde sicem-web, sin
// importar si esa unidad está ocupada en este momento.
const getCrumAmbulances = (callback) => {
    const sql = `SELECT a.* FROM ambulances a
                JOIN institutions i ON a.institution_id = i.institution_id
                WHERE a.is_active = 1 AND i.is_crum_institution = 1`;
    db.query(sql, callback);
}

// Ambulancias disponibles de otras instituciones (requieren solicitud
// interinstitucional). Si la institución que pide es parte de la red CRUM
// fusionada, excluye TODAS las ambulancias de instituciones también CRUM —
// entre instituciones CRUM nunca son "externas" unas de otras, ya son
// "propias" vía getAvailableAmbulances. Si no es CRUM, comportamiento
// EXACTAMENTE el de siempre.
const getExternalAvailableAmbulances = (institutionId, callback) => {
    const crumCheckSql = `SELECT is_crum_institution FROM institutions WHERE institution_id = ?`;
    db.query(crumCheckSql, [institutionId], (e, r) => {
        if (e) return callback(e, r);
        const isCrum = r.length > 0 && Boolean(r[0].is_crum_institution);
        if (isCrum) {
            const sql = `SELECT a.*, i.name AS institution_name
                        FROM ambulances a
                        LEFT JOIN institutions i ON a.institution_id = i.institution_id
                        WHERE a.is_active = 1 AND a.ambulance_status_id = 1
                            AND (i.is_crum_institution = 0 OR i.is_crum_institution IS NULL)`;
            db.query(sql, [], callback);
        } else {
            const sql = `SELECT a.*, i.name AS institution_name
                        FROM ambulances a
                        LEFT JOIN institutions i ON a.institution_id = i.institution_id
                        WHERE a.is_active = 1 AND a.ambulance_status_id = 1 AND a.institution_id != ?`;
            db.query(sql, [institutionId], callback);
        }
    });
}

const getAmbulanceByUnitNumber = (unitNumber, callback) => {
    const sql = `SELECT * FROM ambulances WHERE unit_number LIKE ?`;
    db.query(sql, [`%${unitNumber}%`], callback);
}

const getAmbulanceByLicensePlate = (licensePlate, callback) => {
    const sql = `SELECT * FROM ambulances WHERE license_plate LIKE ?`;
    db.query(sql, [`%${licensePlate}%`], callback);
}

const getAllAmbulanceTypes = (callback) => {
    const sql = `SELECT * FROM ambulance_types WHERE is_active = 1`;
    db.query(sql, callback);
}

const getAllAmbulanceStatuses = (callback) => {
    const sql = `SELECT * FROM ambulances_statuses WHERE is_active = 1`;
    db.query(sql, callback);
}

const getLocationsByAmbulance = (ambulanceId, callback) => {
    const sql = `SELECT * FROM locations WHERE ambulance_id = ? ORDER BY recorded_at DESC LIMIT 1`;
    db.query(sql, [ambulanceId], callback);
}

//-------- gets para administración: sin filtrar por is_active, el admin necesita ver todo --------

const getAllAmbulancesAdmin = (callback) => {
    const sql = `SELECT * FROM ambulances`;
    db.query(sql, callback);
}

const getAllAmbulanceTypesAdmin = (callback) => {
    const sql = `SELECT * FROM ambulance_types`;
    db.query(sql, callback);
}

const getAllAmbulanceStatusesAdmin = (callback) => {
    const sql = `SELECT * FROM ambulances_statuses`;
    db.query(sql, callback);
}

//---- turnos (ambulance_shifts) -------------------
// No hay concepto de "conductor permanente" de una ambulancia — un paramédico
// inicia turno en una unidad, y al terminar ese turno se cierra. shift_end IS
// NULL = turno activo ahora mismo. Se usa para saber a quién dirigir la
// notificación cuando se le asigna una emergencia a la unidad (ver
// eventAmbulanceAssigned en emergencias), en vez de avisarle a todos los
// paramédicos conectados.
//
// scheduled_end (columna nueva en ambulance_shifts) es el momento exacto
// (fecha+hora) en el que termina la ventana de horario del paramédico para
// el día en que inició turno — se calcula UNA vez, al iniciar turno (ver
// startShift en el controller), a partir de isWithinSchedule. Un turno cuyo
// "ahora" ya pasó scheduled_end + STALE_GRACE_MINUTES se trata como
// abandonado en TODA consulta de "turno activo": ni bloquea que alguien más
// tome la unidad, ni recibe notificaciones, ni cuenta para el chequeo de
// turnos simultáneos — y un barrido periódico (ver startShiftExpirySweep en
// el controller) lo cierra solo y libera la unidad. Turnos de rol 1 (bypass
// de prueba, sin horario real) no tienen scheduled_end — a esos se les aplica
// ADMIN_BYPASS_FALLBACK_HOURS en su lugar, para que tampoco se queden
// abiertos para siempre.
const NOT_STALE_CONDITION = `(
    (scheduled_end IS NOT NULL AND NOW() <= DATE_ADD(scheduled_end, INTERVAL ${STALE_GRACE_MINUTES} MINUTE))
    OR (scheduled_end IS NULL AND shift_start > DATE_SUB(NOW(), INTERVAL ${ADMIN_BYPASS_FALLBACK_HOURS} HOUR))
)`;
const IS_EXPIRED_CONDITION = `(
    (scheduled_end IS NOT NULL AND NOW() > DATE_ADD(scheduled_end, INTERVAL ${STALE_GRACE_MINUTES} MINUTE))
    OR (scheduled_end IS NULL AND shift_start <= DATE_SUB(NOW(), INTERVAL ${ADMIN_BYPASS_FALLBACK_HOURS} HOUR))
)`;

// scheduledEnd (Date o null) viene ya calculado del controller — null para el
// bypass de rol 1 (sin horario real que respetar).
const startShift = (ambulanceId, userProfileId, scheduledEnd, callback) => {
    // Solo cierra turnos ABANDONADOS (viejos) de esta unidad o de este
    // paramédico — nunca uno que siga genuinamente activo. Un conflicto con un
    // turno activo de verdad se rechaza ANTES de llegar aquí (ver
    // startShift en el controller), no se pisa en silencio.
    const closeStaleSql = `UPDATE ambulance_shifts SET shift_end = NOW()
                WHERE shift_end IS NULL AND (ambulance_id = ? OR user_profile_id = ?)
                AND ${IS_EXPIRED_CONDITION}`;
    db.query(closeStaleSql, [ambulanceId, userProfileId], (e) => {
        if (e) return callback(e);
        const insertSql = `INSERT INTO ambulance_shifts (ambulance_id, user_profile_id, shift_start, scheduled_end)
                    VALUES (?, ?, NOW(), ?)`;
        db.query(insertSql, [ambulanceId, userProfileId, scheduledEnd], callback);
    });
}

const endShift = (userProfileId, callback) => {
    const sql = `UPDATE ambulance_shifts SET shift_end = NOW()
                WHERE user_profile_id = ? AND shift_end IS NULL`;
    db.query(sql, [userProfileId], callback);
}

// A quién avisarle cuando se asigna esta unidad a una emergencia. Ignora
// turnos abandonados/expirados (ver comentario arriba) — uno de esos no
// cuenta como "hay alguien manejando esta unidad ahora mismo".
const getActiveShiftByAmbulance = (ambulanceId, callback) => {
    const sql = `SELECT ambulance_shift_id, user_profile_id, shift_start
                FROM ambulance_shifts WHERE ambulance_id = ? AND shift_end IS NULL
                AND ${NOT_STALE_CONDITION} LIMIT 1`;
    db.query(sql, [ambulanceId], callback);
}

// Para que el celular sepa, al abrir la app, si ya hay un turno activo
// (y en qué unidad) sin que el paramédico tenga que volver a elegirla.
// scheduled_end y unit_number van aquí (no en su propio endpoint) porque
// sicem-mobile los necesita en el MISMO momento que esto — para mostrar
// "quedan X" (contador de turno) y en qué ambulancia está, sin una consulta
// aparte.
const getActiveShiftByUser = (userProfileId, callback) => {
    const sql = `SELECT s.ambulance_shift_id, s.ambulance_id, s.shift_start, s.scheduled_end, a.unit_number, a.ambulance_status_id
                FROM ambulance_shifts s
                JOIN ambulances a ON a.ambulance_id = s.ambulance_id
                WHERE s.user_profile_id = ? AND s.shift_end IS NULL
                AND ${NOT_STALE_CONDITION} LIMIT 1`;
    db.query(sql, [userProfileId], callback);
}

// Para el barrido periódico (ver startShiftExpirySweep en el controller) —
// turnos que siguen "activos" en BD (shift_end IS NULL) pero ya pasaron su
// horario + gracia, para cerrarlos de verdad y avisarle al celular que se
// cierre solo.
const getExpiredActiveShifts = (callback) => {
    const sql = `SELECT ambulance_shift_id, ambulance_id, user_profile_id
                FROM ambulance_shifts WHERE shift_end IS NULL AND ${IS_EXPIRED_CONDITION}`;
    db.query(sql, callback);
}

module.exports = {
    getUserInstitutionInfo, getInstitutionIdByAmbulanceId,
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus, getExternalAvailableAmbulances,
    updateAmbulanceType, updateAmbulanceStatusCatalog, updateAmbulance, updateAmbulanceStatus, getOpenAssignmentByAmbulance,
    reportAmbulanceFailure, getFailureReportContext,
    advanceEmergencyStatusForAmbulance,
    getAllAmbulancesAdmin, getAllAmbulanceTypesAdmin, getAllAmbulanceStatusesAdmin,
    getAllAmbulances, getAvailableAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance,
    startShift, endShift, getActiveShiftByAmbulance, getActiveShiftByUser, getCrumAmbulances, getUserSchedule,
    getUserBasicName, getExpiredActiveShifts, STALE_GRACE_MINUTES
}