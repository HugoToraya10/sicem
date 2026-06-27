const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    if(req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1]
        const jwtKey = process.env.JWT_SECRET;
        jwt.verify(token, jwtKey, (e, decoded) => {
            if (e){
                return res.status(401).json({message:"Token erróneo"})
            } else {
                req.decoded = decoded
                next()
            }
        })
    } else {
        return res.status(401).json({message: "No autorizado"})
    }
}

module.exports = {verifyToken}