import { useEffect, useState } from 'react';
import { roleLabel } from '../../config/roles'
import MoreMenu from '../../components/ui/MoreMenu'
import '../../styles/entities.css'
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { parseResponse } from '../../utils/apiRequest';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import './Institutions.css'
import './Users.css';
import {API_BASE_URL} from '../../config/api'
import { useDialogs } from '../../context/useDialogs'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import SkeletonCards from '../../components/ui/SkeletonCards'
import { Drawer } from '../../components/ui/Overlay'


const WEEKDAYS = [
    { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' },
]

// Un rango de hora POR día — no un solo rango compartido por todos los días
// seleccionados. Así se puede modelar, por ejemplo, "lunes en la mañana,
// resto de la semana en la tarde/noche". En el form vive como 7 entradas
// fijas (una por día de la semana); al enviar, solo se mandan las que
// quedaron "enabled".
const emptyShiftWindows = () => WEEKDAYS.map((d) => ({ day: d.value, enabled: false, start: '', end: '' }))

const emptyForm = {
    email: '', password: '', roleId: '', institutionId: '',
    firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
    assignedAmbulanceId: '', shiftWindows: emptyShiftWindows(),
}

const emptyPatientForm = {
    hasCredentials: false, email: '', password: '',
    institutionId: '', firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const emptyCredentialsForm = { userCredentialId: '', email: '', password: '' }

const Users = () => {
    const { notify, confirm } = useDialogs()
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)

    const [users, setUsers] = useState([]);
    const [usersError, setUsersError] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [roles, setRoles] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [crumAmbulances, setCrumAmbulances] = useState([]);
    // Ambulancias completas (no solo CRUM) — para resolver el unit_number de
    // la ambulancia asignada a un paramédico en su fila de detalle de horario.
    const [ambulances, setAmbulances] = useState([]);

    const [showForm, setShowForm] = useState(false);
    const [editingUserProfileId, setEditingUserProfileId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [showPatientForm, setShowPatientForm] = useState(false);
    const [patientForm, setPatientForm] = useState(emptyPatientForm);

    const [showCredentialsForm, setShowCredentialsForm] = useState(false);
    const [credentialsForm, setCredentialsForm] = useState(emptyCredentialsForm);

    const [expandedUserId, setExpandedUserId] = useState(null);
    const [userDetail, setUserDetail] = useState(null);

    // Detalle de horario/turno de un paramédico (rol 3) — ambulancia asignada
    // + sus ventanas de turno. Se abre con su botón "Horario".
    const [paramedicScheduleUserId, setParamedicScheduleUserId] = useState(null);

    const [statusFilter, setStatusFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [historyUserId, setHistoryUserId] = useState(null);
    const [credentialHistory, setCredentialHistory] = useState([]);

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    const filterByRole = (list, roleId) => {
        if (!roleId || roleId === 'all') return list
        return list.filter(item => parseInt(item.role_id) === parseInt(roleId))
    }

    const matchesSearch = (u, query) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        const name = [u.first_name, u.first_surname, u.second_surname].filter(Boolean).join(' ').toLowerCase()
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.curp || '').toLowerCase().includes(q)
    }

    const visibleUsers = filterByRole(filterByStatus(users, statusFilter), roleFilter).filter(u => matchesSearch(u, searchQuery))

    const weekdayLabel = (day) => WEEKDAYS.find((d) => d.value === parseInt(day))?.label || day
    const formatSchedule = (shiftWindows) => {
        if (!shiftWindows || shiftWindows.length === 0) return 'Sin horario asignado'
        return shiftWindows.map((w) => `${weekdayLabel(w.day)} ${w.start}-${w.end}`).join(' · ')
    }
    const ambulanceUnitById = (id) => ambulances.find((a) => String(a.ambulance_id) === String(id))?.unit_number

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchUsers = () => {
        fetch(`${API_BASE_URL}/usuarios/obtener-usuarios`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ data }) => { setUsersError(false); setUsers(data.map(u => toLowerCaseKeys(u))); setLoaded(true) })
            .catch(error => { console.error('Error consultando usuarios. ', error); setUsersError(true) })
    }

    const fetchCredentialHistory = (userCredentialId) => {
        fetch(`${API_BASE_URL}/usuarios/historial-cuenta/${userCredentialId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setCredentialHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de cuenta. ', error); notify(error.message, 'error') })
    }

    const toggleCredentialHistory = (u) => {
        if (historyUserId === u.user_profile_id) { setHistoryUserId(null); setCredentialHistory([]); return }
        setHistoryUserId(u.user_profile_id)
        fetchCredentialHistory(u.user_credential_id)
    }

    const toggleParamedicSchedule = (u) => {
        setParamedicScheduleUserId((current) => current === u.user_profile_id ? null : u.user_profile_id)
    }

    useEffect(() => { fetchUsers() }, []);

    // Ambulancias completas para resolver el número de unidad en el detalle de
    // horario de los paramédicos (Ambulances.jsx usa el mismo endpoint admin).
    useEffect(() => {
        fetch(`${API_BASE_URL}/unidades/ambulancias-todas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setAmbulances((data || []).map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando ambulancias. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/obtener-roles`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ roles }) => setRoles(roles.map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando roles. ', error))
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ institutions }) => setInstitutions(institutions.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }, []);

    // Para el selector de "ambulancia asignada" cuando el rol elegido es
    // Paramédico — sicem-web solo puede ligarlos a ambulancias de
    // instituciones CRUM (el backend también lo valida, esto es solo para
    // no mostrar opciones que de todos modos se van a rechazar).
    useEffect(() => {
        fetch(`${API_BASE_URL}/unidades/ambulancias-crum`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setCrumAmbulances((data || []).map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando ambulancias CRUM. ', error))
    }, []);

    const toggleUserDetail = (userProfileId) => {
        if (expandedUserId === userProfileId) {
            setExpandedUserId(null)
            setUserDetail(null)
            return
        }
        setExpandedUserId(userProfileId)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-id/${userProfileId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ user: userData }) => {
                // getUserById responde con un array (result), tomamos el primer elemento
                const detail = Array.isArray(userData) ? userData[0] : userData
                setUserDetail(detail ? toLowerCaseKeys(detail) : null)
            })
            .catch(error => { console.error('Error consultando detalle de usuario. ', error); notify(error.message, 'error') })
    }

    //---------------------------------registrar / actualizar empleado--------------------------------------------------

    const handleFieldChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const toggleShiftWindowDay = (day) => {
        setForm((prev) => ({
            ...prev,
            shiftWindows: prev.shiftWindows.map((w) => w.day === day ? { ...w, enabled: !w.enabled } : w),
        }))
    }

    const updateShiftWindowTime = (day, field, value) => {
        setForm((prev) => ({
            ...prev,
            shiftWindows: prev.shiftWindows.map((w) => w.day === day ? { ...w, [field]: value } : w),
        }))
    }

    const openCreateForm = () => {
        setForm({ ...emptyForm, shiftWindows: emptyShiftWindows() })
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
            assignedAmbulanceId: u.assigned_ambulance_id || '',
            shiftWindows: emptyShiftWindows().map((w) => {
                const existing = (u.shift_windows || []).find((sw) => parseInt(sw.day) === w.day)
                return existing ? { day: w.day, enabled: true, start: existing.start, end: existing.end } : w
            }),
        })
        setEditingUserProfileId(u.user_profile_id)
        setShowForm(true)
        setShowPatientForm(false)
        setShowCredentialsForm(false)
    }

    const buildShiftWindowsPayload = () => form.shiftWindows
        .filter((w) => w.enabled && w.start && w.end)
        .map((w) => ({ day: w.day, start: w.start, end: w.end }))

    const handleSubmit = (e) => {
        e.preventDefault();

        if (editingUserProfileId) {
            fetch(`${API_BASE_URL}/usuarios/actualizar-perfil`, {
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
                    assignedAmbulanceId: parseInt(form.roleId) === 3 ? form.assignedAmbulanceId : undefined,
                    shiftWindows: parseInt(form.roleId) === 3 ? buildShiftWindowsPayload() : undefined,
                })
            })
                .then(parseResponse)
                .then(() => { setShowForm(false); fetchUsers(); })
                .catch(error => { console.error('Error actualizando usuario. ', error); notify(error.message, 'error') })
        } else {
            if (blockIfDuplicate(users, 'email', form.email, 'correo')) return
            if (blockIfDuplicate(users, 'curp', form.cveUnicaRegistroPob, 'CURP')) return
            fetch(`${API_BASE_URL}/usuarios/registro`, {
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
                    assignedAmbulanceId: parseInt(form.roleId) === 3 ? form.assignedAmbulanceId : undefined,
                    shiftWindows: parseInt(form.roleId) === 3 ? buildShiftWindowsPayload() : undefined,
                })
            })
                .then(parseResponse)
                .then(() => { setShowForm(false); fetchUsers(); })
                .catch(error => { console.error('Error registrando usuario. ', error); notify(error.message, 'error') })
        }
    }

    const handleToggleActive = async (u) => {
        if (!u.user_credential_id) return
        const action = u.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} a ${u.first_name} ${u.first_surname || ''}?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/usuarios/invertir-estado-usuario`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ userCredentialId: u.user_credential_id })
        })
            .then(parseResponse)
            .then(() => fetchUsers())
            .catch(error => { console.error('Error cambiando estado del usuario. ', error); notify(error.message, 'error') })
    }

    const handleToggleInstitutionAdmin = async (u) => {
        const nextValue = !u.is_institution_admin
        const action = nextValue ? 'otorgar' : 'quitar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el privilegio de administrador de institución a ${u.first_name} ${u.first_surname || ''}?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/usuarios/alternar-admin-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ userProfileId: u.user_profile_id, isInstitutionAdmin: nextValue })
        })
            .then(parseResponse)
            .then(() => fetchUsers())
            .catch(error => { console.error('Error cambiando privilegio de administrador de institución. ', error); notify(error.message, 'error') })
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

        fetch(`${API_BASE_URL}/usuarios/registro-paciente`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(body)
        })
            .then(parseResponse)
            .then(() => { setShowPatientForm(false); fetchUsers(); })
            .catch(error => { console.error('Error registrando paciente. ', error); notify(error.message, 'error') })
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
        fetch(`${API_BASE_URL}/usuarios/actualizar-credenciales`, {
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
            .catch(error => { console.error('Error actualizando credenciales. ', error); notify(error.message, 'error') })
    }

    return (
        <div className="users-page">
            <Navbar
                userName={user?.firstName || 'Usuario'}
                roleLabel={roleLabel(user?.roleId)}
                links={navLinks}
            />

            <div role="main" id="contenido" className="users-body">
                <div className="users-header">
                    <h1 className="users-title">Gestión de usuarios</h1>
                    <div className="users-header-actions">
                        <button className="users-secondary-btn" onClick={openPatientForm}>
                            + Registrar paciente
                        </button>
                        <button className="users-add-btn" onClick={openCreateForm}>
                            + Nuevo empleado
                        </button>
                    </div>
                </div>

                <Drawer open={Boolean(showCredentialsForm)} onClose={() => setShowCredentialsForm(false)} title="Editar Credenciales de Acceso" size="md">
                    <form className="users-form" onSubmit={handleUpdateCredentials}>
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
                    </Drawer>

                <Drawer open={Boolean(showPatientForm)} onClose={() => setShowPatientForm(false)} title="Registrar nuevo paciente" size="md">
                    <form className="users-form" onSubmit={handleRegisterPatient}>

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
                            <select aria-label="Institución de referencia" value={patientForm.institutionId} onChange={(e) => handlePatientFieldChange('institutionId', e.target.value)} required>
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
                    </Drawer>

                <Drawer open={Boolean(showForm)} onClose={() => setShowForm(false)} title={editingUserProfileId ? 'Editar empleado' : 'Registrar nuevo empleado'} size="md">
                    <form className="users-form" onSubmit={handleSubmit}>

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
                                <select aria-label="Rol" value={form.roleId} onChange={(e) => handleFieldChange('roleId', e.target.value)} required>
                                    <option value="">Selecciona un rol</option>
                                    {roles.filter(r => r.role_id !== 5).map((r) => (
                                        <option key={r.role_id} value={r.role_id}>{r.role_type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="users-field">
                                <label>Institución</label>
                                <select aria-label="Institución" value={form.institutionId} onChange={(e) => handleFieldChange('institutionId', e.target.value)} required>
                                    <option value="">Selecciona una institución</option>
                                    {institutions.map((inst) => (
                                        <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {parseInt(form.roleId) === 3 && (
                            <>
                                <div className="users-form-row">
                                    <div className="users-field">
                                        <label>Ambulancia asignada</label>
                                        <select aria-label="Ambulancia asignada" value={form.assignedAmbulanceId} onChange={(e) => handleFieldChange('assignedAmbulanceId', e.target.value)} required>
                                            <option value="">Selecciona una ambulancia (institución CRUM)</option>
                                            {[
                                                ...crumAmbulances,
                                                ...(form.assignedAmbulanceId && !crumAmbulances.some(a => String(a.ambulance_id) === String(form.assignedAmbulanceId))
                                                    ? [ambulances.find(a => String(a.ambulance_id) === String(form.assignedAmbulanceId))].filter(Boolean)
                                                    : []),
                                            ].map((amb) => (
                                                <option key={amb.ambulance_id} value={amb.ambulance_id}>{amb.unit_number}</option>
                                            ))}
                                        </select>
                                        <p className="users-form-hint">Lista las unidades CRUM. Si el paramédico ya tiene una ambulancia asignada (aunque no sea CRUM), también aparece aquí y queda preseleccionada para no tener que cambiarla.</p>
                                    </div>
                                </div>

                                <div className="users-field">
                                    <label>Horario / turno</label>
                                    <p className="users-form-hint">Activa los días que trabaja y ponle su propio rango de hora a cada uno — pueden ser distintos entre sí (ej. lunes en la mañana, resto de la semana en la tarde). Bloquea el acceso: solo podrá iniciar turno en sicem-mobile dentro de estas ventanas.</p>
                                    <div className="users-shift-windows">
                                        {form.shiftWindows.map((w) => {
                                            const dayLabel = WEEKDAYS.find((d) => d.value === w.day)?.label
                                            return (
                                                <div key={w.day} className={`users-shift-window-row ${w.enabled ? 'active' : ''}`}>
                                                    <label className="users-shift-window-daytoggle">
                                                        <input type="checkbox" checked={w.enabled} onChange={() => toggleShiftWindowDay(w.day)} />
                                                        {dayLabel}
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={w.start}
                                                        onChange={(e) => updateShiftWindowTime(w.day, 'start', e.target.value)}
                                                        disabled={!w.enabled}
                                                        required={w.enabled}
                                                    />
                                                    <span>a</span>
                                                    <input
                                                        type="time"
                                                        value={w.end}
                                                        onChange={(e) => updateShiftWindowTime(w.day, 'end', e.target.value)}
                                                        disabled={!w.enabled}
                                                        required={w.enabled}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

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
                    </Drawer>

                <div className="users-filter-row">
                    <select aria-label="Filtrar por rol" className="status-filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="all">Todos los roles</option>
                        <option value="1">Administrador</option>
                        <option value="2">Despachador</option>
                        <option value="3">Paramédico</option>
                        <option value="4">Hospital</option>
                        <option value="5">Paciente</option>
                    </select>
                    <select aria-label="Filtrar por estado" className="status-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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

                <ul className="stat-strip" aria-label="Resumen de usuarios">
                    <li><b><AnimatedNumber value={users.length} /></b><span>usuarios</span></li>
                    <li><b><AnimatedNumber value={users.filter((x) => x.is_active).length} /></b><span>activos</span></li>
                    <li className={users.some((x) => !x.user_credential_id) ? 'warn' : ''}><b><AnimatedNumber value={users.filter((x) => !x.user_credential_id).length} /></b><span>sin cuenta</span></li>
                    <li><b><AnimatedNumber value={visibleUsers.length} /></b><span>con este filtro</span></li>
                </ul>

                {!loaded && !usersError && <SkeletonCards />}
                <div className="entity-grid" hidden={!loaded}>
                    {visibleUsers.map((u) => {
                        const roleId = parseInt(u.role_id)
                        const accent = { 1: 'acc-admin', 2: 'acc-dispatch', 3: 'acc-medic', 4: 'acc-hospital', 5: 'acc-patient' }[roleId] || 'acc-patient'
                        const fullName = [u.first_name, u.first_surname, u.second_surname].filter(Boolean).join(' ') || 'Sin nombre'
                        const initials = [u.first_name, u.first_surname].filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '?'
                        const isSelf = parseInt(u.user_profile_id) === parseInt(user?.profileId)
                        const statusText = u.is_active ? 'Activo' : (u.user_credential_id ? 'Inactivo' : 'Sin cuenta')
                        const statusTone = u.is_active ? 'pill-ok' : (u.user_credential_id ? 'pill-warn' : 'pill-bad')
                        return (
                            <article key={u.user_profile_id} className={`entity ${accent}${u.is_active ? '' : ' is-off'}`} aria-label={fullName}>
                                <div className="entity-head">
                                    <span className="entity-avatar" aria-hidden="true">{initials}</span>
                                    <div className="entity-titles">
                                        <h2 className="entity-title">{fullName}</h2>
                                        <p className="entity-sub">{u.email || 'Sin correo (no tiene cuenta)'}</p>
                                    </div>
                                    <span className="entity-id">#{u.user_profile_id}</span>
                                </div>
                                <div className="entity-chips">
                                    <span className="pill pill-steel">{roleLabel(u.role_id) || 'Sin rol'}</span>
                                    <span className={`pill ${statusTone}`}>{statusText}</span>
                                    {roleId === 4 && u.is_institution_admin ? <span className="pill pill-hosp">Admin de institución</span> : null}
                                    {isSelf ? <span className="pill">Tú</span> : null}
                                </div>
                                <dl className="entity-facts">
                                    <div><dt>Teléfono</dt><dd>{u.phone_number || '—'}</dd></div>
                                    {roleId === 3 && <div><dt>Ambulancia</dt><dd>{u.assigned_ambulance_id ? (ambulanceUnitById(u.assigned_ambulance_id) || `#${u.assigned_ambulance_id}`) : 'Sin asignar'}</dd></div>}
                                </dl>

                                {expandedUserId === u.user_profile_id && userDetail && (
                                    <div className="entity-panel">
                                        <span><strong>CURP:</strong> {userDetail.curp || '—'}</span>
                                        <span><strong>Fecha de nacimiento:</strong> {userDetail.birth_date ? new Date(userDetail.birth_date).toLocaleDateString('es-MX') : '—'}</span>
                                        <span><strong>Contacto de emergencia:</strong> {userDetail.emergency_contact || '—'}</span>
                                        <span><strong>Teléfono de emergencia:</strong> {userDetail.emergency_phone || '—'}</span>
                                        <span><strong>Institución:</strong> {userDetail.institution_id || '—'}</span>
                                        {roleId === 4 && (
                                            <span>
                                                <button type="button" className="users-toggle-btn" onClick={() => handleToggleInstitutionAdmin(u)}>
                                                    {u.is_institution_admin ? 'Quitar privilegio de administrador' : 'Dar privilegio de administrador'}
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                )}
                                {paramedicScheduleUserId === u.user_profile_id && (
                                    <div className="entity-panel">
                                        <span><strong>Ambulancia asignada:</strong> {u.assigned_ambulance_id ? (ambulanceUnitById(u.assigned_ambulance_id) || `#${u.assigned_ambulance_id}`) : 'Sin ambulancia asignada'}</span>
                                        <span><strong>Horario / turnos:</strong> {formatSchedule(u.shift_windows)}</span>
                                    </div>
                                )}
                                {historyUserId === u.user_profile_id && (
                                    <div className="entity-panel">
                                        <strong>Historial de la cuenta</strong>
                                        <span className="users-history-scope-note">Solo registra activaciones y desactivaciones, no ediciones de perfil.</span>
                                        {credentialHistory.length === 0 ? (
                                            <span>Sin activaciones o desactivaciones registradas todavía.</span>
                                        ) : (
                                            credentialHistory.map((h) => (
                                                <span key={h.user_credential_history_id}>{h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                            ))
                                        )}
                                    </div>
                                )}

                                <div className="entity-actions">
                                    <button type="button" className="users-view-btn" onClick={() => toggleUserDetail(u.user_profile_id)}>
                                        {expandedUserId === u.user_profile_id ? 'Ocultar datos' : 'Ver datos'}
                                    </button>
                                    <button type="button" className="users-edit-btn" onClick={() => openEditForm(u)}>Editar</button>
                                    <span className="spacer" />
                                    <MoreMenu
                                        items={[
                                            { label: 'Credenciales', onClick: () => openCredentialsForm(u), disabled: !u.user_credential_id },
                                            { label: 'Historial de la cuenta', onClick: () => toggleCredentialHistory(u), disabled: !u.user_credential_id },
                                            roleId === 3 && { label: 'Horario y ambulancia', onClick: () => toggleParamedicSchedule(u) },
                                            {
                                                label: u.is_active ? 'Desactivar cuenta' : 'Activar cuenta',
                                                onClick: () => handleToggleActive(u),
                                                disabled: !u.user_credential_id || isSelf,
                                                danger: Boolean(u.is_active),
                                                title: isSelf ? 'No puedes desactivar tu propia cuenta' : undefined,
                                            },
                                        ]}
                                    />
                                </div>
                            </article>
                        )
                    })}

                    {visibleUsers.length === 0 && (
                        usersError ? (
                            <p className="entity-empty" role="alert">
                                No pudimos cargar los usuarios. Revisa que el servicio de usuarios esté en línea.{' '}
                                <button type="button" className="users-secondary-btn" onClick={fetchUsers}>Reintentar</button>
                            </p>
                        ) : (
                            <p className="entity-empty">No hay usuarios que coincidan con el filtro. Prueba con otro rol o quita la búsqueda.</p>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}

export default Users;