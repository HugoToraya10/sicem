import { useEffect, useState } from 'react';
import { roleLabel } from '../config/roles'
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import { getNavLinks } from '../utils/Navlinks';
import { generateEmergencyReport } from '../utils/generateEmergencyReport';
import { readableTextOn } from '../utils/color';
import Icon from '../components/ui/Icon';
import '../pages/admin/Institutions.css';
import './History.css';
import {API_BASE_URL} from '../config/api'
import { useDialogs } from '../context/useDialogs'
import '../styles/entities.css'


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
    { value: 'forced', label: 'Sin resolver' },
]

// Estado de la EMERGENCIA (no es lo mismo que la resolución): si cerró o no.
// "Pendientes" = en curso (closed_at NULL); "Concluidas" = cerrada (closed_at
// con valor). "Todas" = ambas.
const STATE_FILTERS = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'concluidas', label: 'Concluidas' },
    { value: 'pendientes', label: 'Pendientes' },
]

const History = () => {
    const { notify } = useDialogs()
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencies, setEmergencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [search, setSearch] = useState('');
    const [resolutionFilter, setResolutionFilter] = useState('all');
    const [stateFilter, setStateFilter] = useState('all');
    const [triageFilter, setTriageFilter] = useState('all');
    const [triageCatalog, setTriageCatalog] = useState([]);
    const [generatingReportId, setGeneratingReportId] = useState(null);

    // Genera y guarda en el dispositivo el reporte formal PDF de esa emergencia.
    const handleGenerateReport = (em) => {
        if (generatingReportId) return
        setGeneratingReportId(em.emergency_id)
        generateEmergencyReport(em, token)
            .catch((e) => notify(`No se pudo generar el reporte: ${e?.message || 'error desconocido'}`, 'error'))
            .finally(() => setGeneratingReportId(null))
    }

    const visibleEmergencies = emergencies
        .filter((em) => {
            const closed = Boolean(em.closed_at)
            if (stateFilter === 'concluidas') return closed
            if (stateFilter === 'pendientes') return !closed
            return true
        })
        .filter((em) => {
            // La resolución solo es un concepto de emergencias concluidas;
            // una pendiente no tiene close_reason y no debe caer en "Resueltas".
            if (resolutionFilter === 'resolved') return Boolean(em.closed_at) && !em.close_reason
            if (resolutionFilter === 'forced') return Boolean(em.closed_at) && Boolean(em.close_reason)
            return true
        })
        .filter((em) => triageFilter === 'all' || em.triage_level === triageFilter)
        .filter((em) => {
            if (!search.trim()) return true
            const q = search.trim().toLowerCase()
            return (em.type_name || '').toLowerCase().includes(q) || (em.description || '').toLowerCase().includes(q)
        })

    const hasActiveFilters = Boolean(search) || resolutionFilter !== 'all' || stateFilter !== 'all' || triageFilter !== 'all'
    const clearFilters = () => { setSearch(''); setResolutionFilter('all'); setStateFilter('all'); setTriageFilter('all') }

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/emergencias`, {
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
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabel(user?.roleId)} links={navLinks} />

            <div role="main" id="contenido" className="institutions-body">
                <h1 className="institutions-title">Historial de emergencias</h1>
                <p className="page-sub">Todo lo que ya pasó por el sistema, con su motivo de cierre y su duración.</p>

                {accessDenied && (
                    <p className="institutions-empty">No tienes acceso a esta sección.</p>
                )}

                {loading && !accessDenied && <p className="institutions-empty" role="status">Cargando historial…</p>}

                {!accessDenied && !loading && (
                    <>
                        <div className="history-search-row">
                            <div className="history-search">
                                <Icon name="search" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por tipo o descripción"
                                    aria-label="Buscar por tipo o descripción"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="history-seg" role="group" aria-label="Resolución">
                                {RESOLUTION_FILTERS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        aria-pressed={resolutionFilter === opt.value}
                                        onClick={() => setResolutionFilter(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <select className="status-filter-select" aria-label="Estado de la emergencia" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                                {STATE_FILTERS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <select className="status-filter-select" aria-label="Nivel de triage" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                                <option value="all">Todos los niveles</option>
                                {triageCatalog.map((t) => (
                                    <option key={t.triage_level_id} value={t.level}>Nivel {t.level}</option>
                                ))}
                            </select>
                            {hasActiveFilters && <button type="button" className="history-clear-btn" onClick={clearFilters}>Limpiar filtros</button>}
                        </div>

                        <p className="history-count" role="status">
                            Mostrando {visibleEmergencies.length} de {emergencies.length} {emergencies.length === 1 ? 'emergencia' : 'emergencias'}
                        </p>

                        <div className="entity-rows">
                            {visibleEmergencies.map((em) => {
                                const pending = !em.closed_at
                                const unresolved = !pending && em.close_reason
                                return (
                                    <article key={em.emergency_id} className="entity-row" style={{ '--accent': em.triage_hex_color || 'var(--line-strong)' }}>
                                        <span className="tri-badge" style={{ '--c': em.triage_hex_color || 'var(--text-3)', color: readableTextOn(em.triage_hex_color) }} title={em.triage_level ? `Triage ${em.triage_level}` : 'Sin triage'}>
                                            {em.triage_level || '—'}
                                        </span>
                                        <div className="row-main">
                                            <h2 className="row-title">{em.type_name || 'Emergencia'}</h2>
                                            <p className="row-desc" title={em.description || ''}>{em.description || 'Sin descripción'}</p>
                                        </div>
                                        <div className="row-meta">
                                            <span><b>Registro</b> {formatDateTime(em.created_at)}</span>
                                            <span><b>Cierre</b> {pending ? '—' : formatDateTime(em.closed_at)}</span>
                                            <span className="dur">Duración {formatDuration(em.created_at, em.closed_at)}</span>
                                        </div>
                                        <div className="row-actions">
                                            {pending
                                                ? <span className="pill pill-warn">Pendiente</span>
                                                : unresolved
                                                    ? <span className="pill pill-bad" title={em.close_reason}>Sin resolver</span>
                                                    : <span className="pill pill-ok">Resuelta</span>}
                                            <button type="button" className="institutions-edit-btn history-open-btn" onClick={() => navigate(`/emergencias/${em.emergency_id}`)}>Ver detalle</button>
                                            <button type="button" className="institutions-edit-btn" onClick={() => handleGenerateReport(em)} disabled={generatingReportId !== null}>
                                                <Icon name="file" size={14} />{generatingReportId === em.emergency_id ? 'Generando…' : 'Reporte'}
                                            </button>
                                        </div>
                                    </article>
                                )
                            })}
                            {visibleEmergencies.length === 0 && (
                                <p className="entity-empty">
                                    {emergencies.length === 0 ? 'No hay emergencias registradas todavía.' : 'Ninguna emergencia coincide con estos filtros. Quita alguno para ver más.'}
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
