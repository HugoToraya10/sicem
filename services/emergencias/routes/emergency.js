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
router.patch('/forzar-cierre-emergencia', middleware.verifyToken, emergencyController.forceCloseEmergency); // rol 1, cierre con motivo
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
router.patch('/confirmar-recepcion-paciente', middleware.verifyToken, emergencyController.confirmPatientReception);
router.patch('/confirmar-llegada-paciente', middleware.verifyToken, emergencyController.confirmPatientDelivery); // ✅ PatientDetailModal.jsx (sicem-desktop)
router.patch('/dar-alta-paciente', middleware.verifyToken, emergencyController.dischargePatient); // ✅ PatientDetailModal.jsx (sicem-desktop) — libera la cama reservada
router.patch('/reasignar-destino-paciente', middleware.verifyToken, emergencyController.reassignPatientDestination);
router.patch('/asignar-ambulancia-paciente', middleware.verifyToken, emergencyController.assignAmbulanceToPatient); // ✅ EmergencyDetail.jsx

// -------------- gets ---------------------------------
router.get('/emergencias-activas', middleware.verifyToken, emergencyController.getAllActiveEmergencies); // ✅ Dashboard.jsx
router.get('/emergencias-cerradas', middleware.verifyToken, emergencyController.getAllClosedEmergencies); // TODO
router.get('/emergencia/:emergencyId', middleware.verifyToken, emergencyController.getEmergencyById); // ✅ EmergencyDetail.jsx
router.get('/pacientes/:emergencyId', middleware.verifyToken, emergencyController.getPatientsByEmergency); // ✅ EmergencyDetail.jsx
router.get('/pacientes-en-camino/:institutionId', middleware.verifyToken, emergencyController.getIncomingPatientsByInstitution);
router.get('/historial-institucion/:institutionId', middleware.verifyToken, emergencyController.getPatientHistoryByInstitution); // ✅ History.jsx (sicem-desktop)
router.get('/notas/:emergencyPatientId', middleware.verifyToken, emergencyController.getNotesByEmergencyPatient); // ✅ EmergencyDetail.jsx
router.get('/asignaciones/:emergencyId', middleware.verifyToken, emergencyController.getAssignmentsByEmergency); // ✅ EmergencyDetail.jsx
router.get('/asignaciones-ambulancia/:ambulanceId', middleware.verifyToken, emergencyController.getAssignmentsByAmbulance);
router.get('/emergencias-paciente/:userProfileId', middleware.verifyToken, emergencyController.getEmergenciesByPatient);
router.get('/solicitudes-pendientes', middleware.verifyToken, emergencyController.getPendingInterInstitutionalRequests); // TODO
router.get('/solicitudes-pendientes-institucion/:institutionId', middleware.verifyToken, emergencyController.getPendingRequestsByReceivingInstitution); // ✅ IncomingUnitRequests.jsx (sicem-desktop)
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

// analíticas filtradas por hospital (a diferencia de las de arriba, que son globales)
router.get('/analiticas/pacientes-por-tipo/:institutionId', middleware.verifyToken, emergencyController.getPatientsByTypeForInstitution);
router.get('/analiticas/pacientes-por-mes/:institutionId', middleware.verifyToken, emergencyController.getPatientsByMonthForInstitution);
router.get('/analiticas/tiempo-traslado/:institutionId', middleware.verifyToken, emergencyController.getAvgTransferTimeForInstitution);
router.get('/analiticas/mis-estadisticas', middleware.verifyToken, emergencyController.getMyStatsThisMonth); // ✅ sicem-mobile
router.get('/mi-emergencia-actual', middleware.verifyToken, emergencyController.getMyCurrentEmergencyStatus); // ✅ sicem-mobile (recuperación si se perdió el aviso en vivo)

module.exports = router