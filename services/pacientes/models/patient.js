const db = require('../config/db');


const createClinicalRecord = (data, callback) => {
    const {
    userProfileId,
    bloodTypeId,
    weight,
    height,
    gender,
    birthplace,
    maritalStatus,
    occupation,
    religion,
    notes
} = data;

    const sql = `INSERT INTO clinical_records (user_profile_id, blood_type_id, weight, height, gender, birthplace, marital_status, occupation, religion, notes, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    const arrayData = [userProfileId, bloodTypeId, weight, height, gender, birthplace, maritalStatus, occupation, religion, notes]
    db.query(sql, arrayData, callback);
}


const registerAllergy = (data, callback) => {
    const { clinicalRecordId, name, severity } = data;
    const sql = `INSERT INTO patient_allergies (clinical_record_id, name, severity) VALUES (?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, severity], callback);
}

const toggleAllergy = (patientAllergyId, callback) => {
    const sql = `UPDATE patient_allergies SET is_active = NOT is_active WHERE patient_allergy_id = ?`;
    db.query(sql, [patientAllergyId], callback);
}




const registerCondition = (data, callback) => {
    const { clinicalRecordId, name, diagnosedAt, notes } = data;
    const sql = `INSERT INTO patient_conditions (clinical_record_id, name, diagnosed_at, notes) VALUES (?, ?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, diagnosedAt, notes], callback);
}

const toggleCondition = (patientConditionId, callback) => {
    const sql = `UPDATE patient_conditions SET is_active = NOT is_active WHERE patient_condition_id = ?`;
    db.query(sql, [patientConditionId], callback);
}





const registerMedication = (data, callback) => {
    const { clinicalRecordId, name, dosage, frequency } = data;
    const sql = `INSERT INTO patient_medications (clinical_record_id, name, dosage, frequency) VALUES (?, ?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, dosage, frequency], callback);
}

const toggleMedication = (patientMedicationId, callback) => {
    const sql = `UPDATE patient_medications SET is_active = NOT is_active WHERE patient_medication_id = ?`;
    db.query(sql, [patientMedicationId], callback);
}





//-todos los gets
const getClinicalRecordByUser = (userProfileId, callback) => {
    const sql = `SELECT cr.*, bt.blood_type 
                FROM clinical_records cr
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                WHERE cr.user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

const getAllergiesByRecord = (clinicalRecordId, callback) => {
    const sql = `SELECT * FROM patient_allergies WHERE clinical_record_id = ? AND is_active = 1`;
    db.query(sql, [clinicalRecordId], callback);
}

const getConditionsByRecord = (clinicalRecordId, callback) => {
    const sql = `SELECT * FROM patient_conditions WHERE clinical_record_id = ? AND is_active = 1`;
    db.query(sql, [clinicalRecordId], callback);
}

const getMedicationsByRecord = (clinicalRecordId, callback) => {
    const sql = `SELECT * FROM patient_medications WHERE clinical_record_id = ? AND is_active = 1`;
    db.query(sql, [clinicalRecordId], callback);
}

const getAllBloodTypes = (callback) => {
    const sql = `SELECT * FROM blood_types`;
    db.query(sql, callback);
}



module.exports = { 
    createClinicalRecord, 
    registerAllergy, toggleAllergy, 
    registerCondition, toggleCondition, 
    registerMedication, toggleMedication,
    getClinicalRecordByUser,
    getAllergiesByRecord,
    getConditionsByRecord,
    getMedicationsByRecord,
    getAllBloodTypes
}