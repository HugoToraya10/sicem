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
            console.log(`Rooms del socket ${socket.id}:`, socket.rooms)
        }
    })

    socket.on('disconnect', () => {
        console.log(`Usuario ${socket.id} desconectado.`)
    })
})

module.exports = io

server.listen(PORT, () => {
    console.log(`Servicio de unidades. Puerto: ${PORT}`)
    // Empieza a revisar en segundo plano turnos vencidos (horario laboral +
    // gracia) para cerrarlos y liberar la unidad solos.
    unitController.startShiftExpirySweep()
})