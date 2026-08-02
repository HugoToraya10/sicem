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

// Asignar una especialidad YA EXISTENTE del catálogo a una institución no es
// lo mismo que crear una especialidad nueva (eso sigue siendo exclusivo de
// CRUM en createSpeciality) — un rol 4 con is_institution_admin puede unir un
// catálogo existente a SU PROPIA institución únicamente.
const createInstitutionsSpecialities = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const proceed = () => {
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
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else {
                    // Se fuerza institutionId al propio sin importar qué venga en el
                    // body — un hospital nunca asigna especialidades a otra institución.
                    req.body.institutionId = r[0].institution_id;
                    proceed();
                }
            });
        }
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

// Rol 1 únicamente — ni siquiera un rol 4 con is_institution_admin puede tocar
// qué instituciones pertenecen a la red CRUM fusionada.
const toggleCrumInstitution = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 1) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId } = req.body;
        hospitalModel.toggleCrumInstitution(institutionId, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                hospitalModel.getInstitutionCrumFlag(institutionId, (e2, r2) => {
                    if (e2) {
                        return res.status(500).json({message: "Error del servidor."});
                    } else {
                        res.status(200).json({
                            message: "Estado de red CRUM actualizado.",
                            data: { institutionId, isCrumInstitution: r2.length > 0 ? Boolean(r2[0].is_crum_institution) : null }
                        });
                    }
                });
            }
        });
    }
}

// Rol 1: bypass total. Rol 4: exige is_institution_admin=1 y que la especialidad
// pertenezca a su propia institución (resuelta vía institutions_specialities,
// nunca confiando en un institutionId que mande el cliente).
const toggleInstitutionsSpecialities = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionSpecialityId } = req.body;
        const proceed = () => {
            hospitalModel.toggleInstitutionsSpecialities(institutionSpecialityId, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Estado de especialidad en institución actualizado."});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else {
                    hospitalModel.getInstitutionIdByInstitutionSpecialityId(institutionSpecialityId, (e2, r2) => {
                        if (e2 || r2.length === 0) {
                            return res.status(404).json({message: "Especialidad de institución no encontrada."});
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

// Rol 1: bypass total. Rol 4: cualquiera de la institución (ya no exige
// is_institution_admin) — mismo criterio que ya usa updateAvailableBedsIS para
// camas por especialidad: "disponibles" cambia todo el tiempo con cada
// paciente que entra o sale (incluyendo pacientes que llegan por su cuenta,
// no enviados por el CRUM), no tiene sentido que solo el admin pueda
// ajustarlo. La capacidad TOTAL (updateBedCapacityI) sigue siendo admin-only,
// esa sí es estructural. Se conserva la validación de que institutionId sea
// la propia — esa protección es real, la de is_institution_admin no lo era.
const updateAvailableBedsI = (req, res) => {
    const io = getIo();
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId, availableBeds } = req.body;
        const proceed = () => {
            hospitalModel.updateAvailableBedsI(institutionId, availableBeds, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    io.to('dispatcher').to('admin').emit('eventBedsUpdated', { institutionId, availableBeds });
                    res.status(200).json({message: "Camas disponibles actualizadas."});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (parseInt(institutionId) !== parseInt(r[0].institution_id)) {
                    return res.status(403).json({message: "Solo puedes administrar tu propia institución."});
                } else {
                    proceed();
                }
            });
        }
    }
}

// Rol 1: bypass total. Rol 4: exige is_institution_admin=1 y que el
// institutionId del body sea el suyo propio.
const updateBedCapacityI = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionId, bedCapacity } = req.body;
        const proceed = () => {
            hospitalModel.updateBedCapacityI(institutionId, bedCapacity, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Capacidad de camas actualizada."});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
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

// Rol 1: bypass total. Rol 4: exige is_institution_admin=1 y que la especialidad
// pertenezca a su propia institución (resuelta vía institutions_specialities).
const updateBedCapacityIS = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else {
        const { institutionSpecialityId, totalBeds } = req.body;
        const proceed = () => {
            hospitalModel.updateBedCapacityIS(institutionSpecialityId, totalBeds, (e, r) => {
                if (e) {
                    return res.status(500).json({message: "Error del servidor."});
                } else {
                    res.status(200).json({message: "Capacidad de camas de especialidad actualizada."});
                }
            });
        }
        if (parseInt(req.decoded.roleId) === 1) {
            proceed();
        } else {
            hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
                if (e || r.length === 0) {
                    return res.status(500).json({message: "Error del servidor."});
                } else if (!r[0].is_institution_admin) {
                    return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
                } else {
                    hospitalModel.getInstitutionIdByInstitutionSpecialityId(institutionSpecialityId, (e2, r2) => {
                        if (e2 || r2.length === 0) {
                            return res.status(404).json({message: "Especialidad de institución no encontrada."});
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

// Rol 1 puede editar cualquier campo de cualquier institución. Rol 4 con
// is_institution_admin solo puede editar streetAddress/zipCode/cityId de SU
// PROPIA institución — name e institutionTypeId siguen siendo decisión
// exclusiva de CRUM, así que para rol 4 se preservan tal cual están en BD sin
// importar qué venga en el body (se ignoran, no se aplican).
const updateInstitution = (req, res) => {
    const allowedRoles = [1, 4];
    if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
        return res.status(403).json({message: "Acceso denegado."});
    } else if (parseInt(req.decoded.roleId) === 1) {
        hospitalModel.updateInstitution(req.body, (e, r) => {
            if (e) {
                return res.status(500).json({message: "Error del servidor."});
            } else {
                res.status(200).json({message: "Institución actualizada."});
            }
        });
    } else {
        hospitalModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
            if (e || r.length === 0) {
                return res.status(500).json({message: "Error del servidor."});
            } else if (!r[0].is_institution_admin) {
                return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
            } else {
                const institutionId = r[0].institution_id;
                hospitalModel.getInstitutionById(institutionId, (e2, r2) => {
                    if (e2 || r2.length === 0) {
                        return res.status(404).json({message: "Institución no encontrada."});
                    } else {
                        const current = r2[0];
                        const restrictedData = {
                            institutionId,
                            name: current.name,
                            institutionTypeId: current.institution_type_id,
                            cityId: req.body.cityId,
                            streetAddress: req.body.streetAddress,
                            zipCode: req.body.zipCode,
                            longitude: current.longitude,
                            latitude: current.latitude,
                        };
                        hospitalModel.updateInstitution(restrictedData, (e3, r3) => {
                            if (e3) {
                                return res.status(500).json({message: "Error del servidor."});
                            } else {
                                res.status(200).json({message: "Institución actualizada."});
                            }
                        });
                    }
                });
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
    toggleInstitution, toggleCrumInstitution, toggleInstitutionsSpecialities, toggleSpecialities, toggleInstitutionType, identifyPatient,
    updateAvailableBedsI, updateBedCapacityI, updateAvailableBedsIS, updateBedCapacityIS,
    updateInstitutionType, updateSpeciality, updateInstitution, getInstitutionsForDestination,
    getAllInstitutionsAdmin, getAllInstitutionTypesAdmin, getAllSpecialitiesAdmin,
    getAllInstitutions, getInstitutionByName, getInstitutionNotifications, getInstitutionNotificationByName,
    getAllInstitutionSpecialities, getInstitutionSpecialityByName, getAllSpecialities, getSpecialityByName, getAllInstitutionTypes
}