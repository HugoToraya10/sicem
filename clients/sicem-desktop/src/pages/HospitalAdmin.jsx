import { useState, useEffect, useCallback } from 'react'
import SpecialityAdminCard from '../components/hospitalAdmin/SpecialityAdminCard'
import AmbulanceAdminCard from '../components/hospitalAdmin/AmbulanceAdminCard'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { toLowerCaseKeys } from '../utils/formatData'
import { connectUnitsSocket } from '../sockets/unitsSocket'
import { useDialogs } from '../context/useDialogs'
import './HospitalAdmin.css'
import MoreMenu from '../components/ui/MoreMenu'
import { compactSchedule } from '../utils/time'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { Drawer } from '../components/ui/Overlay'

const TABS = ['Camas y Especialidades', 'Ambulancias', 'Empleados', 'Mi Institución']

const emptyAmbulanceForm = { unitNumber: '', licensePlate: '', ambulanceTypeId: '', ambulanceStatusId: '' }
const emptyAssignSpecialityForm = { specialityId: '', totalBeds: '', availableBeds: '' }
const WEEKDAYS = [
    { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 7, label: 'Dom' },
]

// Un rango de hora POR día — no un solo rango compartido por todos los días
// seleccionados. Permite modelar, por ejemplo, "lunes en la mañana, resto de
// la semana en la tarde/noche". Vive en el form como 7 entradas fijas; al
// enviar, solo se mandan las que quedaron "enabled".
const emptyShiftWindows = () => WEEKDAYS.map((d) => ({ day: d.value, enabled: false, start: '', end: '' }))

const emptyEmployeeForm = {
    roleId: '4', assignedAmbulanceId: '', shiftWindows: emptyShiftWindows(),
    email: '', password: '', firstName: '', firstSurname: '', secondSurname: '', phone: '',
    birthDate: '', cveUnicaRegistroPob: '', emergencyContact: '', emergencyPhone: '',
}

