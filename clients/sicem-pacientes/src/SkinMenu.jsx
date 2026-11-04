import { useEffect, useRef, useState } from 'react'
import { SKINS, setSkin, useSkin } from './skin'
import './SkinMenu.css'

const Swatch = ({ skin }) => (
  <span className="skin-swatch" style={{ background: skin.colors[0], borderRadius: Math.min(skin.radius, 10), borderColor: skin.colors[1] }} aria-hidden="true">
    <i style={{ background: skin.colors[1] }} />
    <b style={{ background: skin.colors[2], borderRadius: Math.min(skin.radius, 6) }} />
    <em style={{ background: skin.colors[3], borderRadius: Math.min(skin.radius, 6) }} />
  </span>
)

// Cambia el tema visual al instante (se recuerda en este equipo).
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
      <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>Tema</button>
      {open && (
        <div className="skin-pop" role="menu" aria-label="Tema visual">
          {SKINS.map((s) => (
            <button key={s.id} type="button" role="menuitemradio" aria-checked={skin === s.id} className={`skin-opt${skin === s.id ? ' on' : ''}`} onClick={() => { setSkin(s.id); setOpen(false) }}>
              <Swatch skin={s} /><span><b>{s.label}</b></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SkinMenu
