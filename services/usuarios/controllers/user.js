const userModel = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middlewares/auth");



//función utilizada para reutilizarla en los controllers register y registerPatient
const createUserWithCredentials = (req, res) => {
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
    assignedAmbulanceId,
    shiftWindows,
  } = req.body;

  const proceed = () => {
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
          const isParamedic = parseInt(roleId) === 3;
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
            isParamedic ? assignedAmbulanceId : null,
            isParamedic ? shiftWindows : null,
            (error, result) => {
              if (error) {
                console.log(error);
                return res.status(500).json({ message: "Error creando perfil" });
              } else {
                return res
                  .status(201)
                  .json({ message: "Usuario creado con éxito", userProfileId: result.insertId });
              }
            },
          );
        });
      }
    });
  }

  // El rol 2 (Despachador) es exclusivo de la institución CRUM (Cruz Roja
  // Tabasco) por diseño del proyecto — se hace cumplir aquí antes de crear
  // ninguna credencial, no solo confiando en disciplina operativa.
  if (parseInt(roleId) === 2) {
    userModel.getInstitutionCrumFlag(institutionId, (e, r) => {
      if (e || r.length === 0) {
        return res.status(400).json({ message: "Institución no encontrada." });
      } else if (!r[0].is_crum_institution) {
        return res.status(400).json({ message: "El rol de Despachador solo puede asignarse a personal de la institución CRUM." });
      } else {
        proceed();
      }
    });
  } else {
    proceed();
  }
}

//este controller es para registrar un usuario no paciente, en el caso de poder hashear la contraseña, se crea su perfil
const register = (req, res) => {
  if(req.decoded.roleId === 1) { //si el usuario es administrador, puede usar este controller
  // Si el admin está creando un paramédico (rol 3) con ambulancia asignada,
  // esa ambulancia debe pertenecer a una institución CRUM — sicem-web es la
  // herramienta del despachador/CRUM, no tiene sentido asignar desde ahí
  // paramédicos a ambulancias de hospitales que no son CRUM (eso es trabajo
  // de sicem-desktop, ver la rama de rol 4 abajo).
  if (parseInt(req.body.roleId) === 3 && req.body.assignedAmbulanceId) {
    userModel.getAmbulanceInstitutionInfo(req.body.assignedAmbulanceId, (e, r) => {
      if (e || r.length === 0) {
        return res.status(404).json({message: "Ambulancia no encontrada."});
      } else if (!r[0].is_crum_institution) {
        return res.status(400).json({message: "Desde aquí solo puedes asignar paramédicos a ambulancias de instituciones CRUM."});
      } else {
        createUserWithCredentials(req, res);
      }
    });
  } else {
    createUserWithCredentials(req, res);
  }
} else if (parseInt(req.decoded.roleId) === 4) {
  // Un admin de hospital (is_institution_admin) puede dar de alta personal de
  // SU PROPIA institución — antes solo rol 4 (empleados administrativos),
  // ahora también rol 3 (paramédicos) ligados a UNA ambulancia de su propia
  // institución. Nunca otra institución, sin importar qué venga en el body.
  userModel.getUserInstitutionInfo(req.decoded.userProfileId, (e, r) => {
    if (e || r.length === 0) {
      return res.status(500).json({message: "Error del servidor."});
    } else if (!r[0].is_institution_admin) {
      return res.status(403).json({message: "Necesitas privilegios de administrador de tu institución."});
    } else {
      const requestedRole = parseInt(req.body.roleId) === 3 ? 3 : 4;
      req.body.roleId = requestedRole;
      req.body.institutionId = r[0].institution_id;
      if (requestedRole === 3 && req.body.assignedAmbulanceId) {
        userModel.getAmbulanceInstitutionInfo(req.body.assignedAmbulanceId, (e2, r2) => {
          if (e2 || r2.length === 0) {
            return res.status(404).json({message: "Ambulancia no encontrada."});
          } else if (parseInt(r2[0].institution_id) !== parseInt(r[0].institution_id)) {
            return res.status(403).json({message: "Solo puedes asignar paramédicos a ambulancias de tu propia institución."});
          } else {
            createUserWithCredentials(req, res);
          }
        });
      } else {
        createUserWithCredentials(req, res);
      }
    }
  });
} else {
  res.status(403).json({message:"Acceso denegado, no puedes registrar"})
}
};

