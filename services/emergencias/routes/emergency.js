const express = require('express')
const router = express.Router();
const emergencyController = require('../controllers/emergency');
const middleware = require('../middlewares/auth');

//---------- POSTs -----------------------------------
router.post('/registrar-emergencia', middleware.verifyToken, emergencyController.registerEmergency); // ✅ NewEmergency.jsx
router.post('/registrar-paciente', middleware.verifyToken, emergencyController.registerEmergencyPatient); // TODO (app móvil)
router.post('/registrar-nota-urgencia', middleware.verifyToken, emergencyController.registerEmergencyNote); // TODO (app móvil)
router.post('/registrar-asignacion', middleware.verifyToken, emergencyController.registerAssignment); // ✅ NewEmergency.jsx
router.post('/registrar-solicitud', middleware.verifyToken, emergencyController.registerInterInstitutionalRequest); // ✅ NewEmergency.jsx
router.post('/crear-tipo-emergencia', middleware.verifyToken, emergencyController.createEmergencyType); // TODO
router.post('/crear-estado-emergencia', middleware.verifyToken, emergencyController.createEmergencyStatus); // TODO
router.post('/crear-estado-solicitud', middleware.verifyToken, emergencyController.createRequestStatus); // TODO
router.post('/crear-nivel-triage', middleware.verifyToken, emergencyController.createTriageLevel);

// -------------------patches--------------------
router.patch('/actualizar-estado-emergencia', middleware.verifyToken, emergencyController.updateEmergencyStatus); // TODO
router.patch('/cerrar-emergencia', middleware.verifyToken, emergencyController.closeEmergency); // ✅ EmergencyDetail.jsx
router.patch('/desasignar-ambulancia', middleware.verifyToken, emergencyController.unassignAmbulance); // TODO
router.patch('/responder-solicitud', middleware.verifyToken, emergencyController.respondInterInstitutionalRequest); // TODO
router.patch('/cancelar-solicitud', middleware.verifyToken, emergencyController.cancelInterInstitutionalRequest);
router.patch('/alternar-tipo-emergencia', middleware.verifyToken, emergencyController.toggleEmergencyType); // TODO
router.patch('/alternar-estado-emergencia', middleware.verifyToken, emergencyController.toggleEmergencyStatus); // TODO
router.patch('/alternar-estado-solicitud', middleware.verifyToken, emergencyController.toggleRequestStatus); // TODO
router.patch('/alternar-nivel-triage', middleware.verifyToken, emergencyController.toggleTriageLevel); // TODO
router.patch('/actualizar-tipo-emergencia', middleware.verifyToken, emergencyController.updateEmergencyType);
router.patch('/actualizar-estado-emergencia-catalogo', middleware.verifyToken, emergencyController.updateEmergencyStatusCatalog);
router.patch('/actualizar-estado-solicitud', middleware.verifyToken, emergencyController.updateRequestStatus);
router.patch('/actualizar-nivel-triage', middleware.verifyToken, emergencyController.updateTriageLevel);

// -------------- gets ---------------------------------
router.get('/emergencias-activas', middleware.verifyToken, emergencyController.getAllActiveEmergencies); // ✅ Dashboard.jsx
router.get('/emergencias-cerradas', middleware.verifyToken, emergencyController.getAllClosedEmergencies); // TODO
router.get('/emergencia/:emergencyId', middleware.verifyToken, emergencyController.getEmergencyById); // ✅ EmergencyDetail.jsx
router.get('/pacientes/:emergencyId', middleware.verifyToken, emergencyController.getPatientsByEmergency); // ✅ EmergencyDetail.jsx
router.get('/notas/:emergencyPatientId', middleware.verifyToken, emergencyController.getNotesByEmergencyPatient); // ✅ EmergencyDetail.jsx
router.get('/asignaciones/:emergencyId', middleware.verifyToken, emergencyController.getAssignmentsByEmergency); // ✅ EmergencyDetail.jsx
router.get('/asignaciones-ambulancia/:ambulanceId', middleware.verifyToken, emergencyController.getAssignmentsByAmbulance);
router.get('/emergencias-paciente/:userProfileId', middleware.verifyToken, emergencyController.getEmergenciesByPatient);
router.get('/solicitudes-pendientes', middleware.verifyToken, emergencyController.getPendingInterInstitutionalRequests); // TODO
router.get('/solicitudes', middleware.verifyToken, emergencyController.getAllInterInstitutionalRequests); // ✅ Requests.jsx
router.get('/tipos-emergencia', emergencyController.getAllEmergencyTypes); // ✅ NewEmergency.jsx
router.get('/estados-emergencia', emergencyController.getAllEmergencyStatuses); // TODO
router.get('/estados-solicitud', emergencyController.getAllRequestStatuses); // TODO
router.get('/niveles-triage', emergencyController.getAllTriageLevels); // TODO (app móvil)

// gets de administración (catálogos completos, incluyen activos e inactivos)
router.get('/tipos-emergencia-todos', middleware.verifyToken, emergencyController.getAllEmergencyTypesAdmin);
router.get('/estados-emergencia-todos', middleware.verifyToken, emergencyController.getAllEmergencyStatusesAdmin);
router.get('/estados-solicitud-todos', middleware.verifyToken, emergencyController.getAllRequestStatusesAdmin);
router.get('/niveles-triage-todos', middleware.verifyToken, emergencyController.getAllTriageLevelsAdmin);

//gets de estadísticas
router.get('/analiticas/emergencias-por-tipo', middleware.verifyToken, emergencyController.getEmergenciesByType);
router.get('/analiticas/solicitudes-por-estado', middleware.verifyToken, emergencyController.getRequestsByStatus);
router.get('/analiticas/tiempo-respuesta', middleware.verifyToken, emergencyController.getResponseTimeByDay);
router.get('/analiticas/tiempo-respuesta-hoy', middleware.verifyToken, emergencyController.getResponseTimeToday);
router.get('/analiticas/emergencias-por-institucion', middleware.verifyToken, emergencyController.getEmergenciesByInstitution);

module.exports = router