// Reemplazo directo de Alert.alert(titulo, mensaje, botones) de React Native.
// Misma firma, pero el diálogo lo dibuja la propia app (ver components/AlertHost.js) con los colores y
// la tipografía del sistema, en vez del cuadro azul de Android. Si AlertHost no está montado, cae al Alert nativo.
import { Alert as NativeAlert } from 'react-native'

let listener = null

export const registerAlertHost = (fn) => { listener = fn; return () => { if (listener === fn) listener = null } }

export const Alert = {
    alert: (title, message, buttons, options) => {
        if (!listener) return NativeAlert.alert(title, message, buttons, options)
        listener({ title, message, buttons: buttons && buttons.length ? buttons : [{ text: 'Entendido' }], cancelable: options?.cancelable !== false })
    },
}
