const express = require('express')
const router = express.Router();
const emergencyController = require('../controllers/emergency');
const middleware = require('../middlewares/auth');

//---------- POSTs -----------------------------------
router.post('/registrar-emergencia', middleware.verifyToken, emergencyController.registerEmergency);
router.post('/registrar-paciente', middleware.verifyToken, emergencyController.registerEmergencyPatient);
router.post('/registrar-nota-urgencia', middleware.verifyToken, emergencyController.registerEmergencyNote);
router.post('/registrar-asignacion', middleware.verifyToken, emergencyController.registerAssignment);
router.post('/registrar-solicitud', middleware.verifyToken, emergencyController.registerInterInstitutionalRequest);
router.post('/crear-tipo-emergencia', middleware.verifyToken, emergencyController.createEmergencyType);
router.post('/crear-estado-emergencia', middleware.verifyToken, emergencyController.createEmergencyStatus);
router.post('/crear-estado-solicitud', middleware.verifyToken, emergencyController.createRequestStatus);

// -------------------patches--------------------
router.patch('/actualizar-estado-emergencia', middleware.verifyToken, emergencyController.updateEmergencyStatus);
router.patch('/actualizar-ambulancia', middleware.verifyToken, emergencyController.updateEmergencyAmbulance);
router.patch('/cerrar-emergencia', middleware.verifyToken, emergencyController.closeEmergency);
router.patch('/desasignar-ambulancia', middleware.verifyToken, emergencyController.unassignAmbulance);
router.patch('/responder-solicitud', middleware.verifyToken, emergencyController.respondInterInstitutionalRequest);
router.patch('/alternar-tipo-emergencia', middleware.verifyToken, emergencyController.toggleEmergencyType);
router.patch('/alternar-estado-emergencia', middleware.verifyToken, emergencyController.toggleEmergencyStatus);
router.patch('/alternar-estado-solicitud', middleware.verifyToken, emergencyController.toggleRequestStatus);
router.patch('/alternar-nivel-triage', middleware.verifyToken, emergencyController.toggleTriageLevel);

// -------------- gets ---------------------------------
router.get('/emergencias-activas', middleware.verifyToken, emergencyController.getAllActiveEmergencies);
router.get('/emergencias-cerradas', middleware.verifyToken, emergencyController.getAllClosedEmergencies);
router.get('/emergencia/:emergencyId', middleware.verifyToken, emergencyController.getEmergencyById);
router.get('/pacientes/:emergencyId', middleware.verifyToken, emergencyController.getPatientsByEmergency);
router.get('/notas/:emergencyPatientId', middleware.verifyToken, emergencyController.getNotesByEmergencyPatient);
router.get('/asignaciones/:emergencyId', middleware.verifyToken, emergencyController.getAssignmentsByEmergency);
router.get('/solicitudes-pendientes', middleware.verifyToken, emergencyController.getPendingInterInstitutionalRequests);
router.get('/solicitudes', middleware.verifyToken, emergencyController.getAllInterInstitutionalRequests);
router.get('/tipos-emergencia', emergencyController.getAllEmergencyTypes);
router.get('/estados-emergencia', emergencyController.getAllEmergencyStatuses);
router.get('/estados-solicitud', emergencyController.getAllRequestStatuses);
router.get('/niveles-triage', emergencyController.getAllTriageLevels);

module.exports = router