// controller para registrar un usuario sin credenciales
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
      null,
      null,
      (e, r) => {
        if (e) {
          if (e.code === 'ER_DATA_TOO_LONG') {
            return res.status(400).json({message: "Uno de los campos excede la longitud máxima permitida (revisa la CURP, que debe tener máximo 18 caracteres)."})
          }
          return res.status(500).json({message:"Error creando perfil."})
        } else {
          console.log('Paciente creado sin credenciales')
          return res.status(201).json({message: "Usuario creado con éxito.", userProfileId: r.insertId})
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
              let institutionId = result[0].institution_id
              let roleId = result[0].role_id
              let isActive = result[0].is_active
              if(isActive === 0){
                return res.status(401).json({message: "Este usuario está desactivado"});
              }
              const sendToken = (sessionId) => {
                let payload = {
                  userProfileId: userProfileId,
                  userCredentialId: result[0].user_credential_id,
                  roleId: roleId,
                  sessionId: sessionId || undefined,
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
                      profileId:userProfileId, roleId:roleId, firstName:userFirstName, firstSurname:userFirstSurname,
                      institutionId: institutionId, isInstitutionAdmin: Boolean(result[0].is_institution_admin),
                      assignedAmbulanceId: result[0].assigned_ambulance_id,
                      shiftWindows: result[0].shift_windows ? JSON.parse(result[0].shift_windows) : null}});
              }
              // Rol 3 (paramédico, sicem-mobile) solo puede tener sesión activa en
              // UN dispositivo a la vez — cada login genera un sessionId nuevo y lo
              // guarda como el único válido; el token del dispositivo anterior deja
              // de servir en cuanto haga su siguiente petición (verifyToken lo
              // compara, respaldo garantizado). Además, si YA había una sesión
              // previa (alguien logueado en otro celular ahora mismo), se le avisa
              // por socket para que se cierre AL INSTANTE, sin esperar a que ese
              // celular pregunte algo — ver notifyForceLogout en services/unidades.
              // No aplica a los demás roles (web/desktop institucionales, donde
              // varias pestañas/sesiones de la misma cuenta son normales).
              const issueToken = () => {
                if (parseInt(roleId) !== 3) {
                  return sendToken(null);
                }
                const previousSessionId = result[0].active_session_id;
                const sessionId = require('crypto').randomUUID();
                userModel.updateActiveSession(result[0].user_credential_id, sessionId, (eSession) => {
                  if (eSession) {
                    return res.status(500).json({message: "Error del servidor."});
                  }
                  sendToken(sessionId);
                  // Fire-and-forget: si unidades no responde o está caída, el login
                  // ya se mandó — el respaldo de verifyToken sigue cerrando la
                  // sesión vieja de todos modos en su siguiente petición.
                  if (previousSessionId) {
                    fetch('http://localhost:3003/unidades/notificar-cierre-sesion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.INTERNAL_SERVICE_SECRET },
                      body: JSON.stringify({ oldSessionId: previousSessionId, reason: 'Se inició sesión con tu cuenta en otro dispositivo.' })
                    }).catch((error) => console.error('Error avisando cierre de sesión a unidades. ', error.message));
                  }
                });
              }
              // Defensa adicional: si ya existiera una cuenta rol 2 mal asignada de
              // antes de esta regla (institución no-CRUM), se bloquea aquí también,
              // no solo al momento de crearla.
              if (parseInt(roleId) === 2) {
                userModel.getInstitutionCrumFlag(institutionId, (eCrum, rCrum) => {
                  if (eCrum || rCrum.length === 0 || !rCrum[0].is_crum_institution) {
                    return res.status(401).json({message: "Esta cuenta no tiene permiso de despachador — contacta al administrador."});
                  } else {
                    issueToken();
                  }
                });
              } else {
                issueToken();
              }
            } else {
              return res.status(401).json({ message: "Las credenciales son incorrectas" });
            }
          }
        });
      }
    }
  });
};

