import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import { getNavLinks } from '../utils/Navlinks';
import '../pages/admin/Institutions.css';
import './History.css';
import {API_BASE_URL} from '../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

// Diferencia entre dos timestamps ISO, mostrada como "Xh Ym"
const formatDuration = (start, end) => {
    if (!start || !end) return '—'
    const diffMs = new Date(end) - new Date(start)
    if (isNaN(diffMs) || diffMs < 0) return '—'
    const totalMinutes = Math.round(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
}

const formatDateTime = (value) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// Igual que en sicem-desktop: "resuelta" (close_reason vacío, todos sus
// pacientes se entregaron o nunca tuvo destino) vs "cerrada sin resolver"
// (close_reason presente — el despachador la cerró a la fuerza). Mezclar las
// dos en una sola lista es lo que hacía este historial un desastre.
const RESOLUTION_FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'resolved', label: 'Resueltas' },
    { value: 'forced', label: 'Cerradas sin resolver' },
]

const History = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencies, setEmergencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [search, setSearch] = useState('');
    const [resolutionFilter, setResolutionFilter] = useState('all');
    const [triageFilter, setTriageFilter] = useState('all');
    const [triageCatalog, setTriageCatalog] = useState([]);

    const visibleEmergencies = emergencies
        .filter((em) => {
            if (resolutionFilter === 'resolved') return !em.close_reason
            if (resolutionFilter === 'forced') return Boolean(em.close_reason)
            return true
        })
        .filter((em) => triageFilter === 'all' || em.triage_level === triageFilter)
        .filter((em) => {
            if (!search.trim()) return true
            const q = search.trim().toLowerCase()
            return (em.type_name || '').toLowerCase().includes(q) || (em.description || '').toLowerCase().includes(q)
        })

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/emergencias-cerradas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => {
                if (res.status === 403) { setAccessDenied(true); return null }
                return res.json()
            })
            .then((body) => {
                if (!body) return
                setEmergencies((body.data || []).map(em => toLowerCaseKeys(em)))
            })
            .catch(error => console.error('Error consultando historial de emergencias. ', error))
            .finally(() => setLoading(false))
    }, [token]);

    // Catálogo real de niveles de triage, igual que en sicem-desktop — no se
    // deriva de las emergencias ya cargadas, porque eso solo mostraría los
    // niveles que ya aparecieron, no todos los que existen.
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setTriageCatalog((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando catálogo de triage. ', error))
    }, []);

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="institutions-body">
                <h2 className="institutions-title">Historial de Emergencias</h2>

                {accessDenied && (
                    <p className="institutions-empty">No tienes acceso a esta sección.</p>
                )}

                {!accessDenied && !loading && (
                    <>
                        <div className="history-search-row">
                            <input
                                type="text"
                                placeholder="Buscar por tipo o descripción..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <select className="status-filter-select" value={resolutionFilter} onChange={(e) => setResolutionFilter(e.target.value)}>
                                {RESOLUTION_FILTERS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <select className="status-filter-select" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                                <option value="all">Todos los niveles de triage</option>
                                {triageCatalog.map((t) => (
                                    <option key={t.triage_level_id} value={t.level}>Triage {t.level}</option>
                                ))}
                            </select>
                            {search && <button type="button" className="history-clear-btn" onClick={() => setSearch('')}>Limpiar</button>}
                        </div>

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Triage</th>
                                        <th>Descripción</th>
                                        <th>Fecha de registro</th>
                                        <th>Fecha de cierre</th>
                                        <th>Duración</th>
                                        <th>Resolución</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleEmergencies.map((em) => (
                                        <tr key={em.emergency_id}>
                                            <td>{em.type_name || '—'}</td>
                                            <td>
                                                {em.triage_level ? (
                                                    <span className="history-triage-pill" style={{ background: em.triage_hex_color || '#888' }}>
                                                        {em.triage_level}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>{em.description || '—'}</td>
                                            <td>{formatDateTime(em.created_at)}</td>
                                            <td>{formatDateTime(em.closed_at)}</td>
                                            <td><span className="history-duration">{formatDuration(em.created_at, em.closed_at)}</span></td>
                                            <td>
                                                {em.close_reason ? (
                                                    <span className="history-resolution-pill forced" title={em.close_reason}>Sin resolver</span>
                                                ) : (
                                                    <span className="history-resolution-pill resolved">Resuelta</span>
                                                )}
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => navigate(`/emergencias/${em.emergency_id}`)}>
                                                    Ver detalle
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {visibleEmergencies.length === 0 && (
                                <p className="institutions-empty">
                                    {emergencies.length === 0 ? 'No hay emergencias cerradas todavía.' : 'No hay emergencias que coincidan con los filtros.'}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default History;
