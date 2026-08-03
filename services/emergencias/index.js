const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./config/db')
const emergencyRoutes = require('./routes/emergency')
const { Server } = require('socket.io')
const { createServer } = require('node:http')
const jwt = require('jsonwebtoken');
const configSocket = require('./config/socket')

const app = express();
const PORT = process.env.PORT

app.use(cors({
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
}))
app.use(express.json())
app.use('/emergencias', emergencyRoutes)

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
})

configSocket.setIo(io);

io.on('connection', (socket) => {
    console.log(`Cliente ${socket.id} conectado.`);
    const token = socket.handshake.auth.token;
    const key = process.env.JWT_SECRET;
    jwt.verify(token, key, (e, d) => {
        if(e){
            // Un token vencido (dura 8h) o inválido cae aquí — se desconecta sin
            // unirse a ninguna sala, así que ese cliente deja de recibir eventos
            // hasta que vuelva a iniciar sesión.
            socket.disconnect(true)
        } else {
            let roleString = '';
            socket.roleString = roleString;

            const { userProfileId, userCredentialId, roleId } = d;

            // Room personal, aparte del room de rol — para poder dirigir un evento
            // a UNA persona específica (ej. solo al paramédico con turno activo en
            // la unidad que se acaba de asignar) sin transmitirlo a todo su rol.
            socket.join('user_' + userProfileId)

            switch(roleId) {
                case 1: {
                    socket.roleString = 'admin'
                    socket.join(socket.roleString)
                } break;
                case 2: {
                    socket.roleString = 'dispatcher'
                    socket.join(socket.roleString)
                } break;
                case 3: {
                    socket.roleString = 'paramedic'
                    socket.join(socket.roleString)
                } break;
                case 4: {
                    socket.roleString = 'hospital'
                    socket.join(socket.roleString)
                } break;
                case 5: {
                    socket.roleString = 'patient'
                    socket.join(socket.roleString)
                } break;
                default: socket.disconnect(true); break;
            }
            socket.emit('Hola, usuario: ', toString(socket.roleString))
        }
    })
    socket.on('disconnect', () => {
        console.log(`Usuario ${socket.id} con rol ${socket.roleString} desconectado.`)
    })
})



server.listen(PORT, () => {console.log(`Servicio de emergencias. Puerto: ${PORT}`)})