import { SKINS, setSkin, useSkin } from '../../utils/skin'
import { SkinSwatch } from './SkinMenu'
import './SkinMenu.css'

// Selector grande (Mi perfil): una tarjeta por tema, con su miniatura y una línea que lo describe.
const SkinPicker = () => {
    const skin = useSkin()
    return (
        <fieldset className="skin-picker">
            <legend>Tema visual</legend>
            <p className="skin-picker-hint">Elige cómo se ve el sistema. Se aplica al instante y se recuerda en este equipo.</p>
            <div className="skin-grid" role="radiogroup" aria-label="Tema visual">
                {SKINS.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={skin === s.id} className={`skin-card${skin === s.id ? ' on' : ''}`} onClick={() => setSkin(s.id)}>
                        <SkinSwatch skin={s} size="lg" />
                        <b>{s.label}</b>
                        <span>{s.desc}</span>
                    </button>
                ))}
            </div>
        </fieldset>
    )
}

export default SkinPicker
