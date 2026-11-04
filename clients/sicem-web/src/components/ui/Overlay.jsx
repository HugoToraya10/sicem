import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import './Overlay.css'

// Paneles y diálogos del sistema. Un solo comportamiento para todos:
//  - Drawer: panel lateral para crear, editar o ver detalle SIN sacar a la persona de la pantalla en la que está.
//  - Modal: diálogo centrado para decisiones cortas o vistas que piden toda la atención.
// Ambos van en un portal (nunca quedan detrás de otra tarjeta), atrapan el foco, cierran con Esc,
// devuelven el foco a quien los abrió y bloquean el desplazamiento de la página mientras están abiertos.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Muchos formularios antiguos tienen <label> y control como hermanos sin enlazarlos: se enlazan aquí para que
// los lectores de pantalla (y un clic en la etiqueta) funcionen. No toca etiquetas que ya están enlazadas.
let labelSeq = 0
const linkLabels = (root) => {
    root.querySelectorAll('label').forEach((label) => {
        if (label.htmlFor || label.querySelector('input, select, textarea')) return
        const scope = label.parentElement
        const control = scope && scope.querySelector('input:not([type="hidden"]), select, textarea')
        if (!control) return
        if (!control.id) control.id = `ov-f-${++labelSeq}`
        label.htmlFor = control.id
    })
    // Formato de teléfono (10 dígitos) y CURP (18 caracteres): el navegador avisa antes de enviar.
    root.querySelectorAll('label[for]').forEach((label) => {
        const c = root.querySelector(`#${CSS.escape(label.htmlFor)}`)
        if (!c || c.tagName !== 'INPUT' || c.type === 'hidden' || c.dataset.fmt) return
        const text = label.textContent || ''
        if (/tel[eé]fono/i.test(text) && ['text', 'tel', ''].includes(c.type)) {
            c.dataset.fmt = 'tel'; c.inputMode = 'numeric'; c.maxLength = 10
            c.pattern = '\\d{10}'; c.title = 'Escribe 10 dígitos, sin espacios ni guiones.'
            c.addEventListener('input', () => { const v = c.value.replace(/\D/g, '').slice(0, 10); if (v !== c.value) c.value = v })
        } else if (/CURP/i.test(text) && ['text', ''].includes(c.type)) {
            c.dataset.fmt = 'curp'; c.maxLength = 18; c.autocapitalize = 'characters'
            c.pattern = '[A-Za-z0-9]{18}'; c.title = 'La CURP tiene 18 caracteres.'
        }
    })
    root.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([id]), select:not([aria-label]):not([id])').forEach((c) => {
        if (c.closest('label')) return
        const ph = c.getAttribute('placeholder')
        if (ph) c.setAttribute('aria-label', ph)
    })
}

let scrollLocks = 0
const lockScroll = () => {
    scrollLocks += 1
    if (scrollLocks === 1) {
        const gap = window.innerWidth - document.documentElement.clientWidth
        document.body.dataset.ovPrevOverflow = document.body.style.overflow || ''
        document.body.dataset.ovPrevPad = document.body.style.paddingRight || ''
        document.body.style.overflow = 'hidden'
        if (gap > 0) document.body.style.paddingRight = `${gap}px`
    }
    return () => {
        scrollLocks -= 1
        if (scrollLocks === 0) {
            document.body.style.overflow = document.body.dataset.ovPrevOverflow || ''
            document.body.style.paddingRight = document.body.dataset.ovPrevPad || ''
        }
    }
}

const EXIT_MS = 190

const Overlay = ({ variant = 'drawer', open, onClose, title, subtitle, eyebrow, children, footer, size = 'md', closeOnBackdrop = true, initialFocus, tone, label }) => {
    const titleId = useId()
    const panelRef = useRef(null)
    const lastFocus = useRef(null)
    const wasOpen = useRef(open)
    const [exiting, setExiting] = useState(false)

    // Animación de salida: el panel sigue montado el tiempo justo para deslizarse fuera.
    useEffect(() => {
        if (wasOpen.current && !open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExiting(true)
            const t = setTimeout(() => setExiting(false), EXIT_MS)
            wasOpen.current = open
            return () => clearTimeout(t)
        }
        wasOpen.current = open
        return undefined
    }, [open])

    const mounted = open || exiting

    useEffect(() => {
        if (!open) return undefined
        lastFocus.current = document.activeElement
        const unlock = lockScroll()
        const raf = requestAnimationFrame(() => {
            const panel = panelRef.current
            if (!panel) return
            // El navegador no debe rellenar aquí las credenciales guardadas de quien tiene la sesión abierta.
            panel.querySelectorAll('input[type="password"]').forEach((i) => i.setAttribute('autocomplete', 'new-password'))
            panel.querySelectorAll('input[type="email"]').forEach((i) => i.setAttribute('autocomplete', 'off'))
            linkLabels(panel)
            const target = (initialFocus && initialFocus.current)
                || panel.querySelector('.ov-body input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), .ov-body select, .ov-body textarea')
                || panel.querySelector('[data-autofocus]')
                || panel
            target.focus({ preventScroll: true })
        })
        return () => {
            cancelAnimationFrame(raf)
            unlock()
            const el = lastFocus.current
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true })
        }
    }, [open, initialFocus])

    if (!mounted) return null

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return }
        if (e.key !== 'Tab') return
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
        if (nodes.length === 0) { e.preventDefault(); panelRef.current.focus(); return }
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    return createPortal(
        <div className={`ov-root ov-${variant}${open ? '' : ' is-closing'}`}>
            <div className="ov-backdrop" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.() }} />
            <section
                ref={panelRef}
                className={`ov-panel ov-${size}${tone ? ` ov-tone-${tone}` : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : label}
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <div className="ov-head">
                    <div className="ov-titles">
                        {eyebrow && <p className="ov-eyebrow">{eyebrow}</p>}
                        {title && <h2 id={titleId} className="ov-title">{title}</h2>}
                        {subtitle && <p className="ov-sub">{subtitle}</p>}
                    </div>
                    <button type="button" className="ov-close" onClick={onClose} aria-label="Cerrar" title="Cerrar (Esc)">
                        <Icon name="x" size={18} />
                    </button>
                </div>
                <div className="ov-body">{children}</div>
                {footer && <div className="ov-foot">{footer}</div>}
            </section>
        </div>,
        document.body
    )
}

export const Drawer = (props) => <Overlay variant="drawer" {...props} />
export const Modal = (props) => <Overlay variant="modal" {...props} />

export default Overlay
