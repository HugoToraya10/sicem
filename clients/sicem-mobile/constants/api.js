import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'

// "localhost" en un celular físico apunta al propio celular, no a tu compu —
// por eso el HOST se resuelve solo. Expo/Metro ya sabe la IP de la PC donde
// corriste `npx expo start` (te la muestra el QR) — la expone en
// Constants.expoConfig.hostUri como "192.168.1.50:8081". La sacamos de ahí
// y la reusamos para hablarle al gateway/socket, que corren en la MISMA PC
// durante desarrollo.
const detectHostFromMetro = () => {
    const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost
    if (!hostUri) return null
    const host = hostUri.split(':')[0]
    return host || null
}

// Caso especial: el EMULADOR de Android (no un celular físico) vive en su
// propia red aislada (NAT de QEMU) — ahí "localhost" significa el emulador
// mismo, nunca tu PC. Metro llega igual porque usa un túnel (adb reverse)
// para el puerto del bundler, y por eso detectHostFromMetro() reportaría
// "localhost" — pero eso NO sirve para hablarle al backend (gateway,
// sockets), que sí necesitan la IP real. Android reserva 10.0.2.2 como
// alias fijo para "la PC que corre el emulador", pase lo que pase con la
// red real — por eso se usa a fuerzas en este caso, sin depender del
// auto-detect. Un iPhone/Android físico, o el simulador de iOS (que SÍ
// comparte la red de la Mac), no entran aquí.
const ANDROID_EMULATOR_HOST = '10.0.2.2'
const isAndroidEmulator = Platform.OS === 'android' && !Device.isDevice

// Si EXPO_PUBLIC_HOST está seteado en .env, gana ese valor manual sobre
// todo lo demás (útil si el backend NO vive en la misma PC que Metro, o en
// producción). Si no, se detecta solo según dónde esté corriendo.
const HOST = process.env.EXPO_PUBLIC_HOST || (isAndroidEmulator ? ANDROID_EMULATOR_HOST : detectHostFromMetro()) || 'localhost'

// Un backend en la nube (p. ej. GitHub Codespaces) no vive en "un host y
// varios puertos" — cada puerto reenviado sale como su propia URL completa
// (https://xxx-3000.app.github.dev, https://xxx-3005.app.github.dev, cada
// una con su propio subdominio), así que pegarle ":3005" a un HOST no
// funciona ahí. Si estas variables están seteadas, ganan tal cual sobre la
// construcción HOST:puerto de abajo.
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
const ENV_SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL
const ENV_UNITS_SOCKET_URL = process.env.EXPO_PUBLIC_UNITS_SOCKET_URL

// Todo lo REST pasa por el gateway (puerto 3000).
export const API_BASE_URL = ENV_API_BASE_URL || `http://${HOST}:3000`

// Los sockets son la excepción — se conectan directo al servicio de
// emergencias (puerto 3005), sin pasar por el gateway. Mismo patrón que
// sicem-web/sicem-desktop.
export const SOCKET_URL = ENV_SOCKET_URL || `http://${HOST}:3005`

// El servicio de unidades tiene su PROPIO servidor de Socket.IO (puerto
// 3003), separado del de emergencias — hace falta esta conexión aparte para
// recibir eventForceLogout (turno cerrado solo por vencimiento de horario,
// ver startShiftExpirySweep en el backend).
export const UNITS_SOCKET_URL = ENV_UNITS_SOCKET_URL || `http://${HOST}:3003`
