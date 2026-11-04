import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../config/api'
import { connectUnitsSocket } from '../../sockets/unitsSocket'
import { connectEmergencySocket } from '../../sockets/emergencySocket'
import { useTheme, setTheme } from '../../utils/theme'
import { useRegion } from '../../context/useRegion'
import { useDialogs } from '../../context/useDialogs'
import Icon from '../ui/Icon'
import SkinMenu from '../ui/SkinMenu'
import './Navbar.css'

const LAST_SEEN_KEY_PREFIX = 'sicem_failure_reports_last_seen_'

const Navbar = ({ userName, roleLabel, links }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout, token, user } = useAuth()
    const { notify, confirm } = useDialogs()
    const [openDropdown, setOpenDropdown] = useState(null)
    const dropdownRef = useRef(null)

    // Historial de fallas reportadas por paramédicos — el aviso en vivo
    // (notificación nativa del SO) se pierde si nadie estaba viendo la
    // pantalla en ese momento; esta campana permite verlas después.
    const [failureReports, setFailureReports] = useState([])
    const [bellOpen, setBellOpen] = useState(false)
    const [lastSeen, setLastSeen] = useState(() => {
        const stored = localStorage.getItem(LAST_SEEN_KEY_PREFIX + (user?.profileId || ''))
        return stored ? new Date(stored) : new Date(0)
    })
    const bellRef = useRef(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const theme = useTheme()
    const { region } = useRegion()
    const initials = (userName || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    // Cierra el dropdown si el usuario hace clic fuera de él
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null)
            }
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setBellOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!token) return
        fetch(`${API_BASE_URL}/unidades/reportes-falla`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => setFailureReports(data.reports || []))
            .catch(() => {})

        const unitsSocket = connectUnitsSocket(token)
        unitsSocket.on('eventAmbulanceFailureReported', (data) => {
            // El backend ya solo manda este evento a "hospital" cuando la
            // unidad es de esa institución (ver reportAmbulanceFailure en
            // services/unidades), pero por si acaso llegara una de otra
            // institución, se descarta aquí también.
            if (data.institutionId && parseInt(data.institutionId) !== parseInt(user?.institutionId)) return
            setFailureReports((current) => [{
                ambulance_failure_report_id: `live-${Date.now()}`,
                ambulance_id: data.ambulanceId,
                emergency_id: data.emergencyId,
                unit_number: data.unitNumber,
                first_name: (data.paramedicName || '').split(' ')[0] || '',
                first_surname: (data.paramedicName || '').split(' ').slice(1).join(' '),
                note: data.note,
                reported_at: data.reportedAt || new Date().toISOString(),
            }, ...current])
        })
        // Si el despachador (u otro admin) ya desasignó la unidad desde
        // sicem-web, ya no tiene caso seguir ofreciendo el botón aquí.
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventAmbulanceUnassigned', ({ ambulanceIds }) => {
            setFailureReports((current) => current.map((r) =>
                (ambulanceIds || []).some((id) => parseInt(id) === parseInt(r.ambulance_id))
                    ? { ...r, unassigned: true }
                    : r
            ))
        })
        return () => { unitsSocket.disconnect(); emergencySocket.disconnect() }
    }, [token, user])

    const [unassigningId, setUnassigningId] = useState(null)

    const handleUnassign = async (report) => {
        if (!report.ambulance_id || !report.emergency_id) return
        const accepted = await confirm({
            title: 'Desasignar unidad',
            message: `¿Desasignar la unidad ${report.unit_number || ''} de la emergencia? Quedará marcada "Fuera de servicio" hasta que el propio paramédico la reactive.`,
            confirmLabel: 'Desasignar',
            danger: true,
        })
        if (!accepted) return
        setUnassigningId(report.ambulance_failure_report_id)
        fetch(`${API_BASE_URL}/emergencias/desasignar-ambulancia`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId: report.ambulance_id, emergencyId: report.emergency_id, reason: 'ambulance_failure' }),
        })
            .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
            .then(({ ok, body }) => {
                if (!ok) return notify(body.message || 'No se pudo desasignar la unidad.', 'error')
                setFailureReports((current) => current.map((r) =>
                    r.ambulance_failure_report_id === report.ambulance_failure_report_id ? { ...r, unassigned: true } : r
                ))
            })
            .catch(() => notify('No se pudo desasignar la unidad. Intenta de nuevo.', 'error'))
            .finally(() => setUnassigningId(null))
    }

    // Falla reportada SIN emergencia asociada (el paramédico no estaba en
    // curso cuando reportó) — no hay nada que desasignar, pero el hospital
    // igual necesita poder sacarla de servicio directo desde aquí.
    const handleMarkOutOfService = async (report) => {
        if (!report.ambulance_id) return
        const accepted = await confirm({
            title: 'Marcar fuera de servicio',
            message: `¿Marcar la unidad ${report.unit_number || ''} como "Fuera de servicio"?`,
            confirmLabel: 'Marcar',
            danger: true,
        })
        if (!accepted) return
        setUnassigningId(report.ambulance_failure_report_id)
        fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId: report.ambulance_id, ambulanceStatusId: 5 }),
        })
            .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
            .then(({ ok, body }) => {
                if (!ok) return notify(body.message || 'No se pudo actualizar el estado.', 'error')
                setFailureReports((current) => current.map((r) =>
                    r.ambulance_failure_report_id === report.ambulance_failure_report_id ? { ...r, unassigned: true } : r
                ))
            })
            .catch(() => notify('No se pudo actualizar el estado. Intenta de nuevo.', 'error'))
            .finally(() => setUnassigningId(null))
    }

    const unreadCount = failureReports.filter((r) => new Date(r.reported_at) > lastSeen).length

    const toggleBell = () => {
        const opening = !bellOpen
        setBellOpen(opening)
        if (opening) {
            const now = new Date()
            setLastSeen(now)
            localStorage.setItem(LAST_SEEN_KEY_PREFIX + (user?.profileId || ''), now.toISOString())
        }
    }

    // Un link "normal" tiene `to`. Un dropdown tiene `children` en su lugar.
    const isDropdownItem = (link) => Boolean(link.children)

    // El dropdown se marca como activo si la ruta actual coincide con alguno de sus hijos
    const isDropdownActive = (link) =>
        link.children.some((child) => location.pathname === child.to)

    return (
        <header className="app-header">
        <a
            href="#contenido"
            className="skip-link"
            onClick={(e) => {
                e.preventDefault()
                const target = document.querySelector('h1') || document.querySelector('main')
                if (target) { target.setAttribute('tabindex', '-1'); target.focus() }
            }}
        >
            Saltar al contenido
        </a>
        <nav className="navbar" aria-label="Principal">
            <Link to="/pacientes-en-camino" className="navbar-brand" aria-label="SICEM, ir al inicio">
                <span className="navbar-brand-mark"><Icon name="plus" size={17} strokeWidth={2.8} /></span>
                <span className="navbar-brand-text"><b>SICEM</b><small>{region.state ? `Portal hospitalario · ${region.state}` : 'Portal hospitalario'}</small></span>
            </Link>
            <button
                type="button"
                className="navbar-menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="navbar-links"
                aria-label={menuOpen ? 'Cerrar el menú' : 'Abrir el menú'}
            >
                <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
            </button>
            <div id="navbar-links" className={`navbar-links ${menuOpen ? 'open' : ''}`} ref={dropdownRef} onClick={(e) => { if (e.target.closest('a')) setMenuOpen(false) }}>
                {links.map((link) => {
                    if (isDropdownItem(link)) {
                        const isOpen = openDropdown === link.label
                        return (
                            <div className="navbar-dropdown" key={link.label}>
                                <button
                                    className={`navbar-dropdown-trigger ${isDropdownActive(link) ? 'active' : ''}`}
                                    onClick={() => setOpenDropdown(isOpen ? null : link.label)}
                                >
                                    {link.label}
                                    <Icon name="chevron" size={14} className={`navbar-dropdown-arrow ${isOpen ? 'open' : ''}`} />
                                </button>
                                {isOpen && (
                                    <div className="navbar-dropdown-menu">
                                        {link.children.map((child) => (
                                            <Link
                                                key={child.to}
                                                to={child.to}
                                                className={location.pathname === child.to ? 'active' : ''}
                                                onClick={() => setOpenDropdown(null)}
                                            >
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={location.pathname === link.to ? 'active' : ''}
                        >
                            {link.label}
                        </Link>
                    )
                })}
                <button type="button" className="navbar-menu-only navbar-menu-logout" onClick={handleLogout}>Cerrar sesión</button>
            </div>
            <div className="navbar-right">
                <div className="navbar-bell-wrap" ref={bellRef}>
                    <button
                        className="navbar-bell"
                        onClick={toggleBell}
                        aria-label={unreadCount > 0 ? `Fallas reportadas, ${unreadCount} sin leer` : 'Fallas reportadas'}
                        title="Fallas reportadas"
                    >
                        <Icon name="bell" size={18} />
                        {unreadCount > 0 && <span className="navbar-bell-badge">{unreadCount}</span>}
                    </button>
                    {bellOpen && (
                        <div className="navbar-bell-panel">
                            <div className="navbar-bell-title">Fallas reportadas</div>
                            {failureReports.length === 0 && (
                                <div className="navbar-bell-empty">Sin reportes por ahora.</div>
                            )}
                            {failureReports.map((r) => (
                                <div key={r.ambulance_failure_report_id} className="navbar-bell-item">
                                    <div className="navbar-bell-item-header">
                                        <strong>{r.unit_number || 'Unidad'}</strong>
                                        <span>{new Date(r.reported_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="navbar-bell-item-who">{r.first_name} {r.first_surname}</div>
                                    <div className="navbar-bell-item-note">{r.note}</div>
                                    {r.emergency_id && (
                                        <div className="navbar-bell-item-actions">
                                            {(r.unassigned || r.still_assigned === false || r.still_assigned === 0) ? (
                                                <span className="navbar-bell-item-done">✓ Unidad desasignada</span>
                                            ) : (
                                                <button
                                                    className="danger"
                                                    onClick={() => handleUnassign(r)}
                                                    disabled={unassigningId === r.ambulance_failure_report_id}
                                                >
                                                    {unassigningId === r.ambulance_failure_report_id ? 'Desasignando…' : 'Desasignar de la emergencia'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {!r.emergency_id && (
                                        <div className="navbar-bell-item-actions">
                                            {r.unassigned ? (
                                                <span className="navbar-bell-item-done">✓ Fuera de servicio</span>
                                            ) : (
                                                <button
                                                    className="danger"
                                                    onClick={() => handleMarkOutOfService(r)}
                                                    disabled={unassigningId === r.ambulance_failure_report_id}
                                                >
                                                    {unassigningId === r.ambulance_failure_report_id ? 'Actualizando…' : 'Marcar Fuera de servicio'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <SkinMenu />
                <button
                    className="navbar-bell"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label="Cambiar entre tema claro y oscuro"
                    title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                >
                    <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
                </button>
                <span className="navbar-user" title={`${userName} — ${roleLabel}`}>
                    <span className="navbar-avatar" aria-hidden="true">{initials}</span>
                    <span className="navbar-user-text"><b>{userName}</b><small>{roleLabel}</small></span>
                </span>
                <button className="navbar-logout-btn" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>
        </nav>
        </header>
    )
}

export default Navbar
