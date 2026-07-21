import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { parseResponse } from '../../utils/apiRequest';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import './Users.css';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = {
    email: '', password: '', roleId: '', institutionId: '',
    firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const emptyPatientForm = {
    hasCredentials: false, email: '', password: '',
    institutionId: '', firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const emptyCredentialsForm = { userCredentialId: '', email: '', password: '' }

const Users = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [institutions, setInstitutions] = useState([]);

    const [showForm, setShowForm] = useState(false);
    const [editingUserProfileId, setEditingUserProfileId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [showPatientForm, setShowPatientForm] = useState(false);
    const [patientForm, setPatientForm] = useState(emptyPatientForm);

    const [showCredentialsForm, setShowCredentialsForm] = useState(false);
    const [credentialsForm, setCredentialsForm] = useState(emptyCredentialsForm);

    const [expandedUserId, setExpandedUserId] = useState(null);
    const [userDetail, setUserDetail] = useState(null);

    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [historyUserId, setHistoryUserId] = useState(null);
    const [credentialHistory, setCredentialHistory] = useState([]);

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    const matchesSearch = (u, query) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        const name = [u.first_name, u.first_surname, u.second_surname].filter(Boolean).join(' ').toLowerCase()
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.curp || '').toLowerCase().includes(q)
    }

    const visibleUsers = filterByStatus(users, statusFilter).filter(u => matchesSearch(u, searchQuery))

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchUsers = () => {
        fetch('http://localhost:3000/usuarios/obtener-usuarios', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setUsers(data.map(u => toLowerCaseKeys(u))))
            .catch(error => console.error('Error consultando usuarios. ', error))
    }

    const fetchCredentialHistory = (userCredentialId) => {
        fetch(`http://localhost:3000/usuarios/historial-cuenta/${userCredentialId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setCredentialHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de cuenta. ', error); alert(error.message) })
    }

    const toggleCredentialHistory = (u) => {
        if (historyUserId === u.user_profile_id) { setHistoryUserId(null); setCredentialHistory([]); return }
        setHistoryUserId(u.user_profile_id)
        fetchCredentialHistory(u.user_credential_id)
    }

    useEffect(() => { fetchUsers() }, []);

    useEffect(() => {
        fetch('http://localhost:3000/usuarios/obtener-roles', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ roles }) => setRoles(roles.map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando roles. ', error))
    }, []);

    useEffect(() => {
        fetch('http://localhost:3000/usuarios/obtener-instituciones', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ institutions }) => setInstitutions(institutions.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }, []);

    const toggleUserDetail = (userProfileId) => {
        if (expandedUserId === userProfileId) {
            setExpandedUserId(null)
            setUserDetail(null)
            return
        }
        setExpandedUserId(userProfileId)
        fetch(`http://localhost:3000/usuarios/obtener-usuario-id/${userProfileId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ user: userData }) => {
                // getUserById responde con un array (result), tomamos el primer elemento
                const detail = Array.isArray(userData) ? userData[0] : userData
                setUserDetail(detail ? toLowerCaseKeys(detail) : null)
            })
            .catch(error => { console.error('Error consultando detalle de usuario. ', error); alert(error.message) })
    }

    //---------------------------------registrar / actualizar empleado--------------------------------------------------

    const handleFieldChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const openCreateForm = () => {
        setForm(emptyForm)
        setEditingUserProfileId(null)
        setShowForm(true)
        setShowPatientForm(false)
        setShowCredentialsForm(false)
    }

    const openEditForm = (u) => {
        setForm({
            email: '', password: '',
            roleId: u.role_id || '',
            institutionId: u.institution_id || '',
            firstName: u.first_name || '',
            firstSurname: u.first_surname || '',
            secondSurname: u.second_surname || '',
            phone: u.phone_number || '',
            birthDate: u.birth_date ? u.birth_date.split('T')[0] : '',
            cveUnicaRegistroPob: u.curp || '',
            emergencyContact: u.emergency_contact || '',
            emergencyPhone: u.emergency_phone || '',
        })
        setEditingUserProfileId(u.user_profile_id)
        setShowForm(true)
        setShowPatientForm(false)
        setShowCredentialsForm(false)
    }

    const handleSubmit = (e) => {
        e.preventDefault();

        if (editingUserProfileId) {
            fetch('http://localhost:3000/usuarios/actualizar-perfil', {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    userProfileId: editingUserProfileId,
                    institutionId: form.institutionId,
                    roleId: form.roleId,
                    firstName: form.firstName,
                    firstSurname: form.firstSurname,
                    secondSurname: form.secondSurname,
                    phone: form.phone,
                    birthDate: form.birthDate,
                    cveUnicaRegistroPob: form.cveUnicaRegistroPob,
                    emergencyContact: form.emergencyContact,
                    emergencyPhone: form.emergencyPhone,
                })
            })
                .then(parseResponse)
                .then(() => { setShowForm(false); fetchUsers(); })
                .catch(error => { console.error('Error actualizando usuario. ', error); alert(error.message) })
        } else {
            if (blockIfDuplicate(users, 'email', form.email, 'correo')) return
            if (blockIfDuplicate(users, 'curp', form.cveUnicaRegistroPob, 'CURP')) return
            fetch('http://localhost:3000/usuarios/registro', {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    roleId: form.roleId,
                    institutionId: form.institutionId,
                    firstName: form.firstName,
                    firstSurname: form.firstSurname,
                    secondSurname: form.secondSurname,
                    phone: form.phone,
                    birthDate: form.birthDate,
                    cveUnicaRegistroPob: form.cveUnicaRegistroPob,
                    emergencyContact: form.emergencyContact,
                    emergencyPhone: form.emergencyPhone,
                })
            })
                .then(parseResponse)
                .then(() => { setShowForm(false); fetchUsers(); })
                .catch(error => { console.error('Error registrando usuario. ', error); alert(error.message) })
        }
    }

    const handleToggleActive = (u) => {
        if (!u.user_credential_id) return
        const action = u.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} a ${u.first_name} ${u.first_surname || ''}?`)) return
        fetch('http://localhost:3000/usuarios/invertir-estado-usuario', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ userCredentialId: u.user_credential_id })
        })
            .then(parseResponse)
            .then(() => fetchUsers())
            .catch(error => { console.error('Error cambiando estado del usuario. ', error); alert(error.message) })
    }

    //---------------------------------registrar paciente--------------------------------------------------

    const openPatientForm = () => {
        setPatientForm(emptyPatientForm)
        setShowPatientForm(true)
        setShowForm(false)
        setShowCredentialsForm(false)
    }

    const handlePatientFieldChange = (field, value) => {
        setPatientForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleRegisterPatient = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(users, 'curp', patientForm.cveUnicaRegistroPob, 'CURP')) return
        if (patientForm.hasCredentials && blockIfDuplicate(users, 'email', patientForm.email, 'correo')) return
        // Nota: el controller fuerza roleId = 5 internamente, no hace falta mandarlo
        const body = {
            institutionId: patientForm.institutionId,
            firstName: patientForm.firstName,
            firstSurname: patientForm.firstSurname,
            secondSurname: patientForm.secondSurname,
            phone: patientForm.phone,
            birthDate: patientForm.birthDate,
            cveUnicaRegistroPob: patientForm.cveUnicaRegistroPob,
            emergencyContact: patientForm.emergencyContact,
            emergencyPhone: patientForm.emergencyPhone,
        }
        if (patientForm.hasCredentials) {
            body.email = patientForm.email
            body.password = patientForm.password
        }

        fetch('http://localhost:3000/usuarios/registro-paciente', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(body)
        })
            .then(parseResponse)
            .then(() => { setShowPatientForm(false); fetchUsers(); })
            .catch(error => { console.error('Error registrando paciente. ', error); alert(error.message) })
    }

    //---------------------------------editar credenciales--------------------------------------------------

    const openCredentialsForm = (u) => {
        setCredentialsForm({ userCredentialId: u.user_credential_id, email: u.email || '', password: '' })
        setShowCredentialsForm(true)
        setShowForm(false)
        setShowPatientForm(false)
    }

    const handleUpdateCredentials = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/usuarios/actualizar-credenciales', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userCredentialId: credentialsForm.userCredentialId,
                email: credentialsForm.email,
                password: credentialsForm.password,
            })
        })
            .then(parseResponse)
            .then(() => { setShowCredentialsForm(false); fetchUsers(); })
            .catch(error => { console.error('Error actualizando credenciales. ', error); alert(error.message) })
    }

    return (
        <div className="users-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabels[user?.roleId] || ''}
                links={navLinks}
            />

            <div className="users-body">
                <div className="users-header">
                    <h2 className="users-title">Gestión de Usuarios</h2>
                    <div className="users-header-actions">
                        <button className="users-secondary-btn" onClick={openPatientForm}>
                            + Registrar Paciente
                        </button>
                        <button className="users-add-btn" onClick={openCreateForm}>
                            + Nuevo Empleado
                        </button>
                    </div>
                </div>

                {showCredentialsForm && (
                    <form className="users-form" onSubmit={handleUpdateCredentials}>
                        <h3>Editar Credenciales de Acceso</h3>
                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Correo electrónico</label>
                                <input type="email" value={credentialsForm.email} onChange={(e) => setCredentialsForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required />
                            </div>
                            <div className="users-field">
                                <label>Nueva contraseña</label>
                                <input type="password" value={credentialsForm.password} onChange={(e) => setCredentialsForm(p => ({ ...p, password: e.target.value }))} minLength={8} required />
                            </div>
                        </div>
                        <div className="users-form-actions">
                            <button type="submit" className="users-form-submit">Guardar credenciales</button>
                            <button type="button" className="users-form-cancel" onClick={() => setShowCredentialsForm(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                {showPatientForm && (
                    <form className="users-form" onSubmit={handleRegisterPatient}>
                        <h3>Registrar Nuevo Paciente</h3>

                        <label className="users-checkbox-row">
                            <input
                                type="checkbox"
                                checked={patientForm.hasCredentials}
                                onChange={(e) => handlePatientFieldChange('hasCredentials', e.target.checked)}
                            />
                            Este paciente tendrá cuenta de acceso al sistema
                        </label>

                        {patientForm.hasCredentials && (
                            <div className="users-form-row">
                                <div className="users-field">
                                    <label>Correo electrónico</label>
                                    <input type="email" value={patientForm.email} onChange={(e) => handlePatientFieldChange('email', e.target.value)} maxLength={150} required />
                                </div>
                                <div className="users-field">
                                    <label>Contraseña</label>
                                    <input type="password" value={patientForm.password} onChange={(e) => handlePatientFieldChange('password', e.target.value)} minLength={8} required />
                                </div>
                            </div>
                        )}

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Nombre(s)</label>
                                <input type="text" value={patientForm.firstName} onChange={(e) => handlePatientFieldChange('firstName', e.target.value)} maxLength={100} required />
                            </div>
                            <div className="users-field">
                                <label>Apellido paterno</label>
                                <input type="text" value={patientForm.firstSurname} onChange={(e) => handlePatientFieldChange('firstSurname', e.target.value)} maxLength={150} required />
                            </div>
                            <div className="users-field">
                                <label>Apellido materno</label>
                                <input type="text" value={patientForm.secondSurname} onChange={(e) => handlePatientFieldChange('secondSurname', e.target.value)} maxLength={150} />
                            </div>
                        </div>

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Teléfono</label>
                                <input type="text" value={patientForm.phone} onChange={(e) => handlePatientFieldChange('phone', e.target.value)} maxLength={10} required />
                            </div>
                            <div className="users-field">
                                <label>Fecha de nacimiento</label>
                                <input type="date" value={patientForm.birthDate} onChange={(e) => handlePatientFieldChange('birthDate', e.target.value)} required />
                            </div>
                            <div className="users-field">
                                <label>CURP</label>
                                <input type="text" value={patientForm.cveUnicaRegistroPob} onChange={(e) => handlePatientFieldChange('cveUnicaRegistroPob', e.target.value)} maxLength={18} required />
                            </div>
                        </div>

                        <div className="users-field">
                            <label>Institución de referencia</label>
                            <select value={patientForm.institutionId} onChange={(e) => handlePatientFieldChange('institutionId', e.target.value)} required>
                                <option value="">Selecciona una institución</option>
                                {institutions.map((inst) => (
                                    <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Contacto de emergencia</label>
                                <input type="text" value={patientForm.emergencyContact} onChange={(e) => handlePatientFieldChange('emergencyContact', e.target.value)} maxLength={200} />
                            </div>
                            <div className="users-field">
                                <label>Teléfono de emergencia</label>
                                <input type="text" value={patientForm.emergencyPhone} onChange={(e) => handlePatientFieldChange('emergencyPhone', e.target.value)} maxLength={10} />
                            </div>
                        </div>

                        <div className="users-form-actions">
                            <button type="submit" className="users-form-submit">Registrar paciente</button>
                            <button type="button" className="users-form-cancel" onClick={() => setShowPatientForm(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                {showForm && (
                    <form className="users-form" onSubmit={handleSubmit}>
                        <h3>{editingUserProfileId ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}</h3>

                        {!editingUserProfileId && (
                            <div className="users-form-row">
                                <div className="users-field">
                                    <label>Correo electrónico</label>
                                    <input type="email" value={form.email} onChange={(e) => handleFieldChange('email', e.target.value)} maxLength={150} required />
                                </div>
                                <div className="users-field">
                                    <label>Contraseña</label>
                                    <input type="password" value={form.password} onChange={(e) => handleFieldChange('password', e.target.value)} required minLength={8} />
                                </div>
                            </div>
                        )}

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Rol</label>
                                <select value={form.roleId} onChange={(e) => handleFieldChange('roleId', e.target.value)} required>
                                    <option value="">Selecciona un rol</option>
                                    {roles.filter(r => r.role_id !== 5).map((r) => (
                                        <option key={r.role_id} value={r.role_id}>{r.role_type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="users-field">
                                <label>Institución</label>
                                <select value={form.institutionId} onChange={(e) => handleFieldChange('institutionId', e.target.value)} required>
                                    <option value="">Selecciona una institución</option>
                                    {institutions.map((inst) => (
                                        <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Nombre(s)</label>
                                <input type="text" value={form.firstName} onChange={(e) => handleFieldChange('firstName', e.target.value)} maxLength={100} required />
                            </div>
                            <div className="users-field">
                                <label>Apellido paterno</label>
                                <input type="text" value={form.firstSurname} onChange={(e) => handleFieldChange('firstSurname', e.target.value)} maxLength={150} required />
                            </div>
                            <div className="users-field">
                                <label>Apellido materno</label>
                                <input type="text" value={form.secondSurname} onChange={(e) => handleFieldChange('secondSurname', e.target.value)} maxLength={150} />
                            </div>
                        </div>

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Teléfono</label>
                                <input type="text" value={form.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} maxLength={10} required />
                            </div>
                            <div className="users-field">
                                <label>Fecha de nacimiento</label>
                                <input type="date" value={form.birthDate} onChange={(e) => handleFieldChange('birthDate', e.target.value)} required />
                            </div>
                            <div className="users-field">
                                <label>CURP</label>
                                <input type="text" value={form.cveUnicaRegistroPob} onChange={(e) => handleFieldChange('cveUnicaRegistroPob', e.target.value)} maxLength={18} required />
                            </div>
                        </div>

                        <div className="users-form-row">
                            <div className="users-field">
                                <label>Contacto de emergencia</label>
                                <input type="text" value={form.emergencyContact} onChange={(e) => handleFieldChange('emergencyContact', e.target.value)} maxLength={200} />
                            </div>
                            <div className="users-field">
                                <label>Teléfono de emergencia</label>
                                <input type="text" value={form.emergencyPhone} onChange={(e) => handleFieldChange('emergencyPhone', e.target.value)} maxLength={10} />
                            </div>
                        </div>

                        <div className="users-form-actions">
                            <button type="submit" className="users-form-submit">
                                {editingUserProfileId ? 'Guardar cambios' : 'Registrar empleado'}
                            </button>
                            <button type="button" className="users-form-cancel" onClick={() => setShowForm(false)}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}

                <div className="users-filter-row">
                    <select className="status-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                    <input
                        type="text"
                        className="users-search-input"
                        placeholder="Buscar por nombre, correo o CURP..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="users-table-wrapper">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre completo</th>
                                <th>Correo</th>
                                <th>Rol</th>
                                <th>Teléfono</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleUsers.map((u) => (
                                <Fragment key={u.user_profile_id}>
                                    <tr>
                                        <td className="users-id">#{u.user_profile_id}</td>
                                        <td>{u.first_name} {u.first_surname} {u.second_surname}</td>
                                        <td>{u.email || '—'}</td>
                                        <td>{roleLabels[u.role_id] || '—'}</td>
                                        <td className="users-phone">{u.phone_number || '—'}</td>
                                        <td>
                                            <span className={`users-status ${u.is_active ? 'status-active' : 'status-inactive'}`}>
                                                {u.is_active ? 'Activo' : (u.user_credential_id ? 'Inactivo' : 'Sin cuenta')}
                                            </span>
                                        </td>
                                        <td className="users-actions">
                                            <button className="users-view-btn" onClick={() => toggleUserDetail(u.user_profile_id)}>Ver</button>
                                            <button className="users-edit-btn" onClick={() => openEditForm(u)}>Editar</button>
                                            <button className="users-cred-btn" onClick={() => openCredentialsForm(u)} disabled={!u.user_credential_id}>Credenciales</button>
                                            <button className="users-cred-btn" onClick={() => toggleCredentialHistory(u)} disabled={!u.user_credential_id}>Historial</button>
                                            <button
                                                className="users-toggle-btn"
                                                onClick={() => handleToggleActive(u)}
                                                disabled={!u.user_credential_id || parseInt(u.user_profile_id) === parseInt(user?.profileId)}
                                                title={parseInt(u.user_profile_id) === parseInt(user?.profileId) ? 'No puedes desactivar tu propia cuenta' : undefined}
                                            >
                                                {u.is_active ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedUserId === u.user_profile_id && userDetail && (
                                        <tr className="users-detail-row">
                                            <td colSpan={7}>
                                                <div className="users-detail-content">
                                                    <span><strong>CURP:</strong> {userDetail.curp || '—'}</span>
                                                    <span><strong>Fecha de nacimiento:</strong> {userDetail.birth_date ? new Date(userDetail.birth_date).toLocaleDateString('es-MX') : '—'}</span>
                                                    <span><strong>Contacto de emergencia:</strong> {userDetail.emergency_contact || '—'}</span>
                                                    <span><strong>Teléfono de emergencia:</strong> {userDetail.emergency_phone || '—'}</span>
                                                    <span><strong>Institución ID:</strong> {userDetail.institution_id || '—'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {historyUserId === u.user_profile_id && (
                                        <tr className="users-detail-row">
                                            <td colSpan={7}>
                                                <div className="users-detail-content">
                                                    <strong>Historial de la cuenta:</strong>
                                                    <span className="users-history-scope-note">Este historial registra únicamente activaciones y desactivaciones de la cuenta, no ediciones de perfil.</span>
                                                    {credentialHistory.length === 0 ? (
                                                        <span>Sin activaciones o desactivaciones registradas todavía.</span>
                                                    ) : (
                                                        credentialHistory.map((h) => (
                                                            <span key={h.user_credential_history_id}>
                                                                {h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}
                                                            </span>
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

                    {visibleUsers.length === 0 && (
                        <p className="users-empty">No hay usuarios que coincidan con el filtro.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Users;