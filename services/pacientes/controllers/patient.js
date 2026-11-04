const patientModel = require('../models/patient');

// Resuelve el clinical_record_id del propio paciente (rol 5). Devuelve null si no
// tiene expediente y un error real si la consulta falló.
const getOwnClinicalRecordId = (userProfileId, callback) => {
    patientModel.getClinicalRecordByUser(userProfileId, (e, r) => {
        if (e) return callback(e);
        callback(null, r.length > 0 ? r[0].clinical_record_id : null);
    })
}


// Controller para registro de un único expediente clínico electrónico (ECE) por paciente
const createClinicalRecord = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (allowedRoles.includes(parseInt(req.decoded.roleId))) {
        // un paciente (rol 5) SIEMPRE crea su propio expediente, nunca de otro usuario
        if (parseInt(req.decoded.roleId) === 5) {
            req.body.userProfileId = req.decoded.userProfileId;
        }
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
    }
    // un paciente (rol 5) solo registra alergias en SU PROPIO expediente
    if (parseInt(req.decoded.roleId) === 5) {
        getOwnClinicalRecordId(req.decoded.userProfileId, (e, clinicalRecordId) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!clinicalRecordId) return res.status(404).json({message: "Expediente no encontrado. Crea primero tu expediente clínico."});
            req.body.clinicalRecordId = clinicalRecordId;
            patientModel.registerAllergy(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Alergia registrada con éxito"})
            })
        })
    } else {
        patientModel.registerAllergy(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Alergia registrada con éxito"})
        })
    }
}

//Controller para activar/desactivar la alergia de un paciente
const toggleAllergy = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientAllergyId } = req.body;
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.allergyBelongsToUser(patientAllergyId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.toggleAllergy(patientAllergyId, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Estado de alergia actualizado"})
            })
        })
    } else {
        patientModel.toggleAllergy(patientAllergyId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Estado de alergia actualizado"})
        })
    }
}

//Controller para registro de una condición por paciente
const registerCondition = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    if (parseInt(req.decoded.roleId) === 5) {
        getOwnClinicalRecordId(req.decoded.userProfileId, (e, clinicalRecordId) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!clinicalRecordId) return res.status(404).json({message: "Expediente no encontrado. Crea primero tu expediente clínico."});
            req.body.clinicalRecordId = clinicalRecordId;
            patientModel.registerCondition(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(201).json({message: "Condición registrada con éxito"})
            })
        })
    } else {
        patientModel.registerCondition(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(201).json({message: "Condición registrada con éxito"})
        })
    }
}

//Controller para activar/desactivar una condición de un paciente
const toggleCondition = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientConditionId } = req.body;
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.conditionBelongsToUser(patientConditionId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.toggleCondition(patientConditionId, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Estado de condición actualizado"})
            })
        })
    } else {
        patientModel.toggleCondition(patientConditionId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Estado de condición actualizado"})
        })
    }
}

//Controller para registro de una medicación por paciente
const registerMedication = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    if (parseInt(req.decoded.roleId) === 5) {
        getOwnClinicalRecordId(req.decoded.userProfileId, (e, clinicalRecordId) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!clinicalRecordId) return res.status(404).json({message: "Expediente no encontrado. Crea primero tu expediente clínico."});
            req.body.clinicalRecordId = clinicalRecordId;
            patientModel.registerMedication(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(201).json({message: "Medicamento registrado con éxito"})
            })
        })
    } else {
        patientModel.registerMedication(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(201).json({message: "Medicamento registrado con éxito"})
        })
    }
}

//Controller para activar/desactivar la medicación de un paciente
const toggleMedication = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    const { patientMedicationId } = req.body;
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.medicationBelongsToUser(patientMedicationId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.toggleMedication(patientMedicationId, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Estado de medicamento actualizado"})
            })
        })
    } else {
        patientModel.toggleMedication(patientMedicationId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Estado de medicamento actualizado"})
        })
    }
}

//-Todos los updates------------------------------------------------

