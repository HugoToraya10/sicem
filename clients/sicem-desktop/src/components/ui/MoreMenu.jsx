import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import './MoreMenu.css'

// Menú "Más acciones" de una tarjeta: deja a la vista solo lo habitual y recoge el resto.
// items: [{ label, onClick, disabled, danger, title }]
// La lista se dibuja en un portal con posición fija: nunca queda detrás de otra tarjeta ni se recorta
// por el contenedor, se abre hacia arriba si abajo no hay espacio y se cierra al desplazar la página.
const MoreMenu = ({ items, label = 'Más' }) => {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState(null)
    const btnRef = useRef(null)
    const listRef = useRef(null)

    const visible = items.filter(Boolean)

    const close = useCallback((restoreFocus = false) => {
        setOpen(false)
        if (restoreFocus) btnRef.current?.focus()
    }, [])

    // Calcula la posición con el tamaño real de la lista y la voltea si no cabe.
    useLayoutEffect(() => {
        if (!open || !btnRef.current || !listRef.current) return
        const b = btnRef.current.getBoundingClientRect()
        const l = listRef.current.getBoundingClientRect()
        const gap = 6
        const spaceBelow = window.innerHeight - b.bottom
        const up = spaceBelow < l.height + gap + 8 && b.top > spaceBelow
        const top = up ? Math.max(8, b.top - l.height - gap) : b.bottom + gap
        const left = Math.min(Math.max(8, b.right - l.width), window.innerWidth - l.width - 8)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPos({ top, left, up })
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => {
            if (btnRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return
            close()
        }
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(true); return }
            const buttons = [...(listRef.current?.querySelectorAll('button:not(:disabled)') || [])]
            if (!buttons.length) return
            const i = buttons.indexOf(document.activeElement)
            if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus() }
            else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus() }
            else if (e.key === 'Tab') close()
        }
        const onMove = () => close()
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey, true)
        window.addEventListener('scroll', onMove, true)
        window.addEventListener('resize', onMove)
        const raf = requestAnimationFrame(() => listRef.current?.querySelector('button:not(:disabled)')?.focus())
        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey, true)
            window.removeEventListener('scroll', onMove, true)
            window.removeEventListener('resize', onMove)
        }
    }, [open, close])

    if (visible.length === 0) return null

    return (
        <div className="more-menu">
            <button
                ref={btnRef}
                type="button"
                className="more-btn"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${label} acciones`}
                onClick={() => { setPos(null); setOpen((v) => !v) }}
            >
                {label}<Icon name="chevron" size={14} />
            </button>
            {open && createPortal(
                <div role="region" aria-label="Acciones">
                <ul
                    ref={listRef}
                    className={`more-list${pos?.up ? ' up' : ''}`}
                    role="menu"
                    style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999, visibility: 'hidden' }}
                >
                    {visible.map((it) => (
                        <li key={it.label} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                className={it.danger ? 'danger' : ''}
                                disabled={it.disabled}
                                title={it.title}
                                onClick={() => { close(); it.onClick() }}
                            >
                                {it.label}
                            </button>
                        </li>
                    ))}
                </ul>
                </div>,
                document.body
            )}
        </div>
    )
}

export default MoreMenu
