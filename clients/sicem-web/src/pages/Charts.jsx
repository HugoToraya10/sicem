import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import './Charts.css';
import { getNavLinks } from '../utils/Navlinks';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const PIE_COLORS = ['#2E7D32', '#E67E22', '#C0272D']
const BAR_COLORS = ['#1a1a2e', '#2980B9', '#8E44AD', '#16A085', '#C0272D']

const monthLabel = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

const Charts = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [byType, setByType] = useState([]);
    const [byStatus, setByStatus] = useState([]);
    const [responseTime, setResponseTime] = useState([]);
    const [byInstitution, setByInstitution] = useState([]);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/analiticas/emergencias-por-tipo', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setByType(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando emergencias por tipo. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/analiticas/solicitudes-por-estado', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setByStatus(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando solicitudes por estado. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/analiticas/tiempo-respuesta', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setResponseTime(data.map(d => toLowerCaseKeys(d))))
            .catch(error => console.error('Error consultando tiempo de respuesta. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/emergencias/analiticas/emergencias-por-institucion', {
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
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="charts-body">
                <div className="charts-grid">

                    <div className="chart-box">
                        <h4>Emergencias por Tipo — {monthLabel}</h4>
                        {byType.length === 0 ? (
                            <p className="chart-empty">Sin datos este mes.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={byType}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="total" fill="#C0272D" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h4>Solicitudes Interinstitucionales</h4>
                        {byStatus.length === 0 ? (
                            <p className="chart-empty">Sin solicitudes registradas.</p>
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
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {byStatus.map((entry, index) => (
                                            <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h4>Tiempo Promedio de Respuesta (min) — Última Semana</h4>
                        {responseTime.length === 0 ? (
                            <p className="chart-empty">Sin asignaciones en los últimos 7 días.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={responseTime}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="avg_minutes" stroke="#C0272D" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="chart-box">
                        <h4>Emergencias por Institución — {monthLabel}</h4>
                        {byInstitution.length === 0 ? (
                            <p className="chart-empty">Sin datos este mes.</p>
                        ) : (
                            <div className="institution-bars">
                                {byInstitution.map((inst, index) => (
                                    <div key={inst.name} className="institution-bar-row">
                                        <span className="institution-bar-label">{inst.name}</span>
                                        <div className="institution-bar-track">
                                            <div
                                                className="institution-bar-fill"
                                                style={{
                                                    width: `${(inst.total / maxInstitutionTotal) * 100}%`,
                                                    background: BAR_COLORS[index % BAR_COLORS.length]
                                                }}
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