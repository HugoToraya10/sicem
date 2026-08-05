import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import './Institutions.css';
import './EmergencyCatalogs.css';
import {API_BASE_URL} from '../../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyNameForm = { name: '', description: '' }
const emptyEditNameForm = { id: '', name: '', description: '' }
const emptyTriageForm = { level: '', color: '', hexColor: '#C0272D', description: '', maxWaitMinutes: '' }
const emptyEditTriageForm = { triageLevelId: '', level: '', color: '', hexColor: '#C0272D', description: '', maxWaitMinutes: '' }

const TABS = ['Tipos de Emergencia', 'Estados de Emergencia', 'Estados de Solicitud', 'Niveles de Triage']

const EmergencyCatalogs = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Tipos de Emergencia')

    const [types, setTypes] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [requestStatuses, setRequestStatuses] = useState([]);
    const [triageLevels, setTriageLevels] = useState([]);

    const [typesFilter, setTypesFilter] = useState('all');
    const [statusesFilter, setStatusesFilter] = useState('all');
    const [requestStatusesFilter, setRequestStatusesFilter] = useState('all');
    const [triageFilter, setTriageFilter] = useState('all');

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    // Tipos de emergencia: crear / editar
    const [showTypeForm, setShowTypeForm] = useState(false);
    const [typeForm, setTypeForm] = useState(emptyNameForm);
    const [editingType, setEditingType] = useState(null);
    const [editTypeForm, setEditTypeForm] = useState(emptyEditNameForm);

    // Estados de emergencia: crear / editar
    const [showStatusForm, setShowStatusForm] = useState(false);
    const [statusForm, setStatusForm] = useState(emptyNameForm);
    const [editingStatus, setEditingStatus] = useState(null);
    const [editStatusForm, setEditStatusForm] = useState(emptyEditNameForm);

    // Estados de solicitud: crear / editar
    const [showRequestStatusForm, setShowRequestStatusForm] = useState(false);
    const [requestStatusForm, setRequestStatusForm] = useState(emptyNameForm);
    const [editingRequestStatus, setEditingRequestStatus] = useState(null);
    const [editRequestStatusForm, setEditRequestStatusForm] = useState(emptyEditNameForm);

    // Niveles de triage: crear / editar
    const [showTriageForm, setShowTriageForm] = useState(false);
    const [triageForm, setTriageForm] = useState(emptyTriageForm);
    const [editingTriage, setEditingTriage] = useState(null);
    const [editTriageForm, setEditTriageForm] = useState(emptyEditTriageForm);

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchTypes = () => {
        fetch(`${API_BASE_URL}/emergencias/tipos-emergencia-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setTypes((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando tipos de emergencia. ', error))
    }
    useEffect(() => { fetchTypes() }, []);

    const fetchStatuses = () => {
        fetch(`${API_BASE_URL}/emergencias/estados-emergencia-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setStatuses((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de emergencia. ', error))
    }
    useEffect(() => { fetchStatuses() }, []);

    const fetchRequestStatuses = () => {
        fetch(`${API_BASE_URL}/emergencias/estados-solicitud-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setRequestStatuses((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de solicitud. ', error))
    }
    useEffect(() => { fetchRequestStatuses() }, []);

    const fetchTriageLevels = () => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setTriageLevels((data || []).map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando niveles de triage. ', error))
    }
    useEffect(() => { fetchTriageLevels() }, []);

    //---------------------------------tipos de emergencia: crear / editar / alternar--------------------------------------------------

    const handleCreateType = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(types, 'name', typeForm.name, 'nombre de tipo')) return
        fetch(`${API_BASE_URL}/emergencias/crear-tipo-emergencia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: typeForm.name, description: typeForm.description })
        })
            .then(parseResponse)
            .then(() => { setTypeForm(emptyNameForm); setShowTypeForm(false); fetchTypes(); })
            .catch(error => { console.error('Error creando tipo de emergencia. ', error); alert(error.message) })
    }

    const openEditType = (t) => {
        setEditingType(t.emergency_type_id)
        setEditTypeForm({ id: t.emergency_type_id, name: t.name || '', description: t.description || '' })
    }

    const handleUpdateType = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/emergencias/actualizar-tipo-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyTypeId: editTypeForm.id, name: editTypeForm.name, description: editTypeForm.description })
        })
            .then(parseResponse)
            .then(() => { setEditingType(null); fetchTypes(); })
            .catch(error => { console.error('Error actualizando tipo de emergencia. ', error); alert(error.message) })
    }

    const handleToggleType = (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el tipo "${t.name}"?`)) return
        fetch(`${API_BASE_URL}/emergencias/alternar-tipo-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyTypeId: t.emergency_type_id })
        })
            .then(parseResponse)
            .then(() => fetchTypes())
            .catch(error => { console.error('Error cambiando estado de tipo de emergencia. ', error); alert(error.message) })
    }

    //---------------------------------estados de emergencia: crear / editar / alternar--------------------------------------------------

    const handleCreateStatus = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(statuses, 'name', statusForm.name, 'nombre de estado')) return
        fetch(`${API_BASE_URL}/emergencias/crear-estado-emergencia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: statusForm.name, description: statusForm.description })
        })
            .then(parseResponse)
            .then(() => { setStatusForm(emptyNameForm); setShowStatusForm(false); fetchStatuses(); })
            .catch(error => { console.error('Error creando estado de emergencia. ', error); alert(error.message) })
    }

    const openEditStatus = (s) => {
        setEditingStatus(s.emergency_status_id)
        setEditStatusForm({ id: s.emergency_status_id, name: s.name || '', description: s.description || '' })
    }

    const handleUpdateStatus = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/emergencias/actualizar-estado-emergencia-catalogo`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyStatusId: editStatusForm.id, name: editStatusForm.name, description: editStatusForm.description })
        })
            .then(parseResponse)
            .then(() => { setEditingStatus(null); fetchStatuses(); })
            .catch(error => { console.error('Error actualizando estado de emergencia. ', error); alert(error.message) })
    }

    const handleToggleStatus = (s) => {
        const action = s.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el estado "${s.name}"?`)) return
        fetch(`${API_BASE_URL}/emergencias/alternar-estado-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyStatusId: s.emergency_status_id })
        })
            .then(parseResponse)
            .then(() => fetchStatuses())
            .catch(error => { console.error('Error cambiando estado de emergencia. ', error); alert(error.message) })
    }

    //---------------------------------estados de solicitud: crear / editar / alternar--------------------------------------------------

    const handleCreateRequestStatus = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(requestStatuses, 'name', requestStatusForm.name, 'nombre de estado')) return
        fetch(`${API_BASE_URL}/emergencias/crear-estado-solicitud`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: requestStatusForm.name, description: requestStatusForm.description })
        })
            .then(parseResponse)
            .then(() => { setRequestStatusForm(emptyNameForm); setShowRequestStatusForm(false); fetchRequestStatuses(); })
            .catch(error => { console.error('Error creando estado de solicitud. ', error); alert(error.message) })
    }

    const openEditRequestStatus = (s) => {
        setEditingRequestStatus(s.request_status_id)
        setEditRequestStatusForm({ id: s.request_status_id, name: s.name || '', description: s.description || '' })
    }

    const handleUpdateRequestStatus = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/emergencias/actualizar-estado-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ requestStatusId: editRequestStatusForm.id, name: editRequestStatusForm.name, description: editRequestStatusForm.description })
        })
            .then(parseResponse)
            .then(() => { setEditingRequestStatus(null); fetchRequestStatuses(); })
            .catch(error => { console.error('Error actualizando estado de solicitud. ', error); alert(error.message) })
    }

    const handleToggleRequestStatus = (s) => {
        const action = s.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el estado "${s.name}"?`)) return
        fetch(`${API_BASE_URL}/emergencias/alternar-estado-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ requestStatusId: s.request_status_id })
        })
            .then(parseResponse)
            .then(() => fetchRequestStatuses())
            .catch(error => { console.error('Error cambiando estado de solicitud. ', error); alert(error.message) })
    }

    //---------------------------------niveles de triage: crear / editar / alternar--------------------------------------------------

    const handleCreateTriage = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(triageLevels, 'level', triageForm.level, 'nivel')) return
        fetch(`${API_BASE_URL}/emergencias/crear-nivel-triage`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                level: triageForm.level, color: triageForm.color, hexColor: triageForm.hexColor,
                description: triageForm.description, maxWaitMinutes: triageForm.maxWaitMinutes || null,
            })
        })
            .then(parseResponse)
            .then(() => { setTriageForm(emptyTriageForm); setShowTriageForm(false); fetchTriageLevels(); })
            .catch(error => { console.error('Error creando nivel de triage. ', error); alert(error.message) })
    }

    const openEditTriage = (t) => {
        setEditingTriage(t.triage_level_id)
        setEditTriageForm({
            triageLevelId: t.triage_level_id, level: t.level || '', color: t.color || '',
            hexColor: t.hex_color || '#C0272D',
            description: t.description || '', maxWaitMinutes: t.max_wait_minutes ?? '',
        })
    }

    const handleUpdateTriage = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/emergencias/actualizar-nivel-triage`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                triageLevelId: editTriageForm.triageLevelId, level: editTriageForm.level, color: editTriageForm.color,
                hexColor: editTriageForm.hexColor,
                description: editTriageForm.description, maxWaitMinutes: editTriageForm.maxWaitMinutes || null,
            })
        })
            .then(parseResponse)
            .then(() => { setEditingTriage(null); fetchTriageLevels(); })
            .catch(error => { console.error('Error actualizando nivel de triage. ', error); alert(error.message) })
    }

    const handleToggleTriage = (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el nivel "${t.level}"?`)) return
        fetch(`${API_BASE_URL}/emergencias/alternar-nivel-triage`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ triageLevelId: t.triage_level_id })
        })
            .then(parseResponse)
            .then(() => fetchTriageLevels())
            .catch(error => { console.error('Error cambiando estado de nivel de triage. ', error); alert(error.message) })
    }

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="institutions-body">
                <h2 className="institutions-title">Catálogos de Emergencias</h2>

                <div className="institutions-tabs">
                    {TABS.map((tab) => (
                        <button key={tab} className={`institutions-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ── TAB: TIPOS DE EMERGENCIA ─────────────────────────────── */}
                {activeTab === 'Tipos de Emergencia' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={typesFilter} onChange={(e) => setTypesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowTypeForm(!showTypeForm)}>+ Nuevo Tipo</button>
                        </div>

                        {showTypeForm && (
                            <form className="institutions-form" onSubmit={handleCreateType}>
                                <h3>Nuevo Tipo de Emergencia</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={typeForm.name} onChange={(e) => setTypeForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={typeForm.description} onChange={(e) => setTypeForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear tipo</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowTypeForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingType !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateType}>
                                <h3>Editar Tipo de Emergencia</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editTypeForm.name} onChange={(e) => setEditTypeForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={editTypeForm.description} onChange={(e) => setEditTypeForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingType(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(types, typesFilter).map((t) => (
                                        <tr key={t.emergency_type_id}>
                                            <td>{t.name}</td>
                                            <td>{t.description}</td>
                                            <td>
                                                <span className={`institutions-status ${t.is_active ? 'status-active' : 'status-inactive'}`}>{t.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditType(t)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleType(t)}>{t.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(types, typesFilter).length === 0 && <p className="institutions-empty">No hay tipos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ESTADOS DE EMERGENCIA ─────────────────────────────── */}
                {activeTab === 'Estados de Emergencia' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={statusesFilter} onChange={(e) => setStatusesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowStatusForm(!showStatusForm)}>+ Nuevo Estado</button>
                        </div>

                        {showStatusForm && (
                            <form className="institutions-form" onSubmit={handleCreateStatus}>
                                <h3>Nuevo Estado de Emergencia</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={statusForm.name} onChange={(e) => setStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={statusForm.description} onChange={(e) => setStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear estado</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowStatusForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingStatus !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateStatus}>
                                <h3>Editar Estado de Emergencia</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editStatusForm.name} onChange={(e) => setEditStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={editStatusForm.description} onChange={(e) => setEditStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingStatus(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(statuses, statusesFilter).map((s) => (
                                        <tr key={s.emergency_status_id}>
                                            <td>{s.name}</td>
                                            <td>{s.description}</td>
                                            <td>
                                                <span className={`institutions-status ${s.is_active ? 'status-active' : 'status-inactive'}`}>{s.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditStatus(s)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleStatus(s)}>{s.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(statuses, statusesFilter).length === 0 && <p className="institutions-empty">No hay estados que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ESTADOS DE SOLICITUD ─────────────────────────────── */}
                {activeTab === 'Estados de Solicitud' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={requestStatusesFilter} onChange={(e) => setRequestStatusesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowRequestStatusForm(!showRequestStatusForm)}>+ Nuevo Estado</button>
                        </div>

                        {showRequestStatusForm && (
                            <form className="institutions-form" onSubmit={handleCreateRequestStatus}>
                                <h3>Nuevo Estado de Solicitud</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={requestStatusForm.name} onChange={(e) => setRequestStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={50} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={requestStatusForm.description} onChange={(e) => setRequestStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear estado</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowRequestStatusForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingRequestStatus !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateRequestStatus}>
                                <h3>Editar Estado de Solicitud</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editRequestStatusForm.name} onChange={(e) => setEditRequestStatusForm(p => ({ ...p, name: e.target.value }))} maxLength={50} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={editRequestStatusForm.description} onChange={(e) => setEditRequestStatusForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingRequestStatus(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(requestStatuses, requestStatusesFilter).map((s) => (
                                        <tr key={s.request_status_id}>
                                            <td>{s.name}</td>
                                            <td>{s.description}</td>
                                            <td>
                                                <span className={`institutions-status ${s.is_active ? 'status-active' : 'status-inactive'}`}>{s.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditRequestStatus(s)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleRequestStatus(s)}>{s.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(requestStatuses, requestStatusesFilter).length === 0 && <p className="institutions-empty">No hay estados que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: NIVELES DE TRIAGE ─────────────────────────────── */}
                {activeTab === 'Niveles de Triage' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowTriageForm(!showTriageForm)}>+ Nuevo Nivel</button>
                        </div>

                        {showTriageForm && (
                            <form className="institutions-form" onSubmit={handleCreateTriage}>
                                <h3>Nuevo Nivel de Triage</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nivel</label>
                                        <input type="text" placeholder="I, II, III..." value={triageForm.level} onChange={(e) => setTriageForm(p => ({ ...p, level: e.target.value }))} maxLength={3} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Color</label>
                                        <input type="text" placeholder="Rojo, Naranja..." value={triageForm.color} onChange={(e) => setTriageForm(p => ({ ...p, color: e.target.value }))} maxLength={20} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Color (hex)</label>
                                        <input type="color" value={triageForm.hexColor} onChange={(e) => setTriageForm(p => ({ ...p, hexColor: e.target.value }))} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Espera máxima (min)</label>
                                        <input type="number" min="0" value={triageForm.maxWaitMinutes} onChange={(e) => setTriageForm(p => ({ ...p, maxWaitMinutes: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Descripción</label>
                                    <input type="text" value={triageForm.description} onChange={(e) => setTriageForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear nivel</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowTriageForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingTriage !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateTriage}>
                                <h3>Editar Nivel de Triage</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nivel</label>
                                        <input type="text" value={editTriageForm.level} onChange={(e) => setEditTriageForm(p => ({ ...p, level: e.target.value }))} maxLength={3} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Color</label>
                                        <input type="text" value={editTriageForm.color} onChange={(e) => setEditTriageForm(p => ({ ...p, color: e.target.value }))} maxLength={20} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Color (hex)</label>
                                        <input type="color" value={editTriageForm.hexColor} onChange={(e) => setEditTriageForm(p => ({ ...p, hexColor: e.target.value }))} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Espera máxima (min)</label>
                                        <input type="number" min="0" value={editTriageForm.maxWaitMinutes} onChange={(e) => setEditTriageForm(p => ({ ...p, maxWaitMinutes: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Descripción</label>
                                    <input type="text" value={editTriageForm.description} onChange={(e) => setEditTriageForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingTriage(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Nivel</th><th>Color</th><th>Descripción</th><th>Espera máx.</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(triageLevels, triageFilter).map((t) => (
                                        <tr key={t.triage_level_id}>
                                            <td>{t.level}</td>
                                            <td><span className="triage-color-dot" style={{ background: t.hex_color }} />{t.color}</td>
                                            <td>{t.description}</td>
                                            <td>{t.max_wait_minutes ?? '—'}</td>
                                            <td>
                                                <span className={`institutions-status ${t.is_active ? 'status-active' : 'status-inactive'}`}>{t.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditTriage(t)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleTriage(t)}>{t.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(triageLevels, triageFilter).length === 0 && <p className="institutions-empty">No hay niveles que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default EmergencyCatalogs;
