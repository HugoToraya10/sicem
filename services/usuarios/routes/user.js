const express = require('express')
const router = express.Router();
const userController = require('../controllers/user');
const middleware = require('../middlewares/auth');

//post
router.post('/registro', middleware.verifyToken, userController.register); // TODO
router.post('/registro-paciente', userController.registerPatient); // TODO

//updates
router.patch('/actualizar-credenciales', middleware.verifyToken, userController.editUserCredentials); // TODO
router.patch('/actualizar-perfil', middleware.verifyToken, userController.editUserProfile); // TODO

//patches
router.patch('/invertir-estado-usuario', middleware.verifyToken, userController.toggleActiveUser); // TODO

//login
router.post('/login', userController.login); // ✅ Login.jsx

//gets
router.get('/obtener-usuarios', middleware.verifyToken, userController.getAllUsers) // TODO
router.get('/obtener-usuario-id/:userProfileId', middleware.verifyToken, userController.getUserById) // TODO
router.get('/obtener-roles', userController.getAllRoles); // TODO
router.get('/obtener-instituciones', userController.getAllInstitutions); // TODO
router.get('/obtener-tipos-institucion', userController.getAllInstitutionTypes); // TODO

router.get('/estados', userController.getAllStates); // TODO
router.get('/ciudades/:stateId', userController.getCitiesByState); // TODO
router.get('/obtener-usuario-curp/:curp', userController.getUserByCURP);
router.get('/historial-cuenta/:userCredentialId', middleware.verifyToken, userController.getCredentialHistory);

module.exports = router