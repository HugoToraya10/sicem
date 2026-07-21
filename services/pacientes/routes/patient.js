const express = require('express')
const router = express.Router();
const patientController = require('../controllers/patient');
const middleware = require('../middlewares/auth');

//posts
router.post('/crear-ece', middleware.verifyToken, patientController.createClinicalRecord); // TODO
router.post('/registrar-alergia', middleware.verifyToken, patientController.registerAllergy); // TODO
router.post('/registrar-condicion', middleware.verifyToken, patientController.registerCondition); // TODO
router.post('/registrar-medicacion', middleware.verifyToken, patientController.registerMedication); // TODO

//patches
router.patch('/alternar-alergia', middleware.verifyToken, patientController.toggleAllergy); // TODO
router.patch('/alternar-condicion', middleware.verifyToken, patientController.toggleCondition); // TODO
router.patch('/alternar-medicacion', middleware.verifyToken, patientController.toggleMedication); // TODO
router.patch('/actualizar-ece', middleware.verifyToken, patientController.updateClinicalRecord);
router.patch('/actualizar-alergia', middleware.verifyToken, patientController.updateAllergy);
router.patch('/actualizar-condicion', middleware.verifyToken, patientController.updateCondition);
router.patch('/actualizar-medicacion', middleware.verifyToken, patientController.updateMedication);

//gets
router.get('/tipos-sangre', patientController.getAllBloodTypes); // TODO
router.get('/ece/:userProfileId', middleware.verifyToken, patientController.getClinicalRecordByUser); // TODO
router.get('/alergias/:clinicalRecordId', middleware.verifyToken, patientController.getAllergiesByRecord); // TODO
router.get('/condiciones/:clinicalRecordId', middleware.verifyToken, patientController.getConditionsByRecord); // TODO
router.get('/medicamentos/:clinicalRecordId', middleware.verifyToken, patientController.getMedicationsByRecord); // TODO

// gets de administración (todos los registros, con datos del paciente ya unidos)
router.get('/expedientes-todos', middleware.verifyToken, patientController.getAllClinicalRecords);
router.get('/alergias-todas', middleware.verifyToken, patientController.getAllAllergies);
router.get('/condiciones-todas', middleware.verifyToken, patientController.getAllConditions);
router.get('/medicamentos-todos', middleware.verifyToken, patientController.getAllMedications);

// historial de activaciones/desactivaciones
router.get('/historial-alergia/:patientAllergyId', middleware.verifyToken, patientController.getAllergyHistory);
router.get('/historial-condicion/:patientConditionId', middleware.verifyToken, patientController.getConditionHistory);
router.get('/historial-medicamento/:patientMedicationId', middleware.verifyToken, patientController.getMedicationHistory);

module.exports = router