const db = require('../config/db');

// Institución, rol y privilegio de administrador de institución de un usuario
// puntual — se deriva SIEMPRE server-side, nunca se confía en lo que mande el
// cliente. Se reutiliza tanto para el que llama como para un usuario objetivo.
const getUserInstitutionInfo = (userProfileId, callback) => {
    const sql = `SELECT institution_id, role_id, is_institution_admin FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Igual que getUserInstitutionInfo pero resuelto desde user_credential_id —
// necesario en endpoints que reciben ese ID en vez de user_profile_id
// (editUserCredentials, toggleActiveUser) para validar propiedad de
// institución antes de aplicar el cambio.
const getUserInstitutionInfoByCredentialId = (userCredentialId, callback) => {
    const sql = `SELECT institution_id, role_id, is_institution_admin FROM user_profiles WHERE user_credential_id = ?`;
    db.query(sql, [userCredentialId], callback);
}

const toggleInstitutionAdmin = (userProfileId, isInstitutionAdmin, callback) => {
    const sql = `UPDATE user_profiles SET is_institution_admin = ?, updated_at = NOW() WHERE user_profile_id = ?`;
    db.query(sql, [isInstitutionAdmin ? 1 : 0, userProfileId], callback);
}

// Si una institución es CRUM (Cruz Roja Tabasco) — el rol 2 (Despachador) solo
// puede asignarse/usarse dentro de una institución con esta bandera en 1.
const getInstitutionCrumFlag = (institutionId, callback) => {
    const sql = `SELECT is_crum_institution FROM institutions WHERE institution_id = ?`;
    db.query(sql, [institutionId], callback);
}

// "ambulances" e "institutions" no son de este servicio, pero se consultan
// directo — misma BD compartida, mismo patrón ya usado en el resto del
// proyecto para cruzar tablas de otro servicio. Sirve para validar, al
// registrar un paramédico, a quién le pertenece la ambulancia que se le
// quiere asignar (institución dueña + si esa institución es CRUM).
const getAmbulanceInstitutionInfo = (ambulanceId, callback) => {
    const sql = `SELECT a.institution_id, i.is_crum_institution
                FROM ambulances a JOIN institutions i ON a.institution_id = i.institution_id
                WHERE a.ambulance_id = ?`;
    db.query(sql, [ambulanceId], callback);
}

const createCredential = (email, passwordHash, callback) => {
    const sql = `INSERT INTO user_credentials (email, password_hash, created_at, updated_at, is_active) VALUES (?, ?, NOW(), NOW(), 1)`;

    db.query(sql, [email, passwordHash], callback);
}

const createProfile = (userCredentialId, institutionId, roleId, firstName, firstSurname, secondSurname, phone,
                    birth, cveUnicaRegistroPob, emergencyContact, emergencyPhone, assignedAmbulanceId, shiftWindows, callback) => {
    const sql = `INSERT INTO user_profiles (user_credential_id, institution_id, role_id, first_name, first_surname,
    second_surname, phone_number, birth_date, curp, emergency_contact, emergency_phone, assigned_ambulance_id, shift_windows, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

    const values = [userCredentialId, institutionId, roleId, firstName, firstSurname, secondSurname, phone,
                    birth, cveUnicaRegistroPob, emergencyContact, emergencyPhone, assignedAmbulanceId || null,
                    shiftWindows && shiftWindows.length ? JSON.stringify(shiftWindows) : null]

    db.query(sql, values, callback);

}

const login = (email, callback) => {
    const sql = `SELECT t1.user_profile_id, t1.institution_id, t1.first_name, t1.first_surname, t1.role_id, t1.is_institution_admin, t1.assigned_ambulance_id, t1.shift_windows, t2.user_credential_id,
    t2.email, t2.password_hash, t2.is_active, t2.active_session_id FROM user_profiles AS t1 INNER JOIN user_credentials AS t2 ON
	t1.USER_CREDENTIAL_ID = t2.USER_CREDENTIAL_ID WHERE t2.EMAIL = ?`;
    db.query(sql, [email], callback);
}

// Un solo "sessionId" válido a la vez por credencial — cada login genera uno
// nuevo y pisa el anterior, así que si alguien inicia sesión en OTRO
// dispositivo, el token del dispositivo viejo deja de servir en cuanto haga
// su siguiente petición (verifyToken lo revisa, ver middlewares/auth.js).
// Solo se usa para rol 3 (paramédico) por ahora — ver comentario en login().
const updateActiveSession = (userCredentialId, sessionId, callback) => {
    const sql = `UPDATE user_credentials SET active_session_id = ? WHERE user_credential_id = ?`;
    db.query(sql, [sessionId, userCredentialId], callback);
}

const toggleActiveUser = (userCredentialId, callback) => {
    const sql = `UPDATE user_credentials SET is_active = NOT is_active, updated_at = NOW() WHERE user_credential_id = ?`;
    db.query(sql, [userCredentialId], (e, r) => {
        if (e) return callback(e, r);
        db.query(`SELECT is_active FROM user_credentials WHERE user_credential_id = ?`, [userCredentialId], (e2, r2) => {
            if (!e2 && r2.length > 0) {
                db.query(`INSERT INTO user_credential_history (user_credential_id, is_active, changed_at) VALUES (?, ?, NOW())`,
                    [userCredentialId, r2[0].is_active], (e3) => { if (e3) console.error('Error registrando historial de cuenta:', e3) });
            }
            callback(e, r);
        });
    });
}

const requestUserStatus = (userCredentialId, callback) => {
    const sql = `SELECT is_active FROM user_credentials WHERE user_credential_id = ?`;
    db.query(sql, [userCredentialId], callback);
}

const getCredentialHistory = (userCredentialId, callback) => {
    const sql = `SELECT * FROM user_credential_history WHERE user_credential_id = ? ORDER BY changed_at DESC`;
    db.query(sql, [userCredentialId], callback);
}

// assignedAmbulanceId y shiftWindows solo tienen sentido real para rol 3
// (paramédico), pero se guardan tal cual vengan — el controller es quien
// decide cuándo forzarlos a NULL (ej. si el rol editado ya no es paramédico).
const editUserProfile = (userProfileId, institutionId, roleId, firstName, firstSurname, secondSurname, phone, birth,
    cveUnicaRegistroPob, emergencyContact, emergencyPhone, assignedAmbulanceId, shiftWindows, callback) => {
    const sql = `UPDATE user_profiles SET institution_id = ?, role_id = ?, first_name = ?, first_surname = ?, second_surname = ?,
    phone_number = ?, birth_date = ?, curp = ?, emergency_contact = ?, emergency_phone = ?, assigned_ambulance_id = ?,
    shift_windows = ?, updated_at = NOW() WHERE user_profile_id = ?`;

    const values = [institutionId, roleId, firstName, firstSurname, secondSurname, phone, birth,
    cveUnicaRegistroPob, emergencyContact, emergencyPhone, assignedAmbulanceId || null,
    shiftWindows && shiftWindows.length ? JSON.stringify(shiftWindows) : null, userProfileId]

    db.query(sql, values, callback)
}

const editUserCredentials = (userCredentialId, email, password, callback) => {
    const sql = `UPDATE user_credentials SET email = ?, password_hash = ?, updated_at = NOW() WHERE user_credential_id = ?`;
    const values = [email, password, userCredentialId];
    db.query(sql, values, callback);
}

// Token de dispositivo de FCM — para poder mandarle notificaciones push a
// este usuario aunque tenga la app cerrada (ver registerAssignment en
// services/emergencias). Un solo token por usuario, igual que solo se
// permite un turno activo por dispositivo — el más reciente pisa al
// anterior (si inició sesión en otro celular, el viejo ya no debe recibir).
const updatePushToken = (userProfileId, pushToken, callback) => {
    const sql = `UPDATE user_profiles SET push_token = ?, updated_at = NOW() WHERE user_profile_id = ?`;
    db.query(sql, [pushToken, userProfileId], callback);
}




const getAllUsers = (callback) => {
    const sql = `SELECT t1.user_profile_id, t1.first_name, t1.first_surname, t1.second_surname,
                t1.phone_number, t1.birth_date, t1.curp, t1.emergency_contact, t1.emergency_phone,
                t2.email, t2.is_active, t2.user_credential_id,
                t1.institution_id, t1.role_id, t1.is_institution_admin, t1.assigned_ambulance_id,
                t1.shift_windows
                FROM user_profiles t1
                LEFT JOIN user_credentials t2 ON t1.user_credential_id = t2.user_credential_id`;
    db.query(sql, callback);
}

const getUserById = (userProfileId, callback) => {
    const sql = `SELECT t1.user_profile_id, t1.first_name, t1.first_surname, t1.second_surname,
                t1.phone_number, t1.birth_date, t1.curp, t1.emergency_contact, t1.emergency_phone,
                t2.email, t2.is_active, t2.user_credential_id,
                t1.institution_id, t1.role_id, t1.is_institution_admin, t1.assigned_ambulance_id,
                t1.shift_windows
                FROM user_profiles t1
                LEFT JOIN user_credentials t2 ON t1.user_credential_id = t2.user_credential_id
                WHERE t1.user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

const getAllRoles = (callback) => {
    const sql = `SELECT * FROM roles`;
    db.query(sql, callback);
}

const getAllInstitutions = (callback) => {
    const sql = `SELECT * FROM institutions`;
    db.query(sql, callback);
}

const getAllInstitutionTypes = (callback) => {
    const sql = `SELECT * FROM institution_types`;
    db.query(sql, callback);
}

const getAllStates = (callback) => {
    const sql = `SELECT * FROM states ORDER BY name ASC`;
    db.query(sql, callback);
}

const getCitiesByState = (stateId, callback) => {
    const sql = `SELECT * FROM cities WHERE state_id = ?`;
    db.query(sql, [stateId], callback);
}

// Resuelve el state_id de una ciudad ya guardada — necesario para poder
// pre-seleccionar el combo de Estado (y con eso el de Ciudad) en formularios
// que cargan una dirección ya existente, en vez de partir de cero.
const getCityById = (cityId, callback) => {
    const sql = `SELECT * FROM cities WHERE city_id = ?`;
    db.query(sql, [cityId], callback);
}

// Paramédicos (rol 3) con la ambulancia a la que están vinculados
// (assigned_ambulance_id) y su horario de turnos (shift_windows, string JSON).
// Se usa en sicem-web (Ambulances.jsx) para mostrar, por unidad, quiénes la
// conducen aunque no estén en línea. La presencia EN LÍNEA no se calcula aquí:
// active_session_id nunca se limpia al cerrar sesión (sería un dato falso);
// se resuelve en tiempo real por el socket del servicio de unidades.
const getAllParamedics = (callback) => {
    const sql = `SELECT t1.user_profile_id, t1.first_name, t1.first_surname,
                t1.assigned_ambulance_id, t1.shift_windows
                FROM user_profiles t1
                WHERE t1.role_id = 3`;
    db.query(sql, callback);
}

const getUserByCURP = (curp, callback) => {
    const sql = `SELECT user_profile_id, first_name, first_surname, second_surname,
                phone_number, birth_date, curp
                FROM user_profiles WHERE curp = ?`;
    db.query(sql, [curp], callback);
}

// Rol del usuario objetivo — para que el controller pueda validar que un
// paramédico solo corrija la CURP de un PACIENTE (rol 5), nunca la de otro
// tipo de usuario. Ver updatePatientCurp en el controller.
const getUserRole = (userProfileId, callback) => {
    const sql = `SELECT role_id FROM user_profiles WHERE user_profile_id = ?`;
    db.query(sql, [userProfileId], callback);
}

// Actualización MUY acotada — solo la columna curp, nada más — a diferencia
// de editUserProfile (que edita el expediente administrativo completo y solo
// lo puede hacer un admin o el propio dueño). El paramédico en campo necesita
// poder corregir/llenar la CURP de un paciente que trae registrado (a veces
// llega en blanco o como "No tiene" desde sicem-web), sin abrirle acceso a
// ningún otro dato del perfil de esa persona.
const updatePatientCurp = (userProfileId, curp, callback) => {
    const sql = `UPDATE user_profiles SET curp = ?, updated_at = NOW() WHERE user_profile_id = ?`;
    db.query(sql, [curp, userProfileId], callback);
}

module.exports = { getUserInstitutionInfo, getUserInstitutionInfoByCredentialId, toggleInstitutionAdmin, getInstitutionCrumFlag,
                getAmbulanceInstitutionInfo,
                createCredential, createProfile, login, toggleActiveUser, requestUserStatus, getCredentialHistory,
                editUserProfile, editUserCredentials, getAllUsers, getUserById, getUserByCURP, getUserRole, updatePatientCurp,
                getAllRoles, getAllInstitutions, getAllInstitutionTypes, getAllStates, getCitiesByState, getCityById,
                updatePushToken, updateActiveSession, getAllParamedics }