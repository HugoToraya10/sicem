import { useEffect, useState } from 'react';
import { roleLabel } from '../config/roles'
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import './Charts.css';
import { getNavLinks } from '../utils/Navlinks';
import {API_BASE_URL} from '../config/api'


// Colores desde los tokens, para que los gráficos sigan el tema claro/oscuro.
// El estado de una solicitud tiene significado fijo: verde aceptada, rojo rechazada,
// ámbar pendiente, gris cancelada.
const STATUS_COLORS = { Pendiente: 'var(--t3)', Aceptada: 'var(--ok)', Rechazada: 'var(--brand)', Cancelada: 'var(--text-3)' }
const FALLBACK_COLORS = ['var(--steel)', 'var(--t2)', 'var(--hosp)']

const AXIS_TICK = { fontSize: 12, fill: 'var(--text-2)' }
const TOOLTIP_STYLE = {
    contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13 },
    labelStyle: { color: 'var(--text)', fontWeight: 600 },
    itemStyle: { color: 'var(--text)' },
    cursor: { fill: 'var(--surface-2)' },
}

// El servidor manda el día en inglés (DAYNAME de MariaDB); aquí se muestra en español.
const DIAS = { Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié', Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom' }
const monthLabel = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

const Charts = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [byType, setByType] = useState([]);
    const [byStatus, setByStatus] = useState([]);
    const [responseTime, setResponseTime] = useState([]);
    const [byInstitution, setByInstitution] = useState([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/emergencias-por-tipo`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setByType(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando emergencias por tipo. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/solicitudes-por-estado`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setByStatus(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando solicitudes por estado. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/tiempo-respuesta`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setResponseTime(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando tiempo de respuesta. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/analiticas/emergencias-por-institucion`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setByInstitution(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando emergencias por institución. ', error))
    }, []);

    const maxInstitutionTotal = Math.max(...byInstitution.map(i => i.total), 1)

    return (
        <div className="charts-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <div role="main" id="contenido" className="charts-body">
                <h1 className="charts-title">Gráficas</h1>
                <p className="charts-subtitle">Cómo va la operación: tipos de emergencia, solicitudes entre instituciones y tiempos de respuesta.</p>

                <div className="charts-grid">

                    <div className="chart-box">
                        <h2>Emergencias por tipo</h2>
                        <p className="chart-sub">{monthLabel}</p>
                        {byType.length === 0 ? (
                            <p className="chart-empty">Todavía no hay emergencias este mes.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={byType}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                                    <XAxis dataKey="name" tick={AXIS_TICK} stroke="var(--line-strong)" />
                                    <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="var(--line-strong)" />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Bar dataKey="total" name="Emergencias" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h2>Solicitudes interinstitucionales</h2>
                        <p className="chart-sub">Por estado</p>
                        {byStatus.length === 0 ? (
                            <p className="chart-empty">Todavía no hay solicitudes entre instituciones.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={byStatus}
                                        dataKey="total"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={75}
                                        innerRadius={42}
                                        stroke="var(--surface)"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {byStatus.map((entry, index) => (
                                            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ fontSize: 13, color: 'var(--text-2)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h2>Tiempo promedio de respuesta</h2>
                        <p className="chart-sub">Minutos, última semana</p>
                        {responseTime.length === 0 ? (
                            <p className="chart-empty">No hubo asignaciones en los últimos 7 días.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={responseTime}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                                    <XAxis dataKey="day" tickFormatter={(d) => DIAS[d] || d} tick={AXIS_TICK} stroke="var(--line-strong)" />
                                    <YAxis tick={AXIS_TICK} stroke="var(--line-strong)" />
                                    <Tooltip {...TOOLTIP_STYLE} labelFormatter={(d) => DIAS[d] || d} />
                                    <Line type="monotone" dataKey="avg_minutes" name="Minutos" stroke="var(--steel)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--steel)" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h2>Emergencias por institución</h2>
                        <p className="chart-sub">{monthLabel}</p>
                        {byInstitution.length === 0 ? (
                            <p className="chart-empty">Sin datos este mes.</p>
                        ) : (
                            <div className="institution-bars">
                                {byInstitution.map((inst) => (
                                    <div key={inst.name} className="institution-bar-row">
                                        <span className="institution-bar-label">{inst.name}</span>
                                        <div className="institution-bar-track">
                                            <div
                                                className="institution-bar-fill"
                                                style={{ width: `${(inst.total / maxInstitutionTotal) * 100}%` }}
                                            />
                                        </div>
                                        <span className="institution-bar-value">{inst.total}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Charts;