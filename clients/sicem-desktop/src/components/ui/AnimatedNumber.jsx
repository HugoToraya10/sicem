import { useLayoutEffect, useRef } from 'react'

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Número que cuenta hasta su valor (al aparecer) y entre valores (cuando cambia en vivo).
// Escribe directo en el DOM durante la animación: no vuelve a renderizar el componente por cada cuadro.
const AnimatedNumber = ({ value, decimals = 0, duration = 650 }) => {
    const ref = useRef(null)
    const shown = useRef(null)
    const first = useRef(true)
    const frame = useRef(0)

    useLayoutEffect(() => {
        const el = ref.current
        const to = Number(value)
        if (!el || !Number.isFinite(to)) return undefined
        const fmt = (n) => n.toFixed(decimals)
        const from = shown.current ?? 0
        if (prefersReducedMotion() || from === to) { shown.current = to; el.textContent = fmt(to); return undefined }
        if (!first.current) {
            el.classList.remove('num-bump')
            void el.offsetWidth
            el.classList.add('num-bump')
        }
        first.current = false
        const start = performance.now()
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            const current = from + (to - from) * eased
            shown.current = current
            el.textContent = fmt(current)
            if (t < 1) frame.current = requestAnimationFrame(tick)
            else { shown.current = to; el.textContent = fmt(to) }
        }
        frame.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame.current)
    }, [value, decimals, duration])

    const n = Number(value)
    return <span ref={ref} className="num">{Number.isFinite(n) ? n.toFixed(decimals) : value}</span>
}

export default AnimatedNumber
