const db = require('../config/db');

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



module.exports = {
    getUserInstitutionInfo, getInstitutionIdByAmbulanceId,
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus, getExternalAvailableAmbulances,
    updateAmbulanceType, updateAmbulanceStatusCatalog, updateAmbulance, updateAmbulanceStatus,
    getAllAmbulancesAdmin, getAllAmbulanceTypesAdmin, getAllAmbulanceStatusesAdmin,
    getAllAmbulances, getAvailableAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance
}