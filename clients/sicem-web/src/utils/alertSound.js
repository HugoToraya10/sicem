// Aviso sonoro corto para eventos críticos (nueva emergencia, falla de unidad).
// Preferencia de silencio recordada en localStorage (comodidad por usuario).
const KEY = 'sicem_alert_muted'

export const isMuted = () => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export const setMuted = (muted) => {
    try { localStorage.setItem(KEY, muted ? '1' : '0') } catch { /* sin storage: no se recuerda */ }
}

let ctx = null

export const playAlert = () => {
    if (isMuted()) return
    try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
        // Chromium deja el contexto "suspended" si se creó fuera de un gesto del usuario
        if (ctx.state === 'suspended') ctx.resume()
        const now = ctx.currentTime
        ;[0, 0.22].forEach((offset, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = i === 0 ? 880 : 1175
            gain.gain.setValueAtTime(0.0001, now + offset)
            gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
            osc.connect(gain).connect(ctx.destination)
            osc.start(now + offset)
            osc.stop(now + offset + 0.2)
        })
    } catch { /* sin audio disponible: el aviso visual basta */ }
}
