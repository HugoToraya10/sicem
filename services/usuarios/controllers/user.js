const userModel = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middlewares/auth");



//función utilizada para reutilizarla en los controllers register y registerPatient
const createUserWithCredentials = (req, res) => {
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
    birthDate,
    cveUnicaRegistroPob,
    emergencyContact,
    emergencyPhone,
  } = req.body;

  //hasheo de contraseña
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
          birthDate,
          cveUnicaRegistroPob,
          emergencyContact,
          emergencyPhone,
          (error, result) => {
            if (error) {
              console.log(error);
              return res.status(500).json({ message: "Error creando perfil" });
            } else {
              return res
                .status(201)
                .json({ message: "Usuario creado con éxito" });
            }
          },
        );
      });
    }
  });
}

//este controller es para registrar un usuario no paciente, en el caso de poder hashear la contraseña, se crea su perfil
const register = (req, res) => {
  if(req.decoded.roleId === 1) { //si el usuario es administrador, puede usar este controller
  createUserWithCredentials(req, res);
} else {
  res.status(403).json({message:"Acceso denegado, no puedes registrar"})
}
};

// controller para registrar un usuario sin credenciales
// (paramédico registrando un paciente, es decir, solo le crea un perfil e historial clínico en campo)
const registerPatient = (req, res) => {
  req.body.roleId = 5;
  const {
    email,
    password,
    roleId = 5,
    firstName,
    firstSurname,
    secondSurname,
    phone,
    institutionId,
    birthDate,
    cveUnicaRegistroPob,
    emergencyContact,
    emergencyPhone,
  } = req.body;


  if (email && password){
        console.log('Registro con credenciales')
        createUserWithCredentials(req, res);
  } else {
      userModel.createProfile(
      null,
      institutionId,
      5,
      firstName,
      firstSurname,
      secondSurname,
      phone,
      birthDate,
      cveUnicaRegistroPob,
      emergencyContact,
      emergencyPhone,
      (e, r) => {
        if (e) {
          return res.status(500).json({message:"Error creando perfil."})
        } else {
          console.log('Paciente creado sin credenciales')
          return res.status(201).json({message: "Usuario creado con éxito."})
        }
      }
    );
  }
};

//este es un controller para verificar las credenciales del usuario (en caso de tener)
const login = (req, res) => {
  const email = req.body.email;
  const pass = req.body.password;

  userModel.login(email, (error, result) => {
    if (error) {
      return res.status(500).json({ message: "Error del servidor" });
    } else {
      if (result.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      } else {
        bcrypt.compare(pass, result[0].password_hash, (e, r) => {
          if (e) {
            return res.status(404).json({ message: "Error leyendo datos" });
          } else {
            if (r === true) {
              let userFirstName = result[0].first_name
              let userFirstSurname = result[0].first_surname
              let userProfileId = result[0].user_profile_id
              let roleId = result[0].role_id
              let payload = {
                userProfileId: userProfileId,
                userCredentialId: result[0].user_credential_id,
                roleId: roleId,
              };
              let jwtOptions = {
                expiresIn: "8h",
              };
              let jwtKey = process.env.JWT_SECRET;
              let token = jwt.sign(payload, jwtKey, jwtOptions);
              return res
                .status(200)
                .json({ message: "Ingreso exitoso", jwtToken: token,
                  user : {
                    profileId:userProfileId, role:roleId, firstName:userFirstName, firstSurname:userFirstSurname}});
            } else {
              return res.status(401).json({ message: "Las credenciales son incorrectas" });
            }
          }
        });
      }
    }
  });
};

// Controller para desactivar usuario
const toggleActiveUser = (req, res) => {
  if(req.decoded.roleId === 1){
  const userId = req.body.userCredentialId;
  userModel.toggleActiveUser(userId, (e, r)=>{
    if (e){
      return res.status(500).json({message: "Error invirtiendo el estado activo del usuario."})
    } else {
      userModel.requestUserStatus(userId, (error, result)=> {
        if (error){
          return res.status(500).json({message:"Usuario no encontrado"})
        } else {
          let currentUserStatus = (result[0].is_active === 1)? 'ACTIVO': 'INACTIVO';
          return res.status(200).json({message: "Estado activo invertido exitosamente.", status:currentUserStatus})
        }
      })
    }
  })
} else {
  return res.status(403).json({message: "Acceso denegado, no puedes desactivar un usuario"})
}
}


