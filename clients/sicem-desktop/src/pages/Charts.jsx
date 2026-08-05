import { useState, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import './Charts.css'

const PIE_COLORS = ['#1565C0', '#C0272D', '#2E7D32', '#E65100', '#6A1B9A', '#00838F']

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
        <div className="charts-layout">
            <div className="section-title">Gráficas</div>
            <div className="charts-grid">

                <div className="chart-box">
                    <h5>Pacientes recibidos por tipo</h5>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={byType}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="type_name" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="patient_count" fill="#1565C0" radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-box">
                    <h5>Ocupación de camas por especialidad</h5>
                    <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                            <Pie data={bedOccupancy} dataKey="percent" nameKey="name" outerRadius={70} label={(d) => `${d.percent}%`}>
                                {bedOccupancy.map((entry, index) => (
                                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-box kpi-box">
                    <h5>Tiempo promedio de traslado</h5>
                    <div className="kpi-value-big">
                        {avgTransferMinutes !== null ? `${Math.round(avgTransferMinutes)} min` : '—'}
                    </div>
                    <p className="kpi-caption">Desde que se asigna tu hospital como destino hasta que la emergencia se cierra.</p>
                </div>

                <div className="chart-box">
                    <h5>Pacientes atendidos por mes</h5>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={byMonth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="patient_count" fill="#1565C0" radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

            </div>
        </div>
    )
}

export default Charts