const express = require('express')
const router = express.Router();
const patientController = require('../controllers/patient');
const middleware = require('../middlewares/auth');

//posts
router.post('/crear-ece', middleware.verifyToken, patientController.createClinicalRecord);
router.post('/registrar-alergia', middleware.verifyToken, patientController.registerAllergy);
router.post('/registrar-condicion', middleware.verifyToken, patientController.registerCondition);
router.post('/registrar-medicacion', middleware.verifyToken, patientController.registerMedication);


//patches
router.patch('/alternar-alergia', middleware.verifyToken, patientController.toggleAllergy);
router.patch('/alternar-condicion', middleware.verifyToken, patientController.toggleCondition);
router.patch('/alternar-medicacion', middleware.verifyToken, patientController.toggleMedication);


//gets
router.get('/tipos-sangre', patientController.getAllBloodTypes);
router.get('/ece/:userProfileId', middleware.verifyToken, patientController.getClinicalRecordByUser);
router.get('/alergias/:clinicalRecordId', middleware.verifyToken, patientController.getAllergiesByRecord);
router.get('/condiciones/:clinicalRecordId', middleware.verifyToken, patientController.getConditionsByRecord);
router.get('/medicamentos/:clinicalRecordId', middleware.verifyToken, patientController.getMedicationsByRecord);



module.exports = router