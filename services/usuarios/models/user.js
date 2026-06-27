const db = require('../config/db')

const createCredential = (email, passwordHash, callback) => {
    const sql = `INSERT INTO user_credentials (email, password_hash, created_at,
    is_active) VALUES (?, ?, NOW(), 1)`;

    db.query(sql, [email, passwordHash], callback);
}

const createProfile = (userId, institutionId, roleId, firstName, firstSurname, secondSurname, phone, callback) => {
    const sql = `INSERT INTO user_profiles (user_credential_id, institution_id, role_id, first_name, first_surname,
    second_surname, phone_number, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;

    const values = [userId, institutionId, roleId, firstName, firstSurname, secondSurname, phone]
    db.query(sql, values, callback);
}

module.exports = {createCredential, createProfile}