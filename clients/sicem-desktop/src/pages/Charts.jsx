import { useState, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import './Charts.css'

// Colores de las series: variables de tokens.css (siguen al tema claro/oscuro)
const PIE_COLORS = ['var(--steel)', 'var(--brand)', 'var(--ok)', 'var(--u-scene)', 'var(--u-transfer)', 'var(--text-3)']

const TOOLTIP_STYLE = { background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--text)' }

const Charts = () => {
    const { user, token } = useAuth()
    const [byType, setByType] = useState([])
    const [byMonth, setByMonth] = useState([])
    const [avgTransferMinutes, setAvgTransferMinutes] = useState(null)
    const [bedOccupancy, setBedOccupancy] = useState([])

    useEffect(() => {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        const institutionId = user.institutionId

        fetch(`${API_BASE_URL}/emergencias/analiticas/pacientes-por-tipo/${institutionId}`, { headers })
            .then(res => res.json())
            .then(({ data }) => setByType(data.map(row => toLowerCaseKeys(row))))
            .catch(error => console.error('Error recuperando pacientes por tipo. ', error))

        fetch(`${API_BASE_URL}/emergencias/analiticas/pacientes-por-mes/${institutionId}`, { headers })
            .then(res => res.json())
            .then(({ data }) => setByMonth(data.map(row => toLowerCaseKeys(row))))
            .catch(error => console.error('Error recuperando pacientes por mes. ', error))

        fetch(`${API_BASE_URL}/emergencias/analiticas/tiempo-traslado/${institutionId}`, { headers })
            .then(res => res.json())
            .then(({ data }) => setAvgTransferMinutes(data?.[0]?.avg_minutes ?? null))
            .catch(error => console.error('Error recuperando tiempo de traslado. ', error))

        // Ocupación por especialidad: mismos 2 endpoints que ya usa Capacity.jsx,
        // solo que aquí los convertimos a porcentaje en vez de mostrar el número crudo.
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/hospitales/especialidades`, { headers }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                const myRows = institutionSpecialtiesRes.data
                    .map(row => toLowerCaseKeys(row))
                    .filter(row => parseInt(row.institution_id) === parseInt(institutionId) && row.is_active)

                const catalog = catalogRes.data.map(s => toLowerCaseKeys(s))

                const totalOccupied = myRows.reduce((sum, row) => sum + (row.total_beds - row.available_beds), 0)

                const withPercent = myRows.map(row => {
                    const occupied = row.total_beds - row.available_beds
                    return {
                        name: catalog.find(s => s.speciality_id === row.speciality_id)?.name || 'Especialidad',
                        occupied,
                        percent: totalOccupied > 0 ? Math.round((occupied / totalOccupied) * 100) : 0
                    }
                }).filter(row => row.occupied > 0)

                setBedOccupancy(withPercent)
            })
            .catch(error => console.error('Error recuperando ocupación por especialidad. ', error))
    }, [user, token])

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Gráficas</h1>
                    <p className="page-sub">Cómo ha trabajado tu institución: qué pacientes recibe, cuánto tardan los traslados y qué especialidades están más ocupadas.</p>
                </div>
            </div>
            <div className="charts-grid">

                <div className="chart-box">
                    <h2>Pacientes recibidos por tipo</h2>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={byType}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                            <XAxis dataKey="type_name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="patient_count" fill="var(--steel)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-box">
                    <h2>Ocupación de camas por especialidad</h2>
                    <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                            <Pie data={bedOccupancy} dataKey="percent" nameKey="name" outerRadius={70} label={(d) => `${d.percent}%`}>
                                {bedOccupancy.map((entry, index) => (
                                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-box kpi-box">
                    <h2>Tiempo promedio de traslado</h2>
                    <div className="kpi-value-big">
                        {avgTransferMinutes !== null ? `${Math.round(avgTransferMinutes)} min` : '—'}
                    </div>
                    <p className="kpi-caption">Desde que se asigna tu hospital como destino hasta que la emergencia se cierra.</p>
                </div>

                <div className="chart-box">
                    <h2>Pacientes atendidos por mes</h2>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={byMonth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="patient_count" fill="var(--steel)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

            </div>
        </div>
    )
}

export default Charts