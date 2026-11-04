import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../config/api'
import { connectUnitsSocket } from '../../sockets/unitsSocket'
import { connectEmergencySocket } from '../../sockets/emergencySocket'
import { useTheme, setTheme, isDarkReady } from '../../utils/theme'
import Icon from '../ui/Icon'
import CommandPalette from './CommandPalette'
import SkinMenu from '../ui/SkinMenu'
import { useRegion } from '../../context/useRegion'
import './Navbar.css'

const LAST_SEEN_KEY_PREFIX = 'sicem_failure_reports_last_seen_'

const Navbar = ({ userName, roleLabel, links }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout, token, user } = useAuth()
    const [openDropdown, setOpenDropdown] = useState(null)
    const dropdownRef = useRef(null)

    // Historial de fallas reportadas por paramédicos — el aviso en vivo
    // (toast/notificación) se pierde si nadie tenía la pantalla abierta en
    // ese momento; esta campana es lo que permite verlas después, sin
    // depender de haber estado viendo la pantalla en el instante exacto.
    const [failureReports, setFailureReports] = useState([])
    const [bellOpen, setBellOpen] = useState(false)
    // Reasignaciones de destino hechas por un paramédico (Fase 4/5) — cuando
    // un paramédico en campo cambia a dónde va un paciente (p. ej. a su
    // institución de afiliación), el despachador se entera aquí y puede abrir
    // la emergencia para reasignar/re-confirmar.
    const [destinationReassignments, setDestinationReassignments] = useState([])
    const [lastSeen, setLastSeen] = useState(() => {
        const stored = localStorage.getItem(LAST_SEEN_KEY_PREFIX + (user?.profileId || ''))
        return stored ? new Date(stored) : new Date(0)
    })
    const bellRef = useRef(null)
    const [paletteOpen, setPaletteOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const theme = useTheme()
    const { region } = useRegion()
    const initials = (userName || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

    // Ctrl+K abre la paleta (combinación deliberada; también se abre con el botón).
    // No hay atajos de una sola tecla: en una app de emergencias una tecla suelta
    // nunca debe sacar al despachador de lo que está haciendo.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setPaletteOpen((v) => !v)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

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
        // Si el despachador desasigna la unidad desde aquí mismo (o alguien más
        // lo hace desde EmergencyDetail), ya no tiene caso seguir ofreciendo el
        // botón "Desasignar" para ese reporte — se marca sin tener que recargar.
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventAmbulanceUnassigned', ({ ambulanceIds }) => {
            setFailureReports((current) => current.map((r) =>
                (ambulanceIds || []).some((id) => parseInt(id) === parseInt(r.ambulance_id))
                    ? { ...r, unassigned: true }
                    : r
            ))
        })
        emergencySocket.on('eventDestinationReassigned', (data) => {
            setDestinationReassignments((current) => [{
                destination_reassignment_id: `dest-${Date.now()}`,
                emergency_id: data.emergencyId,
                destination_institution_id: data.destinationInstitutionId,
                patient_name: data.patientName || null,
                reported_at: data.reportedAt || new Date().toISOString(),
            }, ...current])
        })
        return () => { unitsSocket.disconnect(); emergencySocket.disconnect() }
    }, [token])

    const unreadCount = failureReports.filter((r) => new Date(r.reported_at) > lastSeen).length
        + destinationReassignments.filter((r) => new Date(r.reported_at) > lastSeen).length

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
            <Link to="/dashboard" className="navbar-brand" aria-label="SICEM, ir al inicio">
                <span className="navbar-brand-mark"><Icon name="plus" size={17} strokeWidth={2.8} /></span>
                <span className="navbar-brand-text"><b>SICEM</b><small>{region.state ? `Emergencias médicas · ${region.state}` : 'Emergencias médicas'}</small></span>
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
                {/* Solo en ventanas angostas (la barra los oculta): perfil y salir viven en el menú */}
                <Link to="/perfil" className="navbar-menu-only">Mi perfil</Link>
                <button type="button" className="navbar-menu-only navbar-menu-logout" onClick={handleLogout}>Cerrar sesión</button>
            </div>
            <div className="navbar-right">
                <button className="navbar-search" onClick={() => setPaletteOpen(true)} aria-label="Buscar o ir a una pantalla o emergencia">
                    <Icon name="search" size={16} />
                    <span>Buscar o ir a…</span>
                    <kbd>Ctrl K</kbd>
                </button>
                <div className="navbar-bell-wrap" ref={bellRef}>
                    <button
                        className="navbar-bell"
                        onClick={toggleBell}
                        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
                        title="Notificaciones"
                    >
                        <Icon name="bell" size={18} />
                        {unreadCount > 0 && <span className="navbar-bell-badge">{unreadCount}</span>}
                    </button>
                    {bellOpen && (
                        <div className="navbar-bell-panel">
                            <div className="navbar-bell-title">Notificaciones</div>
                            {destinationReassignments.length > 0 && (
                                <>
                                    <div className="navbar-bell-subtitle">Reasignaciones del paramédico</div>
                                    {destinationReassignments.map((r) => (
                                        <div key={r.destination_reassignment_id} className="navbar-bell-item">
                                            <div className="navbar-bell-item-header">
                                                <strong>Destino reasignado</strong>
                                                <span>{new Date(r.reported_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="navbar-bell-item-who">
                                                {r.patient_name ? `${r.patient_name} — el paramédico cambió su destino.` : 'El paramédico cambió el destino de un paciente.'}
                                            </div>
                                            {r.emergency_id && (
                                                <div className="navbar-bell-item-actions">
                                                    <button
                                                        onClick={() => { navigate(`/emergencias/${r.emergency_id}`); setBellOpen(false) }}
                                                    >
                                                        Ver emergencia
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                            {destinationReassignments.length > 0 && failureReports.length > 0 && (
                                <div className="navbar-bell-subtitle">Fallas reportadas</div>
                            )}
                            {failureReports.length === 0 && destinationReassignments.length === 0 && (
                                <div className="navbar-bell-empty">Sin notificaciones por ahora.</div>
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
                                            <button
                                                onClick={() => { navigate(`/emergencias/${r.emergency_id}`); setBellOpen(false) }}
                                            >
                                                Ver emergencia
                                            </button>
                                            {(r.unassigned || r.still_assigned === false || r.still_assigned === 0) && (
                                                <span className="navbar-bell-item-done">✓ Unidad desasignada</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <SkinMenu />
                {isDarkReady(location.pathname) && (
                    <button
                        className="navbar-bell"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        aria-label="Cambiar entre tema claro y oscuro"
                        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                    >
                        <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
                    </button>
                )}
                <Link to="/perfil" className={`navbar-user ${location.pathname === '/perfil' ? 'active' : ''}`} title={`${userName} — ${roleLabel}`} aria-label={`Mi perfil: ${userName}, ${roleLabel}`}>
                    <span className="navbar-avatar" aria-hidden="true">{initials}</span>
                    <span className="navbar-user-text"><b>{userName}</b><small>{roleLabel}</small></span>
                </Link>
                <button className="navbar-logout-btn" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} links={links} token={token} />
        </nav>
        </header>
    )
}

export default Navbar
