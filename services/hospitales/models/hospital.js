const db = require('../config/db');

const registerInstitution = (data, callback) => {
    const {
        cityId,
        institutionTypeId,
        name,
        bedCapacity,
        availableBeds,
        streetAddress,
        zipCode,
        longitude,
        latitude
    } = data
    const sql = `INSERT INTO institutions (city_id, institution_type_id, name, bed_capacity, available_beds, street_address, zip_code,
                longitude, latitude, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`;

    db.query(sql, [cityId, institutionTypeId, name, bedCapacity, availableBeds, streetAddress, zipCode, longitude, latitude], callback);
}

const createSpeciality = (name, description, callback) => {
    const sql = `INSERT INTO specialities (name, description) VALUES (?, ?)`;
    db.query(sql, [name, description], callback)
}

const createInstitutionNotification = (data, callback) => {
    const {
        institutionId,
        emergencyId,
        userProfileId,
        estimatedArrival,
        notes
    } = data;
    const sql = `INSERT INTO institution_notifications (institution_id, emergency_id, user_profile_id, estimated_arrival, notes, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())`;
    db.query(sql, [institutionId, emergencyId, userProfileId, estimatedArrival, notes], callback)
}


//tabla interrmedia, muchos a muchos
const createInstitutionsSpecialities = (data, callback) => {
    const { 
        institutionId, 
        specialityId, 
        totalBeds, 
        availableBeds 
    } = data;
    const sql = `INSERT INTO institutions_specialities (institution_id, speciality_id, total_beds, available_beds, updated_at) 
                VALUES (?, ?, ?, ?, NOW())`;
    db.query(sql, [institutionId, specialityId, totalBeds, availableBeds], callback);
}

const createInstitutionType = (institutionType, callback) => {
    const sql = `INSERT INTO institution_types (institution_type, is_active) VALUES (?, 1)`;
    db.query(sql, [institutionType], callback);
}

//-------Todos los updates --------------------------------

const toggleInstitution = (institutionId, callback) => {
    const sql = `UPDATE institutions SET is_active = NOT is_active WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

const toggleInstitutionsSpecialities = (institutionSpecialityId, callback) => {
    const sql = `UPDATE institutions_specialities SET is_active = NOT is_active WHERE institution_speciality_id = ?`;
    db.query(sql, [institutionSpecialityId], callback);
}

const toggleSpecialities = (specialityId, callback) => {
    const sql = `UPDATE specialities SET is_active = NOT is_active WHERE speciality_id = ?`;
    db.query(sql, [specialityId], callback);
}

const toggleInstitutionType = (institutionTypeId, callback) => {
    const sql = `UPDATE institution_types SET is_active = NOT is_active WHERE institution_type_id = ?`;
    db.query(sql, [institutionTypeId], callback);
}

const updateAvailableBedsI = (institutionId, availableBeds, callback) => {
    const sql = `UPDATE institutions SET available_beds = ? WHERE institution_id = ?`;
    db.query(sql, [availableBeds, institutionId], callback);
}

const updateBedCapacityI = (institutionId, bedCapacity, callback) => {
    const sql = `UPDATE institutions SET bed_capacity = ? WHERE institution_id = ?`;
    db.query(sql, [bedCapacity, institutionId], callback);
}

const updateAvailableBedsIS = (institutionSpecialityId, availableBeds, callback) => {
    const sql = `UPDATE institutions_specialities SET available_beds = ? WHERE institution_speciality_id = ?`;
    db.query(sql, [availableBeds, institutionSpecialityId], callback);
}

const updateBedCapacityIS = (institutionSpecialityId, totalBeds, callback) => {
    const sql = `UPDATE institutions_specialities SET total_beds = ? WHERE institution_speciality_id = ?`;
    db.query(sql, [totalBeds, institutionSpecialityId], callback);
}

//-------------todos los gets---------------------------------
const getAllInstitutions = (callback) => {
    const sql = `SELECT institution_id, city_id, institution_type_id, name, bed_capacity, available_beds,
	street_address, zip_code, longitude, latitude, created_at FROM institutions WHERE is_active = 1`;
    db.query(sql, callback);
}

const getInstitutionByName = (name, callback) => {
    const sql = `SELECT * FROM institutions WHERE name LIKE ?`;
    db.query(sql, [`%${name}%`], callback);
}

//Se obtienen todas las notificaciones de las instituciones (activas o no)
const getInstitutionNotifications = (callback) => {
    const sql = `SELECT t1.is_active, t1.name, t1.institution_type_id, t2.* FROM institutions AS t1 INNER JOIN institution_notifications AS t2
	ON t1.institution_id = t2.institution_id`;
    db.query(sql, callback);
}

const getInstitutionNotificationByName = (name, callback) => {
    const sql = `SELECT t1.is_active, t1.name, t1.institution_type_id, t2.* FROM institutions AS t1 INNER JOIN institution_notifications AS t2
	ON t1.institution_id = t2.institution_id WHERE t1.name LIKE ?`;
    db.query(sql, [`%${name}%`], callback)
}

const getAllInstitutionSpecialities = (callback) => {
    const sql = `SELECT * from institutions_specialities`;
    db.query(sql, callback);
} 


const getInstitutionSpecialityByName = (name, callback) => {
    const sql = `SELECT t1.is_active, t1.name, t1.institution_type_id, t2.* FROM institutions AS t1 INNER JOIN institutions_specialities AS t2
	ON  t1.institution_id = t2.institution_id WHERE t1.name LIKE ?`;
    db.query(sql, [`%${name}%`], callback);
}

const getAllSpecialities = (callback) => {
    const sql = `SELECT * FROM specialities`;
    db.query(sql, callback);
}


const getSpecialityByName = (name, callback) => {
    const sql = `SELECT * from specialities WHERE name like ?`;
    db.query(sql, [`%${name}%`], callback)
}

const getAllInstitutionTypes = (callback) => {
    const sql = `SELECT * FROM institution_types WHERE is_active = 1`;
    db.query(sql, callback);
}

module.exports = { 
    registerInstitution, createSpeciality, createInstitutionNotification, createInstitutionsSpecialities, createInstitutionType,
    toggleInstitution, toggleInstitutionsSpecialities, toggleSpecialities, toggleInstitutionType,
    updateAvailableBedsI, updateBedCapacityI, updateAvailableBedsIS, updateBedCapacityIS,
    getAllInstitutions, getInstitutionByName, getInstitutionNotifications, getInstitutionNotificationByName,
    getAllInstitutionSpecialities, getInstitutionSpecialityByName, getAllSpecialities, getSpecialityByName, getAllInstitutionTypes
}