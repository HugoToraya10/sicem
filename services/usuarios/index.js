const express = require('express')
const cors = require('cors')
require('dotenv').config()
const db = require('./config/db')
const userRoutes = require('./routes/user')

const app = express();
const PORT = process.env.PORT


app.use(cors())
app.use(express.json())

app.get('/ping', (req, res) => {
    res.json({mensaje:'pong'})
})

app.use('/usuarios', userRoutes)

app.listen(PORT, () => {console.log(`Servicio de usuarios. Puerto: ${PORT}`)})