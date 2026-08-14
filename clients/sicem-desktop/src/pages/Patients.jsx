import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import './Patients.css'

// Pacientes afiliados (rol 5) del sistema, con búsqueda por texto (nombre,
// apellidos, CURP, identificación de afiliación) y filtro por institución.
// Sirve para que el hospital consulte a qué institución pertenece cada
// paciente (Fase 3 — detección de "paciente de otra institución").
const Patients = () => {
    const { user, token } = useAuth()
    const [query, setQuery] = useState('')
    const [institutionFilter, setInstitutionFilter] = useState('')
    const [institutions, setInstitutions] = useState([])
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const fetchInstitutions = useCallback(() => {
        fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`)
            .then(res => res.json())
            .then(({ institutions }) => setInstitutions(institutions || []))
            .catch(error => console.error('Error recuperando instituciones. ', error))
    }, [])

    useEffect(() => { fetchInstitutions() }, [fetchInstitutions])

    const search = useCallback(() => {
        setLoading(true)
        setSearched(true)
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (institutionFilter) params.set('institutionId', institutionFilter)
        fetch(`${API_BASE_URL}/usuarios/pacientes?${params.toString()}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients(data || []))
            .catch(error => console.error('Error buscando pacientes. ', error))
            .finally(() => setLoading(false))
    }, [query, institutionFilter, token])

    const handleSubmit = (e) => { e.preventDefault(); search() }

    return (
        <div className="patients-page">
            <h2>Pacientes afiliados</h2>

            <form className="patients-filters" onSubmit={handleSubmit}>
                <input
                    className="patients-search"
                    placeholder="Buscar por nombre, CURP o identificación…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <select
                    className="patients-institution"
                    value={institutionFilter}
                    onChange={(e) => setInstitutionFilter(e.target.value)}
                >
                    <option value="">Todas las instituciones</option>
                    {institutions.map((i) => (
                        <option key={i.institution_id} value={String(i.institution_id)}>{i.name}</option>
                    ))}
                </select>
                <button className="patients-submit" type="submit" disabled={loading}>
                    {loading ? 'Buscando…' : 'Buscar'}
                </button>
            </form>

            {!searched && <p className="patients-empty">Busca un paciente para ver su institución de afiliación.</p>}
            {searched && !loading && patients.length === 0 && (
                <p className="patients-empty">Sin resultados.</p>
            )}

            {patients.length > 0 && (
                <table className="patients-table">
                    <thead>
                        <tr>
                            <th>Paciente</th>
                            <th>CURP</th>
                            <th>Identificación</th>
                            <th>Institución de afiliación</th>
                            <th>Teléfono</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((p) => {
                            const name = [p.first_name, p.first_surname, p.second_surname]
                                .filter(Boolean).join(' ') || 'Paciente no identificado'
                            return (
                                <tr key={p.user_profile_id}>
                                    <td>{name}</td>
                                    <td>{p.curp || '—'}</td>
                                    <td>{p.identification_number || '—'}</td>
                                    <td>{p.institution_name || 'Sin afiliación'}</td>
                                    <td>{p.phone_number || '—'}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>
    )
}

export default Patients