const emergencyModel = require('../models/emergency');
const configSocket = require('../config/socket')

// ─── POST ────────────────────────────────────────────────────────────────────

// Solo el despachador registra emergencias
const registerEmergency = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerEmergency(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const {
                    emergencyTypeId,
                    emergencyStatusId,
                    userProfileId,
                    longitude,
                    latitude,
                    description,
                    reporterName,
                    reporterPhone,
                    numPatients
                } = req.body;
                io.to('paramedic').to('hospital').emit('eventEmergencyRegistered', {emergencyTypeId, emergencyStatusId, userProfileId, longitude,
                    latitude, description, reporterName, reporterPhone, numPatients})
                res.status(201).json({message: "Emergencia registrada con éxito.", emergencyId: r.insertId});
            }
        });
    }
}

// El paramédico registra un paciente en la emergencia
const registerEmergencyPatient = (req, res) => {
        const io = configSocket.getIo();
    const allowedRoles = [2, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerEmergencyPatient(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                //se muestra la info del paciente al frontend inmediatamente se registra 
                const { emergencyId, userProfileId, notes } = req.body;
                io.to('hospital').emit('eventPatientRegistered', { emergencyId, userProfileId, notes })
                res.status(201).json({message: "Paciente registrado en la emergencia.", emergencyPatientId: r.insertId});
            }
        });
    }
}

// Solo el paramédico registra notas de urgencia
const registerEmergencyNote = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 3)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerEmergencyNote(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const {
            emergencyPatientId,
            userProfileId,
            triageLevelId,
            bloodPressure,
            heartRate,
            temperature,
            oxygenSaturation,
            respiratoryRate,
            consciousnessLevel,
            initialDiagnosis,
            treatmentApplied,
            patientStatus
            } = req.body;
                io.to('hospital').emit('eventEmergencyNoteRegistered', {
            emergencyPatientId, userProfileId, triageLevelId, bloodPressure, heartRate, temperature,
            oxygenSaturation, respiratoryRate, consciousnessLevel, initialDiagnosis, treatmentApplied, patientStatus})
                res.status(201).json({message: "Nota de urgencia registrada con éxito."});
            }
        });
    }
}

// Despachador asigna ambulancia y notifica al paramédico que fue asignado
const registerAssignment = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerAssignment(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                // Cambiar estado ambulancia a "En camino"
                emergencyModel.updateAmbulanceStatus(req.body.ambulanceId, 2, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                const { emergencyId, ambulanceId, userProfileId, notes } = req.body;
                io.to('paramedic').to('admin').emit('eventAmbulanceAssigned', { emergencyId, ambulanceId, userProfileId, notes });
                res.status(201).json({message: "Ambulancia asignada con éxito.", assignmentId: r.insertId});
            }
        });
    }
}

// Solicitud interinstitucional y notifica al dispatcher de otra institución
const registerInterInstitutionalRequest = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerInterInstitutionalRequest(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const { emergencyId, requestingInstitutionId, receivingInstitutionId } = req.body;
                io.to('paramedic').to('admin').emit('eventInterInstitutionalRequest', { emergencyId, requestingInstitutionId, receivingInstitutionId });
                res.status(201).json({message: "Solicitud interinstitucional enviada.", requestId: r.insertId});
            }
        });
    }
}

// Solo el admin puede crear tipos y estados de catálogo
const createEmergencyType = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {name, description} = req.body;
        emergencyModel.createEmergencyType(name, description, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Tipo de emergencia creado con éxito."});
            }
        });
    }
}

const createEmergencyStatus = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {name, description} = req.body;
        emergencyModel.createEmergencyStatus(name, description, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Estado de emergencia creado con éxito."});
            }
        });
    }
}

const createRequestStatus = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {name, description} = req.body;
        emergencyModel.createRequestStatus(name, description, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Estado de solicitud creado con éxito."});
            }
        });
    }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

// Actualizar estado de emergencia y notificar a todos los roles relevantes
const updateEmergencyStatus = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId, emergencyStatusId} = req.body;
        emergencyModel.updateEmergencyStatus(emergencyId, emergencyStatusId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                io.to('paramedic').to('hospital').to('admin').emit('eventEmergencyStatusUpdated', { emergencyId, emergencyStatusId });
                res.status(200).json({message: "Estado de emergencia actualizado."});
            }
        });
    }
}

// Despachador asigna ambulancia a la emergencia
const updateEmergencyAmbulance = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId, ambulanceId} = req.body;
        emergencyModel.updateEmergencyAmbulance(emergencyId, ambulanceId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Ambulancia asignada a la emergencia."});
            }
        });
    }
}

