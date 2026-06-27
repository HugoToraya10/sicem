const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./config/db')
const hospitalRoutes = require('./routes/hospital')
const http = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { setIo } = require('./config/socket')

const app = express()
const PORT = process.env.PORT

app.use(cors())
app.use(express.json())

app.get('/ping', (req, res) => {
    res.json({mensaje: 'pong'})
})

app.use('/hospitales', hospitalRoutes)

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

setIo(io)

io.on('connection', (socket) => {
    console.log(`Cliente ${socket.id} conectado.`)
    const token = socket.handshake.auth.token
    const key = process.env.JWT_SECRET
    jwt.verify(token, key, (e, d) => {
        if (e) {
            socket.disconnect(true)
        } else {
            socket.roleString = ''
            const { roleId } = d
            switch(parseInt(roleId)) {
                case 1: socket.roleString = 'admin';      socket.join(socket.roleString); break;
                case 2: socket.roleString = 'dispatcher'; socket.join(socket.roleString); break;
                case 3: socket.roleString = 'paramedic';  socket.join(socket.roleString); break;
                case 4: socket.roleString = 'hospital';   socket.join(socket.roleString); break;
                case 5: socket.roleString = 'patient';    socket.join(socket.roleString); break;
                default: socket.disconnect(true); break;
            }
        }
    })
    socket.on('disconnect', () => {
        console.log(`Cliente ${socket.id} desconectado.`)
    })
})

server.listen(PORT, () => { console.log(`Servicio de hospitales. Puerto: ${PORT}`) })