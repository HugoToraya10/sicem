const unitModel = require('../models/unit');
const { getIo } = require('../config/socket');

const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// Sin horario configurado (NULL o arreglo vacío) = SIN ACCESO — un
// paramédico al que ningún admin le ha puesto todavía un solo día de
// trabajo no debe poder iniciar turno "por defecto". shiftWindowsRaw es el
// string JSON tal cual viene de la columna shift_windows: un arreglo de
// { day, start, end } — un rango de hora POR día (day = ISO, 1=lunes..
// 7=domingo), para poder cubrir horarios rotativos donde un día se trabaja
// distinto a los demás (ej. lunes en la mañana, resto de la semana en la
// tarde/noche). El rango de horas de cada día soporta turnos que cruzan
// medianoche (ej. 20:00-04:00).
const isWithinSchedule = (shiftWindowsRaw) => {
    let windows;
    try {
        windows = shiftWindowsRaw ? JSON.parse(shiftWindowsRaw) : [];
    } catch {
        windows = [];
    }
    if (!windows.length) return { allowed: false, windows: [] };

    const now = new Date();
    const jsDay = now.getDay(); // 0=domingo..6=sabado
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1=lunes..7=domingo
    const todayWindow = windows.find((w) => parseInt(w.day) === isoDay);

    if (!todayWindow) {
        return { allowed: false, windows };
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseTimeToMinutes(todayWindow.start);
    const endMinutes = parseTimeToMinutes(todayWindow.end);
    const withinWindow = startMinutes <= endMinutes
        ? (nowMinutes >= startMinutes && nowMinutes <= endMinutes)
        : (nowMinutes >= startMinutes || nowMinutes <= endMinutes); // cruza medianoche

    return { allowed: withinWindow, windows, todayWindow };
}

// Convierte el todayWindow que devolvió isWithinSchedule (solo hora, "HH:MM")
// en el datetime absoluto en el que termina el turno de hoy — lo que se
// guarda en ambulance_shifts.scheduled_end. Si el rango cruza medianoche
// (ej. 20:00-04:00), el fin real cae en el día SIGUIENTE al que inició el
// turno, no el mismo día (si no, quedaría en el pasado desde el instante en
// que se abre el turno).
const computeScheduledEnd = (todayWindow, shiftStart) => {
    if (!todayWindow) return null;
    const [startH, startM] = todayWindow.start.split(':').map(Number);
    const [endH, endM] = todayWindow.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const crossesMidnight = startMinutes > endMinutes;

    const scheduledEnd = new Date(shiftStart);
    scheduledEnd.setHours(endH, endM, 0, 0);
    if (crossesMidnight) scheduledEnd.setDate(scheduledEnd.getDate() + 1);
    return scheduledEnd;
}


//--- posts -------------------------
const registerLocations = (req, res) => {
    const io = getIo();
    if(!(parseInt(req.decoded.roleId) === 3 || parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const { ambulanceId, longitude, latitude } = req.body
        const proceed = () => {
            unitModel.registerLocations({ambulanceId, longitude, latitude}, (e, r) => {
                if(e) {
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    io.to('despachador').to('hospital').to('admin').emit('eventoUbicacionAmbulancia',
                        {ambulanceId, longitude, latitude})
                    res.status(201).json({message:"Ubicación registrada para la unidad"})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
            return;
        }
        // Rol 3: solo puede reportar ubicación para la unidad donde TIENE
        // TURNO ACTIVO ahora mismo (y no abandonado — ver STALE_SHIFT_HOURS).
        // Esto es lo que evita que un dispositivo "fantasma" (turno ya cerrado
        // por otro dispositivo, o abandonado) siga escribiendo coordenadas para
        // una unidad que ya no le corresponde, generando coordenadas
        // inconsistentes en el mapa del despachador.
        unitModel.getActiveShiftByUser(req.decoded.userProfileId, (e, r) => {
            if (e || r.length === 0 || parseInt(r[0].ambulance_id) !== parseInt(ambulanceId)) {
                return res.status(403).json({message: "No tienes un turno activo en esta unidad — tu ubicación no se registró."});
            }
            proceed();
        });
    }
}

// Rol 1: bypass total. Rol 4: exige is_institution_admin=1 y que el
// institutionId del body sea el suyo propio.
const registerAmbulance = (req, res) => {
    const allowedRoles = [1, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const { institutionId } = req.body;
        const proceed = () => {
            unitModel.registerAmbulance(req.body, (e, r) => {
                if(e) {
                    if(e.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({message:"Ya existe una ambulancia con ese número de unidad o placa."})
                    }
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    res.status(201).json({message:"Unidad registrada con éxito"})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            unitModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else if (parseInt(institutionId) !== parseInt(r[0].institution_id)) {
                    return res.status(403).json({message: "Solo puedes administrar tu propia institución."});
                } else {
                    proceed();
                }
            });
        }
    }
}

const createAmbulanceType = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso no autorizado."})
    } else {
        const {ambulanceType} = req.body;
        unitModel.createAmbulanceType(ambulanceType, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(201).json({message:"Tipo de ambulancia creado con éxito"})
            }
        })
    }
}

const registerAmbulanceStatus = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso no autorizado."})
    } else {
        const {name, description} = req.body;
        unitModel.registerAmbulanceStatus(name, description, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(201).json({message:"Estado de ambulancia registrado con éxito."})
            }
        })
    }
}

