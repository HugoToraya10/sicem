import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import './Institutions.css';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = {
    name: '', institutionTypeId: '', cityId: '', bedCapacity: '', availableBeds: '',
    streetAddress: '', zipCode: '', longitude: '', latitude: '',
}

const emptySpecialityForm = { institutionId: '', specialityId: '', totalBeds: '', availableBeds: '' }

const Institutions = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)

    const [institutions, setInstitutions] = useState([]);
    const [institutionTypes, setInstitutionTypes] = useState([]);
    const [specialities, setSpecialities] = useState([]);
    const [institutionSpecialities, setInstitutionSpecialities] = useState([]);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const [showBedsForm, setShowBedsForm] = useState(null); // institution_id abierto para editar camas
    const [bedsValue, setBedsValue] = useState('');
    const [capacityValue, setCapacityValue] = useState('');

    const [showSpecialityAssign, setShowSpecialityAssign] = useState(false);
    const [specialityForm, setSpecialityForm] = useState(emptySpecialityForm);

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchInstitutions = () => {
        fetch('http://localhost:3000/hospitales/instituciones', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutions(data.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }

    useEffect(() => { fetchInstitutions() }, []);

    useEffect(() => {
        fetch('http://localhost:3000/hospitales/tipos-institucion', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutionTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando tipos de institución. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/hospitales/especialidades', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setSpecialities(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando especialidades. ', error))
    }, []);

    const fetchInstitutionSpecialities = () => {
        fetch('http://localhost:3000/hospitales/especialidades-instituciones', {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutionSpecialities(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando especialidades por institución. ', error))
    }

    useEffect(() => { fetchInstitutionSpecialities() }, []);

    //---------------------------------registrar / actualizar--------------------------------------------------

    const handleFieldChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/hospitales/registrar-institucion', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                name: form.name,
                institutionTypeId: form.institutionTypeId,
                cityId: form.cityId,
                bedCapacity: form.bedCapacity,
                availableBeds: form.availableBeds,
                streetAddress: form.streetAddress,
                zipCode: form.zipCode,
                longitude: form.longitude,
                latitude: form.latitude,
            })
        })
            .then(res => res.json())
            .then(() => { setForm(emptyForm); setShowForm(false); fetchInstitutions(); })
            .catch(error => console.error('Error registrando institución. ', error))
    }

    const handleToggleActive = (institutionId) => {
        fetch('http://localhost:3000/hospitales/alternar-institucion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId })
        })
            .then(res => res.json())
            .then(() => fetchInstitutions())
            .catch(error => console.error('Error cambiando estado de la institución. ', error))
    }

    const openBedsForm = (inst) => {
        setShowBedsForm(inst.institution_id)
        setBedsValue(inst.available_beds ?? '')
        setCapacityValue(inst.bed_capacity ?? '')
    }

    const handleUpdateBeds = (e, institutionId) => {
        e.preventDefault();
        Promise.all([
            fetch('http://localhost:3000/hospitales/actualizar-camas-institucion', {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionId, availableBeds: bedsValue })
            }).then(res => res.json()),
            fetch('http://localhost:3000/hospitales/actualizar-capacidad-institucion', {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionId, bedCapacity: capacityValue })
            }).then(res => res.json()),
        ])
            .then(() => { setShowBedsForm(null); fetchInstitutions(); })
            .catch(error => console.error('Error actualizando camas. ', error))
    }

    const handleAssignSpeciality = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/hospitales/asignar-especialidad', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: specialityForm.institutionId,
                specialityId: specialityForm.specialityId,
                totalBeds: specialityForm.totalBeds,
                availableBeds: specialityForm.availableBeds,
            })
        })
            .then(res => res.json())
            .then(() => { setSpecialityForm(emptySpecialityForm); setShowSpecialityAssign(false); fetchInstitutionSpecialities(); })
            .catch(error => console.error('Error asignando especialidad. ', error))
    }

    const specialitiesForInstitution = (institutionId) =>
        institutionSpecialities.filter(s => s.institution_id === institutionId)

    //---------------------------------registrar / actualizar--------------------------------------------------

    return (
        <div className="institutions-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="institutions-body">
                <div className="institutions-header">
                    <h2 className="institutions-title">Gestión de Instituciones</h2>
                    <div className="institutions-header-actions">
                        <button className="institutions-secondary-btn" onClick={() => setShowSpecialityAssign(!showSpecialityAssign)}>
                            Asignar Especialidad
                        </button>
                        <button className="institutions-add-btn" onClick={() => setShowForm(!showForm)}>
                            + Nueva Institución
                        </button>
                    </div>
                </div>

                {showSpecialityAssign && (
                    <form className="institutions-form" onSubmit={handleAssignSpeciality}>
                        <h3>Asignar Especialidad a Institución</h3>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Institución</label>
                                <select value={specialityForm.institutionId} onChange={(e) => setSpecialityForm(p => ({ ...p, institutionId: e.target.value }))} required>
                                    <option value="">Selecciona una institución</option>
                                    {institutions.map((inst) => (
                                        <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="institutions-field">
                                <label>Especialidad</label>
                                <select value={specialityForm.specialityId} onChange={(e) => setSpecialityForm(p => ({ ...p, specialityId: e.target.value }))} required>
                                    <option value="">Selecciona una especialidad</option>
                                    {specialities.map((sp) => (
                                        <option key={sp.speciality_id} value={sp.speciality_id}>{sp.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Camas totales</label>
                                <input type="number" min="0" value={specialityForm.totalBeds} onChange={(e) => setSpecialityForm(p => ({ ...p, totalBeds: e.target.value }))} required />
                            </div>
                            <div className="institutions-field">
                                <label>Camas disponibles</label>
                                <input type="number" min="0" value={specialityForm.availableBeds} onChange={(e) => setSpecialityForm(p => ({ ...p, availableBeds: e.target.value }))} required />
                            </div>
                        </div>
                        <div className="institutions-form-actions">
                            <button type="submit" className="institutions-form-submit">Asignar</button>
                            <button type="button" className="institutions-form-cancel" onClick={() => setShowSpecialityAssign(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                {showForm && (
                    <form className="institutions-form" onSubmit={handleSubmit}>
                        <h3>Registrar Nueva Institución</h3>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Nombre</label>
                                <input type="text" value={form.name} onChange={(e) => handleFieldChange('name', e.target.value)} maxLength={150} required />
                            </div>
                            <div className="institutions-field">
                                <label>Tipo de institución</label>
                                <select value={form.institutionTypeId} onChange={(e) => handleFieldChange('institutionTypeId', e.target.value)} required>
                                    <option value="">Selecciona un tipo</option>
                                    {institutionTypes.map((t) => (
                                        <option key={t.institution_type_id} value={t.institution_type_id}>{t.institution_type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Capacidad total de camas</label>
                                <input type="number" min="0" value={form.bedCapacity} onChange={(e) => handleFieldChange('bedCapacity', e.target.value)} required />
                            </div>
                            <div className="institutions-field">
                                <label>Camas disponibles</label>
                                <input type="number" min="0" value={form.availableBeds} onChange={(e) => handleFieldChange('availableBeds', e.target.value)} required />
                            </div>
                        </div>
                        <div className="institutions-field">
                            <label>Dirección</label>
                            <input type="text" value={form.streetAddress} onChange={(e) => handleFieldChange('streetAddress', e.target.value)} maxLength={150} required />
                        </div>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Código postal</label>
                                <input type="text" value={form.zipCode} onChange={(e) => handleFieldChange('zipCode', e.target.value)} maxLength={5} required />
                            </div>
                            <div className="institutions-field">
                                <label>ID de ciudad</label>
                                <input type="number" value={form.cityId} onChange={(e) => handleFieldChange('cityId', e.target.value)} required />
                            </div>
                        </div>
                        <div className="institutions-form-row">
                            <div className="institutions-field">
                                <label>Latitud</label>
                                <input type="number" step="0.00000001" value={form.latitude} onChange={(e) => handleFieldChange('latitude', e.target.value)} required />
                            </div>
                            <div className="institutions-field">
                                <label>Longitud</label>
                                <input type="number" step="0.00000001" value={form.longitude} onChange={(e) => handleFieldChange('longitude', e.target.value)} required />
                            </div>
                        </div>
                        <div className="institutions-form-actions">
                            <button type="submit" className="institutions-form-submit">Registrar institución</button>
                            <button type="button" className="institutions-form-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                <div className="institutions-grid">
                    {institutions.map((inst) => (
                        <div key={inst.institution_id} className="institution-admin-card">
                            <div className="institution-admin-header">
                                <h4>{inst.name}</h4>
                                <span className={`institutions-status ${inst.is_active ? 'status-active' : 'status-inactive'}`}>
                                    {inst.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                            </div>

                            <div className="institution-admin-beds">
                                <span className="beds-current">{inst.available_beds}</span>
                                <span className="beds-total">/ {inst.bed_capacity} camas totales</span>
                            </div>

                            <div className="institution-admin-specialities">
                                {specialitiesForInstitution(inst.institution_id).length === 0 ? (
                                    <span className="no-specialities">Sin especialidades asignadas</span>
                                ) : (
                                    specialitiesForInstitution(inst.institution_id).map((s) => (
                                        <span key={s.institution_speciality_id} className="speciality-chip">
                                            {s.available_beds}/{s.total_beds}
                                        </span>
                                    ))
                                )}
                            </div>

                            {showBedsForm === inst.institution_id ? (
                                <form className="beds-edit-form" onSubmit={(e) => handleUpdateBeds(e, inst.institution_id)}>
                                    <input type="number" min="0" placeholder="Capacidad" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} required />
                                    <input type="number" min="0" placeholder="Disponibles" value={bedsValue} onChange={(e) => setBedsValue(e.target.value)} required />
                                    <button type="submit">Guardar</button>
                                    <button type="button" onClick={() => setShowBedsForm(null)}>Cancelar</button>
                                </form>
                            ) : (
                                <div className="institution-admin-actions">
                                    <button className="institutions-edit-btn" onClick={() => openBedsForm(inst)}>Editar camas</button>
                                    <button className="institutions-toggle-btn" onClick={() => handleToggleActive(inst.institution_id)}>
                                        {inst.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {institutions.length === 0 && (
                    <p className="institutions-empty">No hay instituciones registradas todavía.</p>
                )}
            </div>
        </div>
    )
}

export default Institutions;