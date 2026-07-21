const emergencyModel = require('../models/emergency');
const configSocket = require('../config/socket')

// ─── POST ────────────────────────────────────────────────────────────────────

// Solo el despachador registra emergencias
const registerEmergency = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerEmergency(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.getEmergencyById(r.insertId, (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({message: "Error del servidor."});
                    } else {
                        io.to('paramedic').to('hospital').to('dispatcher').emit('eventEmergencyRegistered', r2[0])
                        res.status(201).json({message: "Emergencia registrada con éxito.", emergencyId: r.insertId});
                    }
                });
            }
        });
    }
}

// El paramédico registra un paciente en la emergencia
const registerEmergencyPatient = (req, res) => {
        const io = configSocket.getIo();
    const allowedRoles = [2, 3];
    if (parseInt(req.decoded.roleId) !== 1 && !allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerEmergencyPatient(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                //se muestra la info del paciente al frontend inmediatamente se registra
                const { emergencyId, userProfileId, notes, destinationInstitutionId, ambulanceId } = req.body;
                io.to('hospital').emit('eventPatientRegistered', { emergencyId, userProfileId, notes, destinationInstitutionId, ambulanceId })
                res.status(201).json({message: "Paciente registrado en la emergencia.", emergencyPatientId: r.insertId});
            }
        });
    }
}

// Solo el paramédico registra notas de urgencia
const registerEmergencyNote = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 3 || parseInt(req.decoded.roleId) === 1)) {
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
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.registerAssignment(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                // Cambiar estado ambulancia a "En camino"
                emergencyModel.updateAmbulanceStatus(req.body.ambulanceIds, 2, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                const { emergencyId, ambulanceIds, userProfileId, notes } = req.body;
                io.to('paramedic').to('admin').to("dispatcher").emit('eventAmbulanceAssigned', { emergencyId, ambulanceIds, userProfileId, notes });
                res.status(201).json({message: "Ambulancia asignada con éxito."});
            }
        });
    }
}

// Solicitud interinstitucional y notifica al dispatcher de otra institución
const registerInterInstitutionalRequest = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
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

const createTriageLevel = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.createTriageLevel(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Nivel de triage creado con éxito."});
            }
        });
    }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

// Actualizar estado de emergencia y notificar a todos los roles relevantes
const updateEmergencyStatus = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
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

// Cierra la emergencia y notifica a todos
const closeEmergency = (req, res) => {
    const io = configSocket.getIo();
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
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
    if (!(parseInt(req.decoded.roleId) === 2 || parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {assignmentId} = req.body;
        emergencyModel.unassignAmbulance(assignmentId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.updateAmbulanceStatus(req.body.ambulanceIds, 1, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                io.to('admin').to('dispatcher').emit('eventAmbulanceUnassigned', { assignmentId });
                res.status(200).json({message: "Ambulancia desasignada."});
            }
        });
    }
}

// Cancela una solicitud interinstitucional. A diferencia de respondInterInstitutionalRequest
// (restringido a roles 1/3), esto lo hace exclusivamente quien la creó — la comparación usa
// req.decoded.userProfileId (del JWT), nunca un valor mandado por el cliente.
const cancelInterInstitutionalRequest = (req, res) => {
    const { interInstitutionalRequestId } = req.body;
    const userProfileId = req.decoded.userProfileId;
    const isAdmin = parseInt(req.decoded.roleId) === 1;
    emergencyModel.cancelInterInstitutionalRequest(interInstitutionalRequestId, userProfileId, isAdmin, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else if (r.affectedRows === 0) {
            return res.status(403).json({message: "No puedes cancelar esta solicitud."});
        } else {
            res.status(200).json({message: "Solicitud cancelada."});
        }
    });
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

// Editar nombre/descripción de los catálogos (distinto de updateEmergencyStatus, que
// cambia el estado de una emergencia puntual, no el catálogo)
const updateEmergencyType = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyTypeId, name, description} = req.body;
        emergencyModel.updateEmergencyType(emergencyTypeId, name, description, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Tipo de emergencia actualizado."});
        });
    }
}

const updateEmergencyStatusCatalog = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {emergencyStatusId, name, description} = req.body;
        emergencyModel.updateEmergencyStatusCatalog(emergencyStatusId, name, description, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Estado de emergencia (catálogo) actualizado."});
        });
    }
}

const updateRequestStatus = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {requestStatusId, name, description} = req.body;
        emergencyModel.updateRequestStatus(requestStatusId, name, description, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Estado de solicitud actualizado."});
        });
    }
}