//--- patches -----------------------
// Rol 1: bypass total. Rol 4: exige is_institution_admin=1 y que la ambulancia
// pertenezca a su propia institución (resuelta vía ambulanceId).
const toggleAmbulance = (req, res) => {
    const allowedRoles = [1, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceId} = req.body;
        const proceed = () => {
            unitModel.toggleAmbulance(ambulanceId, (e, r) => {
                if(e) {
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    res.status(200).json({message:"Estado de ambulancia actualizado."})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            unitModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else {
                    unitModel.getInstitutionIdByAmbulanceId(ambulanceId, (e2, r2) => {
                        if (e2 || r2.length === 0) {
                            return res.status(404).json({message: "Ambulancia no encontrada."});
                        } else if (parseInt(r2[0].institution_id) !== parseInt(r[0].institution_id)) {
                            return res.status(403).json({message: "Solo puedes administrar tu propia institución."});
                        } else {
                            proceed();
                        }
                    });
                }
            });
        }
    }
}

const toggleAmbulanceType = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceTypeId} = req.body;
        unitModel.toggleAmbulanceType(ambulanceTypeId, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Estado de tipo de ambulancia actualizado."})
            }
        })
    }
}

const toggleAmbulanceStatus = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceStatusId} = req.body;
        unitModel.toggleAmbulanceStatus(ambulanceStatusId, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Estado de estatus de ambulancia actualizado."})
            }
        })
    }
}

const updateAmbulanceType = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceTypeId, ambulanceType} = req.body;
        unitModel.updateAmbulanceType(ambulanceTypeId, ambulanceType, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Tipo de ambulancia actualizado."})
            }
        })
    }
}

const updateAmbulanceStatusCatalog = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceStatusId, name, description} = req.body;
        unitModel.updateAmbulanceStatusCatalog(ambulanceStatusId, name, description, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Estado de ambulancia (catálogo) actualizado."})
            }
        })
    }
}

