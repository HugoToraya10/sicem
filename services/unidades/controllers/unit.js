const unitModel = require('../models/unit');
const { getIo } = require('../config/socket');


//--- posts -------------------------
const registerLocations = (req, res) => {
    const io = getIo();
    if(!(parseInt(req.decoded.roleId) === 3)) {
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

const registerAmbulance = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
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
const toggleAmbulance = (req, res) => {
    if(!(parseInt(req.decoded.roleId) === 1)) {
        return res.status(403).json({message:"Acceso denegado."})
    } else {
        const {ambulanceId} = req.body;
        unitModel.toggleAmbulance(ambulanceId, (e, r) => {
            if(e) {
                return res.status(500).json({message:"Error del servidor."})
            } else {
                res.status(200).json({message:"Estado de ambulancia actualizado."})
            }
        })
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

module.exports = {
    registerLocations, registerAmbulance, createAmbulanceType, registerAmbulanceStatus,
    toggleAmbulance, toggleAmbulanceType, toggleAmbulanceStatus,
    getAllAmbulances, getAmbulanceByUnitNumber, getAmbulanceByLicensePlate,
    getAllAmbulanceTypes, getAllAmbulanceStatuses, getLocationsByAmbulance
}