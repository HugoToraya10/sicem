import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { generatePatientReport } from '../utils/generatePatientReport'
import PatientDetailModal from '../components/patients/PatientDetailModal'
import RejectReasonModal from '../components/patients/RejectReasonModal'
import { useDialogs } from '../context/useDialogs'
import { formatDateTime } from '../utils/time'
import { readableTextOn } from '../utils/color'
import { triageRoman } from '../utils/triage'
import './History.css'
import AnimatedNumber from '../components/ui/AnimatedNumber'

const statusLabel = (p) => {
    if (p.discharged_at) return { text: 'Dado de alta', className: 'discharged', chip: 'chip-steel' }
    if (p.delivered_at) return { text: 'Entregado', className: 'delivered', chip: 'chip-ok' }
    if (p.reception_status_name === 'Rechazada') return { text: 'Rechazado', className: 'rejected', chip: 'chip-brand' }
    if (p.reception_status_name === 'Aceptada') return { text: 'Aceptado (en camino)', className: 'accepted', chip: 'chip-ok' }
    if (p.closed_at) return { text: 'Cerrada sin resolver', className: 'closedUnresolved', chip: 'chip-warn' }
    return { text: 'Pendiente', className: 'pending', chip: '' }
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

// Estado de la EMERGENCIA (no el del paciente): Concluidas = emergencia cerrada
// (p.closed_at con valor); Pendientes = emergencia en curso (closed_at NULL).
// Es otra dimensión, aparte del estado del paciente de arriba.
const EMERGENCY_STATE_FILTERS = [
    { value: 'all', label: 'Todas las emergencias' },
    { value: 'concluidas', label: 'Solo emergencias concluidas' },
    { value: 'pendientes', label: 'Solo emergencias pendientes' },
]

// Puro archivo: TODO lo que ha pasado por esta institución, con filtros —
// para "qué necesito hacer ahora" está Pacientes en Camino (decisiones) y
// Seguimiento (casos activos); aquí es para buscar/auditar/consultar.
const History = () => {
    const { user, token } = useAuth()
    const { notify } = useDialogs()
    const [patients, setPatients] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [emergencyStateFilter, setEmergencyStateFilter] = useState('all')
    const [triageFilter, setTriageFilter] = useState('all')
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [rejectingPatientId, setRejectingPatientId] = useState(null)
    const [triageCatalog, setTriageCatalog] = useState([])
    const [generatingReportId, setGeneratingReportId] = useState(null)

    // Genera y guarda en el dispositivo el reporte formal PDF de ese paciente.
    // Mientras se genera, deshabilita el botón de esa fila para no repetir la
    // consulta ni amontonar diálogos de guardado.
    const handleGenerateReport = (p) => {
        if (generatingReportId) return
        setGeneratingReportId(p.emergency_patient_id)
        generatePatientReport(p, token)
            .catch((e) => notify(`No se pudo generar el reporte: ${e?.message || 'error desconocido'}`, 'error'))
            .finally(() => setGeneratingReportId(null))
    }

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
            .then(() => { fetchHistory(); notify('Paciente aceptado.', 'ok') })
            .catch(error => { console.error('Error aceptando paciente. ', error); notify(error.message || 'No se pudo confirmar la recepción. Intenta de nuevo.', 'error') })
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
            .then(() => { fetchHistory(); setRejectingPatientId(null); notify('Paciente rechazado.', 'ok') })
            .catch(error => { console.error('Error rechazando paciente. ', error); notify('No se pudo rechazar al paciente. Intenta de nuevo.', 'error') })
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
        .filter((p) => {
            const closed = Boolean(p.closed_at)
            if (emergencyStateFilter === 'concluidas') return closed
            if (emergencyStateFilter === 'pendientes') return !closed
            return true
        })
        .filter((p) => triageFilter === 'all' || p.triage_level === triageFilter)
        .filter((p) => matchesSearch(p, searchQuery))

    const hasFilters = searchQuery || statusFilter !== 'all' || emergencyStateFilter !== 'all' || triageFilter !== 'all'

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Historial</h1>
                    <p className="page-sub">Todo lo que ha pasado por tu institución, del más reciente al más antiguo. Para lo que requiere acción ahora, usa En camino y Seguimiento.</p>
                </div>
                <ul className="stat-row" aria-label="Resumen">
                    <li><b><AnimatedNumber value={visiblePatients.length} /></b><span>{hasFilters ? 'con este filtro' : 'registros'}</span></li>
                </ul>
            </div>

            <div className="filters" role="search">
                <input
                    type="search"
                    className="input grow"
                    aria-label="Buscar en el historial"
                    placeholder="Nombre, CURP o descripción"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="select" aria-label="Filtrar por estado del paciente" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    {STATUS_FILTERS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <select className="select" aria-label="Filtrar por estado de la emergencia" value={emergencyStateFilter} onChange={(e) => setEmergencyStateFilter(e.target.value)}>
                    {EMERGENCY_STATE_FILTERS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <select className="select" aria-label="Filtrar por nivel de triage" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                    <option value="all">Todos los niveles de triage</option>
                    {triageCatalog.map((t) => (
                        <option key={t.triage_level_id} value={t.level}>Triage {t.level}</option>
                    ))}
                </select>
            </div>

            <div className="entity-rows">
                {visiblePatients.map((p) => {
                    const status = statusLabel(p)
                    const fullName = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(' ') || 'Paciente no identificado'
                    const level = triageRoman(p.triage_level)
                    return (
                        <article key={p.emergency_patient_id} className="entity-row" style={{ '--accent': p.triage_hex_color || 'var(--line-strong)' }} onClick={() => setSelectedPatient(p)}>
                            <span className="tri-badge" style={{ '--c': p.triage_hex_color || 'var(--text-3)', color: readableTextOn(p.triage_hex_color) }} title={level ? `Triage ${level}` : 'Sin triage'}>{level || '—'}</span>
                            <div className="row-main">
                                <h2 className="row-title">{fullName}</h2>
                                <p className="row-desc">{p.description || 'Sin descripción'}</p>
                            </div>
                            <div className="row-meta">
                                <span><b>Registro</b> {formatDateTime(p.created_at)}</span>
                                <span><b>Cierre</b> {p.closed_at ? formatDateTime(p.closed_at) : '—'}</span>
                                <span><b>CURP</b> <span className="mono">{p.curp || '—'}</span></span>
                            </div>
                            <div className="row-actions">
                                <span className={`pill ${status.className === 'rejected' ? 'pill-bad' : status.className === 'closedUnresolved' ? 'pill-warn' : status.className === 'discharged' ? 'pill-steel' : status.className === 'pending' ? '' : 'pill-ok'}`}>{status.text}</span>
                                <button type="button" className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setSelectedPatient(p) }}>Ver detalle</button>
                                <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleGenerateReport(p) }} disabled={generatingReportId !== null}>
                                    {generatingReportId === p.emergency_patient_id ? 'Generando…' : 'Generar reporte'}
                                </button>
                            </div>
                        </article>
                    )
                })}
                {visiblePatients.length === 0 && (
                    <p className="entity-empty">
                        {hasFilters ? 'Sin resultados para este filtro. Quita algún filtro para ver más.' : 'Todavía no hay pacientes en el historial.'}
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