// Rol 1: bypass total, incluyendo reasignar la ambulancia a otra institución.
// Rol 4: exige is_institution_admin=1, que la ambulancia ya sea de su propia
// institución, Y que el institutionId nuevo del body siga siendo el suyo — ni
// siquiera un admin de institución puede "robar" una ambulancia reasignándola
// a otro dueño, eso es exclusivo de rol 1.
const updateAmbulance = (req, res) => {
    const allowedRoles = [1, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const { ambulanceId, institutionId } = req.body;
        const proceed = () => {
            unitModel.updateAmbulance(req.body, (e, r) => {
                if(e) {
                    if(e.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({message:"Ya existe una ambulancia con ese número de unidad o placa."})
                    }
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    res.status(200).json({message:"Ambulancia actualizada con éxito."})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            unitModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else {
                    const callerInstitutionId = r[0].institution_id;
                    unitModel.getInstitutionIdByAmbulanceId(ambulanceId, (e2, r2) => {
                        if (e2 || r2.length === 0) {
                            return res.status(404).json({message: "Ambulancia no encontrada."});
                        } else if (parseInt(r2[0].institution_id) !== parseInt(callerInstitutionId)) {
                            return res.status(403).json({message: "Solo puedes administrar tu propia institución."});
                        } else if (parseInt(institutionId) !== parseInt(callerInstitutionId)) {
                            return res.status(403).json({message: "No puedes reasignar una ambulancia a otra institución."});
                        } else {
                            proceed();
                        }
                    });
                }
            });
        }
    }
}

// Estado del día a día de una ambulancia propia (Disponible/En camino/etc.) —
// operación normal para CUALQUIER rol 4, no exige is_institution_admin (a
// diferencia de las funciones de arriba). Solo exige que la ambulancia
// pertenezca a la institución del que llama.
const updateAmbulanceStatus = (req, res) => {
    // Rol 3 (paramédico) agregado — antes solo admin/hospital podían cambiar
    // el estado de una unidad, pero sicem-mobile necesita que el paramédico
    // en campo pueda marcar "En escena"/"Trasladando"/etc. él mismo.
    const allowedRoles = [1, 3, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const io = getIo();
        const { ambulanceId, ambulanceStatusId } = req.body;
        const proceed = () => {
            unitModel.updateAmbulanceStatus(ambulanceId, ambulanceStatusId, (e, r) => {
                if (e) {
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    io.to('despachador').to('hospital').to('admin').emit('eventAmbulanceStatusChanged', { ambulanceId: parseInt(ambulanceId), ambulanceStatusId: parseInt(ambulanceStatusId) });
                    res.status(200).json({message:"Estado de la ambulancia actualizado.", data: { ambulanceId, ambulanceStatusId }})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else if (parseInt(req.decoded.roleId) === 3) {
            // El paramédico solo puede cambiar el estado de la unidad donde
            // TIENE TURNO ACTIVO ahora mismo — no cualquier ambulancia de su
            // institución (a diferencia de rol 4).
            unitModel.getActiveShiftByUser(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0 || parseInt(r[0].ambulance_id) !== parseInt(ambulanceId)) {
                    return res.status(403).json({message: "Solo puedes cambiar el estado de la unidad donde tienes turno activo."});
                } else {
                    proceed();
                }
            });
        } else {
            unitModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    unitModel.getInstitutionIdByAmbulanceId(ambulanceId, (e2, r2) => {
                        if (e2 || r2.length === 0) {
                            return res.status(404).json({message: "Ambulancia no encontrada."});
                        } else if (parseInt(r2[0].institution_id) !== parseInt(r[0].institution_id)) {
                            return res.status(403).json({message: "Esta ambulancia no pertenece a tu institución."});
                        } else {
                            proceed();
                        }
                    });
                }
            });
        }
    }
}

//--- gets --------------------------
const getAllAmbulances = (req, res) => {
    unitModel.getAllAmbulances((e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Ambulancias activas", data: r})
        }
    })
}

const getAvailableAmbulances = (req, res) => {
    const { institutionId } = req.params;
    unitModel.getAvailableAmbulances(institutionId, (e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Ambulancias disponibles", data: r})
        }
    })
}

const getExternalAvailableAmbulances = (req, res) => {
    const { institutionId } = req.params;
    unitModel.getExternalAvailableAmbulances(institutionId, (e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Ambulancias externas disponibles", data: r})
        }
    })
}

const getAmbulanceByUnitNumber = (req, res) => {
    const {unitNumber} = req.params;
    unitModel.getAmbulanceByUnitNumber(unitNumber, (e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            if(r.length === 0) {
                return res.status(404).json({message:"Unidad no encontrada.", data: null})
            } else {
                res.status(200).json({message:"Unidad encontrada", data: r})
            }
        }
    })
}

const getAmbulanceByLicensePlate = (req, res) => {
    const {licensePlate} = req.params;
    unitModel.getAmbulanceByLicensePlate(licensePlate, (e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            if(r.length === 0) {
                return res.status(404).json({message:"Unidad no encontrada.", data: null})
            } else {
                res.status(200).json({message:"Unidad encontrada", data: r})
            }
        }
    })
}