// Controller para desactivar usuario. Rol 1: bypass total. Rol 4 con
// is_institution_admin: solo sobre personal rol 4 de SU MISMA institución
// (típicamente para dar de baja a un ex-empleado sin escalar a CRUM).
const toggleActiveUser = (req, res) => {
  const allowedRoles = [1, 4];
  if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
    return res.status(403).json({message: "Acceso denegado, no puedes desactivar un usuario"})
  }
  // Nadie puede desactivar su propia cuenta, ni siquiera el admin — evita quedar
  // bloqueado del sistema por accidente.
  if (req.decoded.userCredentialId === parseInt(req.body.userCredentialId)) {
    return res.status(403).json({message: "No puedes desactivar tu propia cuenta."})
  }
  const userId = req.body.userCredentialId;

  const proceed = () => {
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
  }

  if (parseInt(req.decoded.roleId) === 1) {
    return proceed();
  }

  userModel.getUserInstitutionInfo(req.decoded.userProfileId, (eCaller, rCaller) => {
    if (eCaller || rCaller.length === 0) {
      return res.status(500).json({message: "Error del servidor."})
    }
    const caller = rCaller[0];
    if (!caller.is_institution_admin) {
      return res.status(403).json({message: "No tienes privilegios de administrador de tu institución."})
    }
    userModel.getUserInstitutionInfoByCredentialId(userId, (eTarget, rTarget) => {
      if (eTarget || rTarget.length === 0) {
        return res.status(404).json({message: "Usuario no encontrado."})
      }
      const target = rTarget[0];
      if (parseInt(target.role_id) !== 4 || parseInt(target.institution_id) !== parseInt(caller.institution_id)) {
        return res.status(403).json({message: "Solo puedes administrar personal de tu propia institución."})
      }
      proceed();
    });
  });
}

// Designa o revoca is_institution_admin sobre un usuario rol 4. Rol 1 (CRUM)
// tiene bypass total. Rol 4 solo puede usarlo si él mismo ya es admin de su
// institución, sobre usuarios de esa MISMA institución, y nunca sobre sí mismo
// para revocarse — mismo patrón defensivo que toggleActiveUser usa para evitar
// que un admin se bloquee a sí mismo por accidente.
const toggleInstitutionAdmin = (req, res) => {
  const allowedRoles = [1, 4];
  if (!allowedRoles.includes(parseInt(req.decoded.roleId))) {
    return res.status(403).json({message: "Acceso denegado."});
  }
  const { userProfileId, isInstitutionAdmin } = req.body;
  const callerRoleId = parseInt(req.decoded.roleId);

  // El objetivo siempre debe ser rol 4, sin importar quién llame — se valida
  // consultando el perfil real, nunca confiando en el body.
  userModel.getUserInstitutionInfo(userProfileId, (eTarget, rTarget) => {
    if (eTarget) {
      return res.status(500).json({message: "Error del servidor."});
    } else if (rTarget.length === 0) {
      return res.status(404).json({message: "Usuario no encontrado."});
    }
    const target = rTarget[0];
    if (parseInt(target.role_id) !== 4) {
      return res.status(400).json({message: "Este privilegio solo aplica a personal hospitalario."});
    }

    const proceed = () => {
      userModel.toggleInstitutionAdmin(userProfileId, isInstitutionAdmin, (e, r) => {
        if (e) {
          return res.status(500).json({message: "Error del servidor."});
        } else {
          res.status(200).json({message: "Privilegio de administrador de institución actualizado.", data: { userProfileId, isInstitutionAdmin: Boolean(isInstitutionAdmin) }});
        }
      });
    }

    if (callerRoleId === 1) {
      return proceed();
    }

    // Rol 4: exige privilegio propio + misma institución + no auto-revocarse
    userModel.getUserInstitutionInfo(req.decoded.userProfileId, (eCaller, rCaller) => {
      if (eCaller || rCaller.length === 0) {
        return res.status(500).json({message: "Error del servidor."});
      }
      const caller = rCaller[0];
      if (!caller.is_institution_admin) {
        return res.status(403).json({message: "No tienes privilegios de administrador de tu institución."});
      } else if (parseInt(target.institution_id) !== parseInt(caller.institution_id)) {
        return res.status(403).json({message: "Solo puedes administrar usuarios de tu propia institución."});
      } else if (parseInt(userProfileId) === parseInt(req.decoded.userProfileId) && isInstitutionAdmin === false) {
        return res.status(403).json({message: "No puedes revocar tu propio privilegio de administrador."});
      } else {
        proceed();
      }
    });
  });
}


