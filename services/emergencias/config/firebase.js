const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

// Credenciales de la cuenta de servicio de Firebase — se descargan desde
// Firebase Console > Configuración del proyecto > Cuentas de servicio >
// Generar nueva clave privada. En desarrollo local vive en /shared (raíz del
// repo, fuera de cualquier servicio) a propósito: es UNA sola llave que le da
// a quien la tenga control total de enviar notificaciones del proyecto, y con
// el tiempo más de un servicio la va a necesitar — si cada servicio tuviera
// su propia copia, rotar la llave significaría acordarse de cambiarla en N
// lugares, y cada copia extra es una oportunidad más de que se filtre por
// accidente. Nunca se sube a git (ver .gitignore en la raíz).
//
// En un entorno efímero (Codespaces, o cualquier host en la nube) no hay
// forma de "subir un archivo" que sobreviva si el contenedor se recrea desde
// cero — por eso también se acepta el JSON completo como texto en la
// variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON (p. ej. un Codespaces
// secret), que gana sobre el archivo si ambos existen. El archivo sigue
// siendo la vía normal para desarrollo local.
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../../../shared/firebase-service-account.json');

const loadServiceAccount = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (error) {
            console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido. ', error.message);
            return null;
        }
    }
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        return require(SERVICE_ACCOUNT_PATH);
    }
    return null;
};

let messaging = null;
const serviceAccount = loadServiceAccount();
if (serviceAccount) {
    const app = initializeApp({
        credential: cert(serviceAccount),
    });
    messaging = getMessaging(app);
} else {
    console.warn('[FCM] Sin credenciales de Firebase (ni FIREBASE_SERVICE_ACCOUNT_JSON ni /shared/firebase-service-account.json) — las notificaciones push NO se van a mandar hasta que agregues una de las dos. El resto del sistema sigue funcionando normal (esto no bloquea nada).');
}

// token = el token de dispositivo que guardó sicem-mobile (ver
// registrar-push-token en usuarios). data solo acepta strings (requisito de
// FCM) — se convierte todo automáticamente.
const sendPushNotification = (token, title, body, data = {}) => {
    if (!messaging || !token) return Promise.resolve();
    const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
    return messaging.send({
        token,
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
    }).catch((error) => {
        console.error('[FCM] Error enviando notificación push. ', error.message);
    });
};

module.exports = { sendPushNotification };