const getAllAmbulanceTypes = (req, res) => {
    unitModel.getAllAmbulanceTypes((e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Tipos de ambulancia", data: r})
        }
    })
}

const getAllAmbulanceStatuses = (req, res) => {
    unitModel.getAllAmbulanceStatuses((e, r) => {
        if(e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Estados de ambulancia", data: r})
        }
    })
}

const getLocationsByAmbulance = (req, res) => {
    const allowedRoles = [1, 2, 3, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceId} = req.params;
        unitModel.getLocationsByAmbulance(ambulanceId, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                if(r.length === 0) {
                    return res.status(404).json({message:"Sin ubicación registrada.", data: null})
                } else {
                    res.status(200).json({message:"Última ubicación", data: r[0]})
                }
            }
        })
    }
}

//--- gets de administración: incluyen activos e inactivos --------------------------
const getAllAmbulancesAdmin = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        unitModel.getAllAmbulancesAdmin((e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Todas las ambulancias (admin)", data: r})
            }
        })
    }
}

const getAllAmbulanceTypesAdmin = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        unitModel.getAllAmbulanceTypesAdmin((e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Todos los tipos de ambulancia (admin)", data: r})
            }
        })
    }
}

const getAllAmbulanceStatusesAdmin = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        unitModel.getAllAmbulanceStatusesAdmin((e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Todos los estados de ambulancia (admin)", data: r})
            }
        })
    }
}

