// Alerta de paciente nuevo — notificación nativa del SO + sonido corto.
// Sin dependencias externas (ni assets de audio, ni servicios como FCM): la
// notificación usa la Web Notification API estándar (Electron la traduce
// directo a notificaciones nativas del sistema operativo desde el renderer,
// sin necesidad de tocar el proceso principal), y el sonido se genera al
// vuelo con Web Audio API en vez de depender de un archivo .mp3/.wav.

// Se pide una sola vez, apenas se sepa que hace falta (al montar la pantalla
// de Pacientes en Camino) — así ya está listo para cuando llegue el primer evento.
export const ensureNotificationPermission = () => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
    }
}

export const showPatientNotification = (title, body) => {
    if (typeof Notification === 'undefined') {
        console.warn('[notify] Notification API no disponible en este contexto.')
        return
    }
    if (Notification.permission !== 'granted') {
        // Antes esto fallaba en silencio — sin este log, "no llegó la
        // notificación" y "nunca se concedió el permiso" se veían idénticos.
        console.warn('[notify] Permiso de notificación no concedido (estado actual: ' + Notification.permission + '). No se muestra la notificación nativa.')
        return
    }
    const notification = new Notification(title, { body })
    // Al hacer clic, trae la ventana de la app al frente — Electron enfoca el
    // BrowserWindow correspondiente cuando el renderer llama a window.focus().
    notification.onclick = () => window.focus()
}

// Dos tonos cortos ascendentes (patrón de alerta corto, no invasivo) generados
// con un oscilador — nada de archivos de audio que mantener.
export const playAlertSound = () => {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return
        const ctx = new AudioContextClass()

        // Chromium suspende un AudioContext nuevo si no se creó a partir de un
        // gesto directo del usuario (clic/tecla) — y un evento de socket no lo
        // es. Sin este resume(), el contexto se queda "suspended" para
        // siempre y las notas se agendan pero nunca sé oyen, sin ningún error.
        const scheduleTones = () => {
            const playTone = (frequency, startTime, duration) => {
                const oscillator = ctx.createOscillator()
                const gain = ctx.createGain()
                oscillator.type = 'sine'
                oscillator.frequency.value = frequency
                gain.gain.setValueAtTime(0.15, startTime)
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
                oscillator.connect(gain)
                gain.connect(ctx.destination)
                oscillator.start(startTime)
                oscillator.stop(startTime + duration)
            }

            const now = ctx.currentTime
            playTone(740, now, 0.15)
            playTone(988, now + 0.15, 0.2)
        }

        if (ctx.state === 'suspended') {
            ctx.resume().then(scheduleTones).catch((error) => console.error('[notify] No se pudo reanudar el AudioContext. ', error))
        } else {
            scheduleTones()
        }
    } catch (error) {
        console.error('Error reproduciendo alerta sonora. ', error)
    }
}

export const alertNewPatient = (title, body) => {
    console.log(`[notify] Disparando alerta: "${title}" — ${body}`)
    playAlertSound()
    showPatientNotification(title, body)
}
