import { useEffect, useState } from 'react';
import { roleLabel } from '../../config/roles'
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import './Institutions.css';
import './Patients.css';
import {API_BASE_URL} from '../../config/api'
import { useDialogs } from '../../context/useDialogs'
import MoreMenu from '../../components/ui/MoreMenu'
import '../../styles/entities.css'
import { Drawer } from '../../components/ui/Overlay'


const emptyRecordForm = {
    userProfileId: '', bloodTypeId: '', weight: '', height: '', gender: '', birthplace: '',
    maritalStatus: '', occupation: '', religion: '', notes: '',
}
const emptyEditRecordForm = {
    clinicalRecordId: '', bloodTypeId: '', weight: '', height: '', gender: '', birthplace: '',
    maritalStatus: '', occupation: '', religion: '', notes: '',
}
const emptyAllergyForm = { clinicalRecordId: '', name: '', severity: '' }
const emptyEditAllergyForm = { patientAllergyId: '', name: '', severity: '' }
const emptyConditionForm = { clinicalRecordId: '', name: '', diagnosedAt: '', notes: '' }
const emptyEditConditionForm = { patientConditionId: '', name: '', diagnosedAt: '', notes: '' }
const emptyMedicationForm = { clinicalRecordId: '', name: '', dosage: '', frequency: '' }
const emptyEditMedicationForm = { patientMedicationId: '', name: '', dosage: '', frequency: '' }

const TABS = ['Expedientes clínicos', 'Alergias', 'Condiciones', 'Medicamentos']

const patientLabel = (row) => {
    const name = [row.first_name, row.first_surname, row.second_surname].filter(Boolean).join(' ')
    return row.curp ? `${name} (${row.curp})` : (name || `ID ${row.user_profile_id}`)
}

const matchesSearch = (row, query, mode = 'all') => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    const name = [row.first_name, row.first_surname, row.second_surname].filter(Boolean).join(' ').toLowerCase()
    const curp = (row.curp || '').toLowerCase()
    const id = String(row.user_profile_id || '')
    if (mode === 'curp') return curp.includes(q)
    if (mode === 'name') return name.includes(q)
    if (mode === 'id') return id.includes(q)
    return curp.includes(q) || name.includes(q) || id.includes(q)
}

