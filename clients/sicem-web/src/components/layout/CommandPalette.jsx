import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../../config/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import './CommandPalette.css'

// Paleta de comandos (Ctrl+K): salta a cualquier pantalla o a una emergencia
// activa sin recorrer menús. Las emergencias se piden una vez al abrir.
const flattenLinks = (links) => links.flatMap((link) => (
    link.children
        ? link.children.map((child) => ({ label: child.label, to: child.to, group: 'Ir a' }))
        : [{ label: link.label, to: link.to, group: 'Ir a' }]
))

// El panel se monta de cero cada vez que se abre (estado limpio, sin efectos de reinicio).
const PaletteBody = ({ onClose, links, token }) => {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [emergencies, setEmergencies] = useState([])
    const [selected, setSelected] = useState(0)
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        fetch(`${API_BASE_URL}/emergencias/emergencias-activas`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        })
            .then((res) => res.json())
            .then(({ data }) => setEmergencies((data || []).map((em) => toLowerCaseKeys(em))))
            .catch(() => setEmergencies([]))
    }, [])

    const items = useMemo(() => {
        const q = query.trim().toLowerCase()
        const pages = flattenLinks(links).map((l) => ({ ...l, id: `p-${l.to}` }))
        const ems = emergencies.map((em) => ({
            id: `e-${em.emergency_id}`,
            group: 'Emergencias activas',
            label: `${em.type_name || 'Emergencia'} · ${em.description || 'Sin descripción'}`,
            hint: em.triage_level ? `Nivel ${em.triage_level}` : '',
            to: `/emergencias/${em.emergency_id}`,
        }))
        return [...pages, ...ems].filter((it) => !q || it.label.toLowerCase().includes(q)).slice(0, 30)
    }, [query, links, emergencies])

    const go = (item) => {
        if (!item) return
        onClose()
        navigate(item.to)
    }

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { onClose() }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); go(items[selected]) }
    }

    let lastGroup = ''
    return (
        <div className="cp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="cp-box" role="dialog" aria-modal="true" aria-label="Buscar o ir a" onKeyDown={onKeyDown}>
                <input
                    ref={inputRef}
                    className="cp-input"
                    placeholder="Busca una emergencia o una pantalla"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
                    aria-label="Buscar"
                    autoComplete="off"
                />
                <ul className="cp-list" role="listbox">
                    {items.map((item, i) => {
                        const header = item.group !== lastGroup ? <li className="cp-group" key={`g-${item.group}`}>{item.group}</li> : null
                        lastGroup = item.group
                        return (
                            <Fragment key={item.id}>
                                {header}
                                <li
                                    role="option"
                                    aria-selected={i === selected}
                                    className="cp-item"
                                    onMouseEnter={() => setSelected(i)}
                                    onClick={() => go(item)}
                                >
                                    <span>{item.label}</span>
                                    {item.hint && <small>{item.hint}</small>}
                                </li>
                            </Fragment>
                        )
                    })}
                    {items.length === 0 && (
                        <li className="cp-empty">No encontramos nada con ese texto. Prueba con el tipo de emergencia o el nombre de la pantalla.</li>
                    )}
                </ul>
                <div className="cp-foot"><span>↑ ↓ para moverte</span><span>Enter para abrir</span><span>Esc para cerrar</span></div>
            </div>
        </div>
    )
}

// Portal al <body>: así el fondo oscuro queda por encima de todo, sin importar el
// nivel de apilamiento de la barra donde se dispara.
const CommandPalette = ({ open, ...props }) => (open ? createPortal(<PaletteBody {...props} />, document.body) : null)

export default CommandPalette
