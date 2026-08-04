const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

// Credenciales de la cuenta de servicio de Firebase — se descargan desde
// Firebase Console > Configuración del proyecto > Cuentas de servicio >
// Generar nueva clave privada. Vive en /shared (raíz del repo, fuera de
// cualquier servicio) a propósito: es UNA sola llave que le da a quien la
// tenga control total de enviar notificaciones del proyecto, y con el
// tiempo más de un servicio la va a necesitar (usuarios para avisos de
// horario, unidades para turnos, etc.) — si cada servicio tuviera su propia
// copia, rotar la llave significaría acordarse de cambiarla en N lugares, y
// cada copia extra es una oportunidad más de que se filtre por accidente.
// Nunca se sube a git (ver .gitignore en la raíz) — solo vive en disco,
// local, referenciada por ruta desde cada servicio que la necesite.
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../../../shared/firebase-service-account.json');

let messaging = null;
if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const app = initializeApp({
        credential: cert(require(SERVICE_ACCOUNT_PATH)),
    });
    messaging = getMessaging(app);
} else {
    console.warn('[FCM] /shared/firebase-service-account.json no existe todavía — las notificaciones push NO se van a mandar hasta que lo agregues. El resto del sistema sigue funcionando normal (esto no bloquea nada).');
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