//Controller para editar datos del perfil del usuario
const editUserProfile = (req, res) => {
  // institutionId/roleId SIEMPRE se derivan server-side aquí dentro (nunca del
  // body) salvo para rol 1 — antes de esta corrección, cualquier usuario
  // "editando su propio perfil" podía mandar roleId/institutionId distintos en
  // el body y el modelo los aplicaba sin validar nada (auto-ascenso de
  // privilegios). Se corrige preservando siempre los valores reales de BD.
  // assignedAmbulanceId y el horario (shiftWindows — un rango de hora por
  // día, ver isWithinSchedule) siguen la misma lógica: nunca se confía en
  // que el usuario se los auto-asigne, solo un admin (rol 1 o 4) puede
  // cambiarlos. Esto es crítico para el horario en particular — si un
  // paramédico pudiera editar su propio horario, podría ponerse "disponible
  // siempre" y saltarse el bloqueo de iniciar-turno-fuera-de-horario.
  const editProfile = (userProfileId, institutionId, roleId, assignedAmbulanceId, shiftWindows) => {
    const {
          firstName,
          firstSurname,
          secondSurname,
          phone,
          birthDate,
          cveUnicaRegistroPob,
          emergencyContact,
          emergencyPhone } = req.body

    userModel.editUserProfile(userProfileId, institutionId, roleId, firstName, firstSurname, secondSurname, phone,
    birthDate, cveUnicaRegistroPob, emergencyContact, emergencyPhone, assignedAmbulanceId, shiftWindows, (e, r) => {
      if (e) {
        console.log(e)
        return res.status(500).json({message: "Error actualizando datos."})
      } else {
        return res.status(200).json({message: "Datos actualizados con éxito."})
      }
    })
  }

  // shift_windows llega de BD como un string JSON (columna JSON de MySQL) —
  // hay que parsearlo antes de reusarlo, nunca reenviarlo tal cual al modelo
  // (que hace JSON.stringify esperando un array, no un string ya serializado).
  const parseStoredWindows = (raw) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  const targetUserProfileId = parseInt(req.body.userProfileId);
  const callerRoleId = parseInt(req.decoded.roleId);

  if (callerRoleId === 1) {
    // Rol 1: bypass total, incluyendo institutionId y roleId del body. Igual
    // que al registrar, si el rol nuevo es paramédico con ambulancia, esa
    // ambulancia debe ser de una institución CRUM.
    const newRoleId = parseInt(req.body.roleId);
    const newAmbulanceId = newRoleId === 3 ? (req.body.assignedAmbulanceId || null) : null;
    const newShiftWindows = newRoleId === 3 ? (req.body.shiftWindows || null) : null;
    if (newRoleId === 3 && newAmbulanceId) {
      userModel.getAmbulanceInstitutionInfo(newAmbulanceId, (e, r) => {
        if (e || r.length === 0) return res.status(404).json({message: "Ambulancia no encontrada."});
        if (!r[0].is_crum_institution) return res.status(400).json({message: "Desde aquí solo puedes asignar paramédicos a ambulancias de instituciones CRUM."});
        editProfile(targetUserProfileId, req.body.institutionId, newRoleId, newAmbulanceId, newShiftWindows);
      });
    } else {
      editProfile(targetUserProfileId, req.body.institutionId, newRoleId, newAmbulanceId, newShiftWindows);
    }
    return;
  }

  if (req.decoded.userProfileId === targetUserProfileId) {
    // Auto-edición: cualquier rol autenticado puede editar sus propios datos
    // de contacto, pero nunca su propio institutionId, roleId,
    // assigned_ambulance_id, ni horario — todos esos son exclusivos de un
    // admin (ver comentario arriba de editProfile).
    userModel.getUserById(targetUserProfileId, (e, r) => {
      if (e || r.length === 0) {
        return res.status(500).json({message: "Error del servidor."});
      }
      const self = r[0];
      editProfile(targetUserProfileId, self.institution_id, self.role_id, self.assigned_ambulance_id, parseStoredWindows(self.shift_windows));
    });
    return;
  }

  if (callerRoleId === 4) {
    // Admin de institución: puede editar personal de SU MISMA institución —
    // antes solo rol 4, ahora también rol 3 (paramédicos), incluyendo poder
    // cambiar entre esos dos roles y reasignar la ambulancia de un
    // paramédico (ej. si la unidad que tenía se dio de baja). Nunca
    // institutionId, nunca otro rol distinto de 3/4.
    userModel.getUserInstitutionInfo(req.decoded.userProfileId, (eCaller, rCaller) => {
      if (eCaller || rCaller.length === 0) {
        return res.status(500).json({message: "Error del servidor."});
      }
      const caller = rCaller[0];
      if (!caller.is_institution_admin) {
        return res.status(403).json({message: "No tienes privilegios de administrador de tu institución."});
      }
      userModel.getUserById(targetUserProfileId, (eTarget, rTarget) => {
        if (eTarget || rTarget.length === 0) {
          return res.status(404).json({message: "Usuario no encontrado."});
        }
        const target = rTarget[0];
        if (![3, 4].includes(parseInt(target.role_id)) || parseInt(target.institution_id) !== parseInt(caller.institution_id)) {
          return res.status(403).json({message: "Solo puedes editar personal (paramédicos o empleados) de tu propia institución."});
        }
        const requestedRole = parseInt(req.body.roleId) === 3 ? 3 : 4;
        if (requestedRole !== 3) {
          return editProfile(targetUserProfileId, target.institution_id, requestedRole, null, null);
        }
        // Si el body no trae un campo nuevo, conserva el que ya tenía — así un
        // PATCH que no lo toca no lo borra por accidente.
        const newAmbulanceId = req.body.assignedAmbulanceId || target.assigned_ambulance_id;
        const newShiftWindows = req.body.shiftWindows !== undefined ? req.body.shiftWindows : parseStoredWindows(target.shift_windows);
        if (!newAmbulanceId) {
          return editProfile(targetUserProfileId, target.institution_id, requestedRole, null, newShiftWindows);
        }
        userModel.getAmbulanceInstitutionInfo(newAmbulanceId, (e2, r2) => {
          if (e2 || r2.length === 0) return res.status(404).json({message: "Ambulancia no encontrada."});
          if (parseInt(r2[0].institution_id) !== parseInt(caller.institution_id)) return res.status(403).json({message: "Solo puedes asignar ambulancias de tu propia institución."});
          editProfile(targetUserProfileId, target.institution_id, requestedRole, newAmbulanceId, newShiftWindows);
        });
      });
    });
    return;
  }

  return res.status(403).json({ message: "Acceso denegado" });
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
  } else if (req.decoded.userCredentialId === parseInt(userCredentialId)) {
    // cualquier rol autenticado puede editar sus propias credenciales (antes limitado solo al rol 5)
    editCredentials(userCredentialId, email, password);
  } else if (parseInt(req.decoded.roleId) === 4) {
    // Admin de institución: puede resetear credenciales de OTRO empleado rol 4
    // de SU MISMA institución únicamente.
    userModel.getUserInstitutionInfo(req.decoded.userProfileId, (eCaller, rCaller) => {
      if (eCaller || rCaller.length === 0) {
        return res.status(500).json({message: "Error del servidor."});
      }
      const caller = rCaller[0];
      if (!caller.is_institution_admin) {
        return res.status(403).json({message: "No tienes privilegios de administrador de tu institución."});
      }
      userModel.getUserInstitutionInfoByCredentialId(userCredentialId, (eTarget, rTarget) => {
        if (eTarget || rTarget.length === 0) {
          return res.status(404).json({message: "Usuario no encontrado."});
        }
        const target = rTarget[0];
        if (parseInt(target.role_id) !== 4 || parseInt(target.institution_id) !== parseInt(caller.institution_id)) {
          return res.status(403).json({message: "Solo puedes administrar credenciales de tu propia institución."});
        }
        editCredentials(userCredentialId, email, password);
      });
    });
  } else {
    return res.status(403).json({message: "Fuera de mi territorio. REGRESA POR DONDE VINISTE PUTA"})
  }
}


