import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toLowerCaseKeys } from '../utils/formatData';
import Navbar from '../components/layout/Navbar';
import { getNavLinks } from '../utils/Navlinks';
import '../pages/admin/Institutions.css';
import { parseResponse } from '../utils/apiRequest';
import './Profile.css';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = {
    firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const Profile = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)

    const [profile, setProfile] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saved, setSaved] = useState(false);

    const [changingPassword, setChangingPassword] = useState(false);
    const [credentialsForm, setCredentialsForm] = useState({ email: '', password: '' });
    const [credentialsSaved, setCredentialsSaved] = useState(false);

    const [myEmergencies, setMyEmergencies] = useState([]);

    const fetchProfile = () => {
        if (!user?.profileId) return
        fetch(`http://localhost:3000/usuarios/obtener-usuario-id/${user.profileId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ user: userData }) => {
                const detail = Array.isArray(userData) ? userData[0] : userData
                setProfile(detail ? toLowerCaseKeys(detail) : null)
            })
            .catch(error => console.error('Error consultando el perfil. ', error))
    }

    useEffect(() => { fetchProfile() }, [user?.profileId]);

    useEffect(() => {
        if (!user?.profileId || parseInt(user?.roleId) !== 5) return
        fetch(`http://localhost:3000/emergencias/emergencias-paciente/${user.profileId}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setMyEmergencies((data || []).map(em => toLowerCaseKeys(em))))
            .catch(error => console.error('Error consultando mis emergencias. ', error))
    }, [user?.profileId]);

    const openEdit = () => {
        setForm({
            firstName: profile.first_name || '',
            firstSurname: profile.first_surname || '',
            secondSurname: profile.second_surname || '',
            phone: profile.phone_number || '',
            birthDate: profile.birth_date ? profile.birth_date.split('T')[0] : '',
            cveUnicaRegistroPob: profile.curp || '',
            emergencyContact: profile.emergency_contact || '',
            emergencyPhone: profile.emergency_phone || '',
        })
        setSaved(false)
        setEditing(true)
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/usuarios/actualizar-perfil', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userProfileId: profile.user_profile_id,
                institutionId: profile.institution_id,
                roleId: profile.role_id,
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
            .then(() => { setEditing(false); setSaved(true); fetchProfile(); })
            .catch(error => { console.error('Error actualizando el perfil. ', error); alert(error.message) })
    }

    const openChangePassword = () => {
        setCredentialsForm({ email: profile.email || '', password: '' })
        setCredentialsSaved(false)
        setChangingPassword(true)
    }

    const handleChangePassword = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/usuarios/actualizar-credenciales', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userCredentialId: profile.user_credential_id,
                email: credentialsForm.email,
                password: credentialsForm.password,
            })
        })
            .then(parseResponse)
            .then(() => { setChangingPassword(false); setCredentialsSaved(true); fetchProfile(); })
            .catch(error => { console.error('Error actualizando las credenciales. ', error); alert(error.message) })
    }

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="institutions-body">
                <h2 className="institutions-title">Mi Perfil</h2>

                {profile === null ? (
                    <p className="institutions-empty">Cargando...</p>
                ) : (
                    <>
                        {saved && <p className="profile-saved-msg">Datos actualizados con éxito.</p>}
                        {credentialsSaved && <p className="profile-saved-msg">Contraseña actualizada con éxito.</p>}

                        {!editing && changingPassword && (
                            <form className="institutions-form" onSubmit={handleChangePassword}>
                                <h3>Cambiar Contraseña</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Correo electrónico</label>
                                        <input type="email" value={credentialsForm.email} onChange={(e) => setCredentialsForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Nueva contraseña</label>
                                        <input type="password" value={credentialsForm.password} onChange={(e) => setCredentialsForm(p => ({ ...p, password: e.target.value }))} minLength={8} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar contraseña</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setChangingPassword(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {!editing && !changingPassword ? (
                            <div className="profile-card">
                                <div className="profile-grid">
                                    <div className="detail-field">
                                        <span className="field-label">Nombre completo</span>
                                        <span className="field-value">{[profile.first_name, profile.first_surname, profile.second_surname].filter(Boolean).join(' ')}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Correo</span>
                                        <span className="field-value">{profile.email || '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Rol</span>
                                        <span className="field-value">{roleLabels[profile.role_id] || '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Teléfono</span>
                                        <span className="field-value">{profile.phone_number || '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Fecha de nacimiento</span>
                                        <span className="field-value">{profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('es-MX') : '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">CURP</span>
                                        <span className="field-value">{profile.curp || '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Contacto de emergencia</span>
                                        <span className="field-value">{profile.emergency_contact || '—'}</span>
                                    </div>
                                    <div className="detail-field">
                                        <span className="field-label">Teléfono de emergencia</span>
                                        <span className="field-value">{profile.emergency_phone || '—'}</span>
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button className="institutions-add-btn" onClick={openEdit}>Editar mi perfil</button>
                                    {profile.user_credential_id && (
                                        <button className="institutions-secondary-btn" onClick={openChangePassword}>Cambiar contraseña</button>
                                    )}
                                </div>
                            </div>
                        ) : editing && (
                            <form className="institutions-form" onSubmit={handleSubmit}>
                                <h3>Editar Mi Perfil</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre(s)</label>
                                        <input type="text" value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Apellido paterno</label>
                                        <input type="text" value={form.firstSurname} onChange={(e) => setForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Apellido materno</label>
                                        <input type="text" value={form.secondSurname} onChange={(e) => setForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Teléfono</label>
                                        <input type="text" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Fecha de nacimiento</label>
                                        <input type="date" value={form.birthDate} onChange={(e) => setForm(p => ({ ...p, birthDate: e.target.value }))} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>CURP</label>
                                        <input type="text" value={form.cveUnicaRegistroPob} onChange={(e) => setForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} maxLength={18} required />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Contacto de emergencia</label>
                                        <input type="text" value={form.emergencyContact} onChange={(e) => setForm(p => ({ ...p, emergencyContact: e.target.value }))} maxLength={200} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Teléfono de emergencia</label>
                                        <input type="text" value={form.emergencyPhone} onChange={(e) => setForm(p => ({ ...p, emergencyPhone: e.target.value }))} maxLength={10} />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditing(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {parseInt(user?.roleId) === 5 && (
                            <div className="profile-card" style={{ marginTop: 20 }}>
                                <h3 style={{ marginBottom: 12 }}>Mis Emergencias</h3>
                                {myEmergencies.length === 0 ? (
                                    <p className="institutions-empty">No tienes emergencias registradas todavía.</p>
                                ) : (
                                    <div className="catalog-table-wrapper">
                                        <table className="catalog-table">
                                            <thead><tr><th>Tipo</th><th>Descripción</th><th>Fecha</th><th>Estado</th></tr></thead>
                                            <tbody>
                                                {myEmergencies.map((em) => (
                                                    <tr key={em.emergency_id}>
                                                        <td>{em.type_name || '—'}</td>
                                                        <td>{em.description || '—'}</td>
                                                        <td>{em.created_at ? new Date(em.created_at).toLocaleString('es-MX') : '—'}</td>
                                                        <td>{em.status_name || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default Profile;
