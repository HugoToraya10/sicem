import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import './Ambulances.css';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = { unitNumber: '', licensePlate: '', ambulanceTypeId: '', ambulanceStatusId: '', institutionId: '' }
const emptyTypeForm = { ambulanceType: '' }
const emptyStatusForm = { name: '', description: '' }

const Ambulances = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)

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

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchAmbulances = () => {
        fetch('http://localhost:3000/unidades/ambulancias', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulances(data.map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando ambulancias. ', error))
    }

    useEffect(() => { fetchAmbulances() }, []);

    const fetchTypes = () => {
        fetch('http://localhost:3000/unidades/tipos-ambulancia', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulanceTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando tipos de ambulancia. ', error))
    }

    useEffect(() => { fetchTypes() }, []);

    const fetchStatuses = () => {
        fetch('http://localhost:3000/unidades/estados-ambulancia', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulanceStatuses(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados de ambulancia. ', error))
    }

    useEffect(() => { fetchStatuses() }, []);

    useEffect(() => {
        fetch('http://localhost:3000/hospitales/instituciones', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutions(data.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }, []);

    //---------------------------------registrar / actualizar--------------------------------------------------

    const handleFieldChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/unidades/registrar-ambulancia', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                unitNumber: form.unitNumber,
                licensePlate: form.licensePlate,
                ambulanceTypeId: form.ambulanceTypeId,
                ambulanceStatusId: form.ambulanceStatusId,
                institutionId: form.institutionId,
            })
        })
            .then(res => res.json())
            .then(() => { setForm(emptyForm); setShowForm(false); fetchAmbulances(); })
            .catch(error => console.error('Error registrando ambulancia. ', error))
    }

    const handleToggleActive = (ambulanceId) => {
        fetch('http://localhost:3000/unidades/alternar-ambulancia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceId })
        })
            .then(res => res.json())
            .then(() => fetchAmbulances())
            .catch(error => console.error('Error cambiando estado de la ambulancia. ', error))
    }

    const handleCreateType = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/unidades/crear-tipo-ambulancia', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ ambulanceType: typeForm.ambulanceType })
        })
            .then(res => res.json())
            .then(() => { setTypeForm(emptyTypeForm); setShowTypeForm(false); fetchTypes(); })
            .catch(error => console.error('Error creando tipo de ambulancia. ', error))
    }

    const handleCreateStatus = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/unidades/registrar-estado-ambulancia', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: statusForm.name, description: statusForm.description })
        })
            .then(res => res.json())
            .then(() => { setStatusForm(emptyStatusForm); setShowStatusForm(false); fetchStatuses(); })
            .catch(error => console.error('Error creando estado de ambulancia. ', error))
    }

    const typeNameById = (id) => ambulanceTypes.find(t => t.ambulance_type_id === id)?.ambulance_type || '—'
    const statusNameById = (id) => ambulanceStatuses.find(s => s.ambulance_status_id === id)?.name || '—'
    const institutionNameById = (id) => institutions.find(i => i.institution_id === id)?.name || '—'

    //---------------------------------registrar / actualizar--------------------------------------------------

    return (
        <div className="ambulances-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="ambulances-body">
                <div className="ambulances-header">
                    <h2 className="ambulances-title">Gestión de Ambulancias</h2>
                    <div className="ambulances-header-actions">
                        <button className="ambulances-secondary-btn" onClick={() => setShowStatusForm(!showStatusForm)}>
                            + Estado
                        </button>
                        <button className="ambulances-secondary-btn" onClick={() => setShowTypeForm(!showTypeForm)}>
                            + Tipo
                        </button>
                        <button className="ambulances-add-btn" onClick={() => setShowForm(!showForm)}>
                            + Nueva Ambulancia
                        </button>
                    </div>
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

                <div className="ambulances-table-wrapper">
                    <table className="ambulances-table">
                        <thead>
                            <tr>
                                <th>Unidad</th>
                                <th>Placa</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Institución</th>
                                <th>Activa</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ambulances.map((amb) => (
                                <tr key={amb.ambulance_id}>
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
                                        <button className="ambulances-toggle-btn" onClick={() => handleToggleActive(amb.ambulance_id)}>
                                            {amb.is_active ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {ambulances.length === 0 && (
                        <p className="ambulances-empty">No hay ambulancias registradas todavía.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Ambulances;