//---------------Controllers para hacer get de las tablas necesarias------------------
//No considero que estas tablas deban tener restricción por JWT

// shift_windows viaja en BD como string JSON (columna JSON de MySQL, el
// driver no lo auto-parsea) — se convierte a array aquí para que ningún
// cliente tenga que hacer JSON.parse por su cuenta.
const parseShiftWindowsRow = (row) => ({
  ...row,
  shift_windows: row.shift_windows ? JSON.parse(row.shift_windows) : null,
})

//Controller para obtener los datos de todos los usuarios
const getAllUsers = (req, res) => {
  const allowedRoles = [1, 2, 3, 4]
  if (allowedRoles.includes(parseInt(req.decoded.roleId))) {
    userModel.getAllUsers((e, r) => {
      if (e){
        return res.status(500).json({message: "Error del servidor."})
      } else {
        res.status(200).json({message:"Datos obtenidos correctamente", data: r.map(parseShiftWindowsRow)})
      }
    })
  } else {
    return res.status(403).json({message: "Acceso denegado."})
  }
}

//Controller para obtener un solo usuario dependiendo del ID
const getUserById = (req, res) => {
  const allowedRoles = [1, 2, 3, 4]
  const { userProfileId } = req.params;
  // Cualquier rol puede consultar su propio perfil (p.ej. paciente en Mi Perfil),
  // además del acceso amplio ya existente para 1-4 sobre cualquier perfil.
  const isSelf = req.decoded.userProfileId === parseInt(userProfileId);
  if (!allowedRoles.includes(parseInt(req.decoded.roleId)) && !isSelf) {
    return res.status(403).json({message: "Acceso denegado."})
  } else {
    userModel.getUserById(userProfileId, (e, r)=>{
      if(e){
        return res.status(500).json({message: "Error del servidor."})
      } else {
        if (r.length === 0) {
          return res.status(404).json({message: "Usuario no encontrado", user: null})
          //este user: null lo voy a usar para cuando el frontend consulte y vea que no existe el user
        } else {
          res.status(200).json({message: "Usuario encontrado:", user: r.map(parseShiftWindowsRow)})
        }
      }
    })
  }
}