const updateTriageLevel = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.updateTriageLevel(req.body, (e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Nivel de triage actualizado."});
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

// Pacientes en camino hacia una institución (hospital consulta la suya, admin cualquiera).
// El JWT actual no incluye institutionId (ver userModel.login), así que igual que el resto
// de endpoints existentes (p.ej. getInstitutionNotifications), se confía en el :institutionId
// que manda el frontend sin cruzarlo contra el token — inconsistencia ya existente en el
// proyecto, no se corrige aquí.
const getIncomingPatientsByInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        emergencyModel.getIncomingPatientsByInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Pacientes en camino", data: r});
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
                console.error('Error en getNotesByEmergencyPatient:', e); // agrega esto
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

// Historial de una ambulancia: todas las emergencias que ha atendido
const getAssignmentsByAmbulance = (req, res) => {
    const allowedRoles = [1, 2, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {ambulanceId} = req.params;
        emergencyModel.getAssignmentsByAmbulance(ambulanceId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Historial de la ambulancia", data: r});
            }
        });
    }
}

// Historial de emergencias de un paciente. El propio paciente puede consultar el suyo
// (comparando contra req.decoded.userProfileId), además del acceso amplio para staff (1-4).
const getEmergenciesByPatient = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    const { userProfileId } = req.params;
    const isSelf = req.decoded.userProfileId === parseInt(userProfileId);
    if (!allowedRoles.includes(parseInt(req.decoded.roleId)) && !isSelf) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getEmergenciesByPatient(userProfileId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Emergencias del paciente", data: r});
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

//--------- gets de administración: catálogos sin filtrar por is_active, el admin necesita ver todo ---------
const getAllEmergencyTypesAdmin = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllEmergencyTypesAdmin((e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Todos los tipos de emergencia (admin)", data: r});
        });
    }
}

const getAllEmergencyStatusesAdmin = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllEmergencyStatusesAdmin((e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Todos los estados de emergencia (admin)", data: r});
        });
    }
}

const getAllRequestStatusesAdmin = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllRequestStatusesAdmin((e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Todos los estados de solicitud (admin)", data: r});
        });
    }
}

const getAllTriageLevelsAdmin = (req, res) => {
    if (!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        emergencyModel.getAllTriageLevelsAdmin((e, r) => {
            if (e) return res.status(500).json({message: "Error del servidor."});
            res.status(200).json({message: "Todos los niveles de triage (admin)", data: r});
        });
    }
}

//----------------------------------------------GETs para estadísticas------------------------------//
const getEmergenciesByType = (req, res) => {
    emergencyModel.getEmergenciesByType((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Emergencias por tipo", data: r});
    });
}

const getRequestsByStatus = (req, res) => {
    emergencyModel.getRequestsByStatus((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Solicitudes por estado", data: r});
    });
}

const getResponseTimeByDay = (req, res) => {
    emergencyModel.getResponseTimeByDay((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Tiempo de respuesta por día", data: r});
    });
}

const getResponseTimeToday = (req, res) => {
    emergencyModel.getResponseTimeToday((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Tiempo de respuesta de hoy", data: r});
    });
}

const getEmergenciesByInstitution = (req, res) => {
    emergencyModel.getEmergenciesByInstitution((e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Emergencias por institución", data: r});
    });
}

//----------------------------------------------GETs de estadísticas filtradas por hospital------------------------------//
const getPatientsByTypeForInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        emergencyModel.getPatientsByTypeForInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Pacientes por tipo", data: r});
            }
        });
    }
}

const getPatientsByMonthForInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        emergencyModel.getPatientsByMonthForInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Pacientes por mes", data: r});
            }
        });
    }
}

const getAvgTransferTimeForInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        emergencyModel.getAvgTransferTimeForInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Tiempo promedio de traslado", data: r});
            }
        });
    }
}

module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote,
    registerAssignment, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus, createTriageLevel,
    // PATCH
    updateEmergencyStatus, closeEmergency,
    unassignAmbulance, respondInterInstitutionalRequest, cancelInterInstitutionalRequest,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    updateEmergencyType, updateEmergencyStatusCatalog, updateRequestStatus, updateTriageLevel,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getIncomingPatientsByInstitution, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getAssignmentsByAmbulance, getEmergenciesByPatient,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels,
    getAllEmergencyTypesAdmin, getAllEmergencyStatusesAdmin, getAllRequestStatusesAdmin, getAllTriageLevelsAdmin,
    //GETs de estadísticas
    getEmergenciesByType, getRequestsByStatus, getResponseTimeByDay, getResponseTimeToday, getEmergenciesByInstitution,
    //GETs de estadísticas filtradas por hospital
    getPatientsByTypeForInstitution, getPatientsByMonthForInstitution, getAvgTransferTimeForInstitution
}