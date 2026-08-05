const express = require('express')
const router = express.Router();
const unitController = require('../controllers/unit');
const middleware = require('../middlewares/auth');

// POST
router.post('/registrar-ubicacion', middleware.verifyToken, unitController.registerLocations); // TODO (app móvil)
router.post('/registrar-ambulancia', middleware.verifyToken, unitController.registerAmbulance); // TODO
router.post('/crear-tipo-ambulancia', middleware.verifyToken, unitController.createAmbulanceType); // TODO
router.post('/registrar-estado-ambulancia', middleware.verifyToken, unitController.registerAmbulanceStatus); // TODO
router.post('/iniciar-turno', middleware.verifyToken, unitController.startShift); // ✅ sicem-mobile
router.post('/reportar-falla', middleware.verifyToken, unitController.reportAmbulanceFailure); // ✅ sicem-mobile
// Interno — SOLO lo llama services/usuarios (no lleva JWT de usuario, lleva
// un secreto compartido entre servicios). Ver login en usuarios: cuando
// alguien inicia sesión con la misma cuenta en otro dispositivo, avisa por
// aquí para que el celular viejo cierre sesión al instante por socket.
router.post('/notificar-cierre-sesion', unitController.notifyForceLogout);

// PATCH
router.patch('/terminar-turno', middleware.verifyToken, unitController.endShift); // ✅ sicem-mobile
router.patch('/alternar-ambulancia', middleware.verifyToken, unitController.toggleAmbulance); // TODO
router.patch('/alternar-tipo-ambulancia', middleware.verifyToken, unitController.toggleAmbulanceType); // TODO
router.patch('/alternar-estado-ambulancia', middleware.verifyToken, unitController.toggleAmbulanceStatus); // TODO
router.patch('/actualizar-tipo-ambulancia', middleware.verifyToken, unitController.updateAmbulanceType);
router.patch('/actualizar-estado-ambulancia-catalogo', middleware.verifyToken, unitController.updateAmbulanceStatusCatalog);
router.patch('/actualizar-ambulancia', middleware.verifyToken, unitController.updateAmbulance);
router.patch('/actualizar-estado-ambulancia', middleware.verifyToken, unitController.updateAmbulanceStatus);
router.patch('/concluir-traslado', middleware.verifyToken, unitController.concludeTransfer); // ✅ sicem-mobile
router.patch('/marcar-disponible', middleware.verifyToken, unitController.markAvailableAfterTransfer); // ✅ sicem-mobile

// GET
router.get('/ambulancias', middleware.verifyToken, unitController.getAllAmbulances); // ✅ Dashboard.jsx
router.get('/ambulancias-disponibles/:institutionId', middleware.verifyToken, unitController.getAvailableAmbulances); // ✅ NewEmergency.jsx
router.get('/ambulancias-externas/:institutionId', middleware.verifyToken, unitController.getExternalAvailableAmbulances); // ✅ NewEmergency.jsx
router.get('/ambulancia/numero/:unitNumber', middleware.verifyToken, unitController.getAmbulanceByUnitNumber); // TODO
router.get('/ambulancia/placa/:licensePlate', middleware.verifyToken, unitController.getAmbulanceByLicensePlate); // TODO
router.get('/tipos-ambulancia', unitController.getAllAmbulanceTypes); // ✅ NewEmergency.jsx
router.get('/ambulancias-crum', unitController.getCrumAmbulances); // ✅ sicem-web (registrar paramédico)
router.get('/estados-ambulancia', unitController.getAllAmbulanceStatuses); // TODO
router.get('/ubicacion/:ambulanceId', middleware.verifyToken, unitController.getLocationsByAmbulance); // ✅ Dashboard.jsx
router.get('/mi-turno-activo', middleware.verifyToken, unitController.getMyActiveShift); // ✅ sicem-mobile
router.get('/mi-traslado-actual', middleware.verifyToken, unitController.getMyActiveTransfer); // ✅ sicem-mobile

// gets de administración (incluyen activos e inactivos)
router.get('/ambulancias-todas', middleware.verifyToken, unitController.getAllAmbulancesAdmin);
router.get('/tipos-ambulancia-todos', middleware.verifyToken, unitController.getAllAmbulanceTypesAdmin);
router.get('/estados-ambulancia-todos', middleware.verifyToken, unitController.getAllAmbulanceStatusesAdmin);

module.exports = router