import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import { getNavLinks } from '../utils/Navlinks';
import '../pages/admin/Institutions.css';
import './History.css';

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

const History = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const navigate = useNavigate();

    const [emergencies, setEmergencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [search, setSearch] = useState('');

    const visibleEmergencies = emergencies.filter((em) => {
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (em.type_name || '').toLowerCase().includes(q) || (em.description || '').toLowerCase().includes(q)
    })

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/emergencias-cerradas', {
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
                            {search && <button type="button" className="history-clear-btn" onClick={() => setSearch('')}>Limpiar</button>}
                        </div>

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Descripción</th>
                                        <th>Fecha de registro</th>
                                        <th>Fecha de cierre</th>
                                        <th>Duración</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleEmergencies.map((em) => (
                                        <tr key={em.emergency_id}>
                                            <td>{em.type_name || '—'}</td>
                                            <td>{em.description || '—'}</td>
                                            <td>{formatDateTime(em.created_at)}</td>
                                            <td>{formatDateTime(em.closed_at)}</td>
                                            <td><span className="history-duration">{formatDuration(em.created_at, em.closed_at)}</span></td>
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
                                    {emergencies.length === 0 ? 'No hay emergencias cerradas todavía.' : 'No hay emergencias que coincidan con la búsqueda.'}
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
