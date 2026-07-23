const unitModel = require('../models/unit');
const { getIo } = require('../config/socket');


//--- posts -------------------------
const registerLocations = (req, res) => {
    const io = getIo();
    if(!(parseInt(req.decoded.roleId) === 3 || parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const { ambulanceId, longitude, latitude } = req.body
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
    const allowedRoles = [1, 4];
    if(!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const { ambulanceId, ambulanceStatusId } = req.body;
        const proceed = () => {
            unitModel.updateAmbulanceStatus(ambulanceId, ambulanceStatusId, (e, r) => {
                if (e) {
                    return res.status(500).json({message:"Error del servidor."})
                } else {
                    res.status(200).json({message:"Estado de la ambulancia actualizado.", data: { ambulanceId, ambulanceStatusId }})
                }
            })
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
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

module.exports = {
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus, getExternalAvailableAmbulances,
    updateAmbulanceType, updateAmbulanceStatusCatalog, updateAmbulance, updateAmbulanceStatus,
    getAllAmbulancesAdmin, getAllAmbulanceTypesAdmin, getAllAmbulanceStatusesAdmin,
    getAllAmbulances, getAvailableAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance
}