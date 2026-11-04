import { useEffect, useState } from 'react';
import { roleLabel } from '../config/roles'
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './Requests.css';
import { getNavLinks } from '../utils/Navlinks';
import { parseResponse } from '../utils/apiRequest';
import { connectEmergencySocket } from '../sockets/emergencySocket';
import {API_BASE_URL} from '../config/api'
import { useDialogs } from '../context/useDialogs'
import Icon from '../components/ui/Icon'
import '../styles/entities.css'


// request_status_id: 1 = Pendiente, 2 = Aceptada, 3 = Rechazada, 4 = Cancelada

const Requests = () => {
    const { notify, confirm } = useDialogs()
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [requests, setRequests] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchRequests = () => {
        fetch(`${API_BASE_URL}/emergencias/solicitudes`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setRequests(data.map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando solicitudes. ', error))
    }
    useEffect(() => { fetchRequests() }, []);

    // Esta pantalla nunca se actualizaba sola — ni cuando alguien respondía una
    // solicitud, ni cuando un cierre forzado cancelaba varias de golpe. En vez
    // de tratar de parchear cada campo a mano (status, responded_at,
    // rejection_reason), simplemente se vuelve a pedir todo: es la misma
    // cantidad de datos que ya se carga al entrar, y evita quedarse
    // desincronizado si el backend cambia algo que el cliente no anticipó.
    useEffect(() => {
        const emergencySocket = connectEmergencySocket(token)
        emergencySocket.on('eventInterInstitutionalRequest', () => fetchRequests())
        emergencySocket.on('eventInterInstitutionalRequestResponded', () => fetchRequests())
        emergencySocket.on('eventEmergencyClosed', () => fetchRequests())
        return () => emergencySocket.disconnect()
    }, [token]);

    const countByStatus = (value) => requests.filter((r) => String(r.request_status_id) === value).length

    const visibleRequests = statusFilter === 'all'
        ? requests
        : requests.filter(r => String(r.request_status_id) === statusFilter)

    const handleCancelRequest = async (req) => {
        if (!(await confirm({ title: 'Confirmar', message: '¿Seguro que quieres cancelar esta solicitud interinstitucional?', confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/emergencias/cancelar-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ interInstitutionalRequestId: req.inter_institutional_request_id })
        })
            .then(parseResponse)
            .then(() => fetchRequests())
            .catch(error => { console.error('Error cancelando la solicitud. ', error); notify(error.message, 'error') })
    }

    const formatTime = (dateString) => {
        if (!dateString) return '—'
        const date = new Date(dateString)
        return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="requests-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <div role="main" id="contenido" className="requests-body">
                <h1 className="requests-title">Solicitudes interinstitucionales</h1>
                <p className="requests-subtitle">Unidades que se piden prestadas a otras instituciones. Se actualiza solo cuando alguien responde.</p>

                <div className="requests-filter-row" role="group" aria-label="Filtrar por estado">
                    {[['all', 'Todas', requests.length], ['1', 'Pendientes', countByStatus('1')], ['2', 'Aceptadas', countByStatus('2')], ['3', 'Rechazadas', countByStatus('3')], ['4', 'Canceladas', countByStatus('4')]].map(([value, label, count]) => (
                        <button key={value} type="button" className="requests-chip" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
                            {label} <span className="requests-chip-count">{count}</span>
                        </button>
                    ))}
                </div>

                <div className="entity-rows">
                    {visibleRequests.map((req) => {
                        const sid = parseInt(req.request_status_id)
                        const accent = { 1: 'var(--warn)', 2: 'var(--ok)', 3: 'var(--brand)', 4: 'var(--text-3)' }[sid] || 'var(--line-strong)'
                        const tone = { 1: 'pill-warn', 2: 'pill-ok', 3: 'pill-bad', 4: '' }[sid] || ''
                        const canCancel = sid === 1 && (parseInt(req.user_profile_id) === parseInt(user?.profileId) || parseInt(user?.roleId) === 1)
                        const open = expandedId === req.inter_institutional_request_id
                        return (
                            <article key={req.inter_institutional_request_id} className="entity-row" style={{ '--accent': accent }}>
                                <span className="entity-id">#{String(req.inter_institutional_request_id).padStart(3, '0')}</span>
                                <div className="row-main">
                                    <h2 className="row-title">{req.emergency_type_name || 'Emergencia'}</h2>
                                    <p className="row-desc">{req.emergency_description || 'Sin descripción'}</p>
                                    <p className="row-desc" style={{ marginTop: 6 }}>
                                        <b>{req.requesting_institution}</b> <Icon name="arrow" size={13} /> <b>{req.receiving_institution}</b>
                                    </p>
                                </div>
                                <div className="row-meta">
                                    <span><b>Unidad</b> <span className="req-unit">{req.unit_number || '—'}</span></span>
                                    <span><b>Hora</b> {formatTime(req.requested_at)}</span>
                                </div>
                                <div className="row-actions">
                                    <span className={`pill ${tone}`}>{req.status_name}</span>
                                    <button type="button" className="req-view-btn" onClick={() => setExpandedId(open ? null : req.inter_institutional_request_id)}>{open ? 'Ocultar' : 'Detalles'}</button>
                                    {canCancel && <button type="button" className="req-cancel-btn" onClick={() => handleCancelRequest(req)}>Cancelar</button>}
                                </div>
                                {open && (
                                    <div className="entity-panel row-panel">
                                        <span><strong>Solicitada:</strong> {req.requested_at ? new Date(req.requested_at).toLocaleString('es-MX') : '—'}</span>
                                        <span><strong>Respondida:</strong> {req.responded_at ? new Date(req.responded_at).toLocaleString('es-MX') : 'Sin respuesta todavía'}</span>
                                        {req.rejection_reason && <span><strong>Motivo de rechazo:</strong> {req.rejection_reason}</span>}
                                    </div>
                                )}
                            </article>
                        )
                    })}
                    {visibleRequests.length === 0 && (
                        <p className="entity-empty">{requests.length === 0 ? 'Todavía no hay solicitudes. Aparecerán aquí cuando se pida una unidad a otra institución.' : 'Ninguna solicitud tiene este estado. Prueba con otro filtro.'}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Requests;