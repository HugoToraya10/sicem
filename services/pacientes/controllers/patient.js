const patientModel = require('../models/patient');


// Controller para registro de un único expediente clínico electrónico (ECE) por paciente
const createClinicalRecord = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (allowedRoles.includes(parseInt(req.decoded.roleId))) {
        patientModel.createClinicalRecord(req.body, (e, r) => {
            if(e){
                if (e.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({message: "Este usuario ya tiene un expediente."})
                } else {
                return res.status(500).json({message: "Error del servidor"})
                }
            } else {
                res.status(201).json({message: "ECE registrado con éxito"})
            }
        })
    } else {
        return res.status(403).json({message:"Acceso no autorizado"})
    }
}

//Controller para registro de una alergia por paciente
const registerAllergy = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))){
        return res.status(403).json({message: "Acceso no autorizado"})
    } else {
        patientModel.registerAllergy(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor"})
            } else {
                res.status(200).json({message: "Alergia registrada con éxito"})
            }
        })
    }
}

//Controller para activar/desactivar la alergia de un paciente
const toggleAllergy = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientAllergyId } = req.body;
    patientModel.toggleAllergy(patientAllergyId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor"})
        res.status(200).json({message: "Estado de alergia actualizado"})
    })
}

//Controller para registro de una condición por paciente
const registerCondition = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    patientModel.registerCondition(req.body, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor"})
        res.status(201).json({message: "Condición registrada con éxito"})
    })
}

//Controller para activar/desactivar una condición de un paciente
const toggleCondition = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientConditionId } = req.body;
    patientModel.toggleCondition(patientConditionId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor"})
        res.status(200).json({message: "Estado de condición actualizado"})
    })
}

//Controller para registro de una medicación por paciente
const registerMedication = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    patientModel.registerMedication(req.body, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor"})
        res.status(201).json({message: "Medicamento registrado con éxito"})
    })
}

//Controller para activar/desactivar la medicación de un paciente
const toggleMedication = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientMedicationId } = req.body;
    patientModel.toggleMedication(patientMedicationId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor"})
        res.status(200).json({message: "Estado de medicamento actualizado"})
    })
}



//-Todos los gets de cada tabla para obtener datos------------------------------

//Controller para obtener un expediente clínico (ECE) por ID del perfil del paciente
const getClinicalRecordByUser = (req, res) => {
    allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        //si es un paciente quien solicita información
        const userProfileId = req.decoded.userProfileId;
        //solo se solicita su información siempre si el rol es 5
        patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
            if(e) {
                return res.status(500).json({message: "Error del servidor."})
            } else {
                res.status(200).json({message:"ECE del paciente", clinicalRecord: r});
            }
        })
    } else {
        const { userProfileId } = req.params;
        patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
            if (e){
                return res.status(500).json({message: "Error del servidor."})
            } else {
                res.status(200).json({message: "ECE obtenido", clinicalRecord: r})
            }
        })
    }
}


//Controller para obtener la alergia de cierto expediente clínico (ECE)
const getAllergiesByRecord = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        // paciente solicita sus propias alergias
        const userProfileId = req.decoded.userProfileId;
        // primero se agarra el clinicalRecordId del paciente
        patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            if (r.length === 0) return res.status(404).json({message: "Expediente no encontrado."});
            const clinicalRecordId = r[0].clinical_record_id;
            patientModel.getAllergiesByRecord(clinicalRecordId, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor."});
                res.status(200).json({message: "Alergias del paciente", allergies: r2});
            });
        });
    } else {
        const { clinicalRecordId } = req.params;
        patientModel.getAllergiesByRecord(clinicalRecordId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Alergias obtenidas", allergies: r});
        });
    }
}


//Controller para obtener la condición de cierto expediente clínico (ECE)
const getConditionsByRecord = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        const userProfileId = req.decoded.userProfileId;
        patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                if (r.length === 0) {
                    return res.status(404).json({message: "Expediente no encontrado."});
                } else {
                    const clinicalRecordId = r[0].clinical_record_id;
                    patientModel.getConditionsByRecord(clinicalRecordId, (e2, r2) => {
                        if (e2) {
                            return res.status(500).json({message: "Error del servidor."});
                        } else {
                            res.status(200).json({message: "Condiciones del paciente", conditions: r2});
                        }
                    });
                }
            }
        });
    } else {
        const { clinicalRecordId } = req.params;
        patientModel.getConditionsByRecord(clinicalRecordId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Condiciones obtenidas", conditions: r});
            }
        });
    }
}

//Controller para obtener la medicación de cierto expediente clínico (ECE)
const getMedicationsByRecord = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        const userProfileId = req.decoded.userProfileId;
        patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                if (r.length === 0) {
                    return res.status(404).json({message: "Expediente no encontrado."});
                } else {
                    const clinicalRecordId = r[0].clinical_record_id;
                    patientModel.getMedicationsByRecord(clinicalRecordId, (e2, r2) => {
                        if (e2) {
                            return res.status(500).json({message: "Error del servidor."});
                        } else {
                            res.status(200).json({message: "Medicamentos del paciente", medications: r2});
                        }
                    });
                }
            }
        });
    } else {
        const { clinicalRecordId } = req.params;
        patientModel.getMedicationsByRecord(clinicalRecordId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Medicamentos obtenidos", medications: r});
            }
        });
    }
}

//Controller para obtener los tipos de sangre registrados (no importa el rol)
const getAllBloodTypes = (req, res) => {
    patientModel.getAllBloodTypes((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Tipos de sangre", bloodTypes: r});
        }
    });
}


module.exports = { 
    createClinicalRecord, 
    registerAllergy, toggleAllergy, 
    registerCondition, toggleCondition, 
    registerMedication, toggleMedication,
    getClinicalRecordByUser,
    getAllergiesByRecord,
    getConditionsByRecord,
    getMedicationsByRecord,
    getAllBloodTypes
}