//Controller para obtener el historial de activaciones/desactivaciones de una cuenta (admin)
const getCredentialHistory = (req, res) => {
  if (parseInt(req.decoded.roleId) !== 1) return res.status(403).json({message: "Acceso denegado."})
  const { userCredentialId } = req.params;
  userModel.getCredentialHistory(userCredentialId, (e, r) => {
    if (e) return res.status(500).json({message: "Error del servidor."})
    res.status(200).json({message: "Historial de la cuenta", history: r})
  })
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

const getCityById = (req, res) => {
    const {cityId} = req.params;
    userModel.getCityById(cityId, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Ciudad", data: r});
        }
    });
}

const getUserByCURP = (req, res) => {
    const { curp } = req.params;
    userModel.getUserByCURP(curp, (e, r) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Búsqueda por CURP", data: r});
        }
    });
}

// Rol 3 (paramédico) corrigiendo/llenando la CURP de un paciente que trae
// registrado — a veces llega vacía o como "No tiene" desde sicem-web/desktop,
// y en escena es el paramédico quien puede leerla del documento físico o
// preguntarle al paciente. Deliberadamente NO reutiliza editUserProfile: esa
// función solo deja editar el perfil propio, el de un admin, o (rol 4) el
// personal de la misma institución — nunca el de OTRO usuario tratado como
// paciente. Esta ruta es angosta a propósito: solo toca la columna curp, y
// solo si el objetivo es de verdad un paciente (rol 5).
const updatePatientCurp = (req, res) => {
    if (parseInt(req.decoded.roleId) !== 3) {
        return res.status(403).json({message: "Acceso denegado."});
    }
    const { userProfileId, curp } = req.body;
    if (!curp || !curp.trim()) {
        return res.status(400).json({message: "La CURP no puede quedar vacía."});
    }
    if (curp.trim().length > 18) {
        return res.status(400).json({message: "La CURP debe tener máximo 18 caracteres."});
    }
    userModel.getUserRole(userProfileId, (e, r) => {
        if (e || r.length === 0) {
            return res.status(404).json({message: "Paciente no encontrado."});
        }
        if (parseInt(r[0].role_id) !== 5) {
            return res.status(403).json({message: "Solo puedes editar la CURP de un paciente."});
        }
        userModel.updatePatientCurp(userProfileId, curp.trim().toUpperCase(), (e2) => {
            if (e2) {
                if (e2.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({message: "Ya existe otro paciente registrado con esa CURP."});
                }
                return res.status(500).json({message: "Error del servidor."});
            }
            res.status(200).json({message: "CURP actualizada."});
        });
    });
}

// Cualquier usuario autenticado puede registrar SU PROPIO token — nunca el
// de otro (userProfileId siempre sale del JWT, nunca del body).
const registerPushToken = (req, res) => {
    const { pushToken } = req.body;
    if (!pushToken) {
        return res.status(400).json({message: "Falta el token."});
    }
    userModel.updatePushToken(req.decoded.userProfileId, pushToken, (e) => {
        if (e) {
            return res.status(500).json({message: "Error del servidor."});
        } else {
            res.status(200).json({message: "Token registrado."});
        }
    });
}


module.exports = { register, login, registerPatient, toggleActiveUser, toggleInstitutionAdmin, editUserProfile, editUserCredentials, getUserByCURP, updatePatientCurp,
                  getAllUsers, getUserById, getCredentialHistory, getAllRoles, getAllInstitutions, getAllInstitutionTypes, getAllStates, getCitiesByState, getCityById,
                  registerPushToken};