//Controller para editar datos del perfil del usuario
const editUserProfile = (req, res) => {
  const editProfile = (req, res) =>{
    const {userCredentialId,
          institutionId, 
          roleId, 
          firstName, 
          firstSurname, 
          secondSurname,             
          phone, 
          birthDate, 
          cveUnicaRegistroPob, 
          emergencyContact, 
          emergencyPhone } = req.body

    userModel.editUserProfile(userCredentialId, institutionId, roleId, firstName, firstSurname, secondSurname, phone,
    birthDate, cveUnicaRegistroPob, emergencyContact, emergencyPhone, (e, r) => {
      if (e) {
        console.log(e)
        return res.status(500).json({message: "Error actualizando datos."})
      } else {
        return res.status(200).json({message: "Datos actualizados con éxito."})
      }
    })
  }

    if(req.decoded.roleId === 1){
      editProfile(req, res)
    } else {
    if ((req.decoded.userCredentialId === parseInt(req.body.userCredentialId)) && (req.decoded.roleId === 5)){
      editProfile(req, res)
      } else {
        return res.status(403).json({ message: "Acceso denegado" })
      }
    }
}

// Controller creado para actualizar las credenciales de cada usuario
const editUserCredentials = (req, res) => {
  const {
    userCredentialId,
    email,
    password
  } = req.body

  // creo una función para poder reutilizarla en los dos cosos, tanto
  // cuando se es usuario admin como cuando se es usuario paciente
  const editCredentials = (userCredentialId, email, password) => {
    bcrypt.hash(password, 10, (err, encrypted)=>{
      if (err) {
        return res.status(500).json({message: "Error creando credenciales."})
      } else {
        userModel.editUserCredentials(userCredentialId, email, encrypted, (e, r) =>{
        if (e) {
          return res.status(500).json({message: "Error en el servidor."})
        } else {
          return res.status(200).json({message: "Credenciales actualizadas con éxito."})
        }
      })
      } 
    });
  }
  // si se es usuario admin
  if(req.decoded.roleId === 1){
    editCredentials(userCredentialId, email, password);
  } else { // si se es usuario paciente (roleId === 5) 
    if ((req.decoded.userCredentialId === parseInt(req.body.userCredentialId)) && (req.decoded.roleId === 5)){
      editCredentials(userCredentialId, email, password);
    } else {
      return res.status(403).json({message: "Fuera de mi territorio. REGRESA POR DONDE VINISTE PUTA"})
    }
  }
}


//---------------Controllers para hacer get de las tablas necesarias------------------
//No considero que estas tablas deban tener restricción por JWT

//Controller para obtener los datos de todos los usuarios
const getAllUsers = (req, res) => {
  const allowedRoles = [1, 2, 3, 4]
  if (allowedRoles.includes(parseInt(req.decoded.roleId))) {
    userModel.getAllUsers((e, r) => {
      if (e){
        return res.status(500).json({message: "Error del servidor."})
      } else {
        res.status(200).json({message:"Datos obtenidos correctamente", data: r})
      }
    })
  } else {
    return res.status(403).json({message: "Acceso denegado."})
  }
}

//Controller para obtener un solo usuario dependiendo del ID
const getUserById = (req, res) => {
  const allowedRoles = [1, 2, 3, 4]
  if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
    return res.status(403).json({message: "Acceso denegado."})
  } else {
    const { userProfileId } = req.params;
    userModel.getUserById(userProfileId, (e, r)=>{
      if(e){
        return res.status(500).json({message: "Error del servidor."})
      } else {
        if (r.length === 0) {
          return res.status(404).json({message: "Usuario no encontrado", user: null})
          //este user: null lo voy a usar para cuando el frontend consulte y vea que no existe el user
        } else {
          res.status(200).json({message: "Usuario encontrado:", user: r})
        }
      }
    })
  }
}


//Controller para obtener todos los roles
const getAllRoles = (req, res) => {
  userModel.getAllRoles((e, r)=>{
    if (e){
      return res.status(500).json({message:"Error del servidor."})
    } else {
      res.status(200).json({message:"Roles", roles: r})
    }
  })
}


//Controller para obtener todas las instituciones registradas
const getAllInstitutions = (req, res) => {
  userModel.getAllInstitutions((e, r)=>{
    if (e){
      return res.status(500).json({message:"Error del servidor."})
    } else {
      res.status(200).json({message:"Instituciones registradas", institutions: r})
    }
  })
}

//Controller para obtener todos los tipos de institución
const getAllInstitutionTypes = (req, res) => {
  userModel.getAllInstitutionTypes((e, r)=>{
    if (e){
      return res.status(500).json({message:"Error del servidor."})
    } else {
      res.status(200).json({message:"Tipos de institución", institutionTypes: r})
    }
  })
}



const getAllStates = (req, res) => {
    userModel.getAllStates((e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Estados", data: r});
        }
    });
}

const getCitiesByState = (req, res) => {
    const {stateId} = req.params;
    userModel.getCitiesByState(stateId, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Ciudades del estado", data: r});
        }
    });
}



module.exports = { register, login, registerPatient, toggleActiveUser, editUserProfile, editUserCredentials, 
                  getAllUsers, getUserById, getAllRoles, getAllInstitutions, getAllInstitutionTypes, getAllStates, getCitiesByState};