const Patients = () => {
    const { notify, confirm } = useDialogs()
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Expedientes clínicos')

    const [bloodTypes, setBloodTypes] = useState([]);
    const [clinicalRecords, setClinicalRecords] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [conditions, setConditions] = useState([]);
    const [medications, setMedications] = useState([]);

    // Búsqueda de texto por pestaña — filtra en el cliente lo ya cargado, no hace fetch
    const [recordSearch, setRecordSearch] = useState('');
    const [recordSearchMode, setRecordSearchMode] = useState('all');
    const [allergySearch, setAllergySearch] = useState('');
    const [allergySearchMode, setAllergySearchMode] = useState('all');
    const [conditionSearch, setConditionSearch] = useState('');
    const [conditionSearchMode, setConditionSearchMode] = useState('all');
    const [medicationSearch, setMedicationSearch] = useState('');
    const [medicationSearchMode, setMedicationSearchMode] = useState('all');

    const clearRecordSearch = () => { setRecordSearch(''); setRecordSearchMode('all') }
    const clearAllergySearch = () => { setAllergySearch(''); setAllergySearchMode('all') }
    const clearConditionSearch = () => { setConditionSearch(''); setConditionSearchMode('all') }
    const clearMedicationSearch = () => { setMedicationSearch(''); setMedicationSearchMode('all') }

    // Filtros por estado (Todos / Activos / Inactivos)
    const [allergiesFilter, setAllergiesFilter] = useState('all');
    const [conditionsFilter, setConditionsFilter] = useState('all');
    const [medicationsFilter, setMedicationsFilter] = useState('all');

    const filterByStatus = (list, filter) => {
        if (filter === 'active') return list.filter(item => item.is_active)
        if (filter === 'inactive') return list.filter(item => !item.is_active)
        return list
    }

    // Expedientes: crear / editar
    const [showRecordForm, setShowRecordForm] = useState(false);
    const [recordForm, setRecordForm] = useState(emptyRecordForm);
    const [curpLookup, setCurpLookup] = useState('');
    const [curpLookupBusy, setCurpLookupBusy] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [editRecordForm, setEditRecordForm] = useState(emptyEditRecordForm);

    // Alergias: crear / editar
    const [showAllergyForm, setShowAllergyForm] = useState(false);
    const [allergyForm, setAllergyForm] = useState(emptyAllergyForm);
    const [editingAllergy, setEditingAllergy] = useState(null);
    const [editAllergyForm, setEditAllergyForm] = useState(emptyEditAllergyForm);

    // Condiciones: crear / editar
    const [showConditionForm, setShowConditionForm] = useState(false);
    const [conditionForm, setConditionForm] = useState(emptyConditionForm);
    const [editingCondition, setEditingCondition] = useState(null);
    const [editConditionForm, setEditConditionForm] = useState(emptyEditConditionForm);

    // Medicamentos: crear / editar
    const [showMedicationForm, setShowMedicationForm] = useState(false);
    const [medicationForm, setMedicationForm] = useState(emptyMedicationForm);
    const [editingMedication, setEditingMedication] = useState(null);
    const [editMedicationForm, setEditMedicationForm] = useState(emptyEditMedicationForm);

    // Historial de activaciones/desactivaciones
    const [historyAllergyId, setHistoryAllergyId] = useState(null);
    const [allergyHistory, setAllergyHistory] = useState([]);
    const [historyConditionId, setHistoryConditionId] = useState(null);
    const [conditionHistory, setConditionHistory] = useState([]);
    const [historyMedicationId, setHistoryMedicationId] = useState(null);
    const [medicationHistory, setMedicationHistory] = useState([]);

    //---------------------------------consultar, gets--------------------------------------------------

    useEffect(() => {
        fetch(`${API_BASE_URL}/pacientes/tipos-sangre`, { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ bloodTypes }) => setBloodTypes((bloodTypes || []).map(b => toLowerCaseKeys(b))))
            .catch(error => console.error('Error consultando tipos de sangre. ', error))
    }, []);

    const fetchClinicalRecords = () => {
        fetch(`${API_BASE_URL}/pacientes/expedientes-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ clinicalRecords }) => setClinicalRecords((clinicalRecords || []).map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando expedientes. ', error))
    }
    useEffect(() => { fetchClinicalRecords() }, []);

    const fetchAllergies = () => {
        fetch(`${API_BASE_URL}/pacientes/alergias-todas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ allergies }) => setAllergies((allergies || []).map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando alergias. ', error))
    }
    useEffect(() => { fetchAllergies() }, []);

    const fetchConditions = () => {
        fetch(`${API_BASE_URL}/pacientes/condiciones-todas`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ conditions }) => setConditions((conditions || []).map(c => toLowerCaseKeys(c))))
            .catch(error => console.error('Error consultando condiciones. ', error))
    }
    useEffect(() => { fetchConditions() }, []);

    const fetchMedications = () => {
        fetch(`${API_BASE_URL}/pacientes/medicamentos-todos`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ medications }) => setMedications((medications || []).map(m => toLowerCaseKeys(m))))
            .catch(error => console.error('Error consultando medicamentos. ', error))
    }
    useEffect(() => { fetchMedications() }, []);

    const toggleAllergyHistory = (a) => {
        if (historyAllergyId === a.patient_allergy_id) { setHistoryAllergyId(null); setAllergyHistory([]); return }
        setHistoryAllergyId(a.patient_allergy_id)
        fetch(`${API_BASE_URL}/pacientes/historial-alergia/${a.patient_allergy_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setAllergyHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de alergia. ', error); notify(error.message, 'error') })
    }

    const toggleConditionHistory = (c) => {
        if (historyConditionId === c.patient_condition_id) { setHistoryConditionId(null); setConditionHistory([]); return }
        setHistoryConditionId(c.patient_condition_id)
        fetch(`${API_BASE_URL}/pacientes/historial-condicion/${c.patient_condition_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setConditionHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de condición. ', error); notify(error.message, 'error') })
    }

    const toggleMedicationHistory = (m) => {
        if (historyMedicationId === m.patient_medication_id) { setHistoryMedicationId(null); setMedicationHistory([]); return }
        setHistoryMedicationId(m.patient_medication_id)
        fetch(`${API_BASE_URL}/pacientes/historial-medicamento/${m.patient_medication_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setMedicationHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de medicamento. ', error); notify(error.message, 'error') })
    }

    //---------------------------------expedientes: crear / editar--------------------------------------------------

    const handleResolveCurp = () => {
        if (!curpLookup.trim()) return
        setCurpLookupBusy(true)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${encodeURIComponent(curpLookup.trim())}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => {
                const rows = (data || []).map(u => toLowerCaseKeys(u))
                if (rows.length === 0) { notify('No se encontró ningún usuario con ese CURP.', 'error'); return }
                setRecordForm(p => ({ ...p, userProfileId: rows[0].user_profile_id }))
            })
            .catch(error => console.error('Error buscando CURP. ', error))
            .finally(() => setCurpLookupBusy(false))
    }

    const handleCreateRecord = (e) => {
        e.preventDefault();
        // El backend ya distingue este duplicado con un 409 amigable ("Este usuario ya tiene
        // un expediente."), a diferencia de los catálogos con nombre — no aplica blockIfDuplicate
        // aquí porque los expedientes no tienen concepto de "inactivo" que reactivar.
        fetch(`${API_BASE_URL}/pacientes/crear-ece`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                userProfileId: recordForm.userProfileId,
                bloodTypeId: recordForm.bloodTypeId || null,
                weight: recordForm.weight, height: recordForm.height, gender: recordForm.gender,
                birthplace: recordForm.birthplace, maritalStatus: recordForm.maritalStatus,
                occupation: recordForm.occupation, religion: recordForm.religion, notes: recordForm.notes,
            })
        })
            .then(parseResponse)
            .then(() => { setRecordForm(emptyRecordForm); setCurpLookup(''); setShowRecordForm(false); fetchClinicalRecords(); })
            .catch(error => { console.error('Error registrando expediente. ', error); notify(error.message, 'error') })
    }

    const openEditRecord = (r) => {
        setEditingRecord(r.clinical_record_id)
        setEditRecordForm({
            clinicalRecordId: r.clinical_record_id,
            bloodTypeId: r.blood_type_id || '',
            weight: r.weight ?? '', height: r.height ?? '', gender: r.gender || '',
            birthplace: r.birthplace || '', maritalStatus: r.marital_status || '',
            occupation: r.occupation || '', religion: r.religion || '', notes: r.notes || '',
        })
    }

    const handleUpdateRecord = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/pacientes/actualizar-ece`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editRecordForm)
        })
            .then(parseResponse)
            .then(() => { setEditingRecord(null); fetchClinicalRecords(); })
            .catch(error => { console.error('Error actualizando expediente. ', error); notify(error.message, 'error') })
    }

    //---------------------------------alergias: crear / editar / alternar--------------------------------------------------

    const handleCreateAllergy = (e) => {
        e.preventDefault();
        const sameRecord = allergies.filter(a => String(a.clinical_record_id) === String(allergyForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', allergyForm.name, 'nombre de alergia para este paciente')) return
        fetch(`${API_BASE_URL}/pacientes/registrar-alergia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ clinicalRecordId: allergyForm.clinicalRecordId, name: allergyForm.name, severity: allergyForm.severity })
        })
            .then(parseResponse)
            .then(() => { setAllergyForm(emptyAllergyForm); setShowAllergyForm(false); fetchAllergies(); })
            .catch(error => { console.error('Error registrando alergia. ', error); notify(error.message, 'error') })
    }

    const openEditAllergy = (a) => {
        setEditingAllergy(a.patient_allergy_id)
        setEditAllergyForm({ patientAllergyId: a.patient_allergy_id, name: a.name || '', severity: a.severity || '' })
    }

    const handleUpdateAllergy = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/pacientes/actualizar-alergia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editAllergyForm)
        })
            .then(parseResponse)
            .then(() => { setEditingAllergy(null); fetchAllergies(); })
            .catch(error => { console.error('Error actualizando alergia. ', error); notify(error.message, 'error') })
    }

    const handleToggleAllergy = async (a) => {
        const action = a.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} la alergia "${a.name}" de ${patientLabel(a)}?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/pacientes/alternar-alergia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientAllergyId: a.patient_allergy_id })
        })
            .then(parseResponse)
            .then(() => fetchAllergies())
            .catch(error => { console.error('Error cambiando estado de alergia. ', error); notify(error.message, 'error') })
    }

    //---------------------------------condiciones: crear / editar / alternar--------------------------------------------------

    const handleCreateCondition = (e) => {
        e.preventDefault();
        const sameRecord = conditions.filter(c => String(c.clinical_record_id) === String(conditionForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', conditionForm.name, 'nombre de condición para este paciente')) return
        fetch(`${API_BASE_URL}/pacientes/registrar-condicion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                clinicalRecordId: conditionForm.clinicalRecordId, name: conditionForm.name,
                diagnosedAt: conditionForm.diagnosedAt, notes: conditionForm.notes,
            })
        })
            .then(parseResponse)
            .then(() => { setConditionForm(emptyConditionForm); setShowConditionForm(false); fetchConditions(); })
            .catch(error => { console.error('Error registrando condición. ', error); notify(error.message, 'error') })
    }

    const openEditCondition = (c) => {
        setEditingCondition(c.patient_condition_id)
        setEditConditionForm({
            patientConditionId: c.patient_condition_id, name: c.name || '',
            diagnosedAt: c.diagnosed_at ? c.diagnosed_at.split('T')[0] : '', notes: c.notes || '',
        })
    }

    const handleUpdateCondition = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/pacientes/actualizar-condicion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editConditionForm)
        })
            .then(parseResponse)
            .then(() => { setEditingCondition(null); fetchConditions(); })
            .catch(error => { console.error('Error actualizando condición. ', error); notify(error.message, 'error') })
    }

    const handleToggleCondition = async (c) => {
        const action = c.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} la condición "${c.name}" de ${patientLabel(c)}?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/pacientes/alternar-condicion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientConditionId: c.patient_condition_id })
        })
            .then(parseResponse)
            .then(() => fetchConditions())
            .catch(error => { console.error('Error cambiando estado de condición. ', error); notify(error.message, 'error') })
    }

    //---------------------------------medicamentos: crear / editar / alternar--------------------------------------------------

    const handleCreateMedication = (e) => {
        e.preventDefault();
        const sameRecord = medications.filter(m => String(m.clinical_record_id) === String(medicationForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', medicationForm.name, 'nombre de medicamento para este paciente')) return
        fetch(`${API_BASE_URL}/pacientes/registrar-medicacion`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                clinicalRecordId: medicationForm.clinicalRecordId, name: medicationForm.name,
                dosage: medicationForm.dosage, frequency: medicationForm.frequency,
            })
        })
            .then(parseResponse)
            .then(() => { setMedicationForm(emptyMedicationForm); setShowMedicationForm(false); fetchMedications(); })
            .catch(error => { console.error('Error registrando medicamento. ', error); notify(error.message, 'error') })
    }

    const openEditMedication = (m) => {
        setEditingMedication(m.patient_medication_id)
        setEditMedicationForm({ patientMedicationId: m.patient_medication_id, name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '' })
    }

    const handleUpdateMedication = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/pacientes/actualizar-medicacion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editMedicationForm)
        })
            .then(parseResponse)
            .then(() => { setEditingMedication(null); fetchMedications(); })
            .catch(error => { console.error('Error actualizando medicamento. ', error); notify(error.message, 'error') })
    }

    const handleToggleMedication = async (m) => {
        const action = m.is_active ? 'desactivar' : 'activar'
        if (!(await confirm({ title: 'Confirmar', message: `¿Seguro que quieres ${action} el medicamento "${m.name}" de ${patientLabel(m)}?`, confirmLabel: 'Sí, continuar', danger: false }))) return
        fetch(`${API_BASE_URL}/pacientes/alternar-medicacion`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientMedicationId: m.patient_medication_id })
        })
            .then(parseResponse)
            .then(() => fetchMedications())
            .catch(error => { console.error('Error cambiando estado de medicamento. ', error); notify(error.message, 'error') })
    }

    const bloodTypeNameById = (id) => bloodTypes.find(b => b.blood_type_id === id)?.blood_type || '—'

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabel(user?.roleId)} links={navLinks} />

            <div role="main" id="contenido" className="institutions-body">
                <h1 className="institutions-title">Gestión de pacientes</h1>

                <div className="institutions-tabs">
                    {TABS.map((tab) => (
                        <button key={tab} className={`institutions-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ── TAB: EXPEDIENTES CLÍNICOS ─────────────────────────────── */}
                {activeTab === 'Expedientes clínicos' && (
                    <>
                        <div className="patient-search-row">
                            <select aria-label="Buscar por" value={recordSearchMode} onChange={(e) => setRecordSearchMode(e.target.value)}>
                                <option value="all">Todos los campos</option>
                                <option value="curp">CURP</option>
                                <option value="name">Nombre</option>
                                <option value="id">ID de perfil</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Filtrar expedientes..."
                                value={recordSearch}
                                onChange={(e) => setRecordSearch(e.target.value)}
                            />
                            {(recordSearch || recordSearchMode !== 'all') && (
                                <button type="button" className="patient-clear-btn" onClick={clearRecordSearch}>Limpiar</button>
                            )}
                        </div>

                        <div className="institutions-tab-header">
                            <button className="institutions-add-btn" onClick={() => setShowRecordForm(!showRecordForm)}>
                                + Nuevo expediente
                            </button>
                        </div>

                        <Drawer open={Boolean(showRecordForm)} onClose={() => setShowRecordForm(false)} title="Registrar expediente clínico" size="md">
                            <form className="institutions-form" onSubmit={handleCreateRecord}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>ID de perfil del paciente</label>
                                        <input type="number" value={recordForm.userProfileId} onChange={(e) => setRecordForm(p => ({ ...p, userProfileId: e.target.value }))} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>O autocompletar por CURP</label>
                                        <div className="patient-search-form">
                                            <input type="text" placeholder="CURP..." value={curpLookup} onChange={(e) => setCurpLookup(e.target.value)} maxLength={18} />
                                            <button type="button" onClick={handleResolveCurp} disabled={curpLookupBusy}>{curpLookupBusy ? '...' : 'Buscar'}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Tipo de sangre</label>
                                        <select aria-label="Tipo de sangre" value={recordForm.bloodTypeId} onChange={(e) => setRecordForm(p => ({ ...p, bloodTypeId: e.target.value }))}>
                                            <option value="">Sin especificar</option>
                                            {bloodTypes.map((b) => (<option key={b.blood_type_id} value={b.blood_type_id}>{b.blood_type}</option>))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Género</label>
                                        <input type="text" value={recordForm.gender} onChange={(e) => setRecordForm(p => ({ ...p, gender: e.target.value }))} maxLength={20} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Peso (kg)</label>
                                        <input type="number" step="0.01" min="0" value={recordForm.weight} onChange={(e) => setRecordForm(p => ({ ...p, weight: e.target.value }))} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Estatura (cm)</label>
                                        <input type="number" step="0.01" min="0" value={recordForm.height} onChange={(e) => setRecordForm(p => ({ ...p, height: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Lugar de nacimiento</label>
                                        <input type="text" value={recordForm.birthplace} onChange={(e) => setRecordForm(p => ({ ...p, birthplace: e.target.value }))} maxLength={100} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Estado civil</label>
                                        <input type="text" value={recordForm.maritalStatus} onChange={(e) => setRecordForm(p => ({ ...p, maritalStatus: e.target.value }))} maxLength={20} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Ocupación</label>
                                        <input type="text" value={recordForm.occupation} onChange={(e) => setRecordForm(p => ({ ...p, occupation: e.target.value }))} maxLength={100} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Religión</label>
                                        <input type="text" value={recordForm.religion} onChange={(e) => setRecordForm(p => ({ ...p, religion: e.target.value }))} maxLength={100} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Notas</label>
                                    <input type="text" value={recordForm.notes} onChange={(e) => setRecordForm(p => ({ ...p, notes: e.target.value }))} maxLength={500} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Registrar expediente</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowRecordForm(false)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <Drawer open={Boolean(editingRecord !== null)} onClose={() => setEditingRecord(null)} title="Editar expediente clínico" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateRecord}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Tipo de sangre</label>
                                        <select aria-label="Tipo de sangre" value={editRecordForm.bloodTypeId} onChange={(e) => setEditRecordForm(p => ({ ...p, bloodTypeId: e.target.value }))}>
                                            <option value="">Sin especificar</option>
                                            {bloodTypes.map((b) => (<option key={b.blood_type_id} value={b.blood_type_id}>{b.blood_type}</option>))}
                                        </select>
                                    </div>
                                    <div className="institutions-field">
                                        <label>Género</label>
                                        <input type="text" value={editRecordForm.gender} onChange={(e) => setEditRecordForm(p => ({ ...p, gender: e.target.value }))} maxLength={20} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Peso (kg)</label>
                                        <input type="number" step="0.01" min="0" value={editRecordForm.weight} onChange={(e) => setEditRecordForm(p => ({ ...p, weight: e.target.value }))} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Estatura (cm)</label>
                                        <input type="number" step="0.01" min="0" value={editRecordForm.height} onChange={(e) => setEditRecordForm(p => ({ ...p, height: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Lugar de nacimiento</label>
                                        <input type="text" value={editRecordForm.birthplace} onChange={(e) => setEditRecordForm(p => ({ ...p, birthplace: e.target.value }))} maxLength={100} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Estado civil</label>
                                        <input type="text" value={editRecordForm.maritalStatus} onChange={(e) => setEditRecordForm(p => ({ ...p, maritalStatus: e.target.value }))} maxLength={20} />
                                    </div>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Ocupación</label>
                                        <input type="text" value={editRecordForm.occupation} onChange={(e) => setEditRecordForm(p => ({ ...p, occupation: e.target.value }))} maxLength={100} />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Religión</label>
                                        <input type="text" value={editRecordForm.religion} onChange={(e) => setEditRecordForm(p => ({ ...p, religion: e.target.value }))} maxLength={100} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Notas</label>
                                    <input type="text" value={editRecordForm.notes} onChange={(e) => setEditRecordForm(p => ({ ...p, notes: e.target.value }))} maxLength={500} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingRecord(null)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <div className="entity-grid">
                            {clinicalRecords.filter(r => matchesSearch(r, recordSearch, recordSearchMode)).map((r) => {
                                const name = [r.first_name, r.first_surname, r.second_surname].filter(Boolean).join(' ') || `ID ${r.user_profile_id}`
                                const blood = r.blood_type || bloodTypeNameById(r.blood_type_id)
                                const heightNum = Number(r.height)
                                const heightText = r.height === null || r.height === undefined || r.height === '' || Number.isNaN(heightNum) ? '—' : (heightNum < 3 ? `${heightNum} m` : `${heightNum} cm`)
                                const weightNum = Number(r.weight)
                                return (
                                    <article key={r.clinical_record_id} className="entity acc-hospital" aria-label={name}>
                                        <div className="entity-head">
                                            <span className="entity-avatar" aria-hidden="true">{blood || '?'}</span>
                                            <div className="entity-titles">
                                                <h2 className="entity-title">{name}</h2>
                                                <p className="entity-sub">CURP <span className="mono">{r.curp || 'sin registrar'}</span></p>
                                            </div>
                                        </div>
                                        <dl className="entity-facts">
                                            <div><dt>Tipo de sangre</dt><dd>{blood || 'Sin dato'}</dd></div>
                                            <div><dt>Peso</dt><dd>{r.weight === null || r.weight === undefined || Number.isNaN(weightNum) ? '—' : `${weightNum} kg`}</dd></div>
                                            <div><dt>Estatura</dt><dd>{heightText}</dd></div>
                                        </dl>
                                        <div className="entity-actions">
                                            <button type="button" className="institutions-edit-btn" onClick={() => openEditRecord(r)}>Editar expediente</button>
                                        </div>
                                    </article>
                                )
                            })}
                            {clinicalRecords.filter(r => matchesSearch(r, recordSearch, recordSearchMode)).length === 0 && <p className="entity-empty">No hay expedientes que coincidan con la búsqueda.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ALERGIAS ─────────────────────────────── */}
                {activeTab === 'Alergias' && (
                    <>
                        <div className="patient-search-row">
                            <select aria-label="Buscar por" value={allergySearchMode} onChange={(e) => setAllergySearchMode(e.target.value)}>
                                <option value="all">Todos los campos</option>
                                <option value="curp">CURP</option>
                                <option value="name">Nombre</option>
                                <option value="id">ID de perfil</option>
                            </select>
                            <input type="text" placeholder="Filtrar alergias..." value={allergySearch} onChange={(e) => setAllergySearch(e.target.value)} />
                            {(allergySearch || allergySearchMode !== 'all') && (
                                <button type="button" className="patient-clear-btn" onClick={clearAllergySearch}>Limpiar</button>
                            )}
                        </div>

                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={allergiesFilter} onChange={(e) => setAllergiesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowAllergyForm(!showAllergyForm)}>+ Nueva alergia</button>
                        </div>

                        <Drawer open={Boolean(showAllergyForm)} onClose={() => setShowAllergyForm(false)} title="Registrar alergia" size="md">
                            <form className="institutions-form" onSubmit={handleCreateAllergy}>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select aria-label="Paciente" value={allergyForm.clinicalRecordId} onChange={(e) => setAllergyForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
                                        <option value="">Selecciona un paciente</option>
                                        {clinicalRecords.map((r) => (<option key={r.clinical_record_id} value={r.clinical_record_id}>{patientLabel(r)}</option>))}
                                    </select>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={allergyForm.name} onChange={(e) => setAllergyForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Severidad</label>
                                        <input type="text" placeholder="Leve, moderada, severa..." value={allergyForm.severity} onChange={(e) => setAllergyForm(p => ({ ...p, severity: e.target.value }))} maxLength={50} />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Registrar alergia</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowAllergyForm(false)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <Drawer open={Boolean(editingAllergy !== null)} onClose={() => setEditingAllergy(null)} title="Editar alergia" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateAllergy}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editAllergyForm.name} onChange={(e) => setEditAllergyForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Severidad</label>
                                        <input type="text" value={editAllergyForm.severity} onChange={(e) => setEditAllergyForm(p => ({ ...p, severity: e.target.value }))} maxLength={50} />
                                    </div>
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingAllergy(null)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <div className="entity-grid">
                            {filterByStatus(allergies, allergiesFilter).filter(a => matchesSearch(a, allergySearch, allergySearchMode)).map((a) => (
                                <article key={a.patient_allergy_id} className={`entity ${/anafil|grave|sever|cr[ií]tic/i.test(a.severity || '') ? 'acc-admin' : /moder/i.test(a.severity || '') ? 'acc-scene' : 'acc-free'}${a.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{a.name}</h2>
                                            <p className="entity-sub">{patientLabel(a)}</p>
                                        </div>
                                        <span className={`pill ${a.is_active ? 'pill-ok' : 'pill-warn'}`}>{a.is_active ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                    <div className="entity-chips">
                                        <span className={`pill ${/anafil|grave|sever|cr[ií]tic/i.test(a.severity || '') ? 'pill-bad' : /moder/i.test(a.severity || '') ? 'pill-warn' : ''}`}>Gravedad: {a.severity || 'sin dato'}</span>
                                    </div>
                                    {historyAllergyId === a.patient_allergy_id && (
                                        <div className="entity-panel clinical-history">
                                            {allergyHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : allergyHistory.map((h) => (
                                                <span key={h.patient_allergy_history_id}>{h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditAllergy(a)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[
                                            { label: 'Historial de cambios', onClick: () => toggleAllergyHistory(a) },
                                            { label: a.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleAllergy(a), danger: Boolean(a.is_active) },
                                        ]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(allergies, allergiesFilter).filter(a => matchesSearch(a, allergySearch, allergySearchMode)).length === 0 && <p className="entity-empty">No hay alergias que coincidan con la búsqueda.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: CONDICIONES ─────────────────────────────── */}
                {activeTab === 'Condiciones' && (
                    <>
                        <div className="patient-search-row">
                            <select aria-label="Buscar por" value={conditionSearchMode} onChange={(e) => setConditionSearchMode(e.target.value)}>
                                <option value="all">Todos los campos</option>
                                <option value="curp">CURP</option>
                                <option value="name">Nombre</option>
                                <option value="id">ID de perfil</option>
                            </select>
                            <input type="text" placeholder="Filtrar condiciones..." value={conditionSearch} onChange={(e) => setConditionSearch(e.target.value)} />
                            {(conditionSearch || conditionSearchMode !== 'all') && (
                                <button type="button" className="patient-clear-btn" onClick={clearConditionSearch}>Limpiar</button>
                            )}
                        </div>

                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={conditionsFilter} onChange={(e) => setConditionsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowConditionForm(!showConditionForm)}>+ Nueva condición</button>
                        </div>

                        <Drawer open={Boolean(showConditionForm)} onClose={() => setShowConditionForm(false)} title="Registrar condición médica" size="md">
                            <form className="institutions-form" onSubmit={handleCreateCondition}>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select aria-label="Paciente" value={conditionForm.clinicalRecordId} onChange={(e) => setConditionForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
                                        <option value="">Selecciona un paciente</option>
                                        {clinicalRecords.map((r) => (<option key={r.clinical_record_id} value={r.clinical_record_id}>{patientLabel(r)}</option>))}
                                    </select>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={conditionForm.name} onChange={(e) => setConditionForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Fecha de diagnóstico</label>
                                        <input type="date" value={conditionForm.diagnosedAt} onChange={(e) => setConditionForm(p => ({ ...p, diagnosedAt: e.target.value }))} required />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Notas</label>
                                    <input type="text" value={conditionForm.notes} onChange={(e) => setConditionForm(p => ({ ...p, notes: e.target.value }))} maxLength={300} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Registrar condición</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowConditionForm(false)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <Drawer open={Boolean(editingCondition !== null)} onClose={() => setEditingCondition(null)} title="Editar condición médica" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateCondition}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editConditionForm.name} onChange={(e) => setEditConditionForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Fecha de diagnóstico</label>
                                        <input type="date" value={editConditionForm.diagnosedAt} onChange={(e) => setEditConditionForm(p => ({ ...p, diagnosedAt: e.target.value }))} required />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Notas</label>
                                    <input type="text" value={editConditionForm.notes} onChange={(e) => setEditConditionForm(p => ({ ...p, notes: e.target.value }))} maxLength={300} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingCondition(null)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <div className="entity-grid">
                            {filterByStatus(conditions, conditionsFilter).filter(c => matchesSearch(c, conditionSearch, conditionSearchMode)).map((c) => (
                                <article key={c.patient_condition_id} className={`entity acc-scene${c.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{c.name}</h2>
                                            <p className="entity-sub">{patientLabel(c)}</p>
                                        </div>
                                        <span className={`pill ${c.is_active ? 'pill-ok' : 'pill-warn'}`}>{c.is_active ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                    <dl className="entity-facts">
                                        <div><dt>Diagnóstico</dt><dd>{c.diagnosed_at ? new Date(c.diagnosed_at).toLocaleDateString('es-MX', { dateStyle: 'medium' }) : '—'}</dd></div>
                                        <div><dt>Notas</dt><dd>{c.notes || '—'}</dd></div>
                                    </dl>
                                    {historyConditionId === c.patient_condition_id && (
                                        <div className="entity-panel clinical-history">
                                            {conditionHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : conditionHistory.map((h) => (
                                                <span key={h.patient_condition_history_id}>{h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditCondition(c)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[
                                            { label: 'Historial de cambios', onClick: () => toggleConditionHistory(c) },
                                            { label: c.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleCondition(c), danger: Boolean(c.is_active) },
                                        ]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(conditions, conditionsFilter).filter(c => matchesSearch(c, conditionSearch, conditionSearchMode)).length === 0 && <p className="entity-empty">No hay condiciones que coincidan con la búsqueda.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: MEDICAMENTOS ─────────────────────────────── */}
                {activeTab === 'Medicamentos' && (
                    <>
                        <div className="patient-search-row">
                            <select aria-label="Buscar por" value={medicationSearchMode} onChange={(e) => setMedicationSearchMode(e.target.value)}>
                                <option value="all">Todos los campos</option>
                                <option value="curp">CURP</option>
                                <option value="name">Nombre</option>
                                <option value="id">ID de perfil</option>
                            </select>
                            <input type="text" placeholder="Filtrar medicamentos..." value={medicationSearch} onChange={(e) => setMedicationSearch(e.target.value)} />
                            {(medicationSearch || medicationSearchMode !== 'all') && (
                                <button type="button" className="patient-clear-btn" onClick={clearMedicationSearch}>Limpiar</button>
                            )}
                        </div>

                        <div className="institutions-tab-header">
                            <select aria-label="Filtrar por estado" className="status-filter-select" value={medicationsFilter} onChange={(e) => setMedicationsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowMedicationForm(!showMedicationForm)}>+ Nuevo medicamento</button>
                        </div>

                        <Drawer open={Boolean(showMedicationForm)} onClose={() => setShowMedicationForm(false)} title="Registrar medicamento" size="md">
                            <form className="institutions-form" onSubmit={handleCreateMedication}>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select aria-label="Paciente" value={medicationForm.clinicalRecordId} onChange={(e) => setMedicationForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
                                        <option value="">Selecciona un paciente</option>
                                        {clinicalRecords.map((r) => (<option key={r.clinical_record_id} value={r.clinical_record_id}>{patientLabel(r)}</option>))}
                                    </select>
                                </div>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={medicationForm.name} onChange={(e) => setMedicationForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Dosis</label>
                                        <input type="text" value={medicationForm.dosage} onChange={(e) => setMedicationForm(p => ({ ...p, dosage: e.target.value }))} maxLength={100} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Frecuencia</label>
                                    <input type="text" value={medicationForm.frequency} onChange={(e) => setMedicationForm(p => ({ ...p, frequency: e.target.value }))} maxLength={100} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Registrar medicamento</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setShowMedicationForm(false)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <Drawer open={Boolean(editingMedication !== null)} onClose={() => setEditingMedication(null)} title="Editar medicamento" size="md">
                            <form className="institutions-form" onSubmit={handleUpdateMedication}>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Nombre</label>
                                        <input type="text" value={editMedicationForm.name} onChange={(e) => setEditMedicationForm(p => ({ ...p, name: e.target.value }))} maxLength={150} required />
                                    </div>
                                    <div className="institutions-field">
                                        <label>Dosis</label>
                                        <input type="text" value={editMedicationForm.dosage} onChange={(e) => setEditMedicationForm(p => ({ ...p, dosage: e.target.value }))} maxLength={100} />
                                    </div>
                                </div>
                                <div className="institutions-field">
                                    <label>Frecuencia</label>
                                    <input type="text" value={editMedicationForm.frequency} onChange={(e) => setEditMedicationForm(p => ({ ...p, frequency: e.target.value }))} maxLength={100} />
                                </div>
                                <div className="institutions-form-actions">
                                    <button type="submit" className="institutions-form-submit">Guardar cambios</button>
                                    <button type="button" className="institutions-form-cancel" onClick={() => setEditingMedication(null)}>Cancelar</button>
                                </div>
                            </form>
                            </Drawer>

                        <div className="entity-grid">
                            {filterByStatus(medications, medicationsFilter).filter(m => matchesSearch(m, medicationSearch, medicationSearchMode)).map((m) => (
                                <article key={m.patient_medication_id} className={`entity acc-route${m.is_active ? '' : ' is-off'}`}>
                                    <div className="entity-head">
                                        <div className="entity-titles">
                                            <h2 className="entity-title">{m.name}</h2>
                                            <p className="entity-sub">{patientLabel(m)}</p>
                                        </div>
                                        <span className={`pill ${m.is_active ? 'pill-ok' : 'pill-warn'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                    <dl className="entity-facts">
                                        <div><dt>Dosis</dt><dd>{m.dosage || '—'}</dd></div>
                                        <div><dt>Frecuencia</dt><dd>{m.frequency || '—'}</dd></div>
                                    </dl>
                                    {historyMedicationId === m.patient_medication_id && (
                                        <div className="entity-panel clinical-history">
                                            {medicationHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : medicationHistory.map((h) => (
                                                <span key={h.patient_medication_history_id}>{h.is_active ? 'Activado' : 'Desactivado'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="entity-actions">
                                        <button type="button" className="institutions-edit-btn" onClick={() => openEditMedication(m)}>Editar</button>
                                        <span className="spacer" />
                                        <MoreMenu items={[
                                            { label: 'Historial de cambios', onClick: () => toggleMedicationHistory(m) },
                                            { label: m.is_active ? 'Desactivar' : 'Activar', onClick: () => handleToggleMedication(m), danger: Boolean(m.is_active) },
                                        ]} />
                                    </div>
                                </article>
                            ))}
                            {filterByStatus(medications, medicationsFilter).filter(m => matchesSearch(m, medicationSearch, medicationSearchMode)).length === 0 && <p className="entity-empty">No hay medicamentos que coincidan con la búsqueda.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Patients;
