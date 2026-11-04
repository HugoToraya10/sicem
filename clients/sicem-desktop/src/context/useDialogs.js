import { createContext, useContext } from 'react'

export const DialogsContext = createContext(null)

// notify(mensaje, tono)  -> aviso breve que no bloquea. tono: 'info' | 'ok' | 'error'
// confirm({ title, message, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
// prompt({ title, message, label, required, multiline, placeholder, danger }) -> Promise<string | null>
// Reemplazan a window.alert / window.confirm, que en Electron congelan la ventana y pueden
// quitar el foco de los campos de texto.
export const useDialogs = () => useContext(DialogsContext) || {
    notify: (message) => console.warn('[notify]', message),
    confirm: () => Promise.resolve(false),
    prompt: () => Promise.resolve(null),
}
