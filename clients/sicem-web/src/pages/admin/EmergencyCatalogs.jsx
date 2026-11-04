import { useEffect, useState } from 'react';
import { roleLabel } from '../../config/roles'
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import './Institutions.css';
import './EmergencyCatalogs.css';
import {API_BASE_URL} from '../../config/api'
import { useDialogs } from '../../context/useDialogs'
import MoreMenu from '../../components/ui/MoreMenu'
import { readableTextOn } from '../../utils/color'
import '../../styles/entities.css'
import { Drawer } from '../../components/ui/Overlay'


const emptyNameForm = { name: '', description: '' }
const emptyEditNameForm = { id: '', name: '', description: '' }
const emptyTriageForm = { level: '', color: '', hexColor: '#C0272D', description: '', maxWaitMinutes: '' }
const emptyEditTriageForm = { triageLevelId: '', level: '', color: '', hexColor: '#C0272D', description: '', maxWaitMinutes: '' }

const TABS = ['Tipos de Emergencia', 'Estados de Emergencia', 'Estados de Solicitud', 'Niveles de Triage']

const EmergencyCatalogs = () => {
    const { notify, confirm } = useDialogs()
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
            .catch(error => { console.error('Error creando tipo de emergencia. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando tipo de emergencia. ', error); notify(error.message, 'error') })
    }

    const handleToggleType = async (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el tipo "${t.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/emergencias/alternar-tipo-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyTypeId: t.emergency_type_id })
        })
            .then(parseResponse)
            .then(() => fetchTypes())
            .catch(error => { console.error('Error cambiando estado de tipo de emergencia. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error creando estado de emergencia. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando estado de emergencia. ', error); notify(error.message, 'error') })
    }

    const handleToggleStatus = async (s) => {
        const action = s.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el estado "${s.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/emergencias/alternar-estado-emergencia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ emergencyStatusId: s.emergency_status_id })
        })
            .then(parseResponse)
            .then(() => fetchStatuses())
            .catch(error => { console.error('Error cambiando estado de emergencia. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error creando estado de solicitud. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando estado de solicitud. ', error); notify(error.message, 'error') })
    }

    const handleToggleRequestStatus = async (s) => {
        const action = s.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el estado "${s.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/emergencias/alternar-estado-solicitud`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ requestStatusId: s.request_status_id })
        })
            .then(parseResponse)
            .then(() => fetchRequestStatuses())
            .catch(error => { console.error('Error cambiando estado de solicitud. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error creando nivel de triage. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando nivel de triage. ', error); notify(error.message, 'error') })
    }

    const handleToggleTriage = async (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el nivel "${t.level}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/emergencias/alternar-nivel-triage`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ triageLevelId: t.triage_level_id })
        })
            .then(parseResponse)
            .then(() => fetchTriageLevels())
            .catch(error => { console.error('Error cambiando estado de nivel de triage. ', error); notify(error.message, 'error') })
    }

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabel(user?.roleId)} links={navLinks} />

            <div role="main" id="contenido" className="institutions-body">
                <h1 className="institutions-title">Catálogos de emergencias</h1>

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
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={typesFilter} onChange={(e) => setTypesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowTypeForm(!showTypeForm)}>+ Nuevo tipo</button>
                        </div>

                        <Drawer open={Boolean(showTypeForm)} onClose={() => setShowTypeForm(false)} title="Nuevo Tipo de Emergencia" size="md">
                            <form className="institutions-form" onSubmit={handleCreateType}>
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
                            </Drawer>

                        <Drawer open={Boolean(editingType !== null)} onClose={() => setEditingType(null)} title="Editar Tipo de Emergencia" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateType}>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(types, typesFilter).map((x) => (
                                <article key={x.emergency_type_id} className={`entity acc-route${x.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{x.name}</h2>
                                            <p className="entity-sub">{x.description || 'Sin descripción'}</p>
                                        </div>
                                        <span className={`pill ${x.is_active ? 'pill-ok' : 'pill-warn'}`}>{x.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditType(x)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[{ label: x.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleType(x), danger: Boolean(x.is_active) }]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(types, typesFilter).length === 0 && <p className="entity-empty">No hay tipos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ESTADOS DE EMERGENCIA ─────────────────────────────── */}
                {activeTab === 'Estados de Emergencia' && (
                    <>
                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={statusesFilter} onChange={(e) => setStatusesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowStatusForm(!showStatusForm)}>+ Nuevo estado</button>
                        </div>

                        <Drawer open={Boolean(showStatusForm)} onClose={() => setShowStatusForm(false)} title="Nuevo Estado de Emergencia" size="md">
                            <form className="institutions-form" onSubmit={handleCreateStatus}>
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
                            </Drawer>

                        <Drawer open={Boolean(editingStatus !== null)} onClose={() => setEditingStatus(null)} title="Editar Estado de Emergencia" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateStatus}>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(statuses, statusesFilter).map((x) => (
                                <article key={x.emergency_status_id} className={`entity acc-route${x.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{x.name}</h2>
                                            <p className="entity-sub">{x.description || 'Sin descripción'}</p>
                                        </div>
                                        <span className={`pill ${x.is_active ? 'pill-ok' : 'pill-warn'}`}>{x.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditStatus(x)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[{ label: x.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleStatus(x), danger: Boolean(x.is_active) }]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(statuses, statusesFilter).length === 0 && <p className="entity-empty">No hay estados que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ESTADOS DE SOLICITUD ─────────────────────────────── */}
                {activeTab === 'Estados de Solicitud' && (
                    <>
                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={requestStatusesFilter} onChange={(e) => setRequestStatusesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowRequestStatusForm(!showRequestStatusForm)}>+ Nuevo estado</button>
                        </div>

                        <Drawer open={Boolean(showRequestStatusForm)} onClose={() => setShowRequestStatusForm(false)} title="Nuevo Estado de Solicitud" size="md">
                            <form className="institutions-form" onSubmit={handleCreateRequestStatus}>
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
                            </Drawer>

                        <Drawer open={Boolean(editingRequestStatus !== null)} onClose={() => setEditingRequestStatus(null)} title="Editar Estado de Solicitud" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateRequestStatus}>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(requestStatuses, requestStatusesFilter).map((x) => (
                                <article key={x.request_status_id} className={`entity acc-route${x.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{x.name}</h2>
                                            <p className="entity-sub">{x.description || 'Sin descripción'}</p>
                                        </div>
                                        <span className={`pill ${x.is_active ? 'pill-ok' : 'pill-warn'}`}>{x.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditRequestStatus(x)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[{ label: x.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleRequestStatus(x), danger: Boolean(x.is_active) }]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(requestStatuses, requestStatusesFilter).length === 0 && <p className="entity-empty">No hay estados que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: NIVELES DE TRIAGE ─────────────────────────────── */}
                {activeTab === 'Niveles de Triage' && (
                    <>
                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={triageFilter} onChange={(e) => setTriageFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowTriageForm(!showTriageForm)}>+ Nuevo nivel</button>
                        </div>

                        <Drawer open={Boolean(showTriageForm)} onClose={() => setShowTriageForm(false)} title="Nuevo Nivel de Triage" size="md">
                            <form className="institutions-form" onSubmit={handleCreateTriage}>
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
                            </Drawer>

                        <Drawer open={Boolean(editingTriage !== null)} onClose={() => setEditingTriage(null)} title="Editar Nivel de Triage" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateTriage}>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(triageLevels, triageFilter).map((t) => (
                                <article key={t.triage_level_id} className={`entity${t.is_active ? '' : ' is-off'}`} style={{ '--accent': t.hex_color || 'var(--text-3)' }}>
                                    <div className="entity-head">
                                        <span className="entity-avatar" aria-hidden="true" style={{ background: t.hex_color || 'var(--text-3)', color: readableTextOn(t.hex_color) }}>{t.level}</span>
                                        <div className="entity-titles">
                                            <h2 className="entity-title">Nivel {t.level} · {t.color}</h2>
                                            <p className="entity-sub">{t.description}</p>
                                        </div>
                                        <span className={`pill ${t.is_active ? 'pill-ok' : 'pill-warn'}`}>{t.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <dl className="entity-facts">
                                        <div><dt>Espera máxima</dt><dd>{t.max_wait_minutes === null || t.max_wait_minutes === undefined ? 'Sin límite' : (Number(t.max_wait_minutes) === 0 ? 'Inmediata' : `${t.max_wait_minutes} min`)}</dd></div>
                                        <div><dt>Color</dt><dd className="mono">{t.hex_color || '—'}</dd></div>
                                    </dl>
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditTriage(t)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[{ label: t.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleTriage(t), danger: Boolean(t.is_active) }]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(triageLevels, triageFilter).length === 0 && <p className="entity-empty">No hay niveles que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default EmergencyCatalogs;