const HospitalAdmin = () => {
    const { user, token } = useAuth()
    const { notify, confirm } = useDialogs()
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
            fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/hospitales/especialidades`, { headers }).then(res => res.json()),
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
            notify('Las camas disponibles no pueden ser más que las camas totales.', 'error')
            return
        }
        // No se manda institutionId — el backend lo fuerza a la propia del usuario
        // logueado sin importar qué se mande.
        fetch(`${API_BASE_URL}/hospitales/asignar-especialidad`, {
            method: "POST", headers,
            body: JSON.stringify({
                specialityId: assignSpecialityForm.specialityId,
                totalBeds: assignSpecialityForm.totalBeds,
                availableBeds: assignSpecialityForm.availableBeds,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo asignar'); return body }))
            .then(() => { setAssignSpecialityForm(emptyAssignSpecialityForm); setShowAssignSpecialityForm(false); fetchSpecialities() })
            .catch(error => { console.error('Error asignando especialidad. ', error); notify(error.message, 'error') })
    }

    const handleUpdateCapacity = (institutionSpecialityId, totalBeds) => {
        return fetch(`${API_BASE_URL}/hospitales/actualizar-capacidad-especialidad`, {
            method: "PATCH", headers,
            body: JSON.stringify({ institutionSpecialityId, totalBeds })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo actualizar'); return res.json() })
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error actualizando capacidad. ', error); notify('No se pudo actualizar la capacidad total. Intenta de nuevo.', 'error') })
    }

    const handleToggleSpeciality = async (speciality) => {
        const action = speciality.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} "${speciality.name}"?`, confirmLabel: 'Sí, continuar' }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-especialidad-institucion`, {
            method: "PATCH", headers,
            body: JSON.stringify({ institutionSpecialityId: speciality.institution_speciality_id })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo cambiar el estado'); return res.json() })
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error cambiando estado de especialidad. ', error); notify('No se pudo cambiar el estado. Intenta de nuevo.', 'error') })
    }

    // ── Ambulancias ──────────────────────────────────────────
    const [ambulances, setAmbulances] = useState([])
    const [ambulanceTypes, setAmbulanceTypes] = useState([])
    const [ambulanceStatuses, setAmbulanceStatuses] = useState([])
    const [showAmbulanceForm, setShowAmbulanceForm] = useState(false)
    const [ambulanceForm, setAmbulanceForm] = useState(emptyAmbulanceForm)
    // Tripulación (paramédicos vinculados con su horario) + presencia en línea
    // por socket — para el desglose de "Ver detalle" en la pestaña Ambulancias.
    const [crew, setCrew] = useState([])
    const [onlineParamedicIds, setOnlineParamedicIds] = useState(new Set())
    const [expandedAmbulanceId, setExpandedAmbulanceId] = useState(null)

    const toggleAmbulanceDetail = (ambulanceId) => {
        setExpandedAmbulanceId((current) => current === ambulanceId ? null : ambulanceId)
    }

    // Resuelve la ambulancia asignada a un paramédico para mostrar el número de
    // unidad Y la placa (no el ID interno, que no le dice nada a nadie).
    const assignedAmbulance = (ambulanceId) => ambulances.find((a) => String(a.ambulance_id) === String(ambulanceId))

    const fetchAmbulances = useCallback(() => {
        Promise.all([
            fetch(`${API_BASE_URL}/unidades/mis-ambulancias`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/unidades/tipos-ambulancia`, { headers }).then(res => res.json()),
            fetch(`${API_BASE_URL}/unidades/estados-ambulancia`, { headers }).then(res => res.json()),
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

    // Tripulación: paramédicos vinculados a cada ambulancia con su horario
    // (endpoint de usuarios, permitido para rol 4 — hospital).
    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/tripulacion-ambulancias`, { headers })
            .then(res => res.json())
            .then(({ data }) => setCrew((data || []).map(p => toLowerCaseKeys(p))))
            .catch(error => console.error('Error consultando tripulación de ambulancias. ', error))
    }, [token])

    // Presencia en tiempo real: solo los paramédicos con el celular conectado
    // al socket de unidades cuentan como en línea (mismo mecanismo que sicem-web).
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
    }, [token])

    const handleRegisterAmbulance = (e) => {
        e.preventDefault()
        // institutionId siempre es la propia del usuario logueado — nunca editable
        // desde este formulario, ni se manda otra.
        fetch(`${API_BASE_URL}/unidades/registrar-ambulancia`, {
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
            .catch(error => { console.error('Error registrando ambulancia. ', error); notify(error.message, 'error') })
    }

    const handleUpdateAmbulance = (ambulanceId, form) => {
        return fetch(`${API_BASE_URL}/unidades/actualizar-ambulancia`, {
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
            .catch(error => { console.error('Error actualizando ambulancia. ', error); notify(error.message, 'error') })
    }

    const handleToggleAmbulance = async (ambulance) => {
        const action = ambulance.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} la unidad "${ambulance.unit_number}"?`, confirmLabel: 'Sí, continuar' }))) return
        fetch(`${API_BASE_URL}/unidades/alternar-ambulancia`, {
            method: "PATCH", headers,
            body: JSON.stringify({ ambulanceId: ambulance.ambulance_id })
        })
            .then(res => { if (!res.ok) throw new Error('No se pudo cambiar el estado'); return res.json() })
            .then(() => fetchAmbulances())
            .catch(error => { console.error('Error cambiando estado de ambulancia. ', error); notify('No se pudo cambiar el estado. Intenta de nuevo.', 'error') })
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
        fetch(`${API_BASE_URL}/usuarios/obtener-usuarios`, { headers })
            .then(res => res.json())
            .then(({ data }) => {
                // Antes solo listaba rol 4 (empleados administrativos) — ahora
                // también rol 3 (paramédicos), para poder verlos y editarlos
                // (reasignar ambulancia, cambiar de rol, poner horario) desde
                // esta misma tabla.
                const mine = (data || [])
                    .map(u => toLowerCaseKeys(u))
                    .filter(u => parseInt(u.institution_id) === parseInt(user.institutionId) && [3, 4].includes(parseInt(u.role_id)))
                setInstitutionAdmins(mine)
            })
            .catch(error => console.error('Error recuperando usuarios de la institución. ', error))
    }, [user, token])

    useEffect(() => { if (activeTab === 'Empleados') fetchInstitutionAdmins() }, [activeTab, fetchInstitutionAdmins])

    const toggleShiftWindowDay = (setter, day) => {
        setter((prev) => ({
            ...prev,
            shiftWindows: prev.shiftWindows.map((w) => w.day === day ? { ...w, enabled: !w.enabled } : w),
        }))
    }

    const updateShiftWindowTime = (setter, day, field, value) => {
        setter((prev) => ({
            ...prev,
            shiftWindows: prev.shiftWindows.map((w) => w.day === day ? { ...w, [field]: value } : w),
        }))
    }

    const buildShiftWindowsPayload = (form) => form.shiftWindows
        .filter((w) => w.enabled && w.start && w.end)
        .map((w) => ({ day: w.day, start: w.start, end: w.end }))

    const handleCreateEmployee = (e) => {
        e.preventDefault()
        if (parseInt(employeeForm.roleId) === 3 && !employeeForm.assignedAmbulanceId) {
            notify('Selecciona a qué ambulancia queda asignado este paramédico.', 'error')
            return
        }
        // No se manda institutionId — eso el backend lo fuerza a la propia
        // institución sin importar qué se intente mandar. roleId sí se manda
        // (3 = paramédico, 4 = empleado administrativo); el backend valida que
        // solo se puedan crear esos dos desde aquí, nunca otro.
        fetch(`${API_BASE_URL}/usuarios/registro`, {
            method: "POST", headers,
            body: JSON.stringify({
                roleId: employeeForm.roleId,
                assignedAmbulanceId: parseInt(employeeForm.roleId) === 3 ? employeeForm.assignedAmbulanceId : undefined,
                shiftWindows: parseInt(employeeForm.roleId) === 3 ? buildShiftWindowsPayload(employeeForm) : undefined,
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
            .then(() => {
                setEmployeeForm({ ...emptyEmployeeForm, shiftWindows: emptyShiftWindows() }); setShowEmployeeForm(false)
                // La tabla de Empleados de abajo solo lista rol 4 (empleados
                // administrativos) — un paramédico recién creado no va a
                // aparecer ahí, vive en la asignación de la ambulancia, no en
                // esta lista. fetchInstitutionAdmins() solo refresca por si se
                // registró un rol 4.
                fetchInstitutionAdmins()
            })
            .catch(error => { console.error('Error registrando empleado. ', error); notify(error.message, 'error') })
    }

    const handleToggleInstitutionAdmin = async (u) => {
        const nextValue = !u.is_institution_admin
        const action = nextValue ? 'otorgar' : 'quitar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el privilegio de administrador a ${u.first_name} ${u.first_surname || ''}?`, confirmLabel: 'Sí, continuar' }))) return
        fetch(`${API_BASE_URL}/usuarios/alternar-admin-institucion`, {
            method: "PATCH", headers,
            body: JSON.stringify({ userProfileId: u.user_profile_id, isInstitutionAdmin: nextValue })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => fetchInstitutionAdmins())
            .catch(error => { console.error('Error cambiando privilegio de administrador. ', error); notify(error.message, 'error') })
    }

    const handleToggleEmployeeActive = async (u) => {
        const action = u.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} a ${u.first_name} ${u.first_surname || ''}?`, confirmLabel: 'Sí, continuar' }))) return
        fetch(`${API_BASE_URL}/usuarios/invertir-estado-usuario`, {
            method: "PATCH", headers,
            body: JSON.stringify({ userCredentialId: u.user_credential_id })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo cambiar el estado'); return body }))
            .then(() => fetchInstitutionAdmins())
            .catch(error => { console.error('Error cambiando estado del empleado. ', error); notify(error.message, 'error') })
    }

    const openEditEmployee = (u) => {
        setEditingEmployeeId(u.user_profile_id)
        setEditEmployeeForm({
            email: '', password: '',
            roleId: String(u.role_id), assignedAmbulanceId: u.assigned_ambulance_id || '',
            shiftWindows: emptyShiftWindows().map((w) => {
                const existing = (u.shift_windows || []).find((sw) => parseInt(sw.day) === w.day)
                return existing ? { day: w.day, enabled: true, start: existing.start, end: existing.end } : w
            }),
            firstName: u.first_name || '', firstSurname: u.first_surname || '', secondSurname: u.second_surname || '',
            phone: u.phone_number || '', birthDate: u.birth_date ? u.birth_date.split('T')[0] : '',
            cveUnicaRegistroPob: u.curp || '', emergencyContact: u.emergency_contact || '', emergencyPhone: u.emergency_phone || '',
        })
        setCredentialsEmployeeId(null)
    }

    const handleUpdateEmployeeProfile = (e) => {
        e.preventDefault()
        // La ambulancia NO es obligatoria al editar: se puede desasignar
        // (dejar al paramédico sin unidad — estado válido, se asigna después).
        // No se manda institutionId — el backend lo preserva tal cual para este
        // caso (admin editando a OTRO empleado propio). roleId SÍ se manda ahora
        // — permite pasar de empleado administrativo a paramédico o viceversa.
        fetch(`${API_BASE_URL}/usuarios/actualizar-perfil`, {
            method: "PATCH", headers,
            body: JSON.stringify({
                userProfileId: editingEmployeeId,
                roleId: editEmployeeForm.roleId,
                assignedAmbulanceId: parseInt(editEmployeeForm.roleId) === 3 ? editEmployeeForm.assignedAmbulanceId : undefined,
                shiftWindows: parseInt(editEmployeeForm.roleId) === 3 ? buildShiftWindowsPayload(editEmployeeForm) : undefined,
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
            .catch(error => { console.error('Error actualizando empleado. ', error); notify(error.message, 'error') })
    }

    const openCredentialsEmployee = (u) => {
        setCredentialsEmployeeId(u.user_profile_id)
        setCredentialsForm({ email: u.email || '', password: '' })
        setEditingEmployeeId(null)
    }

    const handleUpdateEmployeeCredentials = (e, u) => {
        e.preventDefault()
        fetch(`${API_BASE_URL}/usuarios/actualizar-credenciales`, {
            method: "PATCH", headers,
            body: JSON.stringify({
                userCredentialId: u.user_credential_id,
                email: credentialsForm.email,
                password: credentialsForm.password,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => { setCredentialsEmployeeId(null); fetchInstitutionAdmins() })
            .catch(error => { console.error('Error actualizando credenciales. ', error); notify(error.message, 'error') })
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
        fetch(`${API_BASE_URL}/hospitales/instituciones`, { headers })
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
                        fetch(`${API_BASE_URL}/usuarios/ciudad/${mine.city_id}`, { headers: { "Content-Type": "application/json" } })
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
            notify('Las camas disponibles no pueden ser más que la capacidad total.', 'error')
            return
        }
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/actualizar-capacidad-institucion`, {
                method: "PATCH", headers,
                body: JSON.stringify({ institutionId: user.institutionId, bedCapacity: generalBedsForm.bedCapacity })
            }),
            fetch(`${API_BASE_URL}/hospitales/actualizar-camas-institucion`, {
                method: "PATCH", headers,
                body: JSON.stringify({ institutionId: user.institutionId, availableBeds: generalBedsForm.availableBeds })
            }),
        ])
            .then(([res1, res2]) => { if (!res1.ok || !res2.ok) throw new Error('No se pudo actualizar'); })
            .then(() => { setShowGeneralBedsForm(false); fetchInstitutionDetail() })
            .catch(error => { console.error('Error actualizando camas generales. ', error); notify('No se pudo actualizar. Intenta de nuevo.', 'error') })
    }

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/estados`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setStates((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados. ', error))
    }, [])

    useEffect(() => {
        if (!selectedStateId) { setCities([]); return }
        fetch(`${API_BASE_URL}/usuarios/ciudades/${selectedStateId}`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setCities((data || []).map(c => toLowerCaseKeys(c))))
            .catch(error => console.error('Error consultando ciudades. ', error))
    }, [selectedStateId])

    const handleUpdateAddress = (e) => {
        e.preventDefault()
        // No se manda name ni institutionTypeId — el backend los preserva tal cual
        // están para rol 4, e institutionId se fuerza server-side a la propia.
        fetch(`${API_BASE_URL}/hospitales/actualizar-institucion`, {
            method: "PATCH", headers,
            body: JSON.stringify({
                streetAddress: editAddressForm.streetAddress,
                zipCode: editAddressForm.zipCode,
                cityId: editAddressForm.cityId,
            })
        })
            .then(res => res.json().then(body => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar'); return body }))
            .then(() => fetchInstitutionDetail())
            .catch(error => { console.error('Error actualizando dirección de la institución. ', error); notify(error.message, 'error') })
    }

    return (
        <div className="page hospital-admin-layout">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Administración</h1>
                    <p className="page-sub">Camas, ambulancias, personal y datos de tu institución. Solo los administradores del hospital ven esta sección.</p>
                </div>
            </div>

            <div className="hospital-admin-tabs" role="tablist" aria-label="Secciones de administración">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
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

                    <Drawer open={Boolean(showGeneralBedsForm)} onClose={() => setShowGeneralBedsForm(false)} title="Camas generales" subtitle="Capacidad total del hospital." size="md">
                        <form className="hospital-admin-form" onSubmit={handleUpdateGeneralBeds}>
                            <h2>Editar Camas Generales</h2>
                            <p className="hospital-admin-form-hint">Esta es la capacidad TOTAL del hospital (independiente de las camas por especialidad, que pueden traslaparse).</p>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Capacidad total</span><input type="number" min="0" value={generalBedsForm.bedCapacity} onChange={(e) => setGeneralBedsForm(p => ({ ...p, bedCapacity: e.target.value }))} required /></label>
                                <label className="hospital-admin-field"><span>Camas disponibles</span><input type="number" min="0" value={generalBedsForm.availableBeds} onChange={(e) => setGeneralBedsForm(p => ({ ...p, availableBeds: e.target.value }))} required /></label>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowGeneralBedsForm(false)}>Cancelar</button>
                            </div>
                        </form>
                        </Drawer>

                    <div className="hospital-admin-section-header">
                        <h2 className="hospital-admin-section-title">Especialidades</h2>
                        <button className="hospital-admin-add-btn" onClick={() => setShowAssignSpecialityForm(!showAssignSpecialityForm)}>
                            + Asignar Especialidad
                        </button>
                    </div>

                    <Drawer open={Boolean(showAssignSpecialityForm)} onClose={() => setShowAssignSpecialityForm(false)} title="Asignar especialidad" subtitle="Solo las que tu institución todavía no tiene." size="md">
                        <form className="hospital-admin-form" onSubmit={handleAssignSpeciality}>
                            <h2>Asignar Especialidad Existente a mi Institución</h2>
                            <p className="hospital-admin-form-hint">Solo se listan especialidades del catálogo que tu institución todavía no tiene. Crear una especialidad nueva en el catálogo sigue siendo exclusivo de CRUM.</p>
                            <label className="hospital-admin-field"><span>Especialidad</span><select value={assignSpecialityForm.specialityId} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, specialityId: e.target.value }))} required>
                                    <option value="">Selecciona una especialidad</option>
                                    {unassignedSpecialities.map((s) => (
                                        <option key={s.speciality_id} value={s.speciality_id}>{s.name}</option>
                                    ))}
                                </select></label>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Camas totales</span><input type="number" min="0" value={assignSpecialityForm.totalBeds} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, totalBeds: e.target.value }))} required /></label>
                                <label className="hospital-admin-field"><span>Camas disponibles</span><input type="number" min="0" value={assignSpecialityForm.availableBeds} onChange={(e) => setAssignSpecialityForm(p => ({ ...p, availableBeds: e.target.value }))} required /></label>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Asignar</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowAssignSpecialityForm(false)}>Cancelar</button>
                            </div>
                        </form>
                        </Drawer>

                    <div className="hospital-admin-grid">
                        {specialities.map((s) => (
                            <SpecialityAdminCard
                                key={s.institution_speciality_id}
                                speciality={s}
                                onUpdateCapacity={handleUpdateCapacity}
                                onToggleActive={handleToggleSpeciality}
                            />
                        ))}
                        {specialities.length === 0 && <p className="empty">Sin especialidades registradas para tu institución.</p>}
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

                    <Drawer open={Boolean(showAmbulanceForm)} onClose={() => setShowAmbulanceForm(false)} title="Registrar ambulancia" subtitle="Quedará en tu institución." size="md">
                        <form className="hospital-admin-form" onSubmit={handleRegisterAmbulance}>
                            <h2>Registrar Nueva Ambulancia</h2>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Número de unidad</span><input type="text" value={ambulanceForm.unitNumber} onChange={(e) => setAmbulanceForm(p => ({ ...p, unitNumber: e.target.value }))} maxLength={8} required /></label>
                                <label className="hospital-admin-field"><span>Placa</span><input type="text" value={ambulanceForm.licensePlate} onChange={(e) => setAmbulanceForm(p => ({ ...p, licensePlate: e.target.value }))} maxLength={9} required /></label>
                            </div>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Tipo</span><select value={ambulanceForm.ambulanceTypeId} onChange={(e) => setAmbulanceForm(p => ({ ...p, ambulanceTypeId: e.target.value }))} required>
                                        <option value="">Selecciona un tipo</option>
                                        {ambulanceTypes.map((t) => (
                                            <option key={t.ambulance_type_id} value={t.ambulance_type_id}>{t.ambulance_type}</option>
                                        ))}
                                    </select></label>
                                <label className="hospital-admin-field"><span>Estado inicial</span><select value={ambulanceForm.ambulanceStatusId} onChange={(e) => setAmbulanceForm(p => ({ ...p, ambulanceStatusId: e.target.value }))} required>
                                        <option value="">Selecciona un estado</option>
                                        {ambulanceStatuses.map((s) => (
                                            <option key={s.ambulance_status_id} value={s.ambulance_status_id}>{s.name}</option>
                                        ))}
                                    </select></label>
                            </div>
                            <p className="hospital-admin-form-hint">La institución siempre es la tuya — no es editable desde este formulario.</p>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Registrar</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowAmbulanceForm(false)}>Cancelar</button>
                            </div>
                        </form>
                        </Drawer>

                    <div className="hospital-admin-grid">
                        {ambulances.map((a) => (
                            <AmbulanceAdminCard
                                key={a.ambulance_id}
                                ambulance={a}
                                types={ambulanceTypes}
                                onUpdate={handleUpdateAmbulance}
                                onToggleActive={handleToggleAmbulance}
                                crew={crew}
                                onlineParamedicIds={onlineParamedicIds}
                                detailOpen={expandedAmbulanceId === a.ambulance_id}
                                onToggleDetail={() => toggleAmbulanceDetail(a.ambulance_id)}
                            />
                        ))}
                        {ambulances.length === 0 && <p className="empty">Sin ambulancias registradas para tu institución.</p>}
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

                    <Drawer open={Boolean(showEmployeeForm)} onClose={() => setShowEmployeeForm(false)} title="Nuevo empleado" subtitle="Se registra como personal de tu institución." size="md">
                        <form className="hospital-admin-form" onSubmit={handleCreateEmployee}>
                            <h2>Registrar Nuevo Empleado</h2>
                            <p className="hospital-admin-form-hint">Se registra como personal de tu institución — la institución no es opción, ya está fija.</p>

                            <label className="hospital-admin-field"><span>Tipo de personal</span><select value={employeeForm.roleId} onChange={(e) => setEmployeeForm(p => ({ ...p, roleId: e.target.value, assignedAmbulanceId: '' }))}>
                                    <option value="4">Empleado administrativo</option>
                                    <option value="3">Paramédico</option>
                                </select></label>

                            {parseInt(employeeForm.roleId) === 3 && (
                                <div className="hospital-admin-field">
                                    <label>Ambulancia asignada</label>
                                    <select value={employeeForm.assignedAmbulanceId} onChange={(e) => setEmployeeForm(p => ({ ...p, assignedAmbulanceId: e.target.value }))} required>
                                        <option value="">Selecciona una ambulancia de tu institución</option>
                                        {ambulances.map((amb) => (
                                            <option key={amb.ambulance_id} value={amb.ambulance_id}>{amb.unit_number}</option>
                                        ))}
                                    </select>
                                    <p className="hospital-admin-form-hint">Este paramédico queda ligado permanentemente a esta unidad — varios paramédicos pueden compartir la misma ambulancia (turnos distintos).</p>
                                    {ambulances.length === 0 && <p className="hospital-admin-form-hint">Tu institución no tiene ambulancias registradas todavía — registra una primero en la pestaña Ambulancias.</p>}
                                </div>
                            )}

                            {parseInt(employeeForm.roleId) === 3 && (
                                <div className="hospital-admin-field">
                                    <label>Horario / turno</label>
                                    <p className="hospital-admin-form-hint">Activa los días que trabaja y ponle su propio rango de hora a cada uno — pueden ser distintos entre sí (ej. lunes en la mañana, resto de la semana en la tarde). Bloquea el acceso: solo podrá iniciar turno en sicem-mobile dentro de estas ventanas.</p>
                                    <div className="hospital-admin-shift-windows">
                                        {employeeForm.shiftWindows.map((w) => {
                                            const dayLabel = WEEKDAYS.find((d) => d.value === w.day)?.label
                                            return (
                                                <div key={w.day} className={`hospital-admin-shift-window-row ${w.enabled ? 'active' : ''}`}>
                                                    <label className="hospital-admin-shift-window-daytoggle">
                                                        <input type="checkbox" checked={w.enabled} onChange={() => toggleShiftWindowDay(setEmployeeForm, w.day)} />
                                                        {dayLabel}
                                                    </label>
                                                    <input type="time" value={w.start} onChange={(e) => updateShiftWindowTime(setEmployeeForm, w.day, 'start', e.target.value)} disabled={!w.enabled} required={w.enabled} />
                                                    <span>a</span>
                                                    <input type="time" value={w.end} onChange={(e) => updateShiftWindowTime(setEmployeeForm, w.day, 'end', e.target.value)} disabled={!w.enabled} required={w.enabled} />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Correo electrónico</span><input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required /></label>
                                <label className="hospital-admin-field"><span>Contraseña</span><input type="password" value={employeeForm.password} onChange={(e) => setEmployeeForm(p => ({ ...p, password: e.target.value }))} minLength={8} required /></label>
                            </div>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Nombre(s)</span><input type="text" value={employeeForm.firstName} onChange={(e) => setEmployeeForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required /></label>
                                <label className="hospital-admin-field"><span>Apellido paterno</span><input type="text" value={employeeForm.firstSurname} onChange={(e) => setEmployeeForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required /></label>
                                <label className="hospital-admin-field"><span>Apellido materno</span><input type="text" value={employeeForm.secondSurname} onChange={(e) => setEmployeeForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} /></label>
                            </div>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Teléfono</span><input type="text" value={employeeForm.phone} onChange={(e) => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} required /></label>
                                <label className="hospital-admin-field"><span>Fecha de nacimiento</span><input type="date" value={employeeForm.birthDate} onChange={(e) => setEmployeeForm(p => ({ ...p, birthDate: e.target.value }))} required /></label>
                                <label className="hospital-admin-field"><span>CURP</span><input type="text" value={employeeForm.cveUnicaRegistroPob} onChange={(e) => setEmployeeForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} maxLength={18} required /></label>
                            </div>
                            <div className="hospital-admin-form-row">
                                <label className="hospital-admin-field"><span>Contacto de emergencia</span><input type="text" value={employeeForm.emergencyContact} onChange={(e) => setEmployeeForm(p => ({ ...p, emergencyContact: e.target.value }))} maxLength={200} /></label>
                                <label className="hospital-admin-field"><span>Teléfono de emergencia</span><input type="text" value={employeeForm.emergencyPhone} onChange={(e) => setEmployeeForm(p => ({ ...p, emergencyPhone: e.target.value }))} maxLength={10} /></label>
                            </div>
                            <div className="hospital-admin-form-actions">
                                <button type="submit" className="hospital-admin-form-submit">Registrar empleado</button>
                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setShowEmployeeForm(false)}>Cancelar</button>
                            </div>
                        </form>
                        </Drawer>

                    <ul className="stat-strip" aria-label="Resumen del personal">
                        <li><b><AnimatedNumber value={institutionAdmins.length} /></b><span>personas</span></li>
                        <li><b><AnimatedNumber value={institutionAdmins.filter((x) => parseInt(x.role_id) === 3).length} /></b><span>paramédicos</span></li>
                        <li><b><AnimatedNumber value={institutionAdmins.filter((x) => parseInt(x.role_id) !== 3).length} /></b><span>administrativos</span></li>
                        <li className={institutionAdmins.some((x) => !x.is_active) ? 'warn' : ''}><b><AnimatedNumber value={institutionAdmins.filter((x) => !x.is_active).length} /></b><span>inactivos</span></li>
                    </ul>

                    <div className="entity-grid">
                        {institutionAdmins.map((u) => {
                            const isSelf = parseInt(u.user_profile_id) === parseInt(user?.profileId)
                            const isParamedic = parseInt(u.role_id) === 3
                            const amb = isParamedic ? assignedAmbulance(u.assigned_ambulance_id) : null
                            const fullName = [u.first_name, u.first_surname, u.second_surname].filter(Boolean).join(' ') || 'Sin nombre'
                            const initials = [u.first_name, u.first_surname].filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '?'
                            const editing = editingEmployeeId === u.user_profile_id
                            const editingCreds = credentialsEmployeeId === u.user_profile_id
                            return (
                                <article key={u.user_profile_id} className={`entity ${isParamedic ? 'acc-medic' : 'acc-hospital'}${u.is_active ? '' : ' is-off'}${editing || editingCreds ? ' is-wide' : ''}`} aria-label={fullName}>
                                    <div className="entity-head">
                                        <span className="entity-avatar" aria-hidden="true">{initials}</span>
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{fullName}</h2>
                                            <p className="entity-sub">{u.email || 'Sin correo'}</p>
                                        </div>
                                        <span className={`pill ${u.is_active ? 'pill-ok' : 'pill-warn'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <div className="entity-chips">
                                        <span className="pill pill-steel">{isParamedic ? 'Paramédico' : 'Administrativo'}</span>
                                        {!isParamedic && u.is_institution_admin ? <span className="pill pill-hosp">Administrador</span> : null}
                                        {isSelf ? <span className="pill">Tú</span> : null}
                                    </div>
                                    {isParamedic && (
                                        <dl className="entity-facts">
                                            <div><dt>Ambulancia</dt><dd>{amb ? `${amb.unit_number} · ${amb.license_plate}` : 'Sin asignar'}</dd></div>
                                            <div><dt>Horario</dt><dd>{compactSchedule(u.shift_windows)}</dd></div>
                                        </dl>
                                    )}

                                    <Drawer open={Boolean(editing)} onClose={() => setEditingEmployeeId(null)} title="Editar empleado" subtitle={`${u.first_name} ${u.first_surname}`} size="md">
<form className="hospital-admin-form" onSubmit={handleUpdateEmployeeProfile}>
                                                            <div className="hospital-admin-form-row">
                                                                <label className="hospital-admin-field"><span>Tipo de personal</span><select value={editEmployeeForm.roleId} onChange={(e) => setEditEmployeeForm(p => ({ ...p, roleId: e.target.value, assignedAmbulanceId: '' }))}>
                                                                        <option value="4">Empleado administrativo</option>
                                                                        <option value="3">Paramédico</option>
                                                                    </select></label>
                                                                {parseInt(editEmployeeForm.roleId) === 3 && (
                                                                    <label className="hospital-admin-field"><span>Ambulancia asignada</span><select value={editEmployeeForm.assignedAmbulanceId} onChange={(e) => setEditEmployeeForm(p => ({ ...p, assignedAmbulanceId: e.target.value }))}>
                                            <option value="">Sin ambulancia</option>
                                            {ambulances.map((amb) => (
                                                <option key={amb.ambulance_id} value={amb.ambulance_id}>{amb.unit_number}</option>
                                            ))}
                                        </select></label>
                                                                )}
                                                            </div>

                                                            {parseInt(editEmployeeForm.roleId) === 3 && (
                                                                <div className="hospital-admin-field">
                                                                    <label>Horario / turno</label>
                                                                    <p className="hospital-admin-form-hint">Activa los días que trabaja y ponle su propio rango de hora a cada uno.</p>
                                                                    <div className="hospital-admin-shift-windows">
                                                                        {editEmployeeForm.shiftWindows.map((w) => {
                                                                            const dayLabel = WEEKDAYS.find((d) => d.value === w.day)?.label
                                                                            return (
                                                                                <div key={w.day} className={`hospital-admin-shift-window-row ${w.enabled ? 'active' : ''}`}>
                                                                                    <label className="hospital-admin-shift-window-daytoggle">
                                                                                        <input type="checkbox" checked={w.enabled} onChange={() => toggleShiftWindowDay(setEditEmployeeForm, w.day)} />
                                                                                        {dayLabel}
                                                                                    </label>
                                                                                    <input type="time" value={w.start} onChange={(e) => updateShiftWindowTime(setEditEmployeeForm, w.day, 'start', e.target.value)} disabled={!w.enabled} required={w.enabled} />
                                                                                    <span>a</span>
                                                                                    <input type="time" value={w.end} onChange={(e) => updateShiftWindowTime(setEditEmployeeForm, w.day, 'end', e.target.value)} disabled={!w.enabled} required={w.enabled} />
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="hospital-admin-form-row">
                                                                <label className="hospital-admin-field"><span>Nombre(s)</span><input type="text" value={editEmployeeForm.firstName} onChange={(e) => setEditEmployeeForm(p => ({ ...p, firstName: e.target.value }))} maxLength={100} required /></label>
                                                                <label className="hospital-admin-field"><span>Apellido paterno</span><input type="text" value={editEmployeeForm.firstSurname} onChange={(e) => setEditEmployeeForm(p => ({ ...p, firstSurname: e.target.value }))} maxLength={150} required /></label>
                                                                <label className="hospital-admin-field"><span>Apellido materno</span><input type="text" value={editEmployeeForm.secondSurname} onChange={(e) => setEditEmployeeForm(p => ({ ...p, secondSurname: e.target.value }))} maxLength={150} /></label>
                                                            </div>
                                                            <div className="hospital-admin-form-row">
                                                                <label className="hospital-admin-field"><span>Teléfono</span><input type="text" value={editEmployeeForm.phone} onChange={(e) => setEditEmployeeForm(p => ({ ...p, phone: e.target.value }))} maxLength={10} required /></label>
                                                                <label className="hospital-admin-field"><span>Fecha de nacimiento</span><input type="date" value={editEmployeeForm.birthDate} onChange={(e) => setEditEmployeeForm(p => ({ ...p, birthDate: e.target.value }))} required /></label>
                                                                <label className="hospital-admin-field"><span>CURP</span><input type="text" value={editEmployeeForm.cveUnicaRegistroPob} onChange={(e) => setEditEmployeeForm(p => ({ ...p, cveUnicaRegistroPob: e.target.value }))} maxLength={18} required /></label>
                                                            </div>
                                                            <div className="hospital-admin-form-row">
                                                                <label className="hospital-admin-field"><span>Contacto de emergencia</span><input type="text" value={editEmployeeForm.emergencyContact} onChange={(e) => setEditEmployeeForm(p => ({ ...p, emergencyContact: e.target.value }))} maxLength={200} /></label>
                                                                <label className="hospital-admin-field"><span>Teléfono de emergencia</span><input type="text" value={editEmployeeForm.emergencyPhone} onChange={(e) => setEditEmployeeForm(p => ({ ...p, emergencyPhone: e.target.value }))} maxLength={10} /></label>
                                                            </div>
                                                            <div className="hospital-admin-form-actions">
                                                                <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                                                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setEditingEmployeeId(null)}>Cancelar</button>
                                                            </div>
                                                        </form>
</Drawer>
                                    <Drawer open={Boolean(editingCreds)} onClose={() => setCredentialsEmployeeId(null)} title="Credenciales de acceso" subtitle={`${u.first_name} ${u.first_surname}`} size="sm">
<form className="hospital-admin-form" onSubmit={(e) => handleUpdateEmployeeCredentials(e, u)}>
                                                            <div className="hospital-admin-form-row">
                                                                <label className="hospital-admin-field"><span>Correo electrónico</span><input type="email" value={credentialsForm.email} onChange={(e) => setCredentialsForm(p => ({ ...p, email: e.target.value }))} maxLength={150} required /></label>
                                                                <label className="hospital-admin-field"><span>Nueva contraseña</span><input type="password" value={credentialsForm.password} onChange={(e) => setCredentialsForm(p => ({ ...p, password: e.target.value }))} minLength={8} required /></label>
                                                            </div>
                                                            <div className="hospital-admin-form-actions">
                                                                <button type="submit" className="hospital-admin-form-submit">Guardar credenciales</button>
                                                                <button type="button" className="hospital-admin-form-cancel" onClick={() => setCredentialsEmployeeId(null)}>Cancelar</button>
                                                            </div>
                                                        </form>
</Drawer>

                                    <div className="entity-actions">
                                        <button type="button" className="hospital-admin-toggle-btn" onClick={() => openEditEmployee(u)}>Editar</button>
                                        <button type="button" className="hospital-admin-toggle-btn" onClick={() => openCredentialsEmployee(u)} disabled={!u.user_credential_id}>Credenciales</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[
                                            !isParamedic && {
                                                label: u.is_institution_admin ? 'Quitar privilegio de administrador' : 'Dar privilegio de administrador',
                                                onClick: () => handleToggleInstitutionAdmin(u),
                                                disabled: isSelf && u.is_institution_admin,
                                                title: isSelf && u.is_institution_admin ? 'No puedes quitarte tu propio privilegio de administrador' : undefined,
                                            },
                                            {
                                                label: u.is_active ? 'Desactivar cuenta' : 'Activar cuenta',
                                                onClick: () => handleToggleEmployeeActive(u),
                                                disabled: isSelf || !u.user_credential_id,
                                                danger: Boolean(u.is_active),
                                                title: isSelf ? 'No puedes desactivar tu propia cuenta' : undefined,
                                            },
                                        ]} />
                                    </div>
                                </article>
                            )
                        })}
                        {institutionAdmins.length === 0 && <p className="entity-empty">Tu institución todavía no tiene personal registrado. Usa «Nuevo empleado» para agregar al primero.</p>}
                    </div>
                </>
            )}

            {activeTab === 'Mi Institución' && (
                <section className="institution-tab">
                    <div className="institution-tab-head">
                        <h2>{institutionDetail?.name || 'Mi institución'}</h2>
                        <p>Aquí actualizas dónde está tu institución. El nombre y el tipo los define CRUM.</p>
                    </div>
                    <div className="institution-tab-card">
                        <form className="hospital-admin-form" onSubmit={handleUpdateAddress}>
                                        <p className="hospital-admin-form-hint">El nombre y el tipo de institución son responsabilidad exclusiva de CRUM — solo puedes editar dirección, código postal y ciudad.</p>
                    <label className="hospital-admin-field"><span>Dirección</span><input type="text" value={editAddressForm.streetAddress} onChange={(e) => setEditAddressForm(p => ({ ...p, streetAddress: e.target.value }))} maxLength={150} required /></label>
                    <div className="hospital-admin-form-row">
                        <label className="hospital-admin-field"><span>Código postal</span><input type="text" value={editAddressForm.zipCode} onChange={(e) => setEditAddressForm(p => ({ ...p, zipCode: e.target.value }))} maxLength={5} required /></label>
                        <label className="hospital-admin-field"><span>Estado</span><select value={selectedStateId} onChange={(e) => { setSelectedStateId(e.target.value); setEditAddressForm(p => ({ ...p, cityId: '' })) }} required>
                                <option value="">Selecciona un estado</option>
                                {states.map((s) => (
                                    <option key={s.state_id} value={s.state_id}>{s.name}</option>
                                ))}
                            </select></label>
                        <label className="hospital-admin-field"><span>Ciudad</span><select value={editAddressForm.cityId} onChange={(e) => setEditAddressForm(p => ({ ...p, cityId: e.target.value }))} disabled={!selectedStateId} required>
                                <option value="">{selectedStateId ? 'Selecciona una ciudad' : 'Elige un estado primero'}</option>
                                {cities.map((c) => (
                                    <option key={c.city_id} value={c.city_id}>{c.name}</option>
                                ))}
                            </select></label>
                    </div>
                    <div className="hospital-admin-form-actions">
                        <button type="submit" className="hospital-admin-form-submit">Guardar cambios</button>
                    </div>
                </form>
                    </div>
                </section>
            )}
        </div>
    )
}

export default HospitalAdmin