// Cierra la emergencia y notifica a todos
const closeEmergency = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId} = req.body;
        emergencyModel.closeEmergency(emergencyId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                io.to('paramedic').to('hospital').to('admin').emit('eventEmergencyClosed', { emergencyId });
                res.status(200).json({message: "Emergencia cerrada con éxito."});
            }
        });
    }
}

// Desasignar ambulancia y notificar al dispatcher
const unassignAmbulance = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {assignmentId} = req.body;
        emergencyModel.unassignAmbulance(assignmentId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.updateAmbulanceStatus(req.body.ambulanceId, 1, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                io.to('admin').to('dispatcher').emit('eventAmbulanceUnassigned', { assignmentId });
                res.status(200).json({message: "Ambulancia desasignada."});
            }
        });
    }
}

// Responder solicitud interinstitucional. Notifica al dispatcher que la solicitó
const respondInterInstitutionalRequest = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.respondInterInstitutionalRequest(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const { interInstitutionalRequestId, requestStatusId, rejectionReason } = req.body;
                io.to('dispatcher').to('admin').emit('eventInterInstitutionalRequestResponded', { interInstitutionalRequestId, requestStatusId, rejectionReason });
                res.status(200).json({message: "Solicitud respondida."});
            }
        });
    }
}

const toggleEmergencyType = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyTypeId} = req.body;
        emergencyModel.toggleEmergencyType(emergencyTypeId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de tipo de emergencia actualizado."});
            }
        });
    }
}

const toggleEmergencyStatus = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyStatusId} = req.body;
        emergencyModel.toggleEmergencyStatus(emergencyStatusId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de emergencia actualizado."});
            }
        });
    }
}

const toggleRequestStatus = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {requestStatusId} = req.body;
        emergencyModel.toggleRequestStatus(requestStatusId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de solicitud actualizado."});
            }
        });
    }
}

const toggleTriageLevel = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {triageLevelId} = req.body;
        emergencyModel.toggleTriageLevel(triageLevelId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de nivel de triage actualizado."});
            }
        });
    }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

// Emergencias activas — despachador y admin las ven todas, paramédico y hospital también
const getAllActiveEmergencies = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllActiveEmergencies((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Emergencias activas", data: r});
            }
        });
    }
}

// Historial — solo admin y despachador
const getAllClosedEmergencies = (req, res) => {
    const allowedRoles = [1, 2];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllClosedEmergencies((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Historial de emergencias", data: r});
            }
        });
    }
}

const getEmergencyById = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId} = req.params;
        emergencyModel.getEmergencyById(emergencyId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                if (r.length === 0) {
                    return res.status(404).json({message: "Emergencia no encontrada.", data: null});
                } else {
                    res.status(200).json({message: "Emergencia encontrada", data: r[0]});
                }
            }
        });
    }
}

const getPatientsByEmergency = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId} = req.params;
        emergencyModel.getPatientsByEmergency(emergencyId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Pacientes de la emergencia", data: r});
            }
        });
    }
}

const getNotesByEmergencyPatient = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyPatientId} = req.params;
        emergencyModel.getNotesByEmergencyPatient(emergencyPatientId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Notas de urgencia", data: r});
            }
        });
    }
}

const getAssignmentsByEmergency = (req, res) => {
    const allowedRoles = [1, 2, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyId} = req.params;
        emergencyModel.getAssignmentsByEmergency(emergencyId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Asignaciones de la emergencia", data: r});
            }
        });
    }
}

const getPendingInterInstitutionalRequests = (req, res) => {
    const allowedRoles = [1, 2];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getPendingInterInstitutionalRequests((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Solicitudes pendientes", data: r});
            }
        });
    }
}

const getAllInterInstitutionalRequests = (req, res) => {
    const allowedRoles = [1, 2];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllInterInstitutionalRequests((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Todas las solicitudes interinstitucionales", data: r});
            }
        });
    }
}

// Catálogos — públicos
const getAllEmergencyTypes = (req, res) => {
    emergencyModel.getAllEmergencyTypes((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Tipos de emergencia", data: r});
        }
    });
}

const getAllEmergencyStatuses = (req, res) => {
    emergencyModel.getAllEmergencyStatuses((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Estados de emergencia", data: r});
        }
    });
}

const getAllRequestStatuses = (req, res) => {
    emergencyModel.getAllRequestStatuses((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Estados de solicitud", data: r});
        }
    });
}

const getAllTriageLevels = (req, res) => {
    emergencyModel.getAllTriageLevels((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Niveles de triage", data: r});
        }
    });
}

module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote,
    registerAssignment, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus,
    // PATCH
    updateEmergencyStatus, updateEmergencyAmbulance, closeEmergency,
    unassignAmbulance, respondInterInstitutionalRequest,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels
}