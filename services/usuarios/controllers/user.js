const userModel = require("../models/user");
const bcrypt = require("bcrypt");

const register = (req, res) => {
  //Esto se llama destructuring
const {
    email,
    password,
    roleId,
    firstName,
    firstSurname,
    secondSurname,
    phone,
    institutionId,
} = req.body;

  //el 10 es un saltRound, entre mayor número, mayor seguridad
bcrypt.hash(password, 10, (error, hash) => {
    if (error) return res.status(500).json({ message: "Error encriptando" });
    else {
        userModel.createCredential(email, hash, (error, result) => {
        if (error) {
        return res
            .status(500)
            .json({ message: "Error creando credenciales" });
        }
        let userId = result.insertId;
        userModel.createProfile(
            userId,
            institutionId,
            roleId,
            firstName,
            firstSurname,
            secondSurname,
            phone,
        (error, result) => {
            if (error)
            {
                console.log(error)
                return res.status(500).json({ message: "Error creando perfil" });
            }
            else {
                return res
                .status(201)
                .json({ message: "Usuario creado con éxito" });
            }
          },
        );
      });
    }
  });
};

module.exports = { register };
