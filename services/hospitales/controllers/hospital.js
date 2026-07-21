const hospitalModel = require('../models/hospital');
const { getIo } = require('../config/socket')

// ------- posts -----------------------------------------

const registerInstitution = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.registerInstitution(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Institución registrada con éxito."});
            }
        });
    }
}

const createSpeciality = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { name, description } = req.body;
        hospitalModel.createSpeciality(name, description, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Especialidad creada con éxito."});
            }
        });
    }
}

const createInstitutionType = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionType } = req.body;
        hospitalModel.createInstitutionType(institutionType, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Tipo de institución creado con éxito."});
            }
        });
    }
}

const createInstitutionsSpecialities = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.createInstitutionsSpecialities(req.body, (e, r) => {
            if (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({message: "Esta especialidad ya está asignada a esta institución."});
                }
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Especialidad asignada a institución con éxito."});
            }
        });
    }
}

const createInstitutionNotification = (req, res) => {
    const allowedRoles = [1, 3];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.createInstitutionNotification(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(201).json({message: "Notificación enviada con éxito."});
            }
        });
    }
}

// ------- patches... got patches... -------------------------------------------

const identifyPatient = (req, res) => {
    const allowedRoles = [1, 4]; // admin o personal hospitalario
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.identifyPatient(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Paciente identificado con éxito."});
            }
        });
    }
}

const toggleInstitution = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId } = req.body;
        hospitalModel.toggleInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de institución actualizado."});
            }
        });
    }
}

const toggleInstitutionsSpecialities = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionSpecialityId } = req.body;
        hospitalModel.toggleInstitutionsSpecialities(institutionSpecialityId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de especialidad en institución actualizado."});
            }
        });
    }
}

const toggleSpecialities = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { specialityId } = req.body;
        hospitalModel.toggleSpecialities(specialityId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de especialidad actualizado."});
            }
        });
    }
}

const toggleInstitutionType = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionTypeId } = req.body;
        hospitalModel.toggleInstitutionType(institutionTypeId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Estado de tipo de institución actualizado."});
            }
        });
    }
}

const updateAvailableBedsI = (req, res) => {
    const io = getIo();
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId, availableBeds } = req.body;
        hospitalModel.updateAvailableBedsI(institutionId, availableBeds, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                io.to('dispatcher').to('admin').emit('eventBedsUpdated', { institutionId, availableBeds });
                res.status(200).json({message: "Camas disponibles actualizadas."});
            }
        });
    }
}

const updateBedCapacityI = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId, bedCapacity } = req.body;
        hospitalModel.updateBedCapacityI(institutionId, bedCapacity, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Capacidad de camas actualizada."});
            }
        });
    }
}

const updateAvailableBedsIS = (req, res) => {
    const io = getIo();
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionSpecialityId, availableBeds } = req.body;
        hospitalModel.updateAvailableBedsIS(institutionSpecialityId, availableBeds, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                io.to('dispatcher').to('admin').emit('eventSpecialityBedsUpdated', { institutionSpecialityId, availableBeds });
                res.status(200).json({message: "Camas disponibles de especialidad actualizadas."});
            }
        });
    }
}

const updateBedCapacityIS = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionSpecialityId, totalBeds } = req.body;
        hospitalModel.updateBedCapacityIS(institutionSpecialityId, totalBeds, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Capacidad de camas de especialidad actualizada."});
            }
        });
    }
}

const updateInstitutionType = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionTypeId, institutionType } = req.body;
        hospitalModel.updateInstitutionType(institutionTypeId, institutionType, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Tipo de institución actualizado."});
            }
        });
    }
}

const updateSpeciality = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { specialityId, name, description } = req.body;
        hospitalModel.updateSpeciality(specialityId, name, description, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Especialidad actualizada."});
            }
        });
    }
}

const updateInstitution = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.updateInstitution(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Institución actualizada."});
            }
        });
    }
}

// ------- gets ------------------------------

const getAllInstitutions = (req, res) => {
    hospitalModel.getAllInstitutions((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Todas las instituciones", data: r});
        }
    });
}

const getInstitutionsForDestination = (req, res) => {
    hospitalModel.getInstitutionsForDestination((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Instituciones para destino", data: r});
        }
    });
}

const getInstitutionByName = (req, res) => {
    const { name } = req.params;
    hospitalModel.getInstitutionByName(name, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            if (r.length === 0) {
                return res.status(404).json({message: "Institución no encontrada.", data: null});
            } else {
                res.status(200).json({message: "Institución encontrada", data: r});
            }
        }
    });
}

const getInstitutionNotifications = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.getInstitutionNotifications((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Notificaciones de instituciones", data: r});
            }
        });
    }
}

const getInstitutionNotificationByName = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { name } = req.params;
        hospitalModel.getInstitutionNotificationByName(name, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Notificaciones de institución", data: r});
            }
        });
    }
}

const getAllInstitutionSpecialities = (req, res) => {
    hospitalModel.getAllInstitutionSpecialities((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Todas las especialidades por institución", data: r});
        }
    });
}

const getInstitutionSpecialityByName = (req, res) => {
    const { name } = req.params;
    hospitalModel.getInstitutionSpecialityByName(name, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Especialidades de institución", data: r});
        }
    });
}

const getAllSpecialities = (req, res) => {
    hospitalModel.getAllSpecialities((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Todas las especialidades", data: r});
        }
    });
}

const getSpecialityByName = (req, res) => {
    const { name } = req.params;
    hospitalModel.getSpecialityByName(name, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Especialidad encontrada", data: r});
        }
    });
}

const getAllInstitutionTypes = (req, res) => {
    hospitalModel.getAllInstitutionTypes((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Tipos de institución", data: r});
        }
    });
}

// ------- gets de administración: incluyen activos e inactivos ------------------------------

const getAllInstitutionsAdmin = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.getAllInstitutionsAdmin((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Todas las instituciones (admin)", data: r});
            }
        });
    }
}

const getAllInstitutionTypesAdmin = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.getAllInstitutionTypesAdmin((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Todos los tipos de institución (admin)", data: r});
            }
        });
    }
}

const getAllSpecialitiesAdmin = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        hospitalModel.getAllSpecialitiesAdmin((e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Todas las especialidades (admin)", data: r});
            }
        });
    }
}

module.exports = {
    registerInstitution, createSpeciality, createInstitutionType, createInstitutionsSpecialities, createInstitutionNotification,
    toggleInstitution, toggleInstitutionsSpecialities, toggleSpecialities, toggleInstitutionType, identifyPatient,
    updateAvailableBedsI, updateBedCapacityI, updateAvailableBedsIS, updateBedCapacityIS,
    updateInstitutionType, updateSpeciality, updateInstitution, getInstitutionsForDestination,
    getAllInstitutionsAdmin, getAllInstitutionTypesAdmin, getAllSpecialitiesAdmin,
    getAllInstitutions, getInstitutionByName, getInstitutionNotifications, getInstitutionNotificationByName,
    getAllInstitutionSpecialities, getInstitutionSpecialityByName, getAllSpecialities, getSpecialityByName, getAllInstitutionTypes
}