//---- turnos (ambulance_shifts) -------------------
// Rol 1: bypass total. Rol 3: solo puede iniciar turno en una unidad de SU
// propia institución — se valida cruzando ambulanceId contra la institución
// del paramédico, mismo criterio que el resto de acciones "propias".
const startShift = (req, res) => {
    const allowedRoles = [1, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."})
    } else {
        const io = getIo();
        const { ambulanceId } = req.body;
        const userProfileId = req.decoded.userProfileId;
        // Se llena en checkScheduleThenOwnership (null para el bypass de rol 1,
        // que no tiene horario real que respetar).
        let scheduledEnd = null;
        const proceed = () => {
            unitModel.startShift(ambulanceId, userProfileId, scheduledEnd, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."})
                } else {
                    // La unidad ya tiene tripulación real desde ahora mismo — se marca
                    // Disponible automáticamente para que el mapa del despachador
                    // (NewEmergency/Dashboard/EmergencyDetail) la vea al instante, sin
                    // que un admin tenga que ir a cambiarle el estado a mano.
                    unitModel.updateAmbulanceStatus(ambulanceId, 1, (eStatus) => {
                        if (!eStatus) {
                            io.to('despachador').to('hospital').to('admin').emit('eventAmbulanceStatusChanged', { ambulanceId: parseInt(ambulanceId), ambulanceStatusId: 1 });
                        }
                        res.status(201).json({message: "Turno iniciado."})
                    })
                }
            })
        }
        const checkOwnershipThenProceed = () => {
            unitModel.getInstitutionIdByAmbulanceId(ambulanceId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(404).json({message: "Ambulancia no encontrada."})
                } else {
                    unitModel.getUserInstitutionInfo(userProfileId, (e2, r2) => {
                        if (e2 || r2.length === 0 || parseInt(r2[0].institution_id) !== parseInt(r[0].institution_id)) {
                            return res.status(403).json({message: "Solo puedes iniciar turno en una unidad de tu institución."})
                        } else {
                            proceed();
                        }
                    })
                }
            })
        }

        const checkScheduleThenOwnership = () => {
            if (parseInt(req.decoded.roleId) === 1) {
                // Rol 1 (admin) nunca está sujeto a horario — es una excepción de
                // prueba/soporte, no un turno real.
                checkOwnershipThenProceed();
                return;
            }

            // Rol 3: antes de dejarlo iniciar turno, revisa que el día/hora actual
            // caiga dentro de su horario asignado (si tiene uno configurado por
            // un admin — ver comentario en isWithinSchedule sobre el caso sin
            // horario). Esto es lo que evita que un paramédico entre a trabajar
            // fuera de su turno.
            const WEEKDAY_NAMES = { 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado', 7: 'domingo' };
            unitModel.getUserSchedule(userProfileId, (eSched, rSched) => {
                if (eSched || rSched.length === 0) {
                    return res.status(500).json({message: "Error del servidor."})
                }
                const check = isWithinSchedule(rSched[0].shift_windows);
                if (!check.allowed) {
                    if (!check.windows || check.windows.length === 0) {
                        return res.status(403).json({message: "Todavía no tienes un horario de trabajo asignado. Pide a tu institución que te asigne uno antes de poder iniciar turno."});
                    }
                    let windowText;
                    if (check.todayWindow) {
                        windowText = ` Tu horario de hoy es ${check.todayWindow.start}-${check.todayWindow.end}.`;
                    } else {
                        const daysText = check.windows
                            .map((w) => `${WEEKDAY_NAMES[parseInt(w.day)]} ${w.start}-${w.end}`)
                            .join(', ');
                        windowText = ` No tienes turno asignado hoy. Tu horario: ${daysText}.`;
                    }
                    return res.status(403).json({message: `No puedes iniciar turno fuera de tu horario asignado.${windowText}`});
                }
                scheduledEnd = computeScheduledEnd(check.todayWindow, new Date());
                checkOwnershipThenProceed();
            });
        }

        // Antes que nada (aplica a rol 1 y 3 por igual): que no queden dos
        // turnos activos de verdad al mismo tiempo — ni dos personas distintas
        // manejando la misma unidad, ni la misma persona en dos dispositivos.
        // Si eso pasara, ambos celulares seguirían reportando ubicación para la
        // misma ambulancia y las coordenadas en el mapa quedarían inconsistentes.
        // Turnos abandonados (>10h sin cerrar) no cuentan como conflicto — ver
        // STALE_SHIFT_HOURS en el modelo.
        unitModel.getActiveShiftByAmbulance(ambulanceId, (eConflictAmb, rConflictAmb) => {
            if (eConflictAmb) return res.status(500).json({message: "Error del servidor."})
            if (rConflictAmb.length > 0 && parseInt(rConflictAmb[0].user_profile_id) !== userProfileId) {
                return unitModel.getUserBasicName(rConflictAmb[0].user_profile_id, (eName, rName) => {
                    const holderName = (!eName && rName.length > 0) ? `${rName[0].first_name} ${rName[0].first_surname || ''}`.trim() : 'otro paramédico';
                    return res.status(409).json({message: `Esta unidad ya tiene un turno activo con ${holderName}. Debe terminar su turno antes de que puedas iniciar el tuyo.`});
                });
            }
            unitModel.getActiveShiftByUser(userProfileId, (eConflictUser, rConflictUser) => {
                if (eConflictUser) return res.status(500).json({message: "Error del servidor."})
                if (rConflictUser.length > 0 && parseInt(rConflictUser[0].ambulance_id) !== parseInt(ambulanceId)) {
                    return res.status(409).json({message: `Ya tienes un turno activo en la unidad #${rConflictUser[0].ambulance_id}. Termínalo antes de iniciar uno nuevo.`});
                }
                if (rConflictUser.length > 0 && parseInt(rConflictUser[0].ambulance_id) === parseInt(ambulanceId)) {
                    return res.status(409).json({message: "Ya tienes un turno activo en esta unidad desde otro dispositivo. Termínalo ahí antes de iniciar uno nuevo aquí."});
                }
                checkScheduleThenOwnership();
            });
        });
    }
}

// Fuera de servicio (id 5 del catálogo) es el estado que se usa para "esta
// unidad no tiene a nadie manejándola ahora mismo" — no hay un status
// dedicado a "sin tripulación" en el catálogo, y semánticamente cae dentro de
// "no está operativa... u otra razón". Se usa tanto al terminar turno como al
// cerrar sesión desde sicem-mobile (index.js llama a este mismo endpoint
// antes de cerrar sesión si había turno activo).
const NO_CREW_STATUS_ID = 5;

