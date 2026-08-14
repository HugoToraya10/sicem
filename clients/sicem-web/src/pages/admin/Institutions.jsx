import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import MapArea from '../../components/map/MapArea';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import './Institutions.css';
import {API_BASE_URL} from '../../config/api'

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

const emptyForm = {
    name: '', institutionTypeId: '', cityId: '', bedCapacity: '', availableBeds: '',
    streetAddress: '', zipCode: '', longitude: '', latitude: '',
}

const emptySpecialityForm = { institutionId: '', specialityId: '', totalBeds: '', availableBeds: '' }
const emptyNewSpecialityForm = { name: '', description: '' }
const emptyNewTypeForm = { institutionType: '' }
const emptyEditTypeForm = { institutionTypeId: '', institutionType: '' }
const emptyEditSpecialityForm = { specialityId: '', name: '', description: '' }
const emptyEditInstitutionForm = {
    institutionId: '', name: '', institutionTypeId: '', cityId: '',
    streetAddress: '', zipCode: '', longitude: '', latitude: '',
}

const TABS = ['Instituciones', 'Especialidades', 'Tipos', 'Notificaciones']

const Institutions = () => {
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Instituciones')

    const [institutions, setInstitutions] = useState([]);
    const [institutionTypes, setInstitutionTypes] = useState([]);
    const [specialities, setSpecialities] = useState([]);
    const [institutionSpecialities, setInstitutionSpecialities] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [activeEmergencies, setActiveEmergencies] = useState([]);

    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedStateId, setSelectedStateId] = useState('');

    const [addressSearch, setAddressSearch] = useState('');
    const [searchingAddress, setSearchingAddress] = useState(false);

    const [showNotificationForm, setShowNotificationForm] = useState(false);
    const [notificationForm, setNotificationForm] = useState({ institutionId: '', emergencyId: '', estimatedArrival: '', notes: '' })

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const [showBedsForm, setShowBedsForm] = useState(null);
    const [bedsValue, setBedsValue] = useState('');
    const [capacityValue, setCapacityValue] = useState('');

    const [showSpecialityAssign, setShowSpecialityAssign] = useState(false);
    const [specialityForm, setSpecialityForm] = useState(emptySpecialityForm);

    const [showNewSpeciality, setShowNewSpeciality] = useState(false);
    const [newSpecialityForm, setNewSpecialityForm] = useState(emptyNewSpecialityForm);

    const [showNewType, setShowNewType] = useState(false);
    const [newTypeForm, setNewTypeForm] = useState(emptyNewTypeForm);

    const [editingType, setEditingType] = useState(null);
    const [editTypeForm, setEditTypeForm] = useState(emptyEditTypeForm);

    const [editingSpeciality, setEditingSpeciality] = useState(null);
    const [editSpecialityForm, setEditSpecialityForm] = useState(emptyEditSpecialityForm);

    const [editingInstitution, setEditingInstitution] = useState(null);
    const [editInstitutionForm, setEditInstitutionForm] = useState(emptyEditInstitutionForm);

    const [editingSpecialityBeds, setEditingSpecialityBeds] = useState(null);
    const [specialityBedsValue, setSpecialityBedsValue] = useState('');
    const [specialityCapacityValue, setSpecialityCapacityValue] = useState('');

    // Filtros visuales por estado (Todos / Activos / Inactivos) — solo afectan el render, no hacen fetch
    const [institutionsFilter, setInstitutionsFilter] = useState('all');
    const [specialitiesFilter, setSpecialitiesFilter] = useState('all');
    const [typesFilter, setTypesFilter] = useState('all');

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    //---------------------------------consultar, gets--------------------------------------------------

    const fetchInstitutions = () => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutions(data.map(i => toLowerCaseKeys(i))))
            .catch(error => console.error('Error consultando instituciones. ', error))
    }
    useEffect(() => { fetchInstitutions() }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/estados`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setStates((data || []).map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando estados. ', error))
    }, []);

    useEffect(() => {
        if (!selectedStateId) { setCities([]); return }
        fetch(`${API_BASE_URL}/usuarios/ciudades/${selectedStateId}`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setCities((data || []).map(c => toLowerCaseKeys(c))))
            .catch(error => console.error('Error consultando ciudades. ', error))
    }, [selectedStateId]);

    const fetchInstitutionTypes = () => {
        fetch(`${API_BASE_URL}/hospitales/tipos-institucion-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setInstitutionTypes(data.map(t => toLowerCaseKeys(t))))
            .catch(error => console.error('Error consultando tipos de institución. ', error))
    }
    useEffect(() => { fetchInstitutionTypes() }, []);

    const fetchSpecialities = () => {
        fetch(`${API_BASE_URL}/hospitales/especialidades-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setSpecialities(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando especialidades. ', error))
    }
    useEffect(() => { fetchSpecialities() }, []);

    const fetchInstitutionSpecialities = () => {
        fetch(`${API_BASE_URL}/hospitales/especialidades-instituciones`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ data }) => setInstitutionSpecialities(data.map(s => toLowerCaseKeys(s))))
            .catch(error => console.error('Error consultando especialidades por institución. ', error))
    }
    useEffect(() => { fetchInstitutionSpecialities() }, []);

    const fetchNotifications = () => {
        fetch(`${API_BASE_URL}/hospitales/notificaciones`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setNotifications(data.map(n => toLowerCaseKeys(n))))
            .catch(error => console.error('Error consultando notificaciones. ', error))
    }
    useEffect(() => { if (activeTab === 'Notificaciones') fetchNotifications() }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'Notificaciones') return
        fetch(`${API_BASE_URL}/emergencias/emergencias-activas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ data }) => setActiveEmergencies((data || []).map(em => toLowerCaseKeys(em))))
            .catch(error => console.error('Error consultando emergencias activas. ', error))
    }, [activeTab]);

    const handleCreateNotification = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/hospitales/crear-notificacion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: notificationForm.institutionId,
                emergencyId: notificationForm.emergencyId,
                userProfileId: user?.profileId,
                estimatedArrival: notificationForm.estimatedArrival,
                notes: notificationForm.notes,
            })
        })
            .then(parseResponse)
            .then(() => { setNotificationForm({ institutionId: '', emergencyId: '', estimatedArrival: '', notes: '' }); setShowNotificationForm(false); fetchNotifications(); })
            .catch(error => { console.error('Error creando notificación. ', error); alert(error.message) })
    }

    //---------------------------------instituciones: registrar / actualizar--------------------------------------------------

    const handleFieldChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

    // Aplica un resultado de Nominatim (search o reverse) al formulario:
    // latitud/longitud, dirección, código postal y estado (por match contra
    // /usuarios/estados). Todo queda editable — son solo pre-llenados.
    const applyPlaceDetails = (place) => {
        const addr = place.address || {}
        handleFieldChange('latitude', parseFloat(place.lat).toFixed(8))
        handleFieldChange('longitude', parseFloat(place.lon).toFixed(8))

        const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
        if (street) handleFieldChange('streetAddress', street.slice(0, 150))
        if (addr.postcode) handleFieldChange('zipCode', addr.postcode.slice(0, 5))

        if (addr.state) {
            const normalize = (value) =>
                value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^estado de\s+/, '').trim()
            const target = normalize(addr.state)
            const match = states.find((s) => normalize(s.name) === target)
            if (match) {
                setSelectedStateId(String(match.state_id))
                handleFieldChange('cityId', '')
            }
        }
    }

    // Buscador de dirección vía Nominatim (mismo ecosistema OpenStreetMap que
    // ya usa el mapa) — rellena latitud/longitud automáticamente, y también
    // dirección, código postal y estado cuando vienen en el resultado (con
    // addressdetails=1).
    const handleAddressSearch = () => {
        if (!addressSearch.trim()) return
        setSearchingAddress(true)
        const query = `${addressSearch}, Tabasco, México`
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`)
            .then(res => res.json())
            .then((results) => {
                if (results.length === 0) {
                    alert('No se encontró esa dirección. Intenta ser más específico o marca directamente en el mapa.')
                    return
                }
                applyPlaceDetails(results[0])
            })
            .catch(error => console.error('Error buscando dirección. ', error))
            .finally(() => setSearchingAddress(false))
    }

    // Clic en el mapa — solo rellena latitud/longitud. (No se hace reverse
    // geocoding: las instituciones no son calles, y Nominatim "brincaría" al
    // punto de la calle más cercana, lo cual es incorrecto para este caso.)
    const handleMapClick = (lat, lng) => {
        handleFieldChange('latitude', lat.toFixed(8))
        handleFieldChange('longitude', lng.toFixed(8))
    }

    // Bloquea el guardado si las camas disponibles superan las camas totales
    const validateBeds = (availableBeds, totalBeds) => {
        if (Number(availableBeds) > Number(totalBeds)) {
            alert('Las camas disponibles no pueden ser más que las camas totales.')
            return false
        }
        return true
    }

    // Alerta suave (no bloqueante): las camas por especialidad pueden traslaparse entre sí
    // (no son un compartimento exclusivo de las camas generales), así que solo confirmamos
    // cuando la suma ya supera claramente lo explicable por traslape normal.
    const BED_OVERLAP_MULTIPLIER = 2

    const confirmSpecialityBedsOverlap = (institutionId, totalBeds, excludeInstitutionSpecialityId) => {
        const institution = institutions.find(i => String(i.institution_id) === String(institutionId))
        if (!institution) return true

        const sumOtherActive = institutionSpecialities
            .filter(s =>
                String(s.institution_id) === String(institutionId) &&
                s.is_active &&
                s.institution_speciality_id !== excludeInstitutionSpecialityId
            )
            .reduce((acc, s) => acc + Number(s.total_beds), 0)

        const newSum = sumOtherActive + Number(totalBeds)
        const threshold = Number(institution.bed_capacity) * BED_OVERLAP_MULTIPLIER

        if (newSum > threshold) {
            return window.confirm(
                `Esta especialidad hace que la suma de camas por especialidad (${newSum}) supere significativamente las camas totales de la institución (${institution.bed_capacity}). ¿Es esto correcto?`
            )
        }
        return true
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(institutions, 'name', form.name, 'nombre')) return
        if (!validateBeds(form.availableBeds, form.bedCapacity)) return
        fetch(`${API_BASE_URL}/hospitales/registrar-institucion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                name: form.name, institutionTypeId: form.institutionTypeId, cityId: form.cityId,
                bedCapacity: form.bedCapacity, availableBeds: form.availableBeds,
                streetAddress: form.streetAddress, zipCode: form.zipCode,
                longitude: form.longitude, latitude: form.latitude,
            })
        })
            .then(parseResponse)
            .then(() => { setForm(emptyForm); setSelectedStateId(''); setShowForm(false); fetchInstitutions(); })
            .catch(error => { console.error('Error registrando institución. ', error); alert(error.message) })
    }

    const handleToggleActive = (inst) => {
        const action = inst.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la institución "${inst.name}"?`)) return
        fetch(`${API_BASE_URL}/hospitales/alternar-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId: inst.institution_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutions())
            .catch(error => { console.error('Error cambiando estado de la institución. ', error); alert(error.message) })
    }

    const handleToggleCrum = (inst) => {
        const action = inst.is_crum_institution ? 'quitar de la red CRUM' : 'marcar como institución CRUM'
        if (!window.confirm(`¿Seguro que quieres ${action} a "${inst.name}"?`)) return
        fetch(`${API_BASE_URL}/hospitales/alternar-crum-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId: inst.institution_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutions())
            .catch(error => { console.error('Error cambiando estado CRUM de la institución. ', error); alert(error.message) })
    }

    const openBedsForm = (inst) => {
        setShowBedsForm(inst.institution_id)
        setBedsValue(inst.available_beds ?? '')
        setCapacityValue(inst.bed_capacity ?? '')
    }

    const handleUpdateBeds = (e, institutionId) => {
        e.preventDefault();
        if (!validateBeds(bedsValue, capacityValue)) return
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/actualizar-camas-institucion`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionId, availableBeds: bedsValue })
            }).then(parseResponse),
            fetch(`${API_BASE_URL}/hospitales/actualizar-capacidad-institucion`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionId, bedCapacity: capacityValue })
            }).then(parseResponse),
        ])
            .then(() => { setShowBedsForm(null); fetchInstitutions(); })
            .catch(error => { console.error('Error actualizando camas. ', error); alert(error.message) })
    }

    const openEditInstitution = (inst) => {
        setEditingInstitution(inst.institution_id)
        setEditInstitutionForm({
            institutionId: inst.institution_id,
            name: inst.name || '',
            institutionTypeId: inst.institution_type_id || '',
            cityId: inst.city_id || '',
            streetAddress: inst.street_address || '',
            zipCode: inst.zip_code || '',
            longitude: inst.longitude || '',
            latitude: inst.latitude || '',
        })
    }

    const handleUpdateInstitution = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/hospitales/actualizar-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editInstitutionForm)
        })
            .then(parseResponse)
            .then(() => { setEditingInstitution(null); fetchInstitutions(); })
            .catch(error => { console.error('Error actualizando institución. ', error); alert(error.message) })
    }

    const openSpecialityBedsForm = (s) => {
        setEditingSpecialityBeds(s.institution_speciality_id)
        setSpecialityBedsValue(s.available_beds ?? '')
        setSpecialityCapacityValue(s.total_beds ?? '')
    }

    const handleUpdateSpecialityBeds = (e, institutionSpecialityId) => {
        e.preventDefault();
        if (!validateBeds(specialityBedsValue, specialityCapacityValue)) return
        const currentRow = institutionSpecialities.find(s => s.institution_speciality_id === institutionSpecialityId)
        if (currentRow && !confirmSpecialityBedsOverlap(currentRow.institution_id, specialityCapacityValue, institutionSpecialityId)) return
        Promise.all([
            fetch(`${API_BASE_URL}/hospitales/actualizar-camas-especialidad`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionSpecialityId, availableBeds: specialityBedsValue })
            }).then(parseResponse),
            fetch(`${API_BASE_URL}/hospitales/actualizar-capacidad-especialidad`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ institutionSpecialityId, totalBeds: specialityCapacityValue })
            }).then(parseResponse),
        ])
            .then(() => { setEditingSpecialityBeds(null); fetchInstitutionSpecialities(); })
            .catch(error => { console.error('Error actualizando camas de especialidad. ', error); alert(error.message) })
    }

    const specialitiesForInstitution = (institutionId) =>
        institutionSpecialities.filter(s => s.institution_id === institutionId)

    const specialityNameById = (specialityId) =>
        specialities.find(sp => sp.speciality_id === specialityId)?.name || 'Especialidad'

    //---------------------------------especialidades: crear / asignar / desactivar--------------------------------------------------

    const handleCreateSpeciality = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(specialities, 'name', newSpecialityForm.name, 'nombre')) return
        fetch(`${API_BASE_URL}/hospitales/crear-especialidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ name: newSpecialityForm.name, description: newSpecialityForm.description })
        })
            .then(parseResponse)
            .then(() => { setNewSpecialityForm(emptyNewSpecialityForm); setShowNewSpeciality(false); fetchSpecialities(); })
            .catch(error => { console.error('Error creando especialidad. ', error); alert(error.message) })
    }

    const openEditSpeciality = (sp) => {
        setEditingSpeciality(sp.speciality_id)
        setEditSpecialityForm({ specialityId: sp.speciality_id, name: sp.name || '', description: sp.description || '' })
    }

    const handleUpdateSpeciality = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/hospitales/actualizar-especialidad`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editSpecialityForm)
        })
            .then(parseResponse)
            .then(() => { setEditingSpeciality(null); fetchSpecialities(); })
            .catch(error => { console.error('Error actualizando especialidad. ', error); alert(error.message) })
    }

    const handleToggleSpeciality = (sp) => {
        const action = sp.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la especialidad "${sp.name}"?`)) return
        fetch(`${API_BASE_URL}/hospitales/alternar-especialidad`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ specialityId: sp.speciality_id })
        })
            .then(parseResponse)
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error cambiando estado de especialidad. ', error); alert(error.message) })
    }

    const handleAssignSpeciality = (e) => {
        e.preventDefault();
        const alreadyAssigned = institutionSpecialities.some(s =>
            String(s.institution_id) === String(specialityForm.institutionId) &&
            String(s.speciality_id) === String(specialityForm.specialityId)
        )
        if (alreadyAssigned) {
            alert('Esta especialidad ya está asignada a esta institución.')
            return
        }
        if (!validateBeds(specialityForm.availableBeds, specialityForm.totalBeds)) return
        if (!confirmSpecialityBedsOverlap(specialityForm.institutionId, specialityForm.totalBeds, null)) return
        fetch(`${API_BASE_URL}/hospitales/asignar-especialidad`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                institutionId: specialityForm.institutionId,
                specialityId: specialityForm.specialityId,
                totalBeds: specialityForm.totalBeds,
                availableBeds: specialityForm.availableBeds,
            })
        })
            .then(parseResponse)
            .then(() => { setSpecialityForm(emptySpecialityForm); setShowSpecialityAssign(false); fetchInstitutionSpecialities(); })
            .catch(error => { console.error('Error asignando especialidad. ', error); alert(error.message) })
    }

    const handleToggleInstitutionSpeciality = (institutionSpecialityId) => {
        if (!window.confirm('¿Seguro que quieres cambiar el estado de esta especialidad asignada?')) return
        fetch(`${API_BASE_URL}/hospitales/alternar-especialidad-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionSpecialityId })
        })
            .then(parseResponse)
            .then(() => fetchInstitutionSpecialities())
            .catch(error => { console.error('Error cambiando estado. ', error); alert(error.message) })
    }

    //---------------------------------tipos de institución: crear / desactivar--------------------------------------------------

    const handleCreateType = (e) => {
        e.preventDefault();
        if (blockIfDuplicate(institutionTypes, 'institution_type', newTypeForm.institutionType, 'nombre de tipo')) return
        fetch(`${API_BASE_URL}/hospitales/crear-tipo-institucion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionType: newTypeForm.institutionType })
        })
            .then(parseResponse)
            .then(() => { setNewTypeForm(emptyNewTypeForm); setShowNewType(false); fetchInstitutionTypes(); })
            .catch(error => { console.error('Error creando tipo de institución. ', error); alert(error.message) })
    }

    const openEditType = (t) => {
        setEditingType(t.institution_type_id)
        setEditTypeForm({ institutionTypeId: t.institution_type_id, institutionType: t.institution_type || '' })
    }

    const handleUpdateType = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/hospitales/actualizar-tipo-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editTypeForm)
        })
            .then(parseResponse)
            .then(() => { setEditingType(null); fetchInstitutionTypes(); })
            .catch(error => { console.error('Error actualizando tipo de institución. ', error); alert(error.message) })
    }

    const handleToggleType = (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el tipo "${t.institution_type}"?`)) return
        fetch(`${API_BASE_URL}/hospitales/alternar-tipo-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionTypeId: t.institution_type_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutionTypes())
            .catch(error => { console.error('Error cambiando estado de tipo. ', error); alert(error.message) })
    }

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="institutions-body">
                <h2 className="institutions-title">Gestión de Instituciones</h2>

                <div className="institutions-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            className={`institutions-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ── TAB: INSTITUCIONES ─────────────────────────────── */}
                {activeTab === 'Instituciones' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={institutionsFilter} onChange={(e) => setInstitutionsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-secondary-btn" onClick={() => setShowSpecialityAssign(!showSpecialityAssign)}>
                                Asignar Especialidad
                            </button>
                            <button className="institutions-add-btn" onClick={() => setShowForm(!showForm)}>
                                + Nueva Institución
                            </button>
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
                                <p className="institutions-form-hint">
                                    Esta capacidad es la reportada por ese servicio específico y puede traslaparse con las camas de otras especialidades (no es un compartimento exclusivo de las camas generales). "Camas totales" = capacidad máxima reportada para esta especialidad. "Camas disponibles" = las libres ahora mismo para esa especialidad.
                                </p>
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
                                <p className="institutions-form-hint">
                                    "Capacidad total de camas" = capacidad física total del hospital. "Camas disponibles" = las que están libres ahora mismo.
                                </p>
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
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Estado</label>
                                        <select value={selectedStateId} onChange={(e) => { setSelectedStateId(e.target.value); handleFieldChange('cityId', '') }} required>
                                            <option value="">Selecciona un estado</option>
                                            {states.map((s) => (
                                                <option key={s.state_id} value={s.state_id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Ciudad</label>
                                        <select value={form.cityId} onChange={(e) => handleFieldChange('cityId', e.target.value)} disabled={!selectedStateId} required>
                                            <option value="">{selectedStateId ? 'Selecciona una ciudad' : 'Elige un estado primero'}</option>
                                            {cities.map((c) => (
                                                <option key={c.city_id} value={c.city_id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="institutions-address-search">
                                    <input
                                        type="text"
                                        value={addressSearch}
                                        onChange={(e) => setAddressSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                                        placeholder="Busca la dirección de la institución..."
                                    />
                                    <button type="button" onClick={handleAddressSearch} disabled={searchingAddress}>
                                        {searchingAddress ? 'Buscando...' : 'Buscar'}
                                    </button>
                                </div>
                                <div className="institutions-map-wrapper">
                                    <MapArea
                                        emergencyLocation={form.latitude && form.longitude ? { latitude: form.latitude, longitude: form.longitude } : null}
                                        onMapClick={handleMapClick}
                                        flyToLocation={form.latitude && form.longitude ? [parseFloat(form.latitude), parseFloat(form.longitude)] : null}
                                    />
                                </div>
                                <div className="institutions-coords">
                                    <div className="institutions-field">
                                        <label>Latitud</label>
                                        <input type="number" step="0.00000001" value={form.latitude} onChange={(e) => handleFieldChange('latitude', e.target.value)} placeholder="Clic en el mapa" required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Longitud</label>
                                        <input type="number" step="0.00000001" value={form.longitude} onChange={(e) => handleFieldChange('longitude', e.target.value)} placeholder="Clic en el mapa" required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Registrar institución</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="institutions-grid">
                            {filterByStatus(institutions, institutionsFilter).map((inst) => (
                                <div key={inst.institution_id} className="institution-admin-card">
                                    <div className="institution-admin-header">
                                        <h4>{inst.name}</h4>
                                        <span className={`institutions-status ${inst.is_active ? 'status-active' : 'status-inactive'}`}>
                                            {inst.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                        <span className={`institutions-status ${inst.is_crum_institution ? 'status-crum' : 'status-not-crum'}`}>
                                            {inst.is_crum_institution ? 'CRUM' : 'No CRUM'}
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
                                                editingSpecialityBeds === s.institution_speciality_id ? (
                                                    <form
                                                        key={s.institution_speciality_id}
                                                        className="beds-edit-form"
                                                        onSubmit={(e) => handleUpdateSpecialityBeds(e, s.institution_speciality_id)}
                                                    >
                                                        <p className="beds-edit-hint">
                                                            Capacidad reportada por esta especialidad — puede traslaparse con las de otras.
                                                        </p>
                                                        <input type="number" min="0" placeholder="Capacidad" title="Capacidad máxima reportada para esta especialidad" value={specialityCapacityValue} onChange={(e) => setSpecialityCapacityValue(e.target.value)} required />
                                                        <input type="number" min="0" placeholder="Disponibles" title="Camas libres ahora mismo para esta especialidad" value={specialityBedsValue} onChange={(e) => setSpecialityBedsValue(e.target.value)} required />
                                                        <button type="submit">Guardar</button>
                                                        <button type="button" onClick={() => setEditingSpecialityBeds(null)}>Cancelar</button>
                                                    </form>
                                                ) : (
                                                    <div key={s.institution_speciality_id} className="speciality-chip-row">
                                                        <span
                                                            className={`speciality-chip clickable ${s.is_active ? '' : 'speciality-chip-inactive'}`}
                                                            onClick={() => handleToggleInstitutionSpeciality(s.institution_speciality_id)}
                                                            title="Clic para activar/desactivar"
                                                        >
                                                            {specialityNameById(s.speciality_id)} · {s.available_beds}/{s.total_beds} camas
                                                            {!s.is_active && ' (inactiva)'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="speciality-chip-edit-btn"
                                                            onClick={() => openSpecialityBedsForm(s)}
                                                            title="Editar camas de esta especialidad"
                                                        >
                                                            ✎
                                                        </button>
                                                    </div>
                                                )
                                            ))
                                        )}
                                    </div>

                                    {editingInstitution === inst.institution_id && (
                                        <form className="institutions-form" onSubmit={handleUpdateInstitution}>
                                            <h3>Editar Institución</h3>
                                            <div className="institutions-form-row">
                                                <div className="institutions-field">
                                                    <label>Nombre</label>
                                                    <input type="text" value={editInstitutionForm.name} onChange={(e) => setEditInstitutionForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                                </div>
                                                <div className="institutions-field">
                                                    <label>Tipo de institución</label>
                                                    <select value={editInstitutionForm.institutionTypeId} onChange={(e) => setEditInstitutionForm(p => ({ ...p, institutionTypeId: e.target.value }))} required>
                                                        <option value="">Selecciona un tipo</option>
                                                        {institutionTypes.map((t) => (
                                                            <option key={t.institution_type_id} value={t.institution_type_id}>{t.institution_type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="institutions-field">
                                                <label>Dirección</label>
                                                <input type="text" value={editInstitutionForm.streetAddress} onChange={(e) => setEditInstitutionForm(p => ({ ...p, streetAddress: e.target.value }))} maxLength={150} required />
                                            </div>
                                            <div className="institutions-form-row">
                                                <div className="institutions-field">
                                                    <label>Código postal</label>
                                                    <input type="text" value={editInstitutionForm.zipCode} onChange={(e) => setEditInstitutionForm(p => ({ ...p, zipCode: e.target.value }))} maxLength={5} required />
                                                </div>
                                                <div className="institutions-field">
                                                    <label>ID de ciudad</label>
                                                    <input type="number" value={editInstitutionForm.cityId} onChange={(e) => setEditInstitutionForm(p => ({ ...p, cityId: e.target.value }))} required />
                                                </div>
                                            </div>
                                            <div className="institutions-form-row">
                                                <div className="institutions-field">
                                                    <label>Latitud</label>
                                                    <input type="number" step="0.00000001" value={editInstitutionForm.latitude} onChange={(e) => setEditInstitutionForm(p => ({ ...p, latitude: e.target.value }))} required />
                                                </div>
                                                <div className="institutions-field">
                                                    <label>Longitud</label>
                                                    <input type="number" step="0.00000001" value={editInstitutionForm.longitude} onChange={(e) => setEditInstitutionForm(p => ({ ...p, longitude: e.target.value }))} required />
                                                </div>
                                            </div>
                                            <div className="institutions-form-actions">
                                                <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                                <button type="button" className="institutions-form-cancel" onClick={() => setEditingInstitution(null)}>Cancelar</button>
                                            </div>
                                        </form>
                                    )}

                                    {showBedsForm === inst.institution_id ? (
                                        <form className="beds-edit-form" onSubmit={(e) => handleUpdateBeds(e, inst.institution_id)}>
                                            <p className="beds-edit-hint">
                                                Capacidad = capacidad física total del hospital. Disponibles = libres ahora mismo.
                                            </p>
                                            <input type="number" min="0" placeholder="Capacidad" title="Capacidad física total del hospital" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} required />
                                            <input type="number" min="0" placeholder="Disponibles" title="Camas libres ahora mismo" value={bedsValue} onChange={(e) => setBedsValue(e.target.value)} required />
                                            <button type="submit">Guardar</button>
                                            <button type="button" onClick={() => setShowBedsForm(null)}>Cancelar</button>
                                        </form>
                                    ) : (
                                        <div className="institution-admin-actions">
                                            <button className="institutions-edit-btn" onClick={() => openBedsForm(inst)}>Editar camas</button>
                                            <button className="institutions-edit-btn" onClick={() => openEditInstitution(inst)}>Editar institución</button>
                                            <button className="institutions-toggle-btn" onClick={() => handleToggleCrum(inst)}>
                                                {inst.is_crum_institution ? 'Quitar de CRUM' : 'Marcar como CRUM'}
                                            </button>
                                            <button className="institutions-toggle-btn" onClick={() => handleToggleActive(inst)}>
                                                {inst.is_active ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {filterByStatus(institutions, institutionsFilter).length === 0 && <p className="institutions-empty">No hay instituciones que coincidan con el filtro.</p>}
                    </>
                )}

                {/* ── TAB: ESPECIALIDADES ─────────────────────────────── */}
                {activeTab === 'Especialidades' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={specialitiesFilter} onChange={(e) => setSpecialitiesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowNewSpeciality(!showNewSpeciality)}>
                                + Nueva Especialidad
                            </button>
                        </div>

                        {showNewSpeciality && (
                            <form className="institutions-form" onSubmit={handleCreateSpeciality}>
                                <h3>Crear Nueva Especialidad</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={newSpecialityForm.name} onChange={(e) => setNewSpecialityForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={newSpecialityForm.description} onChange={(e) => setNewSpecialityForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear especialidad</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowNewSpeciality(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingSpeciality !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateSpeciality}>
                                <h3>Editar Especialidad</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editSpecialityForm.name} onChange={(e) => setEditSpecialityForm(p => ({ ...p, name: e.target.value }))} maxLength={100} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Descripción</label>
                                        <input type="text" value={editSpecialityForm.description} onChange={(e) => setEditSpecialityForm(p => ({ ...p, description: e.target.value }))} maxLength={200} required />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingSpeciality(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead>
                                    <tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr>
                                </thead>
                                <tbody>
                                    {filterByStatus(specialities, specialitiesFilter).map((sp) => (
                                        <tr key={sp.speciality_id}>
                                            <td>{sp.name}</td>
                                            <td>{sp.description}</td>
                                            <td>
                                                <span className={`institutions-status ${sp.is_active ? 'status-active' : 'status-inactive'}`}>
                                                    {sp.is_active ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditSpeciality(sp)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleSpeciality(sp)}>
                                                    {sp.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(specialities, specialitiesFilter).length === 0 && <p className="institutions-empty">No hay especialidades que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: TIPOS DE INSTITUCIÓN ─────────────────────────────── */}
                {activeTab === 'Tipos' && (
                    <>
                        <div className="institutions-tab-header">
                            <select className="status-filter-select" value={typesFilter} onChange={(e) => setTypesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowNewType(!showNewType)}>
                                + Nuevo Tipo
                            </button>
                        </div>

                        {showNewType && (
                            <form className="institutions-form" onSubmit={handleCreateType}>
                                <h3>Crear Nuevo Tipo de Institución</h3>
                                <div className="institutions-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={newTypeForm.institutionType} onChange={(e) => setNewTypeForm({ institutionType: e.target.value })} maxLength={100} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear tipo</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowNewType(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {editingType !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateType}>
                                <h3>Editar Tipo de Institución</h3>
                                <div className="institutions-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={editTypeForm.institutionType} onChange={(e) => setEditTypeForm(p => ({ ...p, institutionType: e.target.value }))} maxLength={100} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingType(null)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead>
                                    <tr><th>Tipo</th><th>Estado</th><th>Acciones</th></tr>
                                </thead>
                                <tbody>
                                    {filterByStatus(institutionTypes, typesFilter).map((t) => (
                                        <tr key={t.institution_type_id}>
                                            <td>{t.institution_type}</td>
                                            <td>
                                                <span className={`institutions-status ${t.is_active ? 'status-active' : 'status-inactive'}`}>
                                                    {t.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditType(t)}>Editar</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleType(t)}>
                                                    {t.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(institutionTypes, typesFilter).length === 0 && <p className="institutions-empty">No hay tipos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: NOTIFICACIONES ─────────────────────────────── */}
                {activeTab === 'Notificaciones' && (
                    <>
                        <div className="institutions-tab-header">
                            <button className="institutions-add-btn" onClick={() => setShowNotificationForm(!showNotificationForm)}>
                                + Nueva Notificación
                            </button>
                        </div>

                        {showNotificationForm && (
                            <form className="institutions-form" onSubmit={handleCreateNotification}>
                                <h3>Nueva Notificación de Institución</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Institución</label>
                                        <select value={notificationForm.institutionId} onChange={(e) => setNotificationForm(p => ({ ...p, institutionId: e.target.value }))} required>
                                            <option value="">Selecciona una institución</option>
                                            {institutions.map((inst) => (
                                                <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Emergencia relacionada</label>
                                        <select value={notificationForm.emergencyId} onChange={(e) => setNotificationForm(p => ({ ...p, emergencyId: e.target.value }))} required>
                                            <option value="">Selecciona una emergencia activa</option>
                                            {activeEmergencies.map((em) => (
                                                <option key={em.emergency_id} value={em.emergency_id}>#{em.emergency_id} — {em.type_name} — {em.description}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Llegada estimada</label>
                                    <input type="datetime-local" value={notificationForm.estimatedArrival} onChange={(e) => setNotificationForm(p => ({ ...p, estimatedArrival: e.target.value }))} required />
                                </div>
                                <div className="institutions-field">
                                    <label>Notas</label>
                                    <input type="text" value={notificationForm.notes} onChange={(e) => setNotificationForm(p => ({ ...p, notes: e.target.value }))} maxLength={300} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Enviar notificación</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowNotificationForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead>
                                    <tr><th>Institución</th><th>Emergencia</th><th>Llegada estimada</th><th>Notas</th></tr>
                                </thead>
                                <tbody>
                                    {notifications.map((n) => (
                                        <tr key={n.institution_notification_id}>
                                            <td>{n.institution_name}</td>
                                            <td>{n.emergency_type_name ? `${n.emergency_type_name} — ${n.emergency_description}` : `#${n.emergency_id}`}</td>
                                            <td>{n.estimated_arrival ? new Date(n.estimated_arrival).toLocaleString('es-MX') : '—'}</td>
                                            <td>{n.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {notifications.length === 0 && <p className="institutions-empty">No hay notificaciones registradas.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Institutions;