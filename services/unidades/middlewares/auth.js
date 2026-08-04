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
                const {userCredentialId, sessionId} = decoded;
                const sql = `SELECT is_active, active_session_id FROM user_credentials WHERE user_credential_id = ?`;
                db.query(sql, [userCredentialId], (error, result)=>{
                    if(error) {
                        return res.status(500).json({message: "Error en el servidor."})
                    } else if (!result || result.length === 0) {
                        return res.status(401).json({message: "Sesión inválida."})
                    } else if (parseInt(result[0].is_active) !== 1) {
                        return res.status(401).json({message: "Acceso denegado. Usuario desactivado."})
                    // sessionId solo viaja en el token de rol 3 (paramédico, sicem-mobile) —
                    // ver login en services/usuarios. Si no coincide con la sesión activa
                    // guardada, alguien inició sesión después en otro dispositivo con la
                    // misma cuenta: este token ya no sirve.
                    } else if (sessionId && result[0].active_session_id !== sessionId) {
                        return res.status(401).json({message: "Tu sesión se cerró porque iniciaste sesión en otro dispositivo."})
                    } else {
                        next()
                    }
                });
            }
        })
    } else {
        return res.status(401).json({message: "No autorizado"})
    }
}

module.exports = {verifyToken}