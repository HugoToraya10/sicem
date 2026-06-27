const db = require('../config/db');

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


//---- GETs ------------------------
const getAllAmbulances = (callback) => {
    const sql = `SELECT * FROM ambulances WHERE is_active = 1`;
    db.query(sql, callback);
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



module.exports = {
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus,
    getAllAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance
}