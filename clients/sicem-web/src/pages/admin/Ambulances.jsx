import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import { connectUnitsSocket } from '../../sockets/unitsSocket';
import './Ambulances.css';
import {API_BASE_URL} from '../../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = { unitNumber: '', licensePlate: '', ambulanceTypeId: '', ambulanceStatusId: '', institutionId: '' }
const emptyTypeForm = { ambulanceType: '' }
const emptyStatusForm = { name: '', description: '' }
const emptyEditForm = { ambulanceId: '', unitNumber: '', licensePlate: '', ambulanceTypeId: '', institutionId: '' }
const emptyEditTypeForm = { ambulanceTypeId: '', ambulanceType: '' }
const emptyEditStatusForm = { ambulanceStatusId: '', name: '', description: '' }

const TABS = ['Ambulancias', 'Tipos', 'Estados']

const Ambulances = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Ambulancias')

    const [ambulances, setAmbulances] = useState([]);
    const [ambulanceTypes, setAmbulanceTypes] = useState([]);
    const [ambulanceStatuses, setAmbulanceStatuses] = useState([]);
    const [institutions, setInstitutions] = useState([]);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const [showTypeForm, setShowTypeForm] = useState(false);
    const [typeForm, setTypeForm] = useState(emptyTypeForm);

    const [showStatusForm, setShowStatusForm] = useState(false);
    const [statusForm, setStatusForm] = useState(emptyStatusForm);

    const [editingAmbulance, setEditingAmbulance] = useState(null);
    const [editForm, setEditForm] = useState(emptyEditForm);

    const [editingType, setEditingType] = useState(null);
    const [editTypeForm, setEditTypeForm] = useState(emptyEditTypeForm);

    const [editingStatus, setEditingStatus] = useState(null);
    const [editStatusForm, setEditStatusForm] = useState(emptyEditStatusForm);

    const [historyAmbulanceId, setHistoryAmbulanceId] = useState(null);
    const [ambulanceHistory, setAmbulanceHistory] = useState([]);

    // Tripulación: paramédicos vinculados a cada ambulancia (aunque no estén
    // logueados), con su horario de turnos y si tienen sesión activa.
    const [crew, setCrew] = useState([]);
    const [crewAmbulanceId, setCrewAmbulanceId] = useState(null);

    // Paramédicos EN LÍNEA ahora mismo (socket del servicio de unidades) — el
    // único indicador real: active_session_id de BD nunca se limpia al cerrar
    // sesión, por eso no sirve (ver getAmbulanceCrew en usuarios).
    const [onlineParamedicIds, setOnlineParamedicIds] = useState(new Set());

    // Búsqueda por número de unidad o placa
    const [searchMode, setSearchMode] = useState(null); // 'unitNumber' | 'licensePlate' | null
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);

    // Filtros visuales por estado (Todos / Activos / Inactivos) — solo afectan el render, no hacen fetch
    const [ambulancesFilter, setAmbulancesFilter] = useState('all');
    const [typesFilter, setTypesFilter] = useState('all');
    const [statusesFilter, setStatusesFilter] = useState('all');

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    // ¿El paramédico debería estar de turno AHORA? Compara la hora actual
    // contra su shift_windows del día de hoy (mismo criterio que isWithinSchedule
    // en services/unidades: 1=lunes..7=domingo, y rangos que cruzan medianoche).
    const isOnScheduleNow = (shiftWindows) => {
        if (!shiftWindows || shiftWindows.length === 0) return false
        const now = new Date()
        const jsDay = now.getDay()
        const isoDay = jsDay === 0 ? 7 : jsDay
        const todayWindow = shiftWindows.find((w) => parseInt(w.day) === isoDay)
        if (!todayWindow) return false
        const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        const startMinutes = toMinutes(todayWindow.start)
        const endMinutes = toMinutes(todayWindow.end)
        return startMinutes <= endMinutes
            ? (nowMinutes >= startMinutes && nowMinutes <= endMinutes)
            : (nowMinutes >= startMinutes || nowMinutes <= endMinutes)
    }

    const WEEKDAY_LABELS = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }
    const formatSchedule = (shiftWindows) => {
        if (!shiftWindows || shiftWindows.length === 0) return 'Sin horario asignado'
        return shiftWindows
            .map((w) => `${WEEKDAY_LABELS[parseInt(w.day)] || w.day} ${w.start}-${w.end}`)
            .join(' · ')
    }

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchAmbulances = () => {
        fetch(`${API_BASE_URL}/unidades/ambulancias-todas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulances(data.map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando ambulancias. ', error))
    }
    useEffect(() => { fetchAmbulances() }, []);

    const fetchCrew = () => {
        fetch(`${API_BASE_URL}/usuarios/tripulacion-ambulancias`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setCrew((data || []).map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error consultando tripulación de ambulancias. ', error))
    }
    useEffect(() => { fetchCrew() }, []);

    // Presencia en tiempo real de paramédicos en línea. El backend mantiene en
    // el socket de unidades quién tiene el celular conectado ahora mismo y
    // avisa al room 'admin' (y 'despachador') con el estado actual + cambios.
    useEffect(() => {
        const socket = connectUnitsSocket(token)
        socket.on('eventParamedicPresence', ({ online }) => {
            setOnlineParamedicIds(new Set((online || []).map((id) => String(id))))
        })
        socket.on('eventParamedicOnline', ({ userProfileId }) => {
            setOnlineParamedicIds((prev) => new Set(prev).add(String(userProfileId)))
        })
        socket.on('eventParamedicOffline', ({ userProfileId }) => {
            setOnlineParamedicIds((prev) => {
                const next = new Set(prev)
                next.delete(String(userProfileId))
                return next
            })
        })
        return () => socket.disconnect()
    }, [token]);

    const fetchTypes = () => {
        fetch(`${API_BASE_URL}/unidades/tipos-ambulancia-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulanceTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando tipos de ambulancia. ', error))
    }
    useEffect(() => { fetchTypes() }, []);

    const fetchStatuses = () => {
        fetch(`${API_BASE_URL}/unidades/estados-ambulancia-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulanceStatuses(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de ambulancia. ', error))
    }
    useEffect(() => { fetchStatuses() }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setInstitutions(data.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }, []);

    const toggleAmbulanceHistory = (amb) => {
        if (historyAmbulanceId === amb.ambulance_id) { setHistoryAmbulanceId(null); setAmbulanceHistory([]); return }
        setHistoryAmbulanceId(amb.ambulance_id)
        fetch(`${API_BASE_URL}/emergencias/asignaciones-ambulancia/${amb.ambulance_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => setAmbulanceHistory((data || []).map(a => toLowerCaseKeys(a))))
            .catch(error => { console.error('Error consultando historial de la ambulancia. ', error); alert(error.message) })
    }

    const toggleCrew = (amb) => {
        setCrewAmbulanceId((current) => current === amb.ambulance_id ? null : amb.ambulance_id)
    }

    //---------------------------------ambulancias: registrar / buscar / activar--------------------------------------------------

    const handleFieldChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    const handleSubmit = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(ambulances, 'unit_number', form.unitNumber, 'número de unidad')) return
        if (blockIfDuplicate(ambulances, 'license_plate', form.licensePlate, 'placa')) return
        fetch(`${API_BASE_URL}/unidades/registrar-ambulancia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                unitNumber: form.unitNumber, licensePlate: form.licensePlate,
                ambulanceTypeId: form.ambulanceTypeId, ambulanceStatusId: form.ambulanceStatusId,
                institutionId: form.institutionId,
            })
        })
            .then(parseResponse)
            .then(() => { setForm(emptyForm); setShowForm(false); fetchAmbulances(); })
            .catch(error => { console.error('Error registrando ambulancia. ', error); alert(error.message) })
    }

    const handleToggleActive = (amb) => {
        const action = amb.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la unidad ${amb.unit_number}?`)) return
        fetch(`${API_BASE_URL}/unidades/alternar-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId: amb.ambulance_id })
        })
            .then(parseResponse)
            .then(() => fetchAmbulances())
            .catch(error => { console.error('Error cambiando estado de la ambulancia. ', error); alert(error.message) })
    }

    const handleSearch = () => {
        if (!searchQuery.trim()) { fetchAmbulances(); setSearchMode(null); return }
        setSearching(true)
        const endpoint = searchMode === 'licensePlate'
            ? `${API_BASE_URL}/unidades/ambulancia/placa/${searchQuery}`
            : `${API_BASE_URL}/unidades/ambulancia/numero/${searchQuery}`

        fetch(endpoint, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } })
            .then(parseResponse)
            .then(({ data }) => {
                const results = Array.isArray(data) ? data : (data ? [data] : [])
                setAmbulances(results.map(a => toLowerCaseKeys(a)))
            })
            .catch(error => { console.error('Error buscando ambulancia. ', error); alert(error.message) })
            .finally(() => setSearching(false))
    }

    const clearSearch = () => {
        setSearchQuery('')
        setSearchMode(null)
        fetchAmbulances()
    }

    const openEditAmbulance = (amb) => {
        setEditingAmbulance(amb.ambulance_id)
        setEditForm({
            ambulanceId: amb.ambulance_id,
            unitNumber: amb.unit_number || '',
            licensePlate: amb.license_plate || '',
            ambulanceTypeId: amb.ambulance_type_id || '',
            institutionId: amb.institution_id || '',
        })
    }

    const handleUpdateAmbulance = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/unidades/actualizar-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editForm)
        })
            .then(parseResponse)
            .then(() => { setEditingAmbulance(null); fetchAmbulances(); })
            .catch(error => { console.error('Error actualizando ambulancia. ', error); alert(error.message) })
    }

    //---------------------------------tipos: crear / desactivar--------------------------------------------------

    const handleCreateType = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(ambulanceTypes, 'ambulance_type', typeForm.ambulanceType, 'nombre de tipo')) return
        fetch(`${API_BASE_URL}/unidades/crear-tipo-ambulancia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceType: typeForm.ambulanceType })
        })
            .then(parseResponse)
            .then(() => { setTypeForm(emptyTypeForm); setShowTypeForm(false); fetchTypes(); })
            .catch(error => { console.error('Error creando tipo de ambulancia. ', error); alert(error.message) })
    }

    const openEditType = (t) => {
        setEditingType(t.ambulance_type_id)
        setEditTypeForm({ ambulanceTypeId: t.ambulance_type_id, ambulanceType: t.ambulance_type || '' })
    }

    const handleUpdateType = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/unidades/actualizar-tipo-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editTypeForm)
        })
            .then(parseResponse)
            .then(() => { setEditingType(null); fetchTypes(); })
            .catch(error => { console.error('Error actualizando tipo de ambulancia. ', error); alert(error.message) })
    }

    const handleToggleType = (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el tipo "${t.ambulance_type}"?`)) return
        fetch(`${API_BASE_URL}/unidades/alternar-tipo-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceTypeId: t.ambulance_type_id })
        })
            .then(parseResponse)
            .then(() => fetchTypes())
            .catch(error => { console.error('Error cambiando estado de tipo. ', error); alert(error.message) })
    }

    //---------------------------------estados: crear / desactivar--------------------------------------------------

    const handleCreateStatus = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(ambulanceStatuses, 'name', statusForm.name, 'nombre')) return
        fetch(`${API_BASE_URL}/unidades/registrar-estado-ambulancia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: statusForm.name, description: statusForm.description })
        })
            .then(parseResponse)
            .then(() => { setStatusForm(emptyStatusForm); setShowStatusForm(false); fetchStatuses(); })
            .catch(error => { console.error('Error creando estado de ambulancia. ', error); alert(error.message) })
    }

    const openEditStatus = (s) => {
        setEditingStatus(s.ambulance_status_id)
        setEditStatusForm({ ambulanceStatusId: s.ambulance_status_id, name: s.name || '', description: s.description || '' })
    }

    const handleUpdateStatus = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/unidades/actualizar-estado-ambulancia-catalogo`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editStatusForm)
        })
            .then(parseResponse)
            .then(() => { setEditingStatus(null); fetchStatuses(); })
            .catch(error => { console.error('Error actualizando estado de ambulancia. ', error); alert(error.message) })
    }

    const handleToggleStatus = (s) => {
        const action = s.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el estado "${s.name}"?`)) return
        fetch(`${API_BASE_URL}/unidades/alternar-estado-ambulancia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceStatusId: s.ambulance_status_id })
        })
            .then(parseResponse)
            .then(() => fetchStatuses())
            .catch(error => { console.error('Error cambiando estado. ', error); alert(error.message) })
    }

    const typeNameById = (id) => ambulanceTypes.find(t => t.ambulance_type_id === id)?.ambulance_type || '—'
    const statusNameById = (id) => ambulanceStatuses.find(s => s.ambulance_status_id === id)?.name || '—'
    const institutionNameById = (id) => institutions.find(i => i.institution_id === id)?.name || '—'

    return (
        <div className="ambulances-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="ambulances-body">
                <h2 className="ambulances-title">Gestión de Ambulancias</h2>

                <div className="ambulances-tabs">
                    {TABS.map((tab) => (
                        <button key={tab} className={`ambulances-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ── TAB: AMBULANCIAS ─────────────────────────────── */}
                {activeTab === 'Ambulancias' && (
                    <>
                        <div className="ambulances-search-row">
                            <select value={searchMode || ''} onChange={(e) => setSearchMode(e.target.value || null)}>
                                <option value="">Buscar por...</option>
                                <option value="unitNumber">Número de unidad</option>
                                <option value="licensePlate">Placa</option>
                            </select>
                            <input
                                type="text"
                                placeholder={searchMode ? `Buscar por ${searchMode === 'licensePlate' ? 'placa' : 'número'}...` : 'Selecciona un modo de búsqueda'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                disabled={!searchMode}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button onClick={handleSearch} disabled={!searchMode || searching}>
                                {searching ? 'Buscando...' : 'Buscar'}
                            </button>
                            {searchQuery && <button className="ambulances-clear-btn" onClick={clearSearch}>Limpiar</button>}
                        </div>

                        <div className="ambulances-tab-header">
                            <select className="status-filter-select" value={ambulancesFilter} onChange={(e) => setAmbulancesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="ambulances-add-btn" onClick={() => setShowForm(!showForm)}>
                                + Nueva Ambulancia
                            </button>
                        </div>

                        {showForm && (
                            <form className="ambulances-form" onSubmit={handleSubmit}>
                                <h3>Registrar Nueva Ambulancia</h3>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Número de unidad</label>
                                        <input type="text" value={form.unitNumber} onChange={(e) => handleFieldChange('unitNumber', e.target.value)} maxLength={8} required />
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Placa</label>
                                        <input type="text" value={form.licensePlate} onChange={(e) => handleFieldChange('licensePlate', e.target.value)} maxLength={9} required />
                                    </div>
                                </div>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Tipo de ambulancia</label>
                                        <select value={form.ambulanceTypeId} onChange={(e) => handleFieldChange('ambulanceTypeId', e.target.value)} required>
                                            <option value="">Selecciona un tipo</option>
                                            {ambulanceTypes.map((t) => (
                                                <option key={t.ambulance_type_id} value={t.ambulance_type_id}>{t.ambulance_type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Estado inicial</label>
                                        <select value={form.ambulanceStatusId} onChange={(e) => handleFieldChange('ambulanceStatusId', e.target.value)} required>
                                            <option value="">Selecciona un estado</option>
                                            {ambulanceStatuses.map((s) => (
                                                <option key={s.ambulance_status_id} value={s.ambulance_status_id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="ambulances-field">
                                    <label>Institución</label>
                                    <select value={form.institutionId} onChange={(e) => handleFieldChange('institutionId', e.target.value)} required>
                                        <option value="">Selecciona una institución</option>
                                        {institutions.map((inst) => (
                                            <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Registrar ambulancia</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingAmbulance !== null && (
                            <form className="ambulances-form" onSubmit={handleUpdateAmbulance}>
                                <h3>Editar Ambulancia</h3>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Número de unidad</label>
                                        <input type="text" value={editForm.unitNumber} onChange={(e) => setEditForm(p => ({ ...p, unitNumber: e.target.value }))} maxLength={8} required />
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Placa</label>
                                        <input type="text" value={editForm.licensePlate} onChange={(e) => setEditForm(p => ({ ...p, licensePlate: e.target.value }))} maxLength={9} required />
                                    </div>
                                </div>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Tipo de ambulancia</label>
                                        <select value={editForm.ambulanceTypeId} onChange={(e) => setEditForm(p => ({ ...p, ambulanceTypeId: e.target.value }))} required>
                                            <option value="">Selecciona un tipo</option>
                                            {ambulanceTypes.map((t) => (
                                                <option key={t.ambulance_type_id} value={t.ambulance_type_id}>{t.ambulance_type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Institución</label>
                                        <select value={editForm.institutionId} onChange={(e) => setEditForm(p => ({ ...p, institutionId: e.target.value }))} required>
                                            <option value="">Selecciona una institución</option>
                                            {institutions.map((inst) => (
                                                <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Guardar cambios</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setEditingAmbulance(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="ambulances-table-wrapper">
                            <table className="ambulances-table">
                                <thead>
                                    <tr>
                                        <th>Unidad</th><th>Placa</th><th>Tipo</th><th>Estado</th><th>Institución</th><th>Activa</th><th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filterByStatus(ambulances, ambulancesFilter).map((amb) => (
                                        <Fragment key={amb.ambulance_id}>
                                        <tr>
                                            <td className="ambulances-unit">{amb.unit_number}</td>
                                            <td className="ambulances-plate">{amb.license_plate}</td>
                                            <td>{typeNameById(amb.ambulance_type_id)}</td>
                                            <td>{statusNameById(amb.ambulance_status_id)}</td>
                                            <td>{institutionNameById(amb.institution_id)}</td>
                                            <td>
                                                <span className={`ambulances-status ${amb.is_active ? 'status-active' : 'status-inactive'}`}>
                                                    {amb.is_active ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="ambulances-toggle-btn" onClick={() => openEditAmbulance(amb)}>Editar</button>
                                                <button className="ambulances-toggle-btn" onClick={() => toggleCrew(amb)}>Tripulación</button>
                                                <button className="ambulances-toggle-btn" onClick={() => toggleAmbulanceHistory(amb)}>Historial</button>
                                                <button className="ambulances-toggle-btn" onClick={() => handleToggleActive(amb)}>
                                                    {amb.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                        {crewAmbulanceId === amb.ambulance_id && (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className="ambulance-crew">
                                                        <strong>Paramédicos que conducen esta unidad:</strong>
                                                        {crew.filter((p) => p.assigned_ambulance_id && String(p.assigned_ambulance_id) === String(amb.ambulance_id)).length === 0 ? (
                                                            <span className="ambulance-crew-empty">Esta unidad no tiene paramédicos vinculados.</span>
                                                        ) : (
                                                            crew.filter((p) => p.assigned_ambulance_id && String(p.assigned_ambulance_id) === String(amb.ambulance_id)).map((p) => {
                                                                const isOnline = onlineParamedicIds.has(String(p.user_profile_id))
                                                                return (
                                                                    <div key={p.user_profile_id} className="ambulance-crew-row">
                                                                        {isOnline && <span className="crew-online-dot" title="Conectado ahora mismo" />}
                                                                        <span className={`crew-name ${isOnScheduleNow(p.shift_windows) ? 'crew-on-schedule' : ''}`}>
                                                                            {p.first_name} {p.first_surname}
                                                                        </span>
                                                                        <span className="crew-schedule">{formatSchedule(p.shift_windows)}</span>
                                                                        <span className="crew-shift-state">
                                                                            {isOnScheduleNow(p.shift_windows) ? '· En horario de turno' : '· Fuera de turno'}
                                                                        </span>
                                                                        {isOnline && <span className="crew-online-label">En línea</span>}
                                                                    </div>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {historyAmbulanceId === amb.ambulance_id && (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div className="ambulance-history">
                                                        <strong>Historial de emergencias atendidas:</strong>
                                                        {ambulanceHistory.length === 0 ? (
                                                            <span>Esta unidad no ha atendido ninguna emergencia todavía.</span>
                                                        ) : (
                                                            ambulanceHistory.map((h) => (
                                                                <div key={h.assignment_id} className="ambulance-history-row">
                                                                    <span>{h.emergency_type_name || 'Emergencia'} — {h.description}</span>
                                                                    <span className="ambulance-history-dates">
                                                                        Asignada: {h.assigned_at ? new Date(h.assigned_at).toLocaleString('es-MX') : '—'}
                                                                        {h.unassigned_at ? ` · Desasignada: ${new Date(h.unassigned_at).toLocaleString('es-MX')}` : ''}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(ambulances, ambulancesFilter).length === 0 && <p className="ambulances-empty">No hay ambulancias que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: TIPOS ─────────────────────────────── */}
                {activeTab === 'Tipos' && (
                    <>
                        <div className="ambulances-tab-header">
                            <select className="status-filter-select" value={typesFilter} onChange={(e) => setTypesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="ambulances-add-btn" onClick={() => setShowTypeForm(!showTypeForm)}>
                                + Nuevo Tipo
                            </button>
                        </div>

                        {showTypeForm && (
                            <form className="ambulances-form" onSubmit={handleCreateType}>
                                <h3>Nuevo Tipo de Ambulancia</h3>
                                <div className="ambulances-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={typeForm.ambulanceType} onChange={(e) => setTypeForm({ ambulanceType: e.target.value })} maxLength={100} required />
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Crear tipo</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setShowTypeForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingType !== null && (
                            <form className="ambulances-form" onSubmit={handleUpdateType}>
                                <h3>Editar Tipo de Ambulancia</h3>
                                <div className="ambulances-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={editTypeForm.ambulanceType} onChange={(e) => setEditTypeForm(p => ({ ...p, ambulanceType: e.target.value }))} maxLength={100} required />
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Guardar cambios</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setEditingType(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="ambulances-table-wrapper">
                            <table className="ambulances-table">
                                <thead><tr><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(ambulanceTypes, typesFilter).map((t) => (
                                        <tr key={t.ambulance_type_id}>
                                            <td>{t.ambulance_type}</td>
                                            <td>
                                                <span className={`ambulances-status ${t.is_active ? 'status-active' : 'status-inactive'}`}>
                                                    {t.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="ambulances-toggle-btn" onClick={() => openEditType(t)}>Editar</button>
                                                <button className="ambulances-toggle-btn" onClick={() => handleToggleType(t)}>
                                                    {t.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(ambulanceTypes, typesFilter).length === 0 && <p className="ambulances-empty">No hay tipos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ESTADOS ─────────────────────────────── */}
                {activeTab === 'Estados' && (
                    <>
                        <div className="ambulances-tab-header">
                            <select className="status-filter-select" value={statusesFilter} onChange={(e) => setStatusesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="ambulances-add-btn" onClick={() => setShowStatusForm(!showStatusForm)}>
                                + Nuevo Estado
                            </button>
                        </div>

                        {showStatusForm && (
                            <form className="ambulances-form" onSubmit={handleCreateStatus}>
                                <h3>Nuevo Estado de Ambulancia</h3>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Nombre</label>
                                        <input type="text" value={statusForm.name} onChange={(e) => setStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Descripción</label>
                                        <input type="text" value={statusForm.description} onChange={(e) => setStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Crear estado</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setShowStatusForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingStatus !== null && (
                            <form className="ambulances-form" onSubmit={handleUpdateStatus}>
                                <h3>Editar Estado de Ambulancia</h3>
                                <div className="ambulances-form-row">
                                    <div className="ambulances-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editStatusForm.name} onChange={(e) => setEditStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="ambulances-field">
                                        <label>Descripción</label>
                                        <input type="text" value={editStatusForm.description} onChange={(e) => setEditStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="ambulances-form-actions">
                                    <button type="submit" className="ambulances-form-submit">Guardar cambios</button>
                                    <button type="button" className="ambulances-form-cancel" onClick={() => setEditingStatus(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="ambulances-table-wrapper">
                            <table className="ambulances-table">
                                <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(ambulanceStatuses, statusesFilter).map((s) => (
                                        <tr key={s.ambulance_status_id}>
                                            <td>{s.name}</td>
                                            <td>{s.description}</td>
                                            <td>
                                                <span className={`ambulances-status ${s.is_active ? 'status-active' : 'status-inactive'}`}>
                                                    {s.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="ambulances-toggle-btn" onClick={() => openEditStatus(s)}>Editar</button>
                                                <button className="ambulances-toggle-btn" onClick={() => handleToggleStatus(s)}>
                                                    {s.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(ambulanceStatuses, statusesFilter).length === 0 && <p className="ambulances-empty">No hay estados que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Ambulances;