//Controller para editar los datos generales de un expediente clínico (ECE)
const updateClinicalRecord = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})

    // un paciente (rol 5) solo puede editar SU PROPIO expediente: resolvemos el
    // clinical_record_id de su perfil y sobreescribimos el que venga del body
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.getClinicalRecordByUser(req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (r.length === 0) return res.status(404).json({message: "Expediente no encontrado."});
            req.body.clinicalRecordId = r[0].clinical_record_id;
            patientModel.updateClinicalRecord(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Expediente actualizado con éxito"})
            })
        })
    } else {
        patientModel.updateClinicalRecord(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Expediente actualizado con éxito"})
        })
    }
}

//Controller para editar una alergia de un paciente
const updateAllergy = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.allergyBelongsToUser(req.body.patientAllergyId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.updateAllergy(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Alergia actualizada con éxito"})
            })
        })
    } else {
        patientModel.updateAllergy(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Alergia actualizada con éxito"})
        })
    }
}

//Controller para editar una condición de un paciente
const updateCondition = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.conditionBelongsToUser(req.body.patientConditionId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.updateCondition(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Condición actualizada con éxito"})
            })
        })
    } else {
        patientModel.updateCondition(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Condición actualizada con éxito"})
        })
    }
}

//Controller para editar un medicamento de un paciente
const updateMedication = (req, res) => {
    const allowedRoles = [1, 3, 5];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId)))
        return res.status(403).json({message: "Acceso no autorizado"})
    if (parseInt(req.decoded.roleId) === 5) {
        patientModel.medicationBelongsToUser(req.body.patientMedicationId, req.decoded.userProfileId, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"});
            if (!r[0] || r[0].total === 0) return res.status(403).json({message: "Acceso no autorizado"});
            patientModel.updateMedication(req.body, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor"})
                res.status(200).json({message: "Medicamento actualizado con éxito"})
            })
        })
    } else {
        patientModel.updateMedication(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor"})
            res.status(200).json({message: "Medicamento actualizado con éxito"})
        })
    }
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
            patientModel.getAllergiesByRecord(clinicalRecordId, true, (e2, r2) => {
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
                    patientModel.getConditionsByRecord(clinicalRecordId, true, (e2, r2) => {
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
                    patientModel.getMedicationsByRecord(clinicalRecordId, true, (e2, r2) => {
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

//-Historial de activaciones/desactivaciones (admin) -------------------------------------------

const getAllergyHistory = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) return res.status(403).json({message: "Acceso no autorizado"})
    const { patientAllergyId } = req.params;
    patientModel.getAllergyHistory(patientAllergyId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Historial de la alergia", history: r})
    })
}

const getConditionHistory = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) return res.status(403).json({message: "Acceso no autorizado"})
    const { patientConditionId } = req.params;
    patientModel.getConditionHistory(patientConditionId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Historial de la condición", history: r})
    })
}

const getMedicationHistory = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) return res.status(403).json({message: "Acceso no autorizado"})
    const { patientMedicationId } = req.params;
    patientModel.getMedicationHistory(patientMedicationId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Historial del medicamento", history: r})
    })
}

//-Todos los gets de administración: todos los registros, sin necesitar un expediente puntual----

const getAllClinicalRecords = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso no autorizado"})
    }
    patientModel.getAllClinicalRecords((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Todos los expedientes clínicos", clinicalRecords: r})
    })
}

const getAllAllergies = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso no autorizado"})
    }
    patientModel.getAllAllergies((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Todas las alergias", allergies: r})
    })
}

const getAllConditions = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso no autorizado"})
    }
    patientModel.getAllConditions((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Todas las condiciones", conditions: r})
    })
}

const getAllMedications = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso no autorizado"})
    }
    patientModel.getAllMedications((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."})
        res.status(200).json({message: "Todos los medicamentos", medications: r})
    })
}

module.exports = {
    createClinicalRecord,
    registerAllergy, toggleAllergy,
    registerCondition, toggleCondition,
    registerMedication, toggleMedication,
    updateClinicalRecord, updateAllergy, updateCondition, updateMedication,
    getAllergyHistory, getConditionHistory, getMedicationHistory,
    getClinicalRecordByUser,
    getAllergiesByRecord,
    getConditionsByRecord,
    getMedicationsByRecord,
    getAllBloodTypes,
    getAllClinicalRecords, getAllAllergies, getAllConditions, getAllMedications
}