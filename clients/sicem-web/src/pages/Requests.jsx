import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import './Requests.css';
import { getNavLinks } from '../utils/Navlinks';
import { parseResponse } from '../utils/apiRequest';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

// request_status_id: 1 = Pendiente, 2 = Aceptada, 3 = Rechazada, 4 = Cancelada
const statusClass = {
    1: 'status-pending',
    2: 'status-accepted',
    3: 'status-rejected',
    4: 'status-cancelled',
}

const Requests = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [requests, setRequests] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchRequests = () => {
        fetch('http://localhost:3000/emergencias/solicitudes', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setRequests(data.map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando solicitudes. ', error))
    }
    useEffect(() => { fetchRequests() }, []);

    const visibleRequests = statusFilter === 'all'
        ? requests
        : requests.filter(r => String(r.request_status_id) === statusFilter)

    const handleCancelRequest = (req) => {
        if (!window.confirm('¿Seguro que quieres cancelar esta solicitud interinstitucional?')) return
        fetch('http://localhost:3000/emergencias/cancelar-solicitud', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ interInstitutionalRequestId: req.inter_institutional_request_id })
        })
            .then(parseResponse)
            .then(() => fetchRequests())
            .catch(error => { console.error('Error cancelando la solicitud. ', error); alert(error.message) })
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
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="requests-body">
                <h2 className="requests-title">Solicitudes Interinstitucionales</h2>

                <div className="requests-filter-row">
                    <select className="status-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="1">Pendientes</option>
                        <option value="2">Aceptadas</option>
                        <option value="3">Rechazadas</option>
                        <option value="4">Canceladas</option>
                    </select>
                </div>

                <div className="requests-table-wrapper">
                    <table className="requests-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Emergencia</th>
                                <th>Institución solicitante</th>
                                <th>Institución receptora</th>
                                <th>Unidad propuesta</th>
                                <th>Estado</th>
                                <th>Hora</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRequests.map((req) => (
                                <Fragment key={req.inter_institutional_request_id}>
                                    <tr>
                                        <td className="req-id">#{String(req.inter_institutional_request_id).padStart(3, '0')}</td>
                                        <td>
                                            {req.emergency_type_name || 'Emergencia'}
                                            {req.emergency_description ? ` · ${req.emergency_description}` : ''}
                                        </td>
                                        <td>{req.requesting_institution}</td>
                                        <td>{req.receiving_institution}</td>
                                        <td className="req-unit">{req.unit_number || '—'}</td>
                                        <td>
                                            <span className={`req-status ${statusClass[req.request_status_id] || ''}`}>
                                                {req.status_name}
                                            </span>
                                        </td>
                                        <td className="req-time">{formatTime(req.requested_at)}</td>
                                        <td>
                                            <button
                                                className="req-view-btn"
                                                onClick={() => setExpandedId(expandedId === req.inter_institutional_request_id ? null : req.inter_institutional_request_id)}
                                            >
                                                Ver
                                            </button>
                                            {parseInt(req.request_status_id) === 1 && (parseInt(req.user_profile_id) === parseInt(user?.profileId) || parseInt(user?.roleId) === 1) && (
                                                <button
                                                    className="req-cancel-btn"
                                                    onClick={() => handleCancelRequest(req)}
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedId === req.inter_institutional_request_id && (
                                        <tr className="req-detail-row">
                                            <td colSpan={8}>
                                                <div className="req-detail-content">
                                                    <span><strong>Solicitada:</strong> {req.requested_at ? new Date(req.requested_at).toLocaleString('es-MX') : '—'}</span>
                                                    <span><strong>Respondida:</strong> {req.responded_at ? new Date(req.responded_at).toLocaleString('es-MX') : 'Sin respuesta todavía'}</span>
                                                    {req.rejection_reason && (
                                                        <span><strong>Motivo de rechazo:</strong> {req.rejection_reason}</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>

                    {visibleRequests.length === 0 && (
                        <p className="requests-empty">No hay solicitudes que coincidan con el filtro.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Requests;