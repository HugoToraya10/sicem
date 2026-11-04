import { Fragment, useEffect, useState } from 'react';
import { roleLabel } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { NOMINATIM_SEARCH_URL } from '../../config/services'
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import MapArea from '../../components/map/MapArea';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import MoreMenu from '../../components/ui/MoreMenu'
import '../../styles/entities.css'
import './Institutions.css';
import {API_BASE_URL} from '../../config/api'
import { useDialogs } from '../../context/useDialogs'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import SkeletonCards from '../../components/ui/SkeletonCards'
import { Drawer, Modal } from '../../components/ui/Overlay'


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
    const { notify, confirm } = useDialogs()
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Instituciones')

    const [institutions, setInstitutions] = useState([]);
    const [loaded, setLoaded] = useState(false);
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
            .then(({ data }) => { setInstitutions(data.map(i => toLowerCaseKeys(i))); setLoaded(true) })
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
            .catch(error => { console.error('Error creando notificación. ', error); notify(error.message, 'error') })
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
        // El estado sale del que se eligió en el formulario (si ya hay uno); nunca de uno fijo.
        const chosenState = states.find((s) => String(s.state_id) === String(selectedStateId))
        const query = [addressSearch, chosenState?.name, 'México'].filter(Boolean).join(', ')
        fetch(`${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&countrycodes=mx&accept-language=es`)
            .then(res => res.json())
            .then((results) => {
                if (results.length === 0) {
                    notify('No se encontró esa dirección. Intenta ser más específico o marca directamente en el mapa.', 'error')
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
            notify('Las camas disponibles no pueden ser más que las camas totales.', 'error')
            return false
        }
        return true
    }

    // Alerta suave (no bloqueante): las camas por especialidad pueden traslaparse entre sí
    // (no son un compartimento exclusivo de las camas generales), así que solo confirmamos
    // cuando la suma ya supera claramente lo explicable por traslape normal.
    const BED_OVERLAP_MULTIPLIER = 2

    const confirmSpecialityBedsOverlap = async (institutionId, totalBeds, excludeInstitutionSpecialityId) => {
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
            return confirm({
                title: 'Revisa las camas',
                message: `Esta especialidad hace que la suma de camas por especialidad (${newSum}) supere significativamente las camas totales de la institución (${institution.bed_capacity}). ¿Es esto correcto?`,
                confirmLabel: 'Sí, es correcto',
            })
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
            .catch(error => { console.error('Error registrando institución. ', error); notify(error.message, 'error') })
    }

    const handleToggleActive = async (inst) => {
        const action = inst.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} la institución "${inst.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId: inst.institution_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutions())
            .catch(error => { console.error('Error cambiando estado de la institución. ', error); notify(error.message, 'error') })
    }

    const handleToggleCrum = async (inst) => {
        const action = inst.is_crum_institution ? 'quitar de la red CRUM' : 'marcar como institución CRUM'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} a "${inst.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-crum-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionId: inst.institution_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutions())
            .catch(error => { console.error('Error cambiando estado CRUM de la institución. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando camas. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando institución. ', error); notify(error.message, 'error') })
    }

    const openSpecialityBedsForm = (s) => {
        setEditingSpecialityBeds(s.institution_speciality_id)
        setSpecialityBedsValue(s.available_beds ?? '')
        setSpecialityCapacityValue(s.total_beds ?? '')
    }

    const handleUpdateSpecialityBeds = async (e, institutionSpecialityId) => {
        e.preventDefault();
        if (!validateBeds(specialityBedsValue, specialityCapacityValue)) return
        const currentRow = institutionSpecialities.find(s => s.institution_speciality_id === institutionSpecialityId)
        if (currentRow && !(await confirmSpecialityBedsOverlap(currentRow.institution_id, specialityCapacityValue, institutionSpecialityId))) return
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
            .catch(error => { console.error('Error actualizando camas de especialidad. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error creando especialidad. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando especialidad. ', error); notify(error.message, 'error') })
    }

    const handleToggleSpeciality = async (sp) => {
        const action = sp.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} la especialidad "${sp.name}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-especialidad`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ specialityId: sp.speciality_id })
        })
            .then(parseResponse)
            .then(() => fetchSpecialities())
            .catch(error => { console.error('Error cambiando estado de especialidad. ', error); notify(error.message, 'error') })
    }

    const handleAssignSpeciality = async (e) => {
        e.preventDefault();
        const alreadyAssigned = institutionSpecialities.some(s =>
            String(s.institution_id) === String(specialityForm.institutionId) &&
            String(s.speciality_id) === String(specialityForm.specialityId)
        )
        if (alreadyAssigned) {
            notify('Esta especialidad ya está asignada a esta institución.', 'error')
            return
        }
        if (!validateBeds(specialityForm.availableBeds, specialityForm.totalBeds)) return
        if (!(await confirmSpecialityBedsOverlap(specialityForm.institutionId, specialityForm.totalBeds, null))) return
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
            .catch(error => { console.error('Error asignando especialidad. ', error); notify(error.message, 'error') })
    }

    const handleToggleInstitutionSpeciality = async (institutionSpecialityId) => {
        if (!(await confirm({ title: 'Confirmar', message: '¿Seguro que quieres cambiar el estado de esta especialidad asignada?', confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-especialidad-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionSpecialityId })
        })
            .then(parseResponse)
            .then(() => fetchInstitutionSpecialities())
            .catch(error => { console.error('Error cambiando estado. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error creando tipo de institución. ', error); notify(error.message, 'error') })
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
            .catch(error => { console.error('Error actualizando tipo de institución. ', error); notify(error.message, 'error') })
    }

    const handleToggleType = async (t) => {
        const action = t.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el tipo "${t.institution_type}"?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/hospitales/alternar-tipo-institucion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ institutionTypeId: t.institution_type_id })
        })
            .then(parseResponse)
            .then(() => fetchInstitutionTypes())
            .catch(error => { console.error('Error cambiando estado de tipo. ', error); notify(error.message, 'error') })
    }

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabel(user?.roleId)} links={navLinks} />

            <div role="main" id="contenido" className="institutions-body">
                <h1 className="institutions-title">Gestión de instituciones</h1>

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
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={institutionsFilter} onChange={(e) => setInstitutionsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-secondary-btn" onClick={() => setShowSpecialityAssign(!showSpecialityAssign)}>
                                Asignar especialidad
                            </button>
                            <button className="institutions-add-btn" onClick={() => setShowForm(!showForm)}>
                                + Nueva institución
                            </button>
                        </div>

                        <Drawer open={Boolean(showSpecialityAssign)} onClose={() => setShowSpecialityAssign(false)} title="Asignar Especialidad a Institución" size="md">
                            <form className="institutions-form" onSubmit={handleAssignSpeciality}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Institución</label>
                                        <select aria-label="Institución" value={specialityForm.institutionId} onChange={(e) => setSpecialityForm(p => ({ ...p, institutionId: e.target.value }))} required>
                                            <option value="">Selecciona una institución</option>
                                            {institutions.map((inst) => (
                                                <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Especialidad</label>
                                        <select aria-label="Especialidad" value={specialityForm.specialityId} onChange={(e) => setSpecialityForm(p => ({ ...p, specialityId: e.target.value }))} required>
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
                            </Drawer>

                        <Drawer open={Boolean(showForm)} onClose={() => setShowForm(false)} title="Registrar nueva institución" size="lg">
                            <form className="institutions-form" onSubmit={handleSubmit}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={form.name} onChange={(e) => handleFieldChange('name', e.target.value)} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Tipo de institución</label>
                                        <select aria-label="Tipo de institución" value={form.institutionTypeId} onChange={(e) => handleFieldChange('institutionTypeId', e.target.value)} required>
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
                                        <select aria-label="Estado" value={selectedStateId} onChange={(e) => { setSelectedStateId(e.target.value); handleFieldChange('cityId', '') }} required>
                                            <option value="">Selecciona un estado</option>
                                            {states.map((s) => (
                                                <option key={s.state_id} value={s.state_id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Ciudad</label>
                                        <select aria-label="Ciudad" value={form.cityId} onChange={(e) => handleFieldChange('cityId', e.target.value)} disabled={!selectedStateId} required>
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
                            </Drawer>

                        {!loaded && <SkeletonCards count={3} />}
                        <div className="institutions-grid" hidden={!loaded}>
                            {filterByStatus(institutions, institutionsFilter).map((inst) => (
                                <div key={inst.institution_id} className="institution-admin-card">
                                    <div className="institution-admin-header">
                                        <h2>{inst.name}</h2>
                                        <span className={`institutions-status ${inst.is_active ? 'status-active' : 'status-inactive'}`}>
                                            {inst.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                        <span className={`institutions-status ${inst.is_crum_institution ? 'status-crum' : 'status-not-crum'}`}>
                                            {inst.is_crum_institution ? 'CRUM' : 'No CRUM'}
                                        </span>
                                    </div>

                                    <p className="institution-admin-sub">
                                        {[institutionTypes.find(t => t.institution_type_id === inst.institution_type_id)?.institution_type, inst.street_address].filter(Boolean).join(' · ')}
                                    </p>

                                    <div className="institution-admin-beds">
                                        <span className="beds-current"><AnimatedNumber value={inst.available_beds} /></span>
                                        <span className="beds-total">/ {inst.bed_capacity} camas libres</span>
                                    </div>
                                    <div className="beds-bar" role="img" aria-label={`${inst.available_beds} de ${inst.bed_capacity} camas libres`}>
                                        <span style={{ width: `${Math.min(100, Math.max(0, (Number(inst.available_beds) / (Number(inst.bed_capacity) || 1)) * 100))}%` }} />
                                    </div>

                                    <div className="institution-admin-specialities">
                                        {specialitiesForInstitution(inst.institution_id).length === 0 ? (
                                            <span className="no-specialities">Sin especialidades asignadas</span>
                                        ) : (
                                            specialitiesForInstitution(inst.institution_id).map((s) => (
                                                <Fragment key={s.institution_speciality_id}>
                                                    <div className="speciality-chip-row">
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
                                                            aria-label="Editar camas de esta especialidad"
                                                        >
                                                            <Icon name="edit" size={14} />
                                                        </button>
                                                    </div>
                                                    <Modal open={editingSpecialityBeds === s.institution_speciality_id} onClose={() => setEditingSpecialityBeds(null)} title="Camas de la especialidad" subtitle={`${specialityNameById(s.speciality_id)} · ${inst.name}`} size="sm">
                                                        <form className="institutions-form" onSubmit={(e) => handleUpdateSpecialityBeds(e, s.institution_speciality_id)}>
                                                            <p className="institutions-form-hint">La capacidad es la que reporta este servicio y puede traslaparse con la de otras especialidades.</p>
                                                            <div className="institutions-form-row">
                                                                <div className="institutions-field">
                                                                    <label htmlFor={`scap-${s.institution_speciality_id}`}>Capacidad total</label>
                                                                    <input id={`scap-${s.institution_speciality_id}`} type="number" min="0" value={specialityCapacityValue} onChange={(e) => setSpecialityCapacityValue(e.target.value)} required />
                                                                </div>
                                                                <div className="institutions-field">
                                                                    <label htmlFor={`sfree-${s.institution_speciality_id}`}>Libres ahora</label>
                                                                    <input id={`sfree-${s.institution_speciality_id}`} type="number" min="0" value={specialityBedsValue} onChange={(e) => setSpecialityBedsValue(e.target.value)} required />
                                                                </div>
                                                            </div>
                                                            <div className="institutions-form-actions">
                                                                <button type="submit" className="institutions-form-submit">Guardar camas</button>
                                                                <button type="button" className="institutions-form-cancel" onClick={() => setEditingSpecialityBeds(null)}>Cancelar</button>
                                                            </div>
                                                        </form>
                                                    </Modal>
                                                </Fragment>
                                            ))
                                        )}
                                    </div>

                                    <Drawer open={Boolean(editingInstitution === inst.institution_id)} onClose={() => setEditingInstitution(null)} title="Editar institución" size="md">
                                        <form className="institutions-form" onSubmit={handleUpdateInstitution}>
                                            <div className="institutions-form-row">
                                                <div className="institutions-field">
                                                    <label>Nombre</label>
                                                    <input type="text" value={editInstitutionForm.name} onChange={(e) => setEditInstitutionForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                                </div>
                                                <div className="institutions-field">
                                                    <label>Tipo de institución</label>
                                                    <select aria-label="Tipo de institución" value={editInstitutionForm.institutionTypeId} onChange={(e) => setEditInstitutionForm(p => ({ ...p, institutionTypeId: e.target.value }))} required>
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
                                        </Drawer>

                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openBedsForm(inst)}>Editar camas</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[
                                            { label: 'Editar institución', onClick: () => openEditInstitution(inst) },
                                            { label: inst.is_crum_institution ? 'Quitar de CRUM' : 'Marcar como CRUM', onClick: () => handleToggleCrum(inst) },
                                            { label: inst.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleActive(inst), danger: Boolean(inst.is_active) },
                                        ]} />
                                    </div>
                                    <Modal open={showBedsForm === inst.institution_id} onClose={() => setShowBedsForm(null)} title="Camas de la institución" subtitle={inst.name} size="sm">
                                        <form className="institutions-form" onSubmit={(e) => handleUpdateBeds(e, inst.institution_id)}>
                                            <div className="institutions-form-row">
                                                <div className="institutions-field">
                                                    <label htmlFor={`cap-${inst.institution_id}`}>Capacidad total</label>
                                                    <input id={`cap-${inst.institution_id}`} type="number" min="0" value={capacityValue} onChange={(e) => setCapacityValue(e.target.value)} required />
                                                    <p className="field-hint">Camas físicas del hospital.</p>
                                                </div>
                                                <div className="institutions-field">
                                                    <label htmlFor={`free-${inst.institution_id}`}>Libres ahora</label>
                                                    <input id={`free-${inst.institution_id}`} type="number" min="0" value={bedsValue} onChange={(e) => setBedsValue(e.target.value)} required />
                                                    <p className="field-hint">Disponibles en este momento.</p>
                                                </div>
                                            </div>
                                            <div className="institutions-form-actions">
                                                <button type="submit" className="institutions-form-submit">Guardar camas</button>
                                                <button type="button" className="institutions-form-cancel" onClick={() => setShowBedsForm(null)}>Cancelar</button>
                                            </div>
                                        </form>
                                    </Modal>
                                </div>
                            ))}
                        </div>

                        {loaded && filterByStatus(institutions, institutionsFilter).length === 0 && <p className="institutions-empty">No hay instituciones que coincidan con el filtro.</p>}
                    </>
                )}

                {/* ── TAB: ESPECIALIDADES ─────────────────────────────── */}
                {activeTab === 'Especialidades' && (
                    <>
                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={specialitiesFilter} onChange={(e) => setSpecialitiesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowNewSpeciality(!showNewSpeciality)}>
                                + Nueva especialidad
                            </button>
                        </div>

                        <Drawer open={Boolean(showNewSpeciality)} onClose={() => setShowNewSpeciality(false)} title="Crear nueva especialidad" size="md">
                            <form className="institutions-form" onSubmit={handleCreateSpeciality}>
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
                            </Drawer>

                        <Drawer open={Boolean(editingSpeciality !== null)} onClose={() => setEditingSpeciality(null)} title="Editar especialidad" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateSpeciality}>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(specialities, specialitiesFilter).map((sp) => {
                                const hospitals = institutionSpecialities.filter(r => r.speciality_id === sp.speciality_id && r.is_active).length
                                return (
                                    <article key={sp.speciality_id} className={`entity acc-route${sp.is_active ? '' : ' is-off'}`}>
                                        <div className="entity-head">
                                            <div className="entity-titles">
                                                <h2 className="entity-title">{sp.name}</h2>
                                                <p className="entity-sub">{sp.description || 'Sin descripción'}</p>
                                            </div>
                                            <span className={`pill ${sp.is_active ? 'pill-ok' : 'pill-warn'}`}>{sp.is_active ? 'Activa' : 'Inactiva'}</span>
                                        </div>
                                        <dl className="entity-facts">
                                            <div><dt>Instituciones que la ofrecen</dt><dd>{hospitals}</dd></div>
                                        </dl>
                                        <div className="entity-actions">
                                            <button type="button" className="institutions-edit-btn" onClick={() => openEditSpeciality(sp)}>Editar</button>
                                            <span className="spacer" />
                                            <MoreMenu items={[{ label: sp.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleSpeciality(sp), danger: Boolean(sp.is_active) }]} />
                                        </div>
                                    </article>
                                )
                            })}
                            {filterByStatus(specialities, specialitiesFilter).length === 0 && <p className="entity-empty">No hay especialidades que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: TIPOS DE INSTITUCIÓN ─────────────────────────────── */}
                {activeTab === 'Tipos' && (
                    <>
                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={typesFilter} onChange={(e) => setTypesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowNewType(!showNewType)}>
                                + Nuevo tipo
                            </button>
                        </div>

                        <Drawer open={Boolean(showNewType)} onClose={() => setShowNewType(false)} title="Crear Nuevo Tipo de Institución" size="md">
                            <form className="institutions-form" onSubmit={handleCreateType}>
                                <div className="institutions-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={newTypeForm.institutionType} onChange={(e) => setNewTypeForm({ institutionType: e.target.value })} maxLength={100} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Crear tipo</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowNewType(false)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <Drawer open={Boolean(editingType !== null)} onClose={() => setEditingType(null)} title="Editar Tipo de Institución" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateType}>
                                <div className="institutions-field">
                                    <label>Nombre del tipo</label>
                                    <input type="text" value={editTypeForm.institutionType} onChange={(e) => setEditTypeForm(p => ({ ...p, institutionType: e.target.value }))} maxLength={100} required />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingType(null)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {filterByStatus(institutionTypes, typesFilter).map((t) => {
                                const count = institutions.filter(i => i.institution_type_id === t.institution_type_id).length
                                return (
                                    <article key={t.institution_type_id} className={`entity acc-route${t.is_active ? '' : ' is-off'}`}>
                                        <div className="entity-head">
                                            <div className="entity-titles">
                                                <h2 className="entity-title">{t.institution_type}</h2>
                                                <p className="entity-sub">{count} {count === 1 ? 'institución' : 'instituciones'}</p>
                                            </div>
                                            <span className={`pill ${t.is_active ? 'pill-ok' : 'pill-warn'}`}>{t.is_active ? 'Activo' : 'Inactivo'}</span>
                                        </div>
                                        <div className="entity-actions">
                                            <button type="button" className="institutions-edit-btn" onClick={() => openEditType(t)}>Editar</button>
                                            <span className="spacer" />
                                            <MoreMenu items={[{ label: t.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleType(t), danger: Boolean(t.is_active) }]} />
                                        </div>
                                    </article>
                                )
                            })}
                            {filterByStatus(institutionTypes, typesFilter).length === 0 && <p className="entity-empty">No hay tipos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: NOTIFICACIONES ─────────────────────────────── */}
                {activeTab === 'Notificaciones' && (
                    <>
                        <div className="institutions-tab-header">
                            <button className="institutions-add-btn" onClick={() => setShowNotificationForm(!showNotificationForm)}>
                                + Nueva notificación
                            </button>
                        </div>

                        <Drawer open={Boolean(showNotificationForm)} onClose={() => setShowNotificationForm(false)} title="Nueva Notificación de Institución" size="md">
                            <form className="institutions-form" onSubmit={handleCreateNotification}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Institución</label>
                                        <select aria-label="Institución" value={notificationForm.institutionId} onChange={(e) => setNotificationForm(p => ({ ...p, institutionId: e.target.value }))} required>
                                            <option value="">Selecciona una institución</option>
                                            {institutions.map((inst) => (
                                                <option key={inst.institution_id} value={inst.institution_id}>{inst.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Emergencia relacionada</label>
                                        <select aria-label="Emergencia relacionada" value={notificationForm.emergencyId} onChange={(e) => setNotificationForm(p => ({ ...p, emergencyId: e.target.value }))} required>
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
                            </Drawer>

                        <div className="entity-grid entity-grid-sm">
                            {notifications.map((n) => (
                                <article key={n.institution_notification_id} className="entity acc-route">
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{n.institution_name}</h2>
                                            <p className="entity-sub">{n.emergency_type_name ? `${n.emergency_type_name} — ${n.emergency_description}` : `Emergencia #${n.emergency_id}`}</p>
                                        </div>
                                    </div>
                                    <dl className="entity-facts">
                                        <div><dt>Llegada estimada</dt><dd>{n.estimated_arrival ? new Date(n.estimated_arrival).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd></div>
                                        <div><dt>Notas</dt><dd>{n.notes || '—'}</dd></div>
                                    </dl>
                                </article>
                            ))}
                            {notifications.length === 0 && <p className="entity-empty">No hay notificaciones registradas.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Institutions;