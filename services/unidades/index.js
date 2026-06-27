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
                roleId
            } = d;
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

server.listen(PORT, () => {console.log(`Servicio de unidades. Puerto: ${PORT}`)})