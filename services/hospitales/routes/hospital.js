const express = require('express')
const router = express.Router();
const hospitalController = require('../controllers/hospital');
const middleware = require('../middlewares/auth');

//post
router.post('/registrar-institucion', middleware.verifyToken, hospitalController.registerInstitution);
router.post('/crear-especialidad', middleware.verifyToken, hospitalController.createSpeciality);
router.post('/crear-tipo-institucion', middleware.verifyToken, hospitalController.createInstitutionType);
router.post('/asignar-especialidad', middleware.verifyToken, hospitalController.createInstitutionsSpecialities);
router.post('/crear-notificacion', middleware.verifyToken, hospitalController.createInstitutionNotification);

//patches
router.patch('/alternar-institucion', middleware.verifyToken, hospitalController.toggleInstitution);
router.patch('/alternar-especialidad-institucion', middleware.verifyToken, hospitalController.toggleInstitutionsSpecialities);
router.patch('/alternar-especialidad', middleware.verifyToken, hospitalController.toggleSpecialities);
router.patch('/alternar-tipo-institucion', middleware.verifyToken, hospitalController.toggleInstitutionType);
router.patch('/actualizar-camas-institucion', middleware.verifyToken, hospitalController.updateAvailableBedsI);
router.patch('/actualizar-capacidad-institucion', middleware.verifyToken, hospitalController.updateBedCapacityI);
router.patch('/actualizar-camas-especialidad', middleware.verifyToken, hospitalController.updateAvailableBedsIS);
router.patch('/actualizar-capacidad-especialidad', middleware.verifyToken, hospitalController.updateBedCapacityIS);

//gets
router.get('/instituciones', hospitalController.getAllInstitutions);
router.get('/institucion/:name', hospitalController.getInstitutionByName);
router.get('/notificaciones', middleware.verifyToken, hospitalController.getInstitutionNotifications);
router.get('/notificaciones/:name', middleware.verifyToken, hospitalController.getInstitutionNotificationByName);
router.get('/especialidades-instituciones', hospitalController.getAllInstitutionSpecialities);
router.get('/especialidades-institucion/:name', hospitalController.getInstitutionSpecialityByName);
router.get('/especialidades', hospitalController.getAllSpecialities);
router.get('/especialidad/:name', hospitalController.getSpecialityByName);
router.get('/tipos-institucion', hospitalController.getAllInstitutionTypes);

module.exports = router