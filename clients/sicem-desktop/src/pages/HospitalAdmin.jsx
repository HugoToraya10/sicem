import { useState, useEffect, useCallback, Fragment } from 'react'
import SpecialityAdminCard from '../components/hospitalAdmin/SpecialityAdminCard'
import AmbulanceAdminCard from '../components/hospitalAdmin/AmbulanceAdminCard'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import './HospitalAdmin.css'

const TABS = ['Camas y Especialidades', 'Ambulancias', 'Empleados', 'Mi Institución']

const emptyAmbulanceForm = { unitNumber: '', licensePlate: '', ambulanceTypeId: '', ambulanceStatusId: '' }
const emptyAssignSpecialityForm = { specialityId: '', totalBeds: '', availableBeds: '' }
const emptyEmployeeForm = {
    email: '', password: '', firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const HospitalAdmin = () => {
    const { user, token } = useAuth()
    const [activeTab, setActiveTab] = useState(TABS[0])
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

    // ── Camas y Especialidades ──────────────────────────────
    const [specialities, setSpecialities] = useState([])
    const [specialityCatalog, setSpecialityCatalog] = useState([])
    const [showAssignSpecialityForm, setShowAssignSpecialityForm] = useState(false)
    const [assignSpecialityForm, setAssignSpecialityForm] = useState(emptyAssignSpecialityForm)
    const [showGeneralBedsForm, setShowGeneralBedsForm] = useState(false)
    const [generalBedsForm, setGeneralBedsForm] = useState({ bedCapacity: '', availableBeds: '' })

    const fetchSpecialities = useCallback(() => {
        Promise.all([
            fetch('http://localhost:3000/hospitales/especialidades-instituciones', { headers }).then(res => res.json()),
            fetch('http://localhost:3000/hospitales/especialidades', { headers }).then(res => res.json()),
        ])
            .then(([institutionSpecialtiesRes, catalogRes]) => {
                const myRows = institutionSpecialtiesRes.data
                    .map(row => toLowerCaseKeys(row))
                    .filter(row => parseInt(row.institution_id) === parseInt(user.institutionId))

                const catalog = catalogRes.data.map(s => toLowerCaseKeys(s))
                setSpecialityCatalog(catalog)

                const merged = myRows.map(row => ({
                    ...row,
                    name: catalog.find(s => s.speciality_id === row.speciality_id)?.name || 'Especialidad'
                }))

                setSpecialities(merged)
            })
            .catch(error => console.error('Error recuperando especialidades de la institución. ', error))
    }, [user, token])

    useEffect(() => { fetchSpecialities() }, [fetchSpecialities])

    // Especialidades del catálogo que esta institución todavía NO tiene asignadas
    // (ni activas ni inactivas) — cruce en cliente, mismo patrón ya usado en el resto de esta pantalla.
    const unassignedSpecialities = specialityCatalog.filter(
        (s) => !specialities.some((assigned) => assigned.speciality_id === s.speciality_id)
    )

    const handleAssignSpeciality = (e) => {
        e.preventDefault()
        if (Number(assignSpecialityForm.availableBeds) > Number(assignSpecialityForm.totalBeds)) {
            alert('Las camas disponibles no pueden ser más que las camas totales.')
            return
        }
        // No se manda institutionId — el backend lo fuerza a la propia del usuario
        // logueado sin importar qué se mande.
        fetch('http://localhost:3000/hospitales/asignar-especialidad', {
            method: "POST", headers,
            body: JSON.stringify({
                specialityId: assignSpecialityForm.specialityId,
                totalBeds: assignSpecialityForm.totalBeds,
                availableBeds: assignSpecialityForm.availableBeds,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo asignar'); return body }))
            .then(() => { setAssignSpecialityForm(emptyAssignSpecialityForm); setShowAssignSpecialityForm(false); fetchSpecialities() })
            .catch(error => { console.error('Error asignando especialidad. ', error); alert(error.message) })
    }

    const handleUpdateCapacity = (institutionSpecialityId, totalBeds) => {
        return fetch('http://localhost:3000/hospitales/actualizar-capacidad-especialidad', {
            method: "PATCH", headers,
            body: JSON.stringify({ institutionSpecialityId, totalBeds })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo actualizar'); return res.json() })
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error actualizando capacidad. ', error); alert('No se pudo actualizar la capacidad total. Intenta de nuevo.') })
    }

    const handleToggleSpeciality = (speciality) => {
        const action = speciality.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} "${speciality.name}"?`)) return
        fetch('http://localhost:3000/hospitales/alternar-especialidad-institucion', {
            method: "PATCH", headers,
            body: JSON.stringify({ institutionSpecialityId: speciality.institution_speciality_id })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo cambiar el estado'); return res.json() })
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error cambiando estado de especialidad. ', error); alert('No se pudo cambiar el estado. Intenta de nuevo.') })
    }

    // ── Ambulancias ──────────────────────────────────────────
    const [ambulances, setAmbulances] = useState([])
    const [ambulanceTypes, setAmbulanceTypes] = useState([])
    const [ambulanceStatuses, setAmbulanceStatuses] = useState([])
    const [showAmbulanceForm, setShowAmbulanceForm] = useState(false)
    const [ambulanceForm, setAmbulanceForm] = useState(emptyAmbulanceForm)

    const fetchAmbulances = useCallback(() => {
        Promise.all([
            fetch(`http://localhost:3000/unidades/ambulancias-disponibles/${user.institutionId}`, { headers }).then(res => res.json()),
            fetch('http://localhost:3000/unidades/tipos-ambulancia', { headers }).then(res => res.json()),
            fetch('http://localhost:3000/unidades/estados-ambulancia', { headers }).then(res => res.json()),
        ])
            .then(([ambulancesRes, typesRes, statusesRes]) => {
                const typeCatalog = (typesRes.data || []).map(t => toLowerCaseKeys(t))
                const statusCatalog = (statusesRes.data || []).map(s => toLowerCaseKeys(s))
                setAmbulanceTypes(typeCatalog)
                setAmbulanceStatuses(statusCatalog)

                const merged = (ambulancesRes.data || []).map(a => toLowerCaseKeys(a)).map(a => ({
                    ...a,
                    type_name: typeCatalog.find(t => t.ambulance_type_id === a.ambulance_type_id)?.ambulance_type || 'Tipo desconocido'
                }))
                setAmbulances(merged)
            })
            .catch(error => console.error('Error recuperando ambulancias. ', error))
    }, [user, token])

    useEffect(() => { fetchAmbulances() }, [fetchAmbulances])

    const handleRegisterAmbulance = (e) => {
        e.preventDefault()
        // institutionId siempre es la propia del usuario logueado — nunca editable
        // desde este formulario, ni se manda otra.
        fetch('http://localhost:3000/unidades/registrar-ambulancia', {
            method: "POST", headers,
            body: JSON.stringify({
                unitNumber: ambulanceForm.unitNumber,
                licensePlate: ambulanceForm.licensePlate,
                ambulanceTypeId: ambulanceForm.ambulanceTypeId,
                ambulanceStatusId: ambulanceForm.ambulanceStatusId,
                institutionId: user.institutionId,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo registrar'); return body }))
            .then(() => { setAmbulanceForm(emptyAmbulanceForm); setShowAmbulanceForm(false); fetchAmbulances() })
            .catch(error => { console.error('Error registrando ambulancia. ', error); alert(error.message) })
    }

    const handleUpdateAmbulance = (ambulanceId, form) => {
        return fetch('http://localhost:3000/unidades/actualizar-ambulancia', {
            method: "PATCH", headers,
            body: JSON.stringify({
                ambulanceId,
                unitNumber: form.unitNumber,
                licensePlate: form.licensePlate,
                ambulanceTypeId: form.ambulanceTypeId,
                institutionId: user.institutionId,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => fetchAmbulances())
            .catch(error => { console.error('Error actualizando ambulancia. ', error); alert(error.message) })
    }

    const handleToggleAmbulance = (ambulance) => {
        const action = ambulance.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la unidad "${ambulance.unit_number}"?`)) return
        fetch('http://localhost:3000/unidades/alternar-ambulancia', {
            method: "PATCH", headers,
            body: JSON.stringify({ ambulanceId: ambulance.ambulance_id })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo cambiar el estado'); return res.json() })
            .then(() => fetchAmbulances())
            .catch(error => { console.error('Error cambiando estado de ambulancia. ', error); alert('No se pudo cambiar el estado. Intenta de nuevo.') })
    }

    // ── Empleados (personal rol 4 de mi institución) ────────
    const [institutionAdmins, setInstitutionAdmins] = useState([])
    const [showEmployeeForm, setShowEmployeeForm] = useState(false)
    const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
    const [editingEmployeeId, setEditingEmployeeId] = useState(null)
    const [editEmployeeForm, setEditEmployeeForm] = useState(emptyEmployeeForm)
    const [credentialsEmployeeId, setCredentialsEmployeeId] = useState(null)
    const [credentialsForm, setCredentialsForm] = useState({ email: '', password: '' })

    const fetchInstitutionAdmins = useCallback(() => {
        fetch('http://localhost:3000/usuarios/obtener-usuarios', { headers })
            .then(res => res.json())
            .then(({ data }) => {
                const mine = (data || [])
                    .map(u => toLowerCaseKeys(u))
                    .filter(u => parseInt(u.institution_id) === parseInt(user.institutionId) && parseInt(u.role_id) === 4)
                setInstitutionAdmins(mine)
            })
            .catch(error => console.error('Error recuperando usuarios de la institución. ', error))
    }, [user, token])

    useEffect(() => { if (activeTab === 'Empleados') fetchInstitutionAdmins() }, [activeTab, fetchInstitutionAdmins])

    const handleCreateEmployee = (e) => {
        e.preventDefault()
        // No se manda roleId ni institutionId — ni siquiera se muestran como
        // campos del formulario. El backend los fuerza a 4 y a la institución
        // propia respectivamente, sin importar qué se intente mandar.
        fetch('http://localhost:3000/usuarios/registro', {
            method: "POST", headers,
            body: JSON.stringify({
                email: employeeForm.email,
                password: employeeForm.password,
                firstName: employeeForm.firstName,
                firstSurname: employeeForm.firstSurname,
                secondSurname: employeeForm.secondSurname,
                phone: employeeForm.phone,
                birthDate: employeeForm.birthDate,
                cveUnicaRegistroPob: employeeForm.cveUnicaRegistroPob,
                emergencyContact: employeeForm.emergencyContact,
                emergencyPhone: employeeForm.emergencyPhone,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo registrar'); return body }))
            .then(() => { setEmployeeForm(emptyEmployeeForm); setShowEmployeeForm(false); fetchInstitutionAdmins() })
            .catch(error => { console.error('Error registrando empleado. ', error); alert(error.message) })
    }

    const handleToggleInstitutionAdmin = (u) => {
        const nextValue = !u.is_institution_admin
        const action = nextValue ? 'otorgar' : 'quitar'
        if (!window.confirm(`¿Seguro que quieres ${action} el privilegio de administrador a ${u.first_name} ${u.first_surname || ''}?`)) return
        fetch('http://localhost:3000/usuarios/alternar-admin-institucion', {
            method: "PATCH", headers,
            body: JSON.stringify({ userProfileId: u.user_profile_id, isInstitutionAdmin: nextValue })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => fetchInstitutionAdmins())
            .catch(error => { console.error('Error cambiando privilegio de administrador. ', error); alert(error.message) })
    }

    const handleToggleEmployeeActive = (u) => {
        const action = u.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} a ${u.first_name} ${u.first_surname || ''}?`)) return
        fetch('http://localhost:3000/usuarios/invertir-estado-usuario', {
            method: "PATCH", headers,
            body: JSON.stringify({ userCredentialId: u.user_credential_id })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo cambiar el estado'); return body }))
            .then(() => fetchInstitutionAdmins())
            .catch(error => { console.error('Error cambiando estado del empleado. ', error); alert(error.message) })
    }

    const openEditEmployee = (u) => {
        setEditingEmployeeId(u.user_profile_id)
        setEditEmployeeForm({
            email: '', password: '',
            firstName: u.first_name || '', firstSurname: u.first_surname || '', secondSurname: u.second_surname || '',
            phone: u.phone_number || '', birthDate: u.birth_date ? u.birth_date.split('T')[0] : '',
            cveUnicaRegistroPob: u.curp || '', emergencyContact: u.emergency_contact || '', emergencyPhone: u.emergency_phone || '',
        })
        setCredentialsEmployeeId(null)
    }

    const handleUpdateEmployeeProfile = (e) => {
        e.preventDefault()
        // No se manda roleId ni institutionId — el backend los preserva tal cual
        // están para este caso (admin editando a OTRO empleado propio).
        fetch('http://localhost:3000/usuarios/actualizar-perfil', {
            method: "PATCH", headers,
            body: JSON.stringify({
                userProfileId: editingEmployeeId,
                firstName: editEmployeeForm.firstName,
                firstSurname: editEmployeeForm.firstSurname,
                secondSurname: editEmployeeForm.secondSurname,
                phone: editEmployeeForm.phone,
                birthDate: editEmployeeForm.birthDate,
                cveUnicaRegistroPob: editEmployeeForm.cveUnicaRegistroPob,
                emergencyContact: editEmployeeForm.emergencyContact,
                emergencyPhone: editEmployeeForm.emergencyPhone,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => { setEditingEmployeeId(null); fetchInstitutionAdmins() })
            .catch(error => { console.error('Error actualizando empleado. ', error); alert(error.message) })
    }

    const openCredentialsEmployee = (u) => {
        setCredentialsEmployeeId(u.user_profile_id)
        setCredentialsForm({ email: u.email || '', password: '' })
        setEditingEmployeeId(null)
    }

    const handleUpdateEmployeeCredentials = (e, u) => {
        e.preventDefault()
        fetch('http://localhost:3000/usuarios/actualizar-credenciales', {
            method: "PATCH", headers,
            body: JSON.stringify({
                userCredentialId: u.user_credential_id,
                email: credentialsForm.email,
                password: credentialsForm.password,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => { setCredentialsEmployeeId(null); fetchInstitutionAdmins() })
            .catch(error => { console.error('Error actualizando credenciales. ', error); alert(error.message) })
    }

    // ── Mi Institución (solo dirección/CP/ciudad — nombre y tipo son de CRUM) ──
    const [institutionDetail, setInstitutionDetail] = useState(null)
    const [editAddressForm, setEditAddressForm] = useState({ streetAddress: '', zipCode: '', cityId: '' })
    const [states, setStates] = useState([])
    const [cities, setCities] = useState([])
    const [selectedStateId, setSelectedStateId] = useState('')

    const fetchInstitutionDetail = useCallback(() => {
        // Endpoint público con instituciones activas — se filtra en cliente por la
        // propia, mismo patrón de fetch-y-cruzar ya usado en el resto de la app.
        // Se usa tanto en "Mi Institución" (dirección) como en "Camas y
        // Especialidades" (camas generales), así que se pide siempre al montar.
        fetch('http://localhost:3000/hospitales/instituciones', { headers })
            .then(res => res.json())
            .then(({ data }) => {
                const mine = (data || []).map(i => toLowerCaseKeys(i)).find(i => parseInt(i.institution_id) === parseInt(user.institutionId))
                setInstitutionDetail(mine || null)
                if (mine) {
                    setEditAddressForm({ streetAddress: mine.street_address || '', zipCode: mine.zip_code || '', cityId: mine.city_id || '' })
                    setGeneralBedsForm({ bedCapacity: mine.bed_capacity ?? '', availableBeds: mine.available_beds ?? '' })

                    // El combo de Ciudad depende de que el de Estado tenga un valor
                    // (solo entonces se pide la lista de ciudades de ese estado) — sin
                    // esto, aunque cityId ya esté guardado, ambos combos se ven vacíos
                    // porque nunca se resuelve a qué estado pertenece esa ciudad.
                    if (mine.city_id) {
                        fetch(`http://localhost:3000/usuarios/ciudad/${mine.city_id}`, { headers: { "Content-Type": "application/json" } })
                            .then(res => res.json())
                            .then(({ data: cityRows }) => {
                                const cityRow = (cityRows || []).map(c => toLowerCaseKeys(c))[0]
                                if (cityRow) setSelectedStateId(cityRow.state_id)
                            })
                            .catch(error => console.error('Error resolviendo el estado de la ciudad guardada. ', error))
                    }
                }
            })
            .catch(error => console.error('Error recuperando datos de la institución. ', error))
    }, [user, token])

    useEffect(() => { fetchInstitutionDetail() }, [fetchInstitutionDetail])

    const handleUpdateGeneralBeds = (e) => {
        e.preventDefault()
        if (Number(generalBedsForm.availableBeds) > Number(generalBedsForm.bedCapacity)) {
            alert('Las camas disponibles no pueden ser más que la capacidad total.')
            return
        }
        Promise.all([
            fetch('http://localhost:3000/hospitales/actualizar-capacidad-institucion', {
                method: "PATCH", headers,
                body: JSON.stringify({ institutionId: user.institutionId, bedCapacity: generalBedsForm.bedCapacity })
            }),
            fetch('http://localhost:3000/hospitales/actualizar-camas-institucion', {
                method: "PATCH", headers,
                body: JSON.stringify({ institutionId: user.institutionId, availableBeds: generalBedsForm.availableBeds })
            }),
        ])
            .then(([res1, res2]) => { if (!res1.ok || !res2.ok) throw new Error('No se pudo actualizar'); })
            .then(() => { setShowGeneralBedsForm(false); fetchInstitutionDetail() })
            .catch(error => { console.error('Error actualizando camas generales. ', error); alert('No se pudo actualizar. Intenta de nuevo.') })
    }

    useEffect(() => {
        fetch('http://localhost:3000/usuarios/estados', { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setStates((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados. ', error))
    }, [])

    useEffect(() => {
        if (!selectedStateId) { setCities([]); return }
        fetch(`http://localhost:3000/usuarios/ciudades/${selectedStateId}`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setCities((data || []).map(c => toLowerCaseKeys(c))))
            .catch(error => console.error('Error consultando ciudades. ', error))
    }, [selectedStateId])

    const handleUpdateAddress = (e) => {
        e.preventDefault()
        // No se manda name ni institutionTypeId — el backend los preserva tal cual
        // están para rol 4, e institutionId se fuerza server-side a la propia.
        fetch('http://localhost:3000/hospitales/actualizar-institucion', {
            method: "PATCH", headers,
            body: JSON.stringify({
                streetAddress: editAddressForm.streetAddress,
                zipCode: editAddressForm.zipCode,
                cityId: editAddressForm.cityId,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => fetchInstitutionDetail())
            .catch(error => { console.error('Error actualizando dirección de la institución. ', error); alert(error.message) })
    }

    return (
        <div className="hospital-admin-layout">
            <h2 className="hospital-admin-title">Administración de mi Hospital</h2>

            <div className="hospital-admin-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        className={`hospital-admin-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'Camas y Especialidades' && (
                <>
                    <div className="hospital-admin-general-beds">
                        <div className="hospital-admin-general-beds-info">
                            <span className="hospital-admin-general-beds-label">Camas generales del hospital</span>
                            <span className="hospital-admin-general-beds-numbers">
                                <strong>{institutionDetail?.available_beds ?? '—'}</strong> / {institutionDetail?.bed_capacity ?? '—'} disponibles
                            </span>
                        </div>
                        {!showGeneralBedsForm && (
                            <button className="hospital-admin-edit-btn" onClick={() => setShowGeneralBedsForm(true)}>Editar camas generales</button>
                        )}
                    </div>

                    {showGeneralBedsForm && (
                        <form className="hospital-admin-form" onSubmit={handleUpdateGeneralBeds}>
                            <h3>Editar Camas Generales</h3>
                            <p className="hospital-admin-form-hint">Esta es la capacidad TOTAL del hospital (independiente de las camas por especialidad, que pueden traslaparse).</p>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Capacidad total</label>
                                    <input type="number" min="0" value={generalBedsForm.bedCapacity} onChange={(e) => setGeneralBedsForm(p => ({ ...p, bedCapacity: e.target.value }))} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Camas disponibles</label>
                                    <input type="number" min="0" value={generalBedsForm.availableBeds} onChange={(e) => setGeneralBedsForm(p => ({ ...p, availableBeds: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowGeneralBedsForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    <div className="hospital-admin-section-header">
                        <h3 className="hospital-admin-section-title">Especialidades</h3>
                        <button className="hospital-admin-add-btn" onClick={() => setShowAssignSpecialityForm(!showAssignSpecialityForm)}>
                            + Asignar Especialidad
                        </button>
                    </div>

                    {showAssignSpecialityForm && (
                        <form className="hospital-admin-form" onSubmit={handleAssignSpeciality}>
                            <h3>Asignar Especialidad Existente a mi Institución</h3>
                            <p className="hospital-admin-form-hint">Solo se listan especialidades del catálogo que tu institución todavía no tiene. Crear una especialidad nueva en el catálogo sigue siendo exclusivo de CRUM.</p>
                            <div className="hospital-admin-field">
                                <label>Especialidad</label>
                                <select value={assignSpecialityForm.specialityId} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, specialityId: e.target.value }))} required>
                                    <option value="">Selecciona una especialidad</option>
                                    {unassignedSpecialities.map((s) => (
                                        <option key={s.speciality_id} value={s.speciality_id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Camas totales</label>
                                    <input type="number" min="0" value={assignSpecialityForm.totalBeds} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, totalBeds: e.target.value }))} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Camas disponibles</label>
                                    <input type="number" min="0" value={assignSpecialityForm.availableBeds} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, availableBeds: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Asignar</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowAssignSpecialityForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    <div className="hospital-admin-grid">
                        {specialities.map((s) => (
                            <SpecialityAdminCard
                                key={s.institution_speciality_id}
                                speciality={s}
                                onUpdateCapacity={handleUpdateCapacity}
                                onToggleActive={handleToggleSpeciality}
                            />
                        ))}
                        {specialities.length === 0 && <p className="empty-state">Sin especialidades registradas para tu institución.</p>}
                    </div>
                </>
            )}

            {activeTab === 'Ambulancias' && (
                <>
                    <div className="hospital-admin-section-header">
                        <button className="hospital-admin-add-btn" onClick={() => setShowAmbulanceForm(!showAmbulanceForm)}>
                            + Registrar Ambulancia
                        </button>
                    </div>

                    {showAmbulanceForm && (
                        <form className="hospital-admin-form" onSubmit={handleRegisterAmbulance}>
                            <h3>Registrar Nueva Ambulancia</h3>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Número de unidad</label>
                                    <input type="text" value={ambulanceForm.unitNumber} onChange={(e) => setAmbulanceForm(p => ({ ...p, unitNumber: e.target.value }))} maxLength={8} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Placa</label>
                                    <input type="text" value={ambulanceForm.licensePlate} onChange={(e) => setAmbulanceForm(p => ({ ...p, licensePlate: e.target.value }))} maxLength={9} required />
                                </div>
                            </div>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Tipo</label>
                                    <select value={ambulanceForm.ambulanceTypeId} onChange={(e) => setAmbulanceForm(p => ({ ...p, ambulanceTypeId: e.target.value }))} required>
                                        <option value="">Selecciona un tipo</option>
                                        {ambulanceTypes.map((t) => (
                                            <option key={t.ambulance_type_id} value={t.ambulance_type_id}>{t.ambulance_type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Estado inicial</label>
                                    <select value={ambulanceForm.ambulanceStatusId} onChange={(e) => setAmbulanceForm(p => ({ ...p, ambulanceStatusId: e.target.value }))} required>
                                        <option value="">Selecciona un estado</option>
                                        {ambulanceStatuses.map((s) => (
                                            <option key={s.ambulance_status_id} value={s.ambulance_status_id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <p className="hospital-admin-form-hint">La institución siempre es la tuya — no es editable desde este formulario.</p>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Registrar</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowAmbulanceForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    <div className="hospital-admin-grid">
                        {ambulances.map((a) => (
                            <AmbulanceAdminCard
                                key={a.ambulance_id}
                                ambulance={a}
                                types={ambulanceTypes}
                                onUpdate={handleUpdateAmbulance}
                                onToggleActive={handleToggleAmbulance}
                            />
                        ))}
                        {ambulances.length === 0 && <p className="empty-state">Sin ambulancias registradas para tu institución.</p>}
                    </div>
                </>
            )}

            {activeTab === 'Empleados' && (
                <>
                    <div className="hospital-admin-section-header">
                        <button className="hospital-admin-add-btn" onClick={() => setShowEmployeeForm(!showEmployeeForm)}>
                            + Nuevo Empleado
                        </button>
                    </div>

                    {showEmployeeForm && (
                        <form className="hospital-admin-form" onSubmit={handleCreateEmployee}>
                            <h3>Registrar Nuevo Empleado</h3>
                            <p className="hospital-admin-form-hint">Se registra como personal de tu institución — el rol y la institución no son opciones, ya están fijos.</p>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Correo electrónico</label>
                                    <input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Contraseña</label>
                                    <input type="password" value={employeeForm.password} onChange={(e) => setEmployeeForm(p => ({ ...p, password: e.target.value }))} minLength={8} required />
                                </div>
                            </div>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Nombre(s)</label>
                                    <input type="text" value={employeeForm.firstName} onChange={(e) => setEmployeeForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Apellido paterno</label>
                                    <input type="text" value={employeeForm.firstSurname} onChange={(e) => setEmployeeForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Apellido materno</label>
                                    <input type="text" value={employeeForm.secondSurname} onChange={(e) => setEmployeeForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} />
                                </div>
                            </div>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Teléfono</label>
                                    <input type="text" value={employeeForm.phone} onChange={(e) => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Fecha de nacimiento</label>
                                    <input type="date" value={employeeForm.birthDate} onChange={(e) => setEmployeeForm(p => ({ ...p, birthDate: e.target.value }))} required />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>CURP</label>
                                    <input type="text" value={employeeForm.cveUnicaRegistroPob} onChange={(e) => setEmployeeForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} maxLength={18} required />
                                </div>
                            </div>
                            <div className="hospital-admin-form-row">
                                <div className="hospital-admin-field">
                                    <label>Contacto de emergencia</label>
                                    <input type="text" value={employeeForm.emergencyContact} onChange={(e) => setEmployeeForm(p => ({ ...p, emergencyContact: e.target.value }))} maxLength={200} />
                                </div>
                                <div className="hospital-admin-field">
                                    <label>Teléfono de emergencia</label>
                                    <input type="text" value={employeeForm.emergencyPhone} onChange={(e) => setEmployeeForm(p => ({ ...p, emergencyPhone: e.target.value }))} maxLength={10} />
                                </div>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Registrar empleado</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowEmployeeForm(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    <div className="hospital-admin-table-wrapper">
                        <table className="hospital-admin-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Correo</th>
                                    <th>Estado</th>
                                    <th>Admin de institución</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {institutionAdmins.map((u) => {
                                    const isSelf = parseInt(u.user_profile_id) === parseInt(user?.profileId)
                                    return (
                                        <Fragment key={u.user_profile_id}>
                                            <tr>
                                                <td>{u.first_name} {u.first_surname} {u.second_surname}</td>
                                                <td>{u.email || '—'}</td>
                                                <td>
                                                    <span className={`hospital-admin-status ${u.is_active ? 'status-active' : 'status-inactive'}`}>
                                                        {u.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`hospital-admin-status ${u.is_institution_admin ? 'status-active' : 'status-inactive'}`}>
                                                        {u.is_institution_admin ? 'Sí' : 'No'}
                                                    </span>
                                                </td>
                                                <td className="hospital-admin-row-actions">
                                                    <button className="hospital-admin-toggle-btn" onClick={() => openEditEmployee(u)}>Editar</button>
                                                    <button className="hospital-admin-toggle-btn" onClick={() => openCredentialsEmployee(u)} disabled={!u.user_credential_id}>Credenciales</button>
                                                    <button
                                                        className="hospital-admin-toggle-btn"
                                                        onClick={() => handleToggleEmployeeActive(u)}
                                                        disabled={isSelf || !u.user_credential_id}
                                                        title={isSelf ? 'No puedes desactivar tu propia cuenta' : undefined}
                                                    >
                                                        {u.is_active ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                    <button
                                                        className="hospital-admin-toggle-btn"
                                                        onClick={() => handleToggleInstitutionAdmin(u)}
                                                        disabled={isSelf && u.is_institution_admin}
                                                        title={isSelf && u.is_institution_admin ? 'No puedes quitarte tu propio privilegio de administrador' : undefined}
                                                    >
                                                        {u.is_institution_admin ? 'Quitar privilegio' : 'Dar privilegio'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {editingEmployeeId === u.user_profile_id && (
                                                <tr className="hospital-admin-detail-row">
                                                    <td colSpan={5}>
                                                        <form className="hospital-admin-inline-form" onSubmit={handleUpdateEmployeeProfile}>
                                                            <div className="hospital-admin-form-row">
                                                                <div className="hospital-admin-field">
                                                                    <label>Nombre(s)</label>
                                                                    <input type="text" value={editEmployeeForm.firstName} onChange={(e) => setEditEmployeeForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>Apellido paterno</label>
                                                                    <input type="text" value={editEmployeeForm.firstSurname} onChange={(e) => setEditEmployeeForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>Apellido materno</label>
                                                                    <input type="text" value={editEmployeeForm.secondSurname} onChange={(e) => setEditEmployeeForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} />
                                                                </div>
                                                            </div>
                                                            <div className="hospital-admin-form-row">
                                                                <div className="hospital-admin-field">
                                                                    <label>Teléfono</label>
                                                                    <input type="text" value={editEmployeeForm.phone} onChange={(e) => setEditEmployeeForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} required />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>Fecha de nacimiento</label>
                                                                    <input type="date" value={editEmployeeForm.birthDate} onChange={(e) => setEditEmployeeForm(p => ({ ...p, birthDate: e.target.value }))} required />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>CURP</label>
                                                                    <input type="text" value={editEmployeeForm.cveUnicaRegistroPob} onChange={(e) => setEditEmployeeForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} maxLength={18} required />
                                                                </div>
                                                            </div>
                                                            <div className="hospital-admin-form-row">
                                                                <div className="hospital-admin-field">
                                                                    <label>Contacto de emergencia</label>
                                                                    <input type="text" value={editEmployeeForm.emergencyContact} onChange={(e) => setEditEmployeeForm(p => ({ ...p, emergencyContact: e.target.value }))} maxLength={200} />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>Teléfono de emergencia</label>
                                                                    <input type="text" value={editEmployeeForm.emergencyPhone} onChange={(e) => setEditEmployeeForm(p => ({ ...p, emergencyPhone: e.target.value }))} maxLength={10} />
                                                                </div>
                                                            </div>
                                                            <div className="hospital-admin-form-actions">
                                                                <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                                                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setEditingEmployeeId(null)}>Cancelar</button>
                                                            </div>
                                                        </form>
                                                    </td>
                                                </tr>
                                            )}
                                            {credentialsEmployeeId === u.user_profile_id && (
                                                <tr className="hospital-admin-detail-row">
                                                    <td colSpan={5}>
                                                        <form className="hospital-admin-inline-form" onSubmit={(e) => handleUpdateEmployeeCredentials(e, u)}>
                                                            <div className="hospital-admin-form-row">
                                                                <div className="hospital-admin-field">
                                                                    <label>Correo electrónico</label>
                                                                    <input type="email" value={credentialsForm.email} onChange={(e) => setCredentialsForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required />
                                                                </div>
                                                                <div className="hospital-admin-field">
                                                                    <label>Nueva contraseña</label>
                                                                    <input type="password" value={credentialsForm.password} onChange={(e) => setCredentialsForm(p => ({ ...p, password: e.target.value }))} minLength={8} required />
                                                                </div>
                                                            </div>
                                                            <div className="hospital-admin-form-actions">
                                                                <button type="submit" className="hospital-admin-form-submit">Guardar credenciales</button>
                                                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setCredentialsEmployeeId(null)}>Cancelar</button>
                                                            </div>
                                                        </form>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                        {institutionAdmins.length === 0 && <p className="empty-state">Sin usuarios de tu institución registrados.</p>}
                    </div>
                </>
            )}

            {activeTab === 'Mi Institución' && (
                <form className="hospital-admin-form" onSubmit={handleUpdateAddress}>
                    <h3>Editar Dirección de {institutionDetail?.name || 'mi institución'}</h3>
                    <p className="hospital-admin-form-hint">El nombre y el tipo de institución son responsabilidad exclusiva de CRUM — solo puedes editar dirección, código postal y ciudad.</p>
                    <div className="hospital-admin-field">
                        <label>Dirección</label>
                        <input type="text" value={editAddressForm.streetAddress} onChange={(e) => setEditAddressForm(p => ({ ...p, streetAddress: e.target.value }))} maxLength={150} required />
                    </div>
                    <div className="hospital-admin-form-row">
                        <div className="hospital-admin-field">
                            <label>Código postal</label>
                            <input type="text" value={editAddressForm.zipCode} onChange={(e) => setEditAddressForm(p => ({ ...p, zipCode: e.target.value }))} maxLength={5} required />
                        </div>
                        <div className="hospital-admin-field">
                            <label>Estado</label>
                            <select value={selectedStateId} onChange={(e) => { setSelectedStateId(e.target.value); setEditAddressForm(p => ({ ...p, cityId: '' })) }} required>
                                <option value="">Selecciona un estado</option>
                                {states.map((s) => (
                                    <option key={s.state_id} value={s.state_id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="hospital-admin-field">
                            <label>Ciudad</label>
                            <select value={editAddressForm.cityId} onChange={(e) => setEditAddressForm(p => ({ ...p, cityId: e.target.value }))} disabled={!selectedStateId} required>
                                <option value="">{selectedStateId ? 'Selecciona una ciudad' : 'Elige un estado primero'}</option>
                                {cities.map((c) => (
                                    <option key={c.city_id} value={c.city_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="hospital-admin-form-actions">
                        <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                    </div>
                </form>
            )}
        </div>
    )
}

export default HospitalAdmin
