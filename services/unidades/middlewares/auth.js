const jwt = require('jsonwebtoken');
const db = require('../config/db');

const verifyToken = (req, res, next) => {
    if(req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1]
        const jwtKey = process.env.JWT_SECRET;
        jwt.verify(token, jwtKey, (e, decoded) => {
            if (e){
                return res.status(401).json({message:"Token erróneo"})
            } else {
                req.decoded = decoded
                const {userCredentialId} = decoded;
                const sql = `SELECT is_active FROM user_credentials WHERE user_credential_id = ?`;
                db.query(sql, [userCredentialId], (error, result)=>{
                    if(error) {
                        return res.status(500).json({message: "Error en el servidor."})
                    } else {
                        if(parseInt(result[0].is_active) === 1){
                        next()
                        } else {
                            return res.status(401).json({message: "Acceso denegado. Usuario desactivado."})
                        }
                    }
                });
            }
        })
    } else {
        return res.status(401).json({message: "No autorizado"})
    }
}

module.exports = {verifyToken}