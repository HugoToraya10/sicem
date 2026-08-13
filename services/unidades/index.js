const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./config/db')
const unitRoutes = require('./routes/unit')
const PORT = process.env.PORT
const http = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { setIo } = require('./config/socket')
const unitController = require('./controllers/unit')

const app = express();

app.use(cors())
app.use(express.json())
app.use('/unidades', unitRoutes)

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: '*' }
})

setIo(io);

// Presencia en tiempo real de paramédicos EN LÍNEA (socket conectado al
// servicio de unidades). Se usa en sicem-web (Ambulances.jsx) para pintar el
// puntito verde SOLO en los que de verdad tienen su celular conectado ahora
// mismo — el contador por usuario protege el caso de que un mismo paramédico
// tenga dos sockets abiertos (cierra uno y el otro sigue valiendo).
const onlineParamedicCounts = new Map(); // userProfileId -> nº de sockets abiertos
const socketToUser = new Map(); // socket.id -> userProfileId

const addOnlineParamedic = (io, userProfileId) => {
    const prev = onlineParamedicCounts.get(userProfileId) || 0;
    onlineParamedicCounts.set(userProfileId, prev + 1);
    if (prev === 0) {
        io.to('admin').to('despachador').emit('eventParamedicOnline', { userProfileId: parseInt(userProfileId) });
    }
}

const removeOnlineParamedic = (io, userProfileId) => {
    const prev = onlineParamedicCounts.get(userProfileId) || 0;
    if (prev <= 1) {
        onlineParamedicCounts.delete(userProfileId);
        io.to('admin').to('despachador').emit('eventParamedicOffline', { userProfileId: parseInt(userProfileId) });
    } else {
        onlineParamedicCounts.set(userProfileId, prev - 1);
    }
}

io.on('connection', (socket) => {
    console.log(`cliente ${socket.id} conectado`)
    const token = socket.handshake.auth.token;
    const key = process.env.JWT_SECRET;
    //decodificar ese token
    jwt.verify(token, key, (e, d) => {
        if(e) {
            socket.disconnect(true);
        } else {
            socket.emit('Hola, verificado', 'xd')
            const {
                userProfileId,
                userCredentialId,
                roleId,
                sessionId,
            } = d;
            // Room individual — para poder avisarle a ESTE paramédico en
            // particular (no a todos) cuando su turno se cierra solo por
            // vencimiento de horario (ver startShiftExpirySweep en
            // controllers/unit.js, evento eventForceLogout).
            socket.join('user_' + userProfileId)
            // Room por SESIÓN (solo rol 3 trae sessionId en el token — ver login
            // en services/usuarios) — separado del room por usuario a propósito:
            // cuando alguien inicia sesión en otro dispositivo con la misma
            // cuenta, hay que avisarle SOLO al socket de la sesión VIEJA que se
            // cierre, nunca al que apenas se acaba de conectar (que ya trae la
            // sesión nueva). Si se usara el room por usuario para esto, ambos
            // dispositivos lo recibirían — con este room aparte, es imposible
            // que la sesión nueva se cierre a sí misma por accidente.
            if (sessionId) socket.join('session_' + sessionId)
            //ahora vamos a meter al wey en un room según su roleId
            switch(parseInt(roleId)) {
                case 1: socket.join('admin')
                    break;
                case 2: socket.join('despachador')
                    break;
                case 3: socket.join('paramedico')
                    break;
                case 4: socket.join('hospital')
                    break;
                case 5: socket.join('paciente')
                    break;
                default: socket.disconnect();
                    break;
            }
            // Presencia en línea: un paramédico conectado cuenta como en línea;
            // admin/despachador/hospital reciben el estado actual al conectar
            // para poder pintar los puntitos sin recargar.
            if (parseInt(roleId) === 3) {
                // Un paramédico SIN ambulancia asignada no debe emitir presencia:
                // no hay unidad a la que vincular su ubicación, así que se filtra
                // en el origen. Aún así conserva su socket (rooms) para poder
                // recibir avisos de cierre de sesión u otros mensajes.
                db.query(
                    'SELECT assigned_ambulance_id FROM user_profiles WHERE user_profile_id = ?',
                    [userProfileId],
                    (_e, rows) => {
                        const hasAmbulance = rows && rows.length > 0 && rows[0].assigned_ambulance_id != null;
                        if (hasAmbulance) {
                            socketToUser.set(socket.id, userProfileId);
                            addOnlineParamedic(io, userProfileId);
                        }
                    }
                );
            } else if ([1, 2, 4].includes(parseInt(roleId))) {
                socket.emit('eventParamedicPresence', { online: [...onlineParamedicCounts.keys()] });
            }
            console.log(`Rooms del socket ${socket.id}:`, socket.rooms)
        }
    })

    socket.on('disconnect', () => {
        console.log(`Usuario ${socket.id} desconectado.`)
        const uid = socketToUser.get(socket.id);
        if (uid !== undefined) {
            socketToUser.delete(socket.id);
            removeOnlineParamedic(io, uid);
        }
    })
})

module.exports = io

server.listen(PORT, () => {
    console.log(`Servicio de unidades. Puerto: ${PORT}`)
    // Empieza a revisar en segundo plano turnos vencidos (horario laboral +
    // gracia) para cerrarlos y liberar la unidad solos.
    unitController.startShiftExpirySweep()
})