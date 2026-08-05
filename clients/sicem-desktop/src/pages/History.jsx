import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import PatientDetailModal from '../components/patients/PatientDetailModal'
import RejectReasonModal from '../components/patients/RejectReasonModal'
import './History.css'

const statusLabel = (p) => {
    if (p.discharged_at) return { text: 'Dado de alta', className: 'discharged' }
    if (p.delivered_at) return { text: 'Entregado', className: 'delivered' }
    if (p.reception_status_name === 'Rechazada') return { text: 'Rechazado', className: 'rejected' }
    if (p.reception_status_name === 'Aceptada') return { text: 'Aceptado (en camino)', className: 'accepted' }
    if (p.closed_at) return { text: 'Cerrada sin resolver', className: 'closedUnresolved' }
    return { text: 'Pendiente', className: 'pending' }
}

// Los valores tienen que coincidir con las clases que devuelve statusLabel —
// así el filtro y el pill que ya se ve en la tabla usan el mismo criterio,
// no dos lógicas separadas que se puedan desincronizar.
const STATUS_FILTERS = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'accepted', label: 'Aceptado (en camino)' },
    { value: 'rejected', label: 'Rechazado' },
    { value: 'delivered', label: 'Entregado (internado)' },
    { value: 'discharged', label: 'Dado de alta' },
    { value: 'closedUnresolved', label: 'Cerrada sin resolver' },
]

// Puro archivo: TODO lo que ha pasado por esta institución, con filtros —
// para "qué necesito hacer ahora" está Pacientes en Camino (decisiones) y
// Seguimiento (casos activos); aquí es para buscar/auditar/consultar.
const History = () => {
    const { user, token } = useAuth()
    const [patients, setPatients] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [triageFilter, setTriageFilter] = useState('all')
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [rejectingPatientId, setRejectingPatientId] = useState(null)
    const [triageCatalog, setTriageCatalog] = useState([])

    const fetchHistory = useCallback(() => {
        fetch(`${API_BASE_URL}/emergencias/historial-institucion/${user.institutionId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setPatients((data || []).map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error recuperando historial. ', error))
    }, [user, token])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    // Catálogo REAL de niveles de triage — ya viene ordenado por triage_level_id
    // desde el backend (I, II, III, IV, V en ese orden). Antes sacaba los
    // niveles de los pacientes ya cargados, lo cual solo mostraba los niveles
    // que esta institución ya había tenido — un filtro que no muestra todas
    // las opciones reales no sirve como filtro.
    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setTriageCatalog((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error recuperando catálogo de triage. ', error))
    }, [])

    const handleAccept = (emergencyPatientId) => {
        fetch(`${API_BASE_URL}/emergencias/confirmar-recepcion-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId, accepted: true })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo confirmar la recepción'); return body }))
            .then(() => fetchHistory())
            .catch(error => { console.error('Error aceptando paciente. ', error); alert(error.message || 'No se pudo confirmar la recepción. Intenta de nuevo.') })
    }

    const handleReject = (emergencyPatientId) => {
        setRejectingPatientId(emergencyPatientId)
    }

    const handleConfirmReject = (rejectionReason) => {
        const emergencyPatientId = rejectingPatientId
        fetch(`${API_BASE_URL}/emergencias/confirmar-recepcion-paciente`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyPatientId, accepted: false, rejectionReason })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo rechazar'); return res.json() })
            .then(() => { fetchHistory(); setRejectingPatientId(null) })
            .catch(error => { console.error('Error rechazando paciente. ', error); alert('No se pudo rechazar al paciente. Intenta de nuevo.') })
    }

    const matchesSearch = (p, query) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        const name = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ').toLowerCase()
        return name.includes(q) || (p.curp || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    }

    // Más recientes primero — es un archivo/log, no una cola de prioridad.
    const visiblePatients = [...patients]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .filter((p) => statusFilter === 'all' || statusLabel(p).className === statusFilter)
        .filter((p) => triageFilter === 'all' || p.triage_level === triageFilter)
        .filter((p) => matchesSearch(p, searchQuery))

    return (
        <div className="history-layout">
            <div className="section-title">Historial de Pacientes</div>

            <div className="history-filters">
                <input
                    type="text"
                    className="history-search-input"
                    placeholder="Buscar por nombre, CURP o descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="history-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    {STATUS_FILTERS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <select className="history-filter-select" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                    <option value="all">Todos los niveles de triage</option>
                    {triageCatalog.map((t) => (
                        <option key={t.triage_level_id} value={t.level}>Triage {t.level}</option>
                    ))}
                </select>
            </div>

            <div className="history-table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Paciente</th>
                            <th>CURP</th>
                            <th>Emergencia</th>
                            <th>Estado</th>
                            <th>Emergencia cerrada</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visiblePatients.map((p) => {
                            const status = statusLabel(p)
                            const fullName = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado'
                            return (
                                <tr key={p.emergency_patient_id} onClick={() => setSelectedPatient(p)} className="history-row">
                                    <td>{new Date(p.created_at).toLocaleString('es-MX')}</td>
                                    <td>{fullName}</td>
                                    <td>{p.curp || '—'}</td>
                                    <td>{p.description || 'Sin descripción'}</td>
                                    <td><span className={`history-status-pill ${status.className}`}>{status.text}</span></td>
                                    <td>{p.closed_at ? new Date(p.closed_at).toLocaleString('es-MX') : '—'}</td>
                                    <td><button className="btn-detail" onClick={(e) => { e.stopPropagation(); setSelectedPatient(p) }}>Ver detalle</button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {visiblePatients.length === 0 && (
                    <p className="empty-state">
                        {searchQuery || statusFilter !== 'all' || triageFilter !== 'all' ? 'Sin resultados para este filtro.' : 'Sin historial de pacientes todavía.'}
                    </p>
                )}
            </div>

            {selectedPatient && (
                <PatientDetailModal
                    patient={selectedPatient}
                    token={token}
                    onClose={() => setSelectedPatient(null)}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onPatientUpdated={(emergencyPatientId, changes) => {
                        setPatients((current) => current.map((p) =>
                            p.emergency_patient_id === emergencyPatientId ? { ...p, ...changes } : p
                        ))
                    }}
                />
            )}

            {rejectingPatientId && (
                <RejectReasonModal
                    onConfirm={handleConfirmReject}
                    onCancel={() => setRejectingPatientId(null)}
                />
            )}
        </div>
    )
}

export default History
