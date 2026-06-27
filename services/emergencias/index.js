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

app.use(cors())
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
            socket.disconnect(true)
        } else {
            let roleString = '';
            socket.roleString = roleString;
            
            const { userProfileId, userCredentialId, roleId } = d;
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