const express = require('express')
const router = express.Router();
const unitController = require('../controllers/unit');
const middleware = require('../middlewares/auth');

// POST
router.post('/registrar-ubicacion', middleware.verifyToken, unitController.registerLocations);
router.post('/registrar-ambulancia', middleware.verifyToken, unitController.registerAmbulance);
router.post('/crear-tipo-ambulancia', middleware.verifyToken, unitController.createAmbulanceType);
router.post('/registrar-estado-ambulancia', middleware.verifyToken, unitController.registerAmbulanceStatus);

// PATCH
router.patch('/alternar-ambulancia', middleware.verifyToken, unitController.toggleAmbulance);
router.patch('/alternar-tipo-ambulancia', middleware.verifyToken, unitController.toggleAmbulanceType);
router.patch('/alternar-estado-ambulancia', middleware.verifyToken, unitController.toggleAmbulanceStatus);

// GET
router.get('/ambulancias', middleware.verifyToken, unitController.getAllAmbulances);
router.get('/ambulancia/numero/:unitNumber', middleware.verifyToken, unitController.getAmbulanceByUnitNumber);
router.get('/ambulancia/placa/:licensePlate', middleware.verifyToken, unitController.getAmbulanceByLicensePlate);
router.get('/tipos-ambulancia', unitController.getAllAmbulanceTypes);
router.get('/estados-ambulancia', unitController.getAllAmbulanceStatuses);
router.get('/ubicacion/:ambulanceId', middleware.verifyToken, unitController.getLocationsByAmbulance);

module.exports = router