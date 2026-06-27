const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express();
const PORT = process.env.PORT
const {createProxyMiddleware} = require('http-proxy-middleware')

app.use(cors())

app.use('/usuarios', createProxyMiddleware({target: 'http://localhost:3001/usuarios', changeOrigin: true}))
app.use('/hospitales', createProxyMiddleware({target: 'http://localhost:3002/hospitales', changeOrigin: true}))
app.use('/unidades', createProxyMiddleware({target: 'http://localhost:3003/unidades', changeOrigin: true}))
app.use('/pacientes', createProxyMiddleware({target: 'http://localhost:3004/pacientes', changeOrigin: true}))
app.use('/emergencias', createProxyMiddleware({target: 'http://localhost:3005/emergencias', changeOrigin: true}))


app.listen(PORT, () => {console.log(`API GATEWAY. Puerto: ${PORT}`)})