const emergencyModel = require('../models/emergency');
const configSocket = require('../config/socket')
const { sendPushNotification } = require('../config/firebase')

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
        const { destinationInstitutionId, emergencyId, ambulanceId, userProfileId, notes } = req.body;
        if (destinationInstitutionId === undefined || destinationInstitutionId === null || destinationInstitutionId === '') {
            return res.status(400).json({message: "Debes asignar un hospital destino para este paciente."});
        }

        const insertPatient = () => {
            emergencyModel.registerEmergencyPatient(req.body, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    // Se muestra la info del paciente al frontend inmediatamente se
                    // registra — también a 'paramedic' (antes solo llegaba a
                    // 'hospital'), para que sicem-mobile (paciente.js) vea al
                    // paciente recién registrado sin tener que salir y volver a
                    // entrar a la pestaña.
                    io.to('hospital').to('paramedic').emit('eventPatientRegistered', { emergencyId, userProfileId, notes, destinationInstitutionId, ambulanceId })
                    res.status(201).json({message: "Paciente registrado en la emergencia.", emergencyPatientId: r.insertId});
                }
            });
        }

        if (ambulanceId) {
            emergencyModel.getConflictingAmbulanceDestination(emergencyId, ambulanceId, destinationInstitutionId, (eC, rC) => {
                if (eC) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (rC.length > 0) {
                    return res.status(400).json({message: "Esa unidad ya tiene asignado otro hospital destino distinto en esta emergencia. Una ambulancia no puede llevar pacientes a dos hospitales a la vez — asígnales la misma unidad o unidades distintas."});
                } else {
                    insertPatient();
                }
            });
        } else {
            insertPatient();
        }
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
            glucoseLevel,
            consciousnessLevel,
            glasgowScale,
            painScale,
            pupils,
            initialDiagnosis,
            treatmentApplied,
            patientStatus
            } = req.body;
                io.to('hospital').emit('eventEmergencyNoteRegistered', {
            emergencyPatientId, userProfileId, triageLevelId, bloodPressure, heartRate, temperature,
            oxygenSaturation, respiratoryRate, glucoseLevel, consciousnessLevel, glasgowScale, painScale, pupils,
            initialDiagnosis, treatmentApplied, patientStatus})
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
        const { emergencyId: checkEmergencyId, ambulanceIds: checkAmbulanceIds } = req.body;
        // Bloquea ANTES de insertar si alguna de las unidades ya está atada a
        // otra emergencia sin cerrar — ver getConflictingOpenAssignments (el
        // bug real que esto corrige: una unidad terminó "atendiendo" dos
        // emergencias a la vez porque nada lo impedía).
        emergencyModel.getConflictingOpenAssignments(checkAmbulanceIds, checkEmergencyId, (eConf, rConf) => {
        if (eConf) {
            return res.status(500).json({message: "Error del servidor."});
        } else if (rConf && rConf.length > 0) {
            const units = rConf.map((row) => row.unit_number || `#${row.ambulance_id}`).join(', ');
            return res.status(409).json({message: `La unidad ${units} ya está atendiendo otra emergencia sin cerrar — desasígnala primero o espera a que termine.`});
        }
        emergencyModel.registerAssignment(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                // Cambiar estado ambulancia a "En camino"
                emergencyModel.updateAmbulanceStatus(req.body.ambulanceIds, 2, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                const { emergencyId, ambulanceIds, userProfileId, notes } = req.body;
                // La emergencia pasa sola de "Registrada" a "Asignada" — antes
                // se quedaba en "Registrada" para siempre a menos que el
                // despachador la cambiara a mano por separado, aunque la
                // ambulancia ya llevara horas en camino. Solo avanza (nunca
                // retrocede una que ya iba más adelante por otra unidad).
                emergencyModel.advanceEmergencyStatus(emergencyId, 2, (e2b, r2b) => {
                    if (e2b) { console.error('Error avanzando estado de emergencia:', e2b); return; }
                    if (r2b.affectedRows > 0) {
                        io.to('admin').to('dispatcher').to('hospital').to('paramedic').emit('eventEmergencyStatusUpdated', { emergencyId, emergencyStatusId: 2 });
                    }
                });
                // Faltaba 'hospital' aquí también — misma razón que en eventAmbulanceUnassigned.
                // Ya NO se manda a 'paramedic' en general — ese room recibía esto sin
                // importar qué unidad trae cada quien. Ahora se manda la alerta completa
                // (con los datos de la emergencia) SOLO al paramédico con turno activo en
                // cada unidad asignada, vía su room personal 'user_<id>'.
                io.to('admin').to("dispatcher").to('hospital').emit('eventAmbulanceAssigned', { emergencyId, ambulanceIds, userProfileId, notes });

                emergencyModel.getEmergencyById(emergencyId, (eDetail, rDetail) => {
                    const emergencyDetail = (!eDetail && rDetail.length > 0) ? rDetail[0] : null;
                    ambulanceIds.forEach((ambulanceId) => {
                        emergencyModel.getActiveShiftUserByAmbulance(ambulanceId, (e3, r3) => {
                            if (!e3 && r3.length > 0) {
                                const assignedUserProfileId = r3[0].user_profile_id;
                                io.to('user_' + assignedUserProfileId).emit('eventEmergencyAssignedToMe', {
                                    emergencyId, ambulanceId, notes, emergency: emergencyDetail
                                });
                                // Además del socket (que solo llega con la app abierta y
                                // conectada), se manda una notificación push por FCM — así
                                // le llega al paramédico AUNQUE tenga la app cerrada. Si no
                                // tiene push_token guardado o Firebase no está configurado
                                // todavía, sendPushNotification simplemente no hace nada.
                                emergencyModel.getUserPushToken(assignedUserProfileId, (e4, r4) => {
                                    if (!e4 && r4.length > 0 && r4[0].push_token) {
                                        sendPushNotification(
                                            r4[0].push_token,
                                            'Nueva emergencia asignada',
                                            emergencyDetail?.type_name || 'Se te asignó una emergencia — abre la app.',
                                            { emergencyId, ambulanceId }
                                        );
                                    }
                                });
                            }
                            // Si nadie tiene turno activo en esta unidad, nadie recibe la
                            // alerta dirigida — no hay a quién avisarle en el celular.
                        });
                    });
                });

                res.status(201).json({message: "Ambulancia asignada con éxito."});
            }
        });
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
                // También a 'hospital' — es la institución dueña de la unidad quien
                // tiene que enterarse ya, para poder aceptar/rechazar desde sicem-desktop.
                io.to('paramedic').to('admin').to('hospital').emit('eventInterInstitutionalRequest', { emergencyId, requestingInstitutionId, receivingInstitutionId, requestId: r.insertId });
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
                // Faltaba 'dispatcher' — otro despachador con el Dashboard abierto en
                // otra sesión nunca se enteraba de este cambio en vivo, solo al
                // refrescar la página.
                io.to('paramedic').to('hospital').to('admin').to('dispatcher').emit('eventEmergencyStatusUpdated', { emergencyId, emergencyStatusId });
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
            } else if (r.blocked) {
                return res.status(409).json({message: `No se puede cerrar: hay ${r.pendingCount} paciente(s) con destino asignado que aún no han sido recibidos (pendientes o rechazados). Reasigna o confirma su recepción antes de cerrar la emergencia.`});
            } else {
                io.to('paramedic').to('hospital').to('admin').emit('eventEmergencyClosed', { emergencyId });
                res.status(200).json({message: "Emergencia cerrada con éxito."});
            }
        });
    }
}

// Válvula de escape exclusiva de rol 1 — cierra sin importar si hay pacientes
// pendientes de recepción/entrega (ambulancia cancelada, paciente rechazado y
// nunca reasignado, etc.). Exige un motivo, a diferencia del cierre normal.
const forceCloseEmergency = (req, res) => {
    const io = configSocket.getIo();
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyId, reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({message: "Debes indicar un motivo para el cierre forzado."});
        }

        const proceedToClose = () => {
            emergencyModel.forceCloseEmergency(emergencyId, reason, (e) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    io.to('paramedic').to('hospital').to('admin').to('dispatcher').emit('eventEmergencyClosed', { emergencyId, forced: true, reason });
                    res.status(200).json({message: "Emergencia cerrada de forma forzada."});
                }
            });
        }

        // Antes de cerrar, libera las camas de quien ya había reservado una
        // (Aceptada) pero nunca se confirmó entregado — este cierre significa
        // justamente que ese traslado no va a completarse.
        emergencyModel.getAcceptedUndeliveredPatients(emergencyId, (eList, patientsToRelease) => {
            if (eList || patientsToRelease.length === 0) {
                return proceedToClose();
            }
            let remaining = patientsToRelease.length;
            const onOneReleased = () => { remaining -= 1; if (remaining === 0) proceedToClose(); };
            patientsToRelease.forEach((p) => {
                emergencyModel.incrementInstitutionBeds(p.destination_institution_id, () => {
                    if (p.destination_speciality_id) {
                        emergencyModel.incrementSpecialityBeds(p.destination_institution_id, p.destination_speciality_id, onOneReleased);
                    } else {
                        onOneReleased();
                    }
                });
            });
        });
    }
}

// Desasignar ambulancia y notificar al dispatcher
// Rol 4 (hospital) puede desasignar SOLO sus propias unidades — pensado
// para cuando un paramédico reporta una falla (ver eventAmbulanceFailureReported
// en services/unidades) y el hospital dueño de esa unidad decide, de una vez,
// sacarla de la emergencia sin tener que esperar al despachador. Roles 1/2
// (admin/despachador) conservan la autoridad general, sin restricción de
// institución — ver fundamentos-legales/autoridad-crum-sobre-tamp-paramedico.txt.
const unassignAmbulance = (req, res) => {
    const io = configSocket.getIo();
    const roleId = parseInt(req.decoded.roleId);
    if (![1, 2, 4].includes(roleId)) {
        return res.status(403).json({message: "Acceso denegado."});
    }
    let {assignmentId, ambulanceIds, emergencyId} = req.body;
    // La campana de fallas reportadas (sicem-web/desktop) solo conoce
    // ambulanceId + emergencyId (lo que trae el propio reporte de falla),
    // nunca el assignmentId interno — se resuelve aquí antes de continuar.
    const { ambulanceId } = req.body;
    const { reason } = req.body; // p. ej. 'ambulance_failure' — para que sicem-mobile pueda avisarle al paramédico con un mensaje específico
    if (!assignmentId && ambulanceId && emergencyId) {
        ambulanceIds = [ambulanceId];
    }

    const resolveAssignmentIdIfNeeded = (callback) => {
        if (assignmentId) {
            // Vino solo el assignmentId (flujo viejo, EmergencyDetail.jsx) —
            // igual hace falta emergencyId para avisar por socket y revisar
            // si la emergencia se quedó sin ninguna unidad.
            if (emergencyId) return callback(null);
            return emergencyModel.getEmergencyIdByAssignment(assignmentId, (e, r) => {
                if (e || r.length === 0) return callback(new Error('No se encontró esa asignación.'));
                emergencyId = r[0].emergency_id;
                callback(null);
            });
        }
        if (!ambulanceId || !emergencyId) {
            return callback(new Error('Falta assignmentId, o ambulanceId + emergencyId.'));
        }
        emergencyModel.getOpenAssignmentId(ambulanceId, emergencyId, (e, r) => {
            if (e || r.length === 0) return callback(new Error('No se encontró una asignación abierta para esa unidad y emergencia.'));
            assignmentId = r[0].assignment_id;
            callback(null);
        });
    }

    const doUnassign = () => {
        emergencyModel.unassignAmbulance(assignmentId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.updateAmbulanceStatus(ambulanceIds, 1, (e2, r2) => {
                    if (e2) console.error('Error actualizando estado ambulancia:', e2);
                });
                // Faltaba 'hospital' — MyAmbulances.jsx (sicem-desktop) nunca se
                // enteraba de que su propia unidad volvió a estar disponible.
                // Faltaba 'paramedic' también — sicem-mobile nunca se enteraba de
                // que le quitaron su unidad de la emergencia hasta cerrar e
                // iniciar sesión de nuevo (mi-emergencia-actual solo se reconcilia
                // al reconectar el socket).
                io.to('admin').to('dispatcher').to('hospital').to('paramedic')
                    .emit('eventAmbulanceUnassigned', { assignmentId, ambulanceIds, emergencyId, reason: reason || null });

                // Si esa era la ÚLTIMA unidad activa de la emergencia, regresa a
                // "Registrada" para que el despachador la vuelva a ver como
                // pendiente de asignar — antes se quedaba en "Asignada" para
                // siempre aunque ya no tuviera ninguna ambulancia en camino.
                emergencyModel.countActiveAssignments(emergencyId, (e3, r3) => {
                    if (e3) { console.error('Error contando asignaciones activas:', e3); return; }
                    if (r3[0].total > 0) return;
                    emergencyModel.updateEmergencyStatus(emergencyId, 1, (e4, r4) => {
                        if (e4) { console.error('Error regresando emergencia a Registrada:', e4); return; }
                        io.to('admin').to('dispatcher').to('hospital').to('paramedic')
                            .emit('eventEmergencyStatusUpdated', { emergencyId, emergencyStatusId: 1, statusName: 'Registrada' });
                    });
                });

                res.status(200).json({message: "Ambulancia desasignada."});
            }
        });
    }

    resolveAssignmentIdIfNeeded((resolveError) => {
        if (resolveError) return res.status(400).json({message: resolveError.message});

        if (roleId !== 4) {
            return doUnassign();
        }

        emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (eInfo, rInfo) => {
            if (eInfo || rInfo.length === 0) {
                return res.status(500).json({message: "Error del servidor."});
            }
            const myInstitutionId = rInfo[0].institution_id;
            emergencyModel.getAmbulanceInstitutionIds(ambulanceIds, (eAmb, rAmb) => {
                if (eAmb) return res.status(500).json({message: "Error del servidor."});
                const allOwn = rAmb.length > 0 && rAmb.every((a) => parseInt(a.institution_id) === parseInt(myInstitutionId));
                if (!allOwn) {
                    return res.status(403).json({message: "Solo puedes desasignar unidades de tu propia institución."});
                }
                doUnassign();
            });
        });
    });
}

// Cancela una solicitud interinstitucional. A diferencia de respondInterInstitutionalRequest
// (restringido a roles 1/3), esto lo hace exclusivamente quien la creó — la comparación usa
// req.decoded.userProfileId (del JWT), nunca un valor mandado por el cliente.
const cancelInterInstitutionalRequest = (req, res) => {
    const io = configSocket.getIo();
    const { interInstitutionalRequestId } = req.body;
    const userProfileId = req.decoded.userProfileId;
    const isAdmin = parseInt(req.decoded.roleId) === 1;
    emergencyModel.cancelInterInstitutionalRequest(interInstitutionalRequestId, userProfileId, isAdmin, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else if (r.affectedRows === 0) {
            return res.status(403).json({message: "No puedes cancelar esta solicitud."});
        } else {
            // Una unidad cancelada ya no va a llegar — si algún paciente de esa
            // emergencia la tenía asignada de antemano (EmergencyDetail ahora deja
            // asignar unidades todavía no aceptadas), hay que soltarla.
            emergencyModel.getInterInstitutionalRequestById(interInstitutionalRequestId, (e2, r2) => {
                const ambulanceId = (!e2 && r2.length > 0) ? r2[0].ambulance_id : null;
                const emergencyId = (!e2 && r2.length > 0) ? r2[0].emergency_id : null;
                const receivingInstitutionId = (!e2 && r2.length > 0) ? r2[0].receiving_institution_id : null;
                const afterCleanup = () => {
                    // Faltaba esto — el hospital dueño de la unidad (sicem-desktop) nunca se
                    // enteraba en vivo de que ya no hacía falta responder, y se quedaba
                    // mostrando la solicitud como si siguiera pendiente hasta recargar. Ahora
                    // también incluye receivingInstitutionId — hace falta para poder avisar
                    // con sonido/notificación cuando se cancela una que YA se había aceptado
                    // (el hospital había comprometido la unidad, merece enterarse ya).
                    io.to('dispatcher').to('admin').to('hospital').emit('eventInterInstitutionalRequestResponded', { interInstitutionalRequestId, requestStatusId: 4, rejectionReason: null, ambulanceId, emergencyId, receivingInstitutionId });
                    res.status(200).json({message: "Solicitud cancelada."});
                }
                if (ambulanceId && emergencyId) {
                    emergencyModel.clearAmbulanceFromEmergencyPatients(emergencyId, ambulanceId, afterCleanup);
                } else {
                    afterCleanup();
                }
            });
        }
    });
}

// Responder solicitud interinstitucional. Antes solo dejaba a rol 3 (paramédico,
// vía sicem-mobile, que todavía no existe) o rol 1 (admin) — el hospital dueño
// de la unidad (rol 4) no podía aceptar/rechazar nada desde sicem-desktop, así
// que la ambulancia nunca salía de "Pendiente". También faltaba comprobar que
// quien responde de verdad pertenece a la institución receptora — sin eso,
// cualquier hospital podía aceptar la solicitud de otro.
// Activa de verdad una unidad interinstitucional que ACABA de ser aceptada
// por su propia institución — hasta este punto (nunca antes) es que la
// unidad "responde": se crea su asignación real (antes NO existía ninguna
// fila en `assignments` para unidades prestadas, así que ni el despachador
// que la pidió la veía "asignada" igual que a las propias, ni — el bug real
// que reportó Hugo — el paramédico que la maneja se enteraba NUNCA de esta
// emergencia, ni antes ni después de que su hospital autorizara el
// préstamo, porque nada le avisaba). Aquí se reutiliza exactamente el mismo
// patrón que ya usa registerAssignment para las unidades propias: asignación
// + estado "En camino" + aviso por socket y push SOLO al paramédico con
// turno activo en esa unidad.
const activateAcceptedExternalUnit = (io, ambulanceId, emergencyId, respondingUserProfileId, done) => {
    emergencyModel.registerAssignment({ emergencyId, ambulanceIds: [ambulanceId], userProfileId: respondingUserProfileId, notes: null }, (eAssign) => {
        if (eAssign) console.error('Error creando asignación para unidad interinstitucional aceptada:', eAssign);
        emergencyModel.updateAmbulanceStatus([ambulanceId], 2, (eStatus) => {
            if (eStatus) console.error('Error actualizando estado de unidad interinstitucional aceptada:', eStatus);
        });
        // Misma lógica que registerAssignment: la emergencia pasa sola a
        // "Asignada" en cuanto tiene una unidad de verdad trabajando en ella
        // (esta unidad prestada apenas ahora cuenta como tal).
        emergencyModel.advanceEmergencyStatus(emergencyId, 2, (eAdv, rAdv) => {
            if (eAdv) { console.error('Error avanzando estado de emergencia (unidad interinstitucional):', eAdv); return; }
            if (rAdv.affectedRows > 0) {
                io.to('admin').to('dispatcher').to('hospital').to('paramedic').emit('eventEmergencyStatusUpdated', { emergencyId, emergencyStatusId: 2 });
            }
        });
        emergencyModel.getEmergencyById(emergencyId, (eDetail, rDetail) => {
            const emergencyDetail = (!eDetail && rDetail.length > 0) ? rDetail[0] : null;
            emergencyModel.getActiveShiftUserByAmbulance(ambulanceId, (e3, r3) => {
                if (!e3 && r3.length > 0) {
                    const assignedUserProfileId = r3[0].user_profile_id;
                    io.to('user_' + assignedUserProfileId).emit('eventEmergencyAssignedToMe', {
                        emergencyId, ambulanceId, notes: null, emergency: emergencyDetail
                    });
                    emergencyModel.getUserPushToken(assignedUserProfileId, (e4, r4) => {
                        if (!e4 && r4.length > 0 && r4[0].push_token) {
                            sendPushNotification(
                                r4[0].push_token,
                                'Nueva emergencia asignada',
                                emergencyDetail?.type_name || 'Tu hospital autorizó prestar tu unidad a otra institución — abre la app.',
                                { emergencyId, ambulanceId }
                            );
                        }
                    });
                }
                // Si nadie tiene turno activo en esa unidad ahora mismo, no hay a
                // quién avisarle directamente — igual que en registerAssignment.
                done();
            });
        });
    });
}

const respondInterInstitutionalRequest = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 3, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { interInstitutionalRequestId, requestStatusId, rejectionReason } = req.body;

        const proceed = () => {
            emergencyModel.respondInterInstitutionalRequest(req.body, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    // Rechazada (3) = esa unidad ya no va a llegar. Si algún paciente de
                    // esa emergencia la tenía asignada de antemano, hay que soltarla —
                    // "déjame asignarla ya, si la rechazan se le pone otra" es justo lo
                    // que se pidió, y esto es la mitad de "se le pone otra": primero hay
                    // que soltar la que ya no sirve.
                    emergencyModel.getInterInstitutionalRequestById(interInstitutionalRequestId, (e2, r2) => {
                        const ambulanceId = (!e2 && r2.length > 0) ? r2[0].ambulance_id : null;
                        const emergencyId = (!e2 && r2.length > 0) ? r2[0].emergency_id : null;
                        const receivingInstitutionId = (!e2 && r2.length > 0) ? r2[0].receiving_institution_id : null;
                        const afterCleanup = () => {
                            io.to('dispatcher').to('admin').to('hospital').emit('eventInterInstitutionalRequestResponded', { interInstitutionalRequestId, requestStatusId, rejectionReason, ambulanceId, emergencyId, receivingInstitutionId });
                            res.status(200).json({message: "Solicitud respondida."});
                        }
                        if (parseInt(requestStatusId) === 3 && ambulanceId && emergencyId) {
                            emergencyModel.clearAmbulanceFromEmergencyPatients(emergencyId, ambulanceId, afterCleanup);
                        } else if (parseInt(requestStatusId) === 2 && ambulanceId && emergencyId) {
                            activateAcceptedExternalUnit(io, ambulanceId, emergencyId, req.decoded.userProfileId, afterCleanup);
                        } else {
                            afterCleanup();
                        }
                    });
                }
            });
        }

        // Antes solo se checaba "ya fue respondida" para roles 3/4 — un admin
        // (rol 1) podía llamar esto dos veces sobre la misma solicitud ya
        // Aceptada y (con la activación de arriba) crearía una asignación
        // duplicada y le mandaría la notificación al paramédico dos veces.
        // Ahora que aceptar de verdad tiene efectos reales, este chequeo
        // aplica para TODOS los roles por igual — el resto de la validación
        // (dueño de la unidad) sigue siendo exclusiva de roles 3/4.
        emergencyModel.getInterInstitutionalRequestById(interInstitutionalRequestId, (e1, r1) => {
            if (e1) {
                return res.status(500).json({message: "Error del servidor."});
            } else if (r1.length === 0) {
                return res.status(404).json({message: "Solicitud no encontrada."});
            } else if (r1[0].request_status_id !== 1) {
                return res.status(400).json({message: "Esta solicitud ya fue respondida."});
            }

            if (parseInt(req.decoded.roleId) === 1) {
                return proceed();
            }

            emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e2, r2) => {
                if (e2 || r2.length === 0 || parseInt(r2[0].institution_id) !== parseInt(r1[0].receiving_institution_id)) {
                    return res.status(403).json({message: "Solo la institución dueña de la unidad puede responder esta solicitud."});
                } else {
                    proceed();
                }
            });
        });
    }
}

// El hospital destino confirma o rechaza la recepción de un paciente. La ambulancia
// sigue su curso de todos modos — esto solo afecta reception_status_id (confirmación
// administrativa), reutilizando el catálogo request_statuses. El institution_id de
// quien confirma se deriva del JWT (userProfileId -> user_profiles), nunca de un
// institutionId que mande el cliente.
// Aceptar un paciente RESERVA cama de inmediato (no hasta que llegue
// físicamente) — es la única forma de evitar que un hospital siga aceptando
// pacientes de más y se entere del sobrecupo hasta que ya llegaron todos.
// Rechazar nunca toca camas (nunca se habían reservado). El único caso que
// libera una cama ya reservada es si alguien pasa de Aceptada a Rechazada
// (defensivo — la UI actual no ofrece esa transición, pero por API sí sería
// posible) o un cierre forzado (ver forceCloseEmergency).
const confirmPatientReception = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyPatientId, accepted, rejectionReason } = req.body;
        emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
            if (e || r.length === 0) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const callerInstitutionId = r[0].institution_id;
                emergencyModel.getEmergencyPatientById(emergencyPatientId, (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({message: "Error del servidor."});
                    } else if (r2.length === 0 || parseInt(r2[0].destination_institution_id) !== parseInt(callerInstitutionId)) {
                        return res.status(403).json({message: "Este paciente no está asignado a tu institución."});
                    } else if (r2[0].closed_at) {
                        return res.status(400).json({message: "Esta emergencia ya está cerrada, no se puede aceptar ni rechazar al paciente."});
                    } else {
                        const emergencyId = r2[0].emergency_id;
                        const specialityId = r2[0].destination_speciality_id;
                        const wasAlreadyAccepted = r2[0].reception_status_name === 'Aceptada';

                        if (accepted && wasAlreadyAccepted) {
                            return res.status(400).json({message: "Este paciente ya había sido aceptado."});
                        }

                        const applyStatusChange = () => {
                            const statusName = accepted ? 'Aceptada' : 'Rechazada';
                            emergencyModel.getRequestStatusIdByName(statusName, (e3, r3) => {
                                if (e3 || r3.length === 0) {
                                    return res.status(500).json({message: "Error del servidor."});
                                } else {
                                    const receptionStatusId = r3[0].request_status_id;
                                    emergencyModel.updatePatientReceptionStatus(emergencyPatientId, receptionStatusId, callerInstitutionId, accepted ? null : rejectionReason, (e4, r4) => {
                                        if (e4) {
                                            return res.status(500).json({message: "Error del servidor."});
                                        } else {
                                            // Admin también recibe este evento en vivo, igual que el resto de emits
                                            // dirigidos al despachador en este archivo (eventEmergencyRegistered,
                                            // eventAmbulanceAssigned, eventAmbulanceUnassigned, etc.) — el admin
                                            // entra a la sala 'admin', no a 'dispatcher', así que emitir solo a
                                            // 'dispatcher' lo deja fuera aunque esté viendo la misma pantalla.
                                            // También al hospital que acaba de aceptar/rechazar: si tiene más de
                                            // una pantalla abierta (p. ej. Seguimiento en otra pestaña), necesita
                                            // enterarse sin tener que salir y volver a entrar.
                                            io.to('dispatcher').to('admin').to('hospital').emit('eventPatientReceptionUpdated', { emergencyPatientId, emergencyId, receptionStatusId, accepted, rejectionReason: accepted ? null : rejectionReason });

                                            // Rechazo — el paramédico que sigue con el paciente físicamente
                                            // encima nunca se enteraba de esto (el evento de arriba solo
                                            // llega a despachador/admin/hospital). Se avisa directo a SU
                                            // celular (room 'user_<id>', igual que registerAssignment) — es
                                            // la persona que en ese momento más necesita saberlo.
                                            if (!accepted && r2[0].ambulance_id) {
                                                emergencyModel.getActiveShiftUserByAmbulance(r2[0].ambulance_id, (e5, r5) => {
                                                    if (!e5 && r5.length > 0) {
                                                        io.to('user_' + r5[0].user_profile_id).emit('eventPatientReceptionUpdated', {
                                                            emergencyPatientId, emergencyId, receptionStatusId, accepted, rejectionReason
                                                        });
                                                    }
                                                });
                                            }

                                            res.status(200).json({
                                                message: accepted ? "Recepción confirmada." : "Recepción rechazada.",
                                                data: { emergencyPatientId, receptionStatusId }
                                            });
                                        }
                                    });
                                }
                            });
                        }

                        if (accepted) {
                            emergencyModel.decrementInstitutionBeds(callerInstitutionId, (eBed, rBed) => {
                                if (eBed) {
                                    return res.status(500).json({message: "Error del servidor."});
                                } else if (rBed.affectedRows === 0) {
                                    return res.status(409).json({message: "Sin camas disponibles en tu institución — no puedes aceptar a este paciente. Recházalo para que el despachador lo reasigne."});
                                } else if (specialityId) {
                                    emergencyModel.decrementSpecialityBeds(callerInstitutionId, specialityId, (eSpecBed, rSpecBed) => {
                                        if (eSpecBed) {
                                            return res.status(500).json({message: "Error del servidor."});
                                        } else if (rSpecBed.affectedRows === 0) {
                                            // Se reservó la cama general pero no había de la especialidad
                                            // — se revierte la general antes de bloquear, para no dejar
                                            // una cama fantasma reservada sin un paciente real detrás.
                                            emergencyModel.incrementInstitutionBeds(callerInstitutionId, () => {
                                                res.status(409).json({message: "Sin camas disponibles para esa especialidad en tu institución — no puedes aceptar a este paciente. Recházalo para que el despachador lo reasigne."});
                                            });
                                        } else {
                                            applyStatusChange();
                                        }
                                    });
                                } else {
                                    applyStatusChange();
                                }
                            });
                        } else if (wasAlreadyAccepted) {
                            emergencyModel.incrementInstitutionBeds(callerInstitutionId, () => {
                                if (specialityId) {
                                    emergencyModel.incrementSpecialityBeds(callerInstitutionId, specialityId, () => applyStatusChange());
                                } else {
                                    applyStatusChange();
                                }
                            });
                        } else {
                            applyStatusChange();
                        }
                    }
                });
            }
        });
    }
}

// Confirmación de llegada FÍSICA del paciente (distinta de confirmPatientReception,
// que es la decisión administrativa de aceptarlo ANTES de que llegue). Hoy solo la
// dispara el hospital mismo (sin sicem-mobile todavía no hay forma de que el
// paramédico lo confirme desde el terreno) — cuando exista, rol 3 podría sumarse
// aquí con su propia validación de que la ambulancia es la asignada a este paciente.
// Si tras esto ya no queda nadie pendiente de entrega en la emergencia, se cierra
// sola sin esperar a que el despachador la cierre a mano.
const confirmPatientDelivery = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyPatientId } = req.body;
        emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
            if (e || r.length === 0) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const callerInstitutionId = r[0].institution_id;
                emergencyModel.getEmergencyPatientById(emergencyPatientId, (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({message: "Error del servidor."});
                    } else if (r2.length === 0 || parseInt(r2[0].destination_institution_id) !== parseInt(callerInstitutionId)) {
                        return res.status(403).json({message: "Este paciente no está asignado a tu institución."});
                    } else if (r2[0].delivered_at) {
                        return res.status(400).json({message: "La llegada de este paciente ya había sido confirmada."});
                    } else if (r2[0].closed_at) {
                        return res.status(400).json({message: "Esta emergencia ya está cerrada."});
                    } else if (r2[0].reception_status_name !== 'Aceptada') {
                        // Sin esto, se podía confirmar la llegada de un paciente que seguía
                        // "Pendiente" (nunca pasó por Aceptar) — nunca se le reservó cama al
                        // aceptarlo, así que hubiera terminado "entregado" sin que el stock de
                        // camas se hubiera descontado nunca.
                        return res.status(400).json({message: "Este paciente todavía no ha sido aceptado por tu institución."});
                    } else {
                        const emergencyId = r2[0].emergency_id;
                        emergencyModel.confirmPatientDelivery(emergencyPatientId, callerInstitutionId, (e3) => {
                            if (e3) {
                                return res.status(500).json({message: "Error del servidor."});
                            } else {
                                io.to('dispatcher').to('admin').to('hospital').emit('eventPatientDelivered', { emergencyPatientId, emergencyId });
                                emergencyModel.getUndeliveredPendingCount(emergencyId, (e4, r4) => {
                                    const stillPending = (!e4 && r4.length > 0) ? r4[0].pending_count : 1;
                                    const willClose = !e4 && stillPending === 0;
                                    if (willClose) {
                                        emergencyModel.closeEmergencyRaw(emergencyId, null, () => {
                                            io.to('paramedic').to('hospital').to('admin').to('dispatcher').emit('eventEmergencyClosed', { emergencyId });
                                        });
                                    }
                                    res.status(200).json({
                                        message: "Llegada confirmada.",
                                        data: { emergencyPatientId, emergencyClosed: willClose }
                                    });
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

// Alta médica — libera de vuelta la cama que "Aceptar" había reservado. Solo
// tiene sentido sobre un paciente que ya se confirmó entregado (si nunca
// llegó, no está ocupando nada que dar de alta — para ese caso está el
// cierre forzado, que libera por cancelación en vez de por alta). No
// depende de que la emergencia siga abierta o cerrada: el alta es del
// paciente, no de la emergencia que lo trajo.
const dischargePatient = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyPatientId } = req.body;
        emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
            if (e || r.length === 0) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                const callerInstitutionId = r[0].institution_id;
                emergencyModel.getEmergencyPatientById(emergencyPatientId, (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({message: "Error del servidor."});
                    } else if (r2.length === 0 || parseInt(r2[0].destination_institution_id) !== parseInt(callerInstitutionId)) {
                        return res.status(403).json({message: "Este paciente no está asignado a tu institución."});
                    } else if (!r2[0].delivered_at) {
                        return res.status(400).json({message: "Este paciente todavía no ha sido confirmado como entregado — no ocupa una cama que dar de alta."});
                    } else if (r2[0].discharged_at) {
                        return res.status(400).json({message: "Este paciente ya había sido dado de alta."});
                    } else {
                        const specialityId = r2[0].destination_speciality_id;
                        emergencyModel.dischargePatient(emergencyPatientId, callerInstitutionId, (e3) => {
                            if (e3) {
                                return res.status(500).json({message: "Error del servidor."});
                            } else {
                                emergencyModel.incrementInstitutionBeds(callerInstitutionId, () => {
                                    const finish = () => res.status(200).json({message: "Paciente dado de alta. Cama liberada."});
                                    if (specialityId) {
                                        emergencyModel.incrementSpecialityBeds(callerInstitutionId, specialityId, finish);
                                    } else {
                                        finish();
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

// Despachador/admin reasigna el hospital destino (y opcionalmente la ambulancia) de
// un paciente ya registrado. Resetea reception_status_id a "Pendiente" y avisa por
// socket al hospital NUEVO reutilizando eventPatientRegistered — el mismo evento que
// IncomingPatients.jsx (sicem-desktop) ya escucha y ya compara contra su institución.
const reassignPatientDestination = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 2];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyPatientId, newDestinationInstitutionId, newAmbulanceId } = req.body;
        emergencyModel.reassignPatientDestination(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.getEmergencyPatientById(emergencyPatientId, (e2, r2) => {
                    const emergencyId = (!e2 && r2.length > 0) ? r2[0].emergency_id : null;
                    io.to('hospital').emit('eventPatientRegistered', {
                        emergencyId, emergencyPatientId,
                        destinationInstitutionId: newDestinationInstitutionId,
                        ambulanceId: newAmbulanceId
                    });
                    res.status(200).json({message: "Destino reasignado con éxito."});
                });
            }
        });
    }
}

// Liga una unidad ya disponible en la emergencia (propia asignada o externa ya
// aceptada) a un paciente concreto — "Agregar ambulancia" solo la mete al
// pool, esto es lo que de verdad dice "esta unidad lleva a este paciente".
const assignAmbulanceToPatient = (req, res) => {
    const io = configSocket.getIo();
    const allowedRoles = [1, 2];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { emergencyPatientId, ambulanceId } = req.body;
        emergencyModel.assignAmbulanceToPatient(emergencyPatientId, ambulanceId, (e) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                emergencyModel.getEmergencyPatientById(emergencyPatientId, (e2, r2) => {
                    const emergencyId = (!e2 && r2.length > 0) ? r2[0].emergency_id : null;
                    io.to('hospital').emit('eventPatientRegistered', { emergencyId, emergencyPatientId, ambulanceId });
                    res.status(200).json({message: "Unidad asignada al paciente."});
                });
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
// Rol 1: bypass total. Rol 4: solo puede consultar la propia institución — se
// valida contra la institución real derivada de su perfil, no contra el
// institutionId del path (antes no se validaba esto en absoluto: cualquier
// rol 4 podía pedir los pacientes en camino de OTRA institución con solo
// cambiar el ID en la URL).
const getIncomingPatientsByInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        const proceed = () => {
            emergencyModel.getIncomingPatientsByInstitution(institutionId, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Pacientes en camino", data: r});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0 || parseInt(r[0].institution_id) !== parseInt(institutionId)) {
                    return res.status(403).json({message: "Solo puedes consultar pacientes de tu propia institución."});
                } else {
                    proceed();
                }
            });
        }
    }
}

// Mismo criterio de ownership que getIncomingPatientsByInstitution, aplicado
// al historial completo (abiertas+cerradas).
const getPatientHistoryByInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const {institutionId} = req.params;
        const proceed = () => {
            emergencyModel.getPatientHistoryByInstitution(institutionId, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Historial de pacientes", data: r});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0 || parseInt(r[0].institution_id) !== parseInt(institutionId)) {
                    return res.status(403).json({message: "Solo puedes consultar el historial de tu propia institución."});
                } else {
                    proceed();
                }
            });
        }
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

// Solicitudes pendientes dirigidas a la institución del hospital que consulta
// — ✅ pantalla nueva de sicem-desktop. Mismo criterio de ownership que
// getIncomingPatientsByInstitution: el admin puede consultar cualquiera, el
// hospital solo la suya.
const getPendingRequestsByReceivingInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId } = req.params;
        const proceed = () => {
            emergencyModel.getPendingRequestsByReceivingInstitution(institutionId, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Solicitudes pendientes de tu institución", data: r});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            emergencyModel.getInstitutionIdByUserProfile(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0 || parseInt(r[0].institution_id) !== parseInt(institutionId)) {
                    return res.status(403).json({message: "Solo puedes consultar solicitudes de tu propia institución."});
                } else {
                    proceed();
                }
            });
        }
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

// Estadísticas personales del paramédico logueado (mes actual) — ver
// comentario en el modelo sobre cómo se infiere "atendida por él".
const getMyStatsThisMonth = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 3) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const userProfileId = req.decoded.userProfileId;
        emergencyModel.getMyAssignmentCountThisMonth(userProfileId, (e1, r1) => {
            if (e1) return res.status(500).json({message: "Error del servidor."});
            emergencyModel.getMyAvgResponseTimeThisMonth(userProfileId, (e2, r2) => {
                if (e2) return res.status(500).json({message: "Error del servidor."});
                emergencyModel.getMyAssignmentsByTypeThisMonth(userProfileId, (e3, r3) => {
                    if (e3) return res.status(500).json({message: "Error del servidor."});
                    emergencyModel.getMyAssignmentsByWeekThisMonth(userProfileId, (e4, r4) => {
                        if (e4) return res.status(500).json({message: "Error del servidor."});
                        emergencyModel.getMyPatientCountThisMonth(userProfileId, (e5, r5) => {
                            if (e5) return res.status(500).json({message: "Error del servidor."});
                            emergencyModel.getMyNoteCountThisMonth(userProfileId, (e6, r6) => {
                                if (e6) return res.status(500).json({message: "Error del servidor."});
                                emergencyModel.getMyShiftMinutesThisMonth(userProfileId, (e7, r7) => {
                                    if (e7) return res.status(500).json({message: "Error del servidor."});
                                    emergencyModel.getMyRecentActivity(userProfileId, (e8, r8) => {
                                        if (e8) return res.status(500).json({message: "Error del servidor."});
                                        res.status(200).json({
                                            message: "Mis estadísticas",
                                            data: {
                                                totalThisMonth: r1[0]?.total || 0,
                                                avgResponseMinutes: r2[0]?.avg_minutes || null,
                                                byType: r3,
                                                byWeek: r4,
                                                patientsThisMonth: r5[0]?.total || 0,
                                                notesThisMonth: r6[0]?.total || 0,
                                                shiftMinutesThisMonth: r7[0]?.total_minutes || 0,
                                                recentActivity: r8,
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
}

// Respaldo de "recuperación" para sicem-mobile — ver comentario en
// getMyCurrentEmergency en el modelo. Se llama al conectar el socket (o
// periódicamente) para ponerse al día si se perdió el aviso en vivo.
const getMyCurrentEmergencyStatus = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 3) {
        return res.status(403).json({message: "Acceso denegado."});
    }
    emergencyModel.getMyCurrentEmergency(req.decoded.userProfileId, (e, r) => {
        if (e) return res.status(500).json({message: "Error del servidor."});
        res.status(200).json({message: "Emergencia actual", data: r[0] || null});
    });
}

module.exports = {
    // POST
    registerEmergency, registerEmergencyPatient, registerEmergencyNote,
    registerAssignment, registerInterInstitutionalRequest,
    createEmergencyType, createEmergencyStatus, createRequestStatus, createTriageLevel,
    // PATCH
    updateEmergencyStatus, closeEmergency, forceCloseEmergency,
    unassignAmbulance, respondInterInstitutionalRequest, cancelInterInstitutionalRequest,
    toggleEmergencyType, toggleEmergencyStatus, toggleRequestStatus, toggleTriageLevel,
    updateEmergencyType, updateEmergencyStatusCatalog, updateRequestStatus, updateTriageLevel,
    confirmPatientReception, confirmPatientDelivery, dischargePatient, reassignPatientDestination, assignAmbulanceToPatient,
    // GET
    getAllActiveEmergencies, getAllClosedEmergencies, getEmergencyById,
    getPatientsByEmergency, getIncomingPatientsByInstitution, getPatientHistoryByInstitution, getNotesByEmergencyPatient, getAssignmentsByEmergency,
    getAssignmentsByAmbulance, getEmergenciesByPatient,
    getPendingInterInstitutionalRequests, getAllInterInstitutionalRequests, getPendingRequestsByReceivingInstitution,
    getAllEmergencyTypes, getAllEmergencyStatuses, getAllRequestStatuses, getAllTriageLevels,
    getAllEmergencyTypesAdmin, getAllEmergencyStatusesAdmin, getAllRequestStatusesAdmin, getAllTriageLevelsAdmin,
    //GETs de estadísticas
    getEmergenciesByType, getRequestsByStatus, getResponseTimeByDay, getResponseTimeToday, getEmergenciesByInstitution,
    //GETs de estadísticas filtradas por hospital
    getPatientsByTypeForInstitution, getPatientsByMonthForInstitution, getAvgTransferTimeForInstitution,
    //GET de estadísticas del paramédico (sicem-mobile)
    getMyStatsThisMonth, getMyCurrentEmergencyStatus
}