const endShift = (req, res) => {
    const allowedRoles = [1, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."})
    } else {
        const io = getIo();
        const userProfileId = req.decoded.userProfileId;
        // Se busca el turno activo ANTES de cerrarlo para saber qué unidad hay
        // que marcar como sin tripulación — una vez cerrado ya no se puede saber.
        unitModel.getActiveShiftByUser(userProfileId, (eShift, rShift) => {
            if (eShift) return res.status(500).json({message: "Error del servidor."})
            const ambulanceId = rShift.length > 0 ? rShift[0].ambulance_id : null;
            unitModel.endShift(userProfileId, (e) => {
                if (e) return res.status(500).json({message: "Error del servidor."})
                if (!ambulanceId) {
                    return res.status(200).json({message: "Turno terminado."})
                }
                unitModel.updateAmbulanceStatus(ambulanceId, NO_CREW_STATUS_ID, (eStatus) => {
                    if (!eStatus) {
                        io.to('despachador').to('hospital').to('admin').emit('eventAmbulanceStatusChanged', { ambulanceId: parseInt(ambulanceId), ambulanceStatusId: NO_CREW_STATUS_ID });
                    }
                    res.status(200).json({message: "Turno terminado."})
                })
            })
        })
    }
}

// Cada cuánto se revisa si algún turno ya venció (horario + gracia — ver
// STALE_GRACE_MINUTES en models/unit.js, ESA es la que hay que cambiar para
// ajustar el tiempo real de gracia). Este intervalo solo controla qué tan
// rápido se nota que ya venció, no el tiempo de gracia en sí.
const SHIFT_EXPIRY_SWEEP_INTERVAL_MS = 10000;

// Cierra solo los turnos que ya pasaron su horario laboral + gracia sin que
// nadie llamara a terminar-turno — libera la unidad (Fuera de servicio) y le
// manda a ESE paramédico en particular (room 'user_<id>', se une al conectar
// el socket) un aviso para que su celular cierre la sesión solo.
const sweepExpiredShifts = () => {
    const io = getIo();
    unitModel.getExpiredActiveShifts((e, rows) => {
        if (e || !rows || rows.length === 0) return;
        rows.forEach((shift) => {
            unitModel.endShift(shift.user_profile_id, (eEnd) => {
                if (eEnd) return;
                unitModel.updateAmbulanceStatus(shift.ambulance_id, NO_CREW_STATUS_ID, (eStatus) => {
                    if (!eStatus) {
                        io.to('despachador').to('hospital').to('admin').emit('eventAmbulanceStatusChanged', { ambulanceId: parseInt(shift.ambulance_id), ambulanceStatusId: NO_CREW_STATUS_ID });
                    }
                    io.to('user_' + shift.user_profile_id).emit('eventForceLogout', {
                        reason: 'Tu turno se cerró automáticamente porque terminó tu horario laboral.'
                    });
                });
            });
        });
    });
};

// Se llama UNA vez al arrancar el servicio (ver index.js) para dejar el
// barrido corriendo en segundo plano mientras el proceso viva.
const startShiftExpirySweep = () => {
    setInterval(sweepExpiredShifts, SHIFT_EXPIRY_SWEEP_INTERVAL_MS);
};

// Público (igual que tipos-ambulancia) — sicem-web lo usa para el picker al
// registrar un paramédico nuevo, sin importar el rol de quien esté logueado.
const getCrumAmbulances = (req, res) => {
    unitModel.getCrumAmbulances((e, r) => {
        if (e) {
            return res.status(500).json({message:"Error del servidor."})
        } else {
            res.status(200).json({message:"Ambulancias de instituciones CRUM", data: r})
        }
    })
}

// Para que el celular, al abrir la app, sepa si ya había un turno activo (y en
// qué unidad) sin obligar al paramédico a volver a elegirla cada vez.
const getMyActiveShift = (req, res) => {
    unitModel.getActiveShiftByUser(req.decoded.userProfileId, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."})
        } else {
            res.status(200).json({message: "Turno activo", data: r[0] || null})
        }
    })
}

module.exports = {
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus, getExternalAvailableAmbulances,
    updateAmbulanceType, updateAmbulanceStatusCatalog, updateAmbulance, updateAmbulanceStatus,
    getAllAmbulancesAdmin, getAllAmbulanceTypesAdmin, getAllAmbulanceStatusesAdmin,
    getAllAmbulances, getAvailableAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance,
    startShift, endShift, getMyActiveShift, getCrumAmbulances, startShiftExpirySweep
}