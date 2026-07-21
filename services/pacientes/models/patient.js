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


// Registra un evento de historial (creación o toggle) sin bloquear la respuesta principal
// si falla — es una traza de auditoría secundaria, no debe tumbar la operación real.
const logAllergyHistory = (patientAllergyId, isActive) => {
    db.query(`INSERT INTO patient_allergy_history (patient_allergy_id, is_active, changed_at) VALUES (?, ?, NOW())`,
        [patientAllergyId, isActive], (e) => { if (e) console.error('Error registrando historial de alergia:', e) });
}
const logConditionHistory = (patientConditionId, isActive) => {
    db.query(`INSERT INTO patient_condition_history (patient_condition_id, is_active, changed_at) VALUES (?, ?, NOW())`,
        [patientConditionId, isActive], (e) => { if (e) console.error('Error registrando historial de condición:', e) });
}
const logMedicationHistory = (patientMedicationId, isActive) => {
    db.query(`INSERT INTO patient_medication_history (patient_medication_id, is_active, changed_at) VALUES (?, ?, NOW())`,
        [patientMedicationId, isActive], (e) => { if (e) console.error('Error registrando historial de medicamento:', e) });
}

const registerAllergy = (data, callback) => {
    const { clinicalRecordId, name, severity } = data;
    const sql = `INSERT INTO patient_allergies (clinical_record_id, name, severity) VALUES (?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, severity], (e, r) => {
        if (!e) logAllergyHistory(r.insertId, 1);
        callback(e, r);
    });
}

const toggleAllergy = (patientAllergyId, callback) => {
    const sql = `UPDATE patient_allergies SET is_active = NOT is_active WHERE patient_allergy_id = ?`;
    db.query(sql, [patientAllergyId], (e, r) => {
        if (e) return callback(e, r);
        db.query(`SELECT is_active FROM patient_allergies WHERE patient_allergy_id = ?`, [patientAllergyId], (e2, r2) => {
            if (!e2 && r2.length > 0) logAllergyHistory(patientAllergyId, r2[0].is_active);
            callback(e, r);
        });
    });
}

const getAllergyHistory = (patientAllergyId, callback) => {
    const sql = `SELECT * FROM patient_allergy_history WHERE patient_allergy_id = ? ORDER BY changed_at DESC`;
    db.query(sql, [patientAllergyId], callback);
}




const registerCondition = (data, callback) => {
    const { clinicalRecordId, name, diagnosedAt, notes } = data;
    const sql = `INSERT INTO patient_conditions (clinical_record_id, name, diagnosed_at, notes) VALUES (?, ?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, diagnosedAt, notes], (e, r) => {
        if (!e) logConditionHistory(r.insertId, 1);
        callback(e, r);
    });
}

const toggleCondition = (patientConditionId, callback) => {
    const sql = `UPDATE patient_conditions SET is_active = NOT is_active WHERE patient_condition_id = ?`;
    db.query(sql, [patientConditionId], (e, r) => {
        if (e) return callback(e, r);
        db.query(`SELECT is_active FROM patient_conditions WHERE patient_condition_id = ?`, [patientConditionId], (e2, r2) => {
            if (!e2 && r2.length > 0) logConditionHistory(patientConditionId, r2[0].is_active);
            callback(e, r);
        });
    });
}

const getConditionHistory = (patientConditionId, callback) => {
    const sql = `SELECT * FROM patient_condition_history WHERE patient_condition_id = ? ORDER BY changed_at DESC`;
    db.query(sql, [patientConditionId], callback);
}




const registerMedication = (data, callback) => {
    const { clinicalRecordId, name, dosage, frequency } = data;
    const sql = `INSERT INTO patient_medications (clinical_record_id, name, dosage, frequency) VALUES (?, ?, ?, ?)`;
    db.query(sql, [clinicalRecordId, name, dosage, frequency], (e, r) => {
        if (!e) logMedicationHistory(r.insertId, 1);
        callback(e, r);
    });
}

const toggleMedication = (patientMedicationId, callback) => {
    const sql = `UPDATE patient_medications SET is_active = NOT is_active WHERE patient_medication_id = ?`;
    db.query(sql, [patientMedicationId], (e, r) => {
        if (e) return callback(e, r);
        db.query(`SELECT is_active FROM patient_medications WHERE patient_medication_id = ?`, [patientMedicationId], (e2, r2) => {
            if (!e2 && r2.length > 0) logMedicationHistory(patientMedicationId, r2[0].is_active);
            callback(e, r);
        });
    });
}

const getMedicationHistory = (patientMedicationId, callback) => {
    const sql = `SELECT * FROM patient_medication_history WHERE patient_medication_id = ? ORDER BY changed_at DESC`;
    db.query(sql, [patientMedicationId], callback);
}

//-todos los updates
const updateClinicalRecord = (data, callback) => {
    const {
        clinicalRecordId, bloodTypeId, weight, height, gender, birthplace,
        maritalStatus, occupation, religion, notes
    } = data;
    const sql = `UPDATE clinical_records SET blood_type_id = ?, weight = ?, height = ?, gender = ?, birthplace = ?,
                marital_status = ?, occupation = ?, religion = ?, notes = ?, updated_at = NOW()
                WHERE clinical_record_id = ?`;
    db.query(sql, [bloodTypeId, weight, height, gender, birthplace, maritalStatus, occupation, religion, notes, clinicalRecordId], callback);
}

const updateAllergy = (data, callback) => {
    const { patientAllergyId, name, severity } = data;
    const sql = `UPDATE patient_allergies SET name = ?, severity = ? WHERE patient_allergy_id = ?`;
    db.query(sql, [name, severity, patientAllergyId], callback);
}

const updateCondition = (data, callback) => {
    const { patientConditionId, name, diagnosedAt, notes } = data;
    const sql = `UPDATE patient_conditions SET name = ?, diagnosed_at = ?, notes = ? WHERE patient_condition_id = ?`;
    db.query(sql, [name, diagnosedAt, notes, patientConditionId], callback);
}

const updateMedication = (data, callback) => {
    const { patientMedicationId, name, dosage, frequency } = data;
    const sql = `UPDATE patient_medications SET name = ?, dosage = ?, frequency = ? WHERE patient_medication_id = ?`;
    db.query(sql, [name, dosage, frequency, patientMedicationId], callback);
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

//-todos los gets de administración: todos los registros, con datos del paciente ya unidos
const getAllClinicalRecords = (callback) => {
    const sql = `SELECT cr.*, bt.blood_type, up.first_name, up.first_surname, up.second_surname, up.curp
                FROM clinical_records cr
                LEFT JOIN blood_types bt ON cr.blood_type_id = bt.blood_type_id
                LEFT JOIN user_profiles up ON cr.user_profile_id = up.user_profile_id`;
    db.query(sql, callback);
}

const getAllAllergies = (callback) => {
    const sql = `SELECT pa.*, up.first_name, up.first_surname, up.second_surname, up.curp
                FROM patient_allergies pa
                LEFT JOIN clinical_records cr ON pa.clinical_record_id = cr.clinical_record_id
                LEFT JOIN user_profiles up ON cr.user_profile_id = up.user_profile_id`;
    db.query(sql, callback);
}

const getAllConditions = (callback) => {
    const sql = `SELECT pc.*, up.first_name, up.first_surname, up.second_surname, up.curp
                FROM patient_conditions pc
                LEFT JOIN clinical_records cr ON pc.clinical_record_id = cr.clinical_record_id
                LEFT JOIN user_profiles up ON cr.user_profile_id = up.user_profile_id`;
    db.query(sql, callback);
}

const getAllMedications = (callback) => {
    const sql = `SELECT pm.*, up.first_name, up.first_surname, up.second_surname, up.curp
                FROM patient_medications pm
                LEFT JOIN clinical_records cr ON pm.clinical_record_id = cr.clinical_record_id
                LEFT JOIN user_profiles up ON cr.user_profile_id = up.user_profile_id`;
    db.query(sql, callback);
}

module.exports = {
    createClinicalRecord,
    registerAllergy, toggleAllergy,
    registerCondition, toggleCondition,
    registerMedication, toggleMedication,
    updateClinicalRecord, updateAllergy, updateCondition, updateMedication,
    getClinicalRecordByUser,
    getAllergiesByRecord,
    getConditionsByRecord,
    getMedicationsByRecord,
    getAllergyHistory, getConditionHistory, getMedicationHistory,
    getAllBloodTypes,
    getAllClinicalRecords, getAllAllergies, getAllConditions, getAllMedications
}