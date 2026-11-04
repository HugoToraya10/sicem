const db = require('../config/db');

// Institución, rol y privilegio de administrador de institución del usuario que
// llama — se deriva SIEMPRE server-side desde user_profiles, nunca se confía en
// un institutionId mandado por el cliente para decisiones de permiso. Se
// reutiliza tanto para el que llama como para resolver un usuario objetivo.
const getUserInstitutionInfo = (userProfileId, callback) => {
    const sql = `SELECT institution_id, role_id, is_institution_admin FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Institución dueña de una fila puntual de institutions_specialities — para
// validar que un rol 4 solo administre especialidades de SU institución.
const getInstitutionIdByInstitutionSpecialityId = (institutionSpecialityId, callback) => {
    const sql = `SELECT institution_id FROM institutions_specialities WHERE institution_speciality_id = ?`;
    db.query(sql, [institutionSpecialityId], callback);
}

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

// Permite al hospital completar/corregir la identidad de un paciente
// que llegó sin identificar (por ejemplo, sin CURP en el momento del incidente)
const identifyPatient = (data, callback) => {
    const { userProfileId, firstName, firstSurname, secondSurname, cveUnicaRegistroPob, birthDate, phone } = data;
    const sql = `UPDATE user_profiles SET first_name = ?, first_surname = ?, second_surname = ?,
                curp = ?, birth_date = ?, phone_number = ?, updated_at = NOW()
                WHERE user_profile_id = ?`;
    db.query(sql, [firstName, firstSurname, secondSurname, cveUnicaRegistroPob, birthDate, phone, userProfileId], callback);
}

const toggleInstitution = (institutionId, callback) => {
    const sql = `UPDATE institutions SET is_active = NOT is_active WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

const toggleCrumInstitution = (institutionId, callback) => {
    const sql = `UPDATE institutions SET is_crum_institution = NOT is_crum_institution WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

const getInstitutionCrumFlag = (institutionId, callback) => {
    const sql = `SELECT is_crum_institution FROM institutions WHERE institution_id = ?`;
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

const updateInstitutionType = (institutionTypeId, institutionType, callback) => {
    const sql = `UPDATE institution_types SET institution_type = ? WHERE institution_type_id = ?`;
    db.query(sql, [institutionType, institutionTypeId], callback);
}

const updateSpeciality = (specialityId, name, description, callback) => {
    const sql = `UPDATE specialities SET name = ?, description = ? WHERE speciality_id = ?`;
    db.query(sql, [name, description, specialityId], callback);
}

const updateInstitution = (data, callback) => {
    const {
        institutionId,
        name,
        institutionTypeId,
        cityId,
        streetAddress,
        zipCode,
        longitude,
        latitude
    } = data
    const sql = `UPDATE institutions SET name = ?, institution_type_id = ?, city_id = ?, street_address = ?,
                zip_code = ?, longitude = ?, latitude = ? WHERE institution_id = ?`;
    db.query(sql, [name, institutionTypeId, cityId, streetAddress, zipCode, longitude, latitude, institutionId], callback);
}

//-------------todos los gets---------------------------------
const getAllInstitutions = (callback) => {
    const sql = `SELECT institution_id, city_id, institution_type_id, name, bed_capacity, available_beds,
	street_address, zip_code, longitude, latitude, created_at, is_active FROM institutions WHERE is_active = 1`;
    db.query(sql, callback);
}

// Instituciones con sus camas disponibles y especialidades, para elegir destino de traslado
const getInstitutionsForDestination = (callback) => {
    const sql = `SELECT i.institution_id, i.name, i.available_beds, i.bed_capacity,
                i.latitude, i.longitude,
                GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') AS specialities
                FROM institutions i
                LEFT JOIN institutions_specialities ist ON i.institution_id = ist.institution_id AND ist.is_active = 1
                LEFT JOIN specialities s ON ist.speciality_id = s.speciality_id
                WHERE i.is_active = 1
                GROUP BY i.institution_id
                ORDER BY i.available_beds DESC`;
    db.query(sql, callback);
}

// Dónde opera una institución: coordenadas, ciudad y estado. El frontend centra el mapa y
// acota la búsqueda de direcciones con esto — NUNCA con la IP, que se equivoca de estado.
const getRegionContext = (institutionId, callback) => {
    const sql = `SELECT i.institution_id, i.name, i.latitude, i.longitude,
                c.city_id, c.name AS city_name, s.state_id, s.name AS state_name
                FROM institutions i
                LEFT JOIN cities c ON i.city_id = c.city_id
                LEFT JOIN states s ON c.state_id = s.state_id
                WHERE i.institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

const getInstitutionByName = (name, callback) => {
    const sql = `SELECT * FROM institutions WHERE name LIKE ?`;
    db.query(sql, [`%${name}%`], callback);
}

// Lista explícita en minúsculas (no SELECT *) para poder leer los campos que
// un rol 4 NO puede tocar (name, institution_type_id, longitude, latitude) y
// reescribirlos sin cambio al actualizar solo dirección/CP/ciudad.
const getInstitutionById = (institutionId, callback) => {
    const sql = `SELECT institution_id, name, institution_type_id, city_id, street_address,
                zip_code, longitude, latitude FROM institutions WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

//Se obtienen todas las notificaciones de las instituciones (activas o no), con nombre de
//institución y datos de la emergencia relacionada ya resueltos (no solo los IDs crudos)
const getInstitutionNotifications = (callback) => {
    const sql = `SELECT t1.is_active, t1.name AS institution_name, t1.institution_type_id, t2.*,
                et.name AS emergency_type_name, e.description AS emergency_description
                FROM institutions AS t1
                INNER JOIN institution_notifications AS t2 ON t1.institution_id = t2.institution_id
                LEFT JOIN emergencies e ON t2.emergency_id = e.emergency_id
                LEFT JOIN emergency_types et ON e.emergency_type_id = et.emergency_type_id`;
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

//-------- gets para administración: sin filtrar por is_active, el admin necesita ver todo --------

const getAllInstitutionsAdmin = (callback) => {
    const sql = `SELECT * FROM institutions`;
    db.query(sql, callback);
}

const getAllInstitutionTypesAdmin = (callback) => {
    const sql = `SELECT * FROM institution_types`;
    db.query(sql, callback);
}

const getAllSpecialitiesAdmin = (callback) => {
    const sql = `SELECT * FROM specialities`;
    db.query(sql, callback);
}

module.exports = {
    getUserInstitutionInfo, getInstitutionIdByInstitutionSpecialityId, getInstitutionCrumFlag,
    registerInstitution, createSpeciality, createInstitutionNotification, createInstitutionsSpecialities, createInstitutionType,
    toggleInstitution, toggleCrumInstitution, toggleInstitutionsSpecialities, toggleSpecialities, toggleInstitutionType, identifyPatient,
    updateAvailableBedsI, updateBedCapacityI, updateAvailableBedsIS, updateBedCapacityIS, getInstitutionsForDestination, getRegionContext,
    updateInstitutionType, updateSpeciality, updateInstitution,
    getAllInstitutionsAdmin, getAllInstitutionTypesAdmin, getAllSpecialitiesAdmin,
    getAllInstitutions, getInstitutionByName, getInstitutionById, getInstitutionNotifications, getInstitutionNotificationByName,
    getAllInstitutionSpecialities, getInstitutionSpecialityByName, getAllSpecialities, getSpecialityByName, getAllInstitutionTypes
}