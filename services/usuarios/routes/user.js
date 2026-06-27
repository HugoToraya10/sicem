const express = require('express')
const router = express.Router();
const userController = require('../controllers/user');
const middleware = require('../middlewares/auth');


//post
router.post('/registro', middleware.verifyToken, userController.register);
router.post('/registro-paciente', userController.registerPatient);

//updates
router.patch('/actualizar-credenciales', middleware.verifyToken, userController.editUserCredentials);
router.patch('/actualizar-perfil', middleware.verifyToken, userController.editUserProfile);

//patches
router.patch('/invertir-estado-usuario', middleware.verifyToken, userController.toggleActiveUser);

//login
router.post('/login', userController.login);

//gets
router.get('/obtener-usuarios', middleware.verifyToken, userController.getAllUsers)
router.get('/obtener-usuario-id/:userProfileId', middleware.verifyToken, userController.getUserById)
router.get('/obtener-roles', userController.getAllRoles);
router.get('/obtener-instituciones', userController.getAllInstitutions);
router.get('/obtener-tipos-institucion', userController.getAllInstitutionTypes);

router.get('/estados', userController.getAllStates);
router.get('/ciudades/:stateId', userController.getCitiesByState);


module.exports = router