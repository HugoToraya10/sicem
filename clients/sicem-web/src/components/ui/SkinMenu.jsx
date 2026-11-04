import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { SKINS, setSkin, useSkin } from '../../utils/skin'
import './SkinMenu.css'

// Muestra en miniatura de un skin: fondo, barra superior y dos bloques con los colores reales del tema.
export const SkinSwatch = ({ skin, size = 'sm' }) => (
    <span className={`skin-swatch skin-swatch-${size}`} style={{ background: skin.colors[0], borderRadius: Math.min(skin.radius, 10), borderColor: skin.colors[1] }} aria-hidden="true">
        <i style={{ background: skin.colors[1] }} />
        <b style={{ background: skin.colors[2], borderRadius: Math.min(skin.radius, 6) }} />
        <em style={{ background: skin.colors[3], borderRadius: Math.min(skin.radius, 6) }} />
    </span>
)

// Botón de la barra superior: abre una lista corta para cambiar de tema al instante.
const SkinMenu = () => {
    const skin = useSkin()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
    }, [open])

    return (
        <div className="skin-menu" ref={ref}>
            <button type="button" className="navbar-bell" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Cambiar el tema visual" title="Tema visual">
                <Icon name="palette" size={18} />
            </button>
            {open && (
                <div className="skin-pop" role="menu" aria-label="Tema visual">
                    <p className="skin-pop-title">Tema visual</p>
                    {SKINS.map((s) => (
                        <button key={s.id} type="button" role="menuitemradio" aria-checked={skin === s.id} className={`skin-opt${skin === s.id ? ' on' : ''}`} onClick={() => { setSkin(s.id); setOpen(false) }}>
                            <SkinSwatch skin={s} />
                            <span><b>{s.label}</b></span>
                            {skin === s.id && <Icon name="check" size={16} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default SkinMenu
