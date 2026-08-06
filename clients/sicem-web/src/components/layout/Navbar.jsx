import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../config/api'
import { connectUnitsSocket } from '../../sockets/unitsSocket'
import { connectEmergencySocket } from '../../sockets/emergencySocket'
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
    const [lastSeen, setLastSeen] = useState(() => {
        const stored = localStorage.getItem(LAST_SEEN_KEY_PREFIX + (user?.profileId || ''))
        return stored ? new Date(stored) : new Date(0)
    })
    const bellRef = useRef(null)

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
        return () => { unitsSocket.disconnect(); emergencySocket.disconnect() }
    }, [token])

    const [unassigningId, setUnassigningId] = useState(null)

    const handleUnassign = (report) => {
        if (!report.ambulance_id || !report.emergency_id) return
        if (!window.confirm(`¿Seguro que quieres desasignar la unidad ${report.unit_number || ''}? Quedará marcada "Fuera de servicio" hasta que el propio paramédico la reactive.`)) return
        setUnassigningId(report.ambulance_failure_report_id)
        fetch(`${API_BASE_URL}/emergencias/desasignar-ambulancia`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId: report.ambulance_id, emergencyId: report.emergency_id, reason: 'ambulance_failure' }),
        })
            .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
            .then(({ ok, body }) => {
                if (!ok) return alert(body.message || 'No se pudo desasignar la unidad.')
                setFailureReports((current) => current.map((r) =>
                    r.ambulance_failure_report_id === report.ambulance_failure_report_id ? { ...r, unassigned: true } : r
                ))
            })
            .catch(() => alert('No se pudo desasignar la unidad. Intenta de nuevo.'))
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
        <nav className="navbar">
            <span className="navbar-logo">SICEM</span>
            <div className="navbar-links" ref={dropdownRef}>
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
                                    <span className={`navbar-dropdown-arrow ${isOpen ? 'open' : ''}`}>▾</span>
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
            </div>
            <div className="navbar-right">
                <div className="navbar-bell-wrap" ref={bellRef}>
                    <button className="navbar-bell" onClick={toggleBell} title="Fallas reportadas">
                        🔔
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
                                                <>
                                                    <button
                                                        onClick={() => { navigate(`/emergencias/${r.emergency_id}`); setBellOpen(false) }}
                                                    >
                                                        Ver emergencia
                                                    </button>
                                                    <button
                                                        className="danger"
                                                        onClick={() => handleUnassign(r)}
                                                        disabled={unassigningId === r.ambulance_failure_report_id}
                                                    >
                                                        {unassigningId === r.ambulance_failure_report_id ? 'Desasignando…' : 'Desasignar unidad'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Link to="/perfil" className={`navbar-user ${location.pathname === '/perfil' ? 'active' : ''}`}>
                    <span className="navbar-user-dot" />
                    {userName} — {roleLabel}
                </Link>
                <button className="navbar-logout-btn" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>
        </nav>
    )
}

export default Navbar
