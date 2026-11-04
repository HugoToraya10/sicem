import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useDialogs } from '../context/useDialogs'

// Pacientes afiliados (rol 5) del sistema, con búsqueda por texto (nombre,
// apellidos, CURP, identificación de afiliación) y filtro por institución.
// Sirve para que el hospital consulte a qué institución pertenece cada paciente.
const Patients = () => {
    const { token } = useAuth()
    const { notify } = useDialogs()
    const [query, setQuery] = useState('')
    const [institutionFilter, setInstitutionFilter] = useState('')
    const [institutions, setInstitutions] = useState([])
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`)
            .then(res => res.json())
            .then(({ institutions }) => setInstitutions(institutions || []))
            .catch(error => console.error('Error recuperando instituciones. ', error))
    }, [])

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
            .catch(error => { console.error('Error buscando pacientes. ', error); notify('No se pudo buscar. Revisa tu conexión e inténtalo de nuevo.', 'error') })
            .finally(() => setLoading(false))
    }, [query, institutionFilter, token, notify])

    const handleSubmit = (e) => { e.preventDefault(); search() }

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Pacientes afiliados</h1>
                    <p className="page-sub">Consulta a qué institución pertenece cada paciente antes de recibirlo.</p>
                </div>
            </div>

            <form className="filters" onSubmit={handleSubmit} role="search">
                <input
                    className="input grow"
                    aria-label="Buscar paciente"
                    placeholder="Nombre, CURP o número de afiliación"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <select className="select" aria-label="Filtrar por institución" value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)}>
                    <option value="">Todas las instituciones</option>
                    {institutions.map((i) => (
                        <option key={i.institution_id} value={String(i.institution_id)}>{i.name}</option>
                    ))}
                </select>
                <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
            </form>

            {!searched && <p className="empty">Escribe un nombre, CURP o número de afiliación para ver la institución de un paciente.</p>}
            {searched && !loading && patients.length === 0 && <p className="empty">Sin resultados. Prueba con otro nombre o quita el filtro de institución.</p>}

            {patients.length > 0 && (
                <div className="entity-grid">
                    {patients.map((p) => {
                        const name = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado'
                        const initials = [p.first_name, p.first_surname].filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '?'
                        return (
                            <article key={p.user_profile_id} className={`entity ${p.institution_name ? 'acc-hospital' : 'acc-off'}`} aria-label={name}>
                                <div className="entity-head">
                                    <span className="entity-avatar" aria-hidden="true">{initials}</span>
                                    <div className="entity-titles">
                                        <h2 className="entity-title">{name}</h2>
                                        <p className="entity-sub mono">{p.curp || 'Sin CURP'}</p>
                                    </div>
                                </div>
                                <div className="entity-chips">
                                    <span className={`pill ${p.institution_name ? 'pill-hosp' : 'pill-warn'}`}>{p.institution_name || 'Sin afiliación'}</span>
                                </div>
                                <dl className="entity-facts">
                                    <div><dt>N.º de afiliación</dt><dd className="mono">{p.identification_number || '—'}</dd></div>
                                    <div><dt>Teléfono</dt><dd>{p.phone_number || '—'}</dd></div>
                                </dl>
                            </article>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default Patients
