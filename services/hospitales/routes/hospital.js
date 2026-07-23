const express = require('express')
const router = express.Router();
const hospitalController = require('../controllers/hospital');
const middleware = require('../middlewares/auth');

//post
router.post('/registrar-institucion', middleware.verifyToken, hospitalController.registerInstitution); // TODO
router.post('/crear-especialidad', middleware.verifyToken, hospitalController.createSpeciality); // TODO
router.post('/crear-tipo-institucion', middleware.verifyToken, hospitalController.createInstitutionType); // TODO
router.post('/asignar-especialidad', middleware.verifyToken, hospitalController.createInstitutionsSpecialities); // TODO
router.post('/crear-notificacion', middleware.verifyToken, hospitalController.createInstitutionNotification); // TODO

//patches
router.patch('/identificar-paciente', middleware.verifyToken, hospitalController.identifyPatient);
router.patch('/alternar-institucion', middleware.verifyToken, hospitalController.toggleInstitution); // TODO
router.patch('/alternar-crum-institucion', middleware.verifyToken, hospitalController.toggleCrumInstitution);
router.patch('/alternar-especialidad-institucion', middleware.verifyToken, hospitalController.toggleInstitutionsSpecialities); // TODO
router.patch('/alternar-especialidad', middleware.verifyToken, hospitalController.toggleSpecialities); // TODO
router.patch('/alternar-tipo-institucion', middleware.verifyToken, hospitalController.toggleInstitutionType); // TODO
router.patch('/actualizar-camas-institucion', middleware.verifyToken, hospitalController.updateAvailableBedsI); // TODO
router.patch('/actualizar-capacidad-institucion', middleware.verifyToken, hospitalController.updateBedCapacityI); // TODO
router.patch('/actualizar-camas-especialidad', middleware.verifyToken, hospitalController.updateAvailableBedsIS); // TODO
router.patch('/actualizar-capacidad-especialidad', middleware.verifyToken, hospitalController.updateBedCapacityIS); // TODO
router.patch('/actualizar-tipo-institucion', middleware.verifyToken, hospitalController.updateInstitutionType);
router.patch('/actualizar-especialidad', middleware.verifyToken, hospitalController.updateSpeciality);
router.patch('/actualizar-institucion', middleware.verifyToken, hospitalController.updateInstitution);

//gets
router.get('/instituciones', hospitalController.getAllInstitutions); // TODO
router.get('/instituciones-destino', hospitalController.getInstitutionsForDestination); // ✅ NewEmergency.jsx
router.get('/institucion/:name', hospitalController.getInstitutionByName); // TODO
router.get('/notificaciones', middleware.verifyToken, hospitalController.getInstitutionNotifications); // TODO
router.get('/notificaciones/:name', middleware.verifyToken, hospitalController.getInstitutionNotificationByName); // TODO
router.get('/especialidades-instituciones', hospitalController.getAllInstitutionSpecialities); // TODO
router.get('/especialidades-institucion/:name', hospitalController.getInstitutionSpecialityByName); // TODO
router.get('/especialidades', hospitalController.getAllSpecialities); // TODO
router.get('/especialidad/:name', hospitalController.getSpecialityByName); // TODO
router.get('/tipos-institucion', hospitalController.getAllInstitutionTypes); // TODO

// gets de administración (incluyen activos e inactivos)
router.get('/instituciones-todos', middleware.verifyToken, hospitalController.getAllInstitutionsAdmin);
router.get('/tipos-institucion-todos', middleware.verifyToken, hospitalController.getAllInstitutionTypesAdmin);
router.get('/especialidades-todos', middleware.verifyToken, hospitalController.getAllSpecialitiesAdmin);

module.exports = router