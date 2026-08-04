import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

// Cómo se muestra una notificación mientras la app está ABIERTA en primer
// plano — sin esto, expo-notifications no la muestra por default (asume que
// la quieres manejar tú a mano). Cuando la app está cerrada/en segundo
// plano, esto ni se ejecuta — Android la muestra solo, por eso funciona
// incluso con la app cerrada.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
})

// Token de dispositivo "crudo" de FCM (getDevicePushTokenAsync), NO el token
// de Expo (getExpoPushTokenAsync) — así el backend le habla directo a FCM
// con las credenciales de Firebase del proyecto, sin depender de una cuenta
// de Expo/EAS ni de projectId. Requiere que exista google-services.json (ver
// app.json) y que la app corra desde un build nativo — NO funciona en Expo
// Go desde el SDK 53 en adelante.
const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) {
        console.warn('Las notificaciones push no funcionan en el simulador de iOS — en Android sí funcionan en emulador si tiene Google Play.')
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'SICEM',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2E7D32',
        })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
    }
    if (finalStatus !== 'granted') {
        console.warn('Permiso de notificaciones no concedido — no se recibirán alertas con la app cerrada.')
        return null
    }

    try {
        const { data: token } = await Notifications.getDevicePushTokenAsync()
        return token
    } catch (error) {
        console.error('Error obteniendo el token de notificaciones push. ', error)
        return null
    }
}

export { registerForPushNotificationsAsync }
