import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toLowerCaseKeys } from '../../utils/formatData';
import Navbar from '../../components/layout/Navbar';
import { getNavLinks } from '../../utils/Navlinks';
import { blockIfDuplicate } from '../../utils/duplicateCheck';
import { parseResponse } from '../../utils/apiRequest';
import './Institutions.css';
import './Patients.css';

const roleLabels = { 1: 'Administrador', 2: 'Despachador', 3: 'Paramédico', 4: 'Hospital', 5: 'Paciente' }

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

const TABS = ['Expedientes Clínicos', 'Alergias', 'Condiciones', 'Medicamentos']

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
    const { token, user } = useAuth();
    const navLinks = getNavLinks(user?.roleId)
    const [activeTab, setActiveTab] = useState('Expedientes Clínicos')

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
        fetch('http://localhost:3000/pacientes/tipos-sangre', { headers: { "Content-Type": "application/json" } })
            .then(res => res.json())
            .then(({ bloodTypes }) => setBloodTypes((bloodTypes || []).map(b => toLowerCaseKeys(b))))
            .catch(error => console.error('Error consultando tipos de sangre. ', error))
    }, []);

    const fetchClinicalRecords = () => {
        fetch('http://localhost:3000/pacientes/expedientes-todos', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ clinicalRecords }) => setClinicalRecords((clinicalRecords || []).map(r => toLowerCaseKeys(r))))
            .catch(error => console.error('Error consultando expedientes. ', error))
    }
    useEffect(() => { fetchClinicalRecords() }, []);

    const fetchAllergies = () => {
        fetch('http://localhost:3000/pacientes/alergias-todas', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ allergies }) => setAllergies((allergies || []).map(a => toLowerCaseKeys(a))))
            .catch(error => console.error('Error consultando alergias. ', error))
    }
    useEffect(() => { fetchAllergies() }, []);

    const fetchConditions = () => {
        fetch('http://localhost:3000/pacientes/condiciones-todas', {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(({ conditions }) => setConditions((conditions || []).map(c => toLowerCaseKeys(c))))
            .catch(error => console.error('Error consultando condiciones. ', error))
    }
    useEffect(() => { fetchConditions() }, []);

    const fetchMedications = () => {
        fetch('http://localhost:3000/pacientes/medicamentos-todos', {
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
        fetch(`http://localhost:3000/pacientes/historial-alergia/${a.patient_allergy_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setAllergyHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de alergia. ', error); alert(error.message) })
    }

    const toggleConditionHistory = (c) => {
        if (historyConditionId === c.patient_condition_id) { setHistoryConditionId(null); setConditionHistory([]); return }
        setHistoryConditionId(c.patient_condition_id)
        fetch(`http://localhost:3000/pacientes/historial-condicion/${c.patient_condition_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setConditionHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de condición. ', error); alert(error.message) })
    }

    const toggleMedicationHistory = (m) => {
        if (historyMedicationId === m.patient_medication_id) { setHistoryMedicationId(null); setMedicationHistory([]); return }
        setHistoryMedicationId(m.patient_medication_id)
        fetch(`http://localhost:3000/pacientes/historial-medicamento/${m.patient_medication_id}`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
            .then(parseResponse)
            .then(({ history }) => setMedicationHistory((history || []).map(h => toLowerCaseKeys(h))))
            .catch(error => { console.error('Error consultando historial de medicamento. ', error); alert(error.message) })
    }

    //---------------------------------expedientes: crear / editar--------------------------------------------------

    const handleResolveCurp = () => {
        if (!curpLookup.trim()) return
        setCurpLookupBusy(true)
        fetch(`http://localhost:3000/usuarios/obtener-usuario-curp/${encodeURIComponent(curpLookup.trim())}`, {
            headers: { "Content-Type": "application/json" }
        })
            .then(res => res.json())
            .then(({ data }) => {
                const rows = (data || []).map(u => toLowerCaseKeys(u))
                if (rows.length === 0) { alert('No se encontró ningún usuario con ese CURP.'); return }
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
        fetch('http://localhost:3000/pacientes/crear-ece', {
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
            .catch(error => { console.error('Error registrando expediente. ', error); alert(error.message) })
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
        fetch('http://localhost:3000/pacientes/actualizar-ece', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editRecordForm)
        })
            .then(parseResponse)
            .then(() => { setEditingRecord(null); fetchClinicalRecords(); })
            .catch(error => { console.error('Error actualizando expediente. ', error); alert(error.message) })
    }

    //---------------------------------alergias: crear / editar / alternar--------------------------------------------------

    const handleCreateAllergy = (e) => {
        e.preventDefault();
        const sameRecord = allergies.filter(a => String(a.clinical_record_id) === String(allergyForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', allergyForm.name, 'nombre de alergia para este paciente')) return
        fetch('http://localhost:3000/pacientes/registrar-alergia', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ clinicalRecordId: allergyForm.clinicalRecordId, name: allergyForm.name, severity: allergyForm.severity })
        })
            .then(parseResponse)
            .then(() => { setAllergyForm(emptyAllergyForm); setShowAllergyForm(false); fetchAllergies(); })
            .catch(error => { console.error('Error registrando alergia. ', error); alert(error.message) })
    }

    const openEditAllergy = (a) => {
        setEditingAllergy(a.patient_allergy_id)
        setEditAllergyForm({ patientAllergyId: a.patient_allergy_id, name: a.name || '', severity: a.severity || '' })
    }

    const handleUpdateAllergy = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/pacientes/actualizar-alergia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editAllergyForm)
        })
            .then(parseResponse)
            .then(() => { setEditingAllergy(null); fetchAllergies(); })
            .catch(error => { console.error('Error actualizando alergia. ', error); alert(error.message) })
    }

    const handleToggleAllergy = (a) => {
        const action = a.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la alergia "${a.name}" de ${patientLabel(a)}?`)) return
        fetch('http://localhost:3000/pacientes/alternar-alergia', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientAllergyId: a.patient_allergy_id })
        })
            .then(parseResponse)
            .then(() => fetchAllergies())
            .catch(error => { console.error('Error cambiando estado de alergia. ', error); alert(error.message) })
    }

    //---------------------------------condiciones: crear / editar / alternar--------------------------------------------------

    const handleCreateCondition = (e) => {
        e.preventDefault();
        const sameRecord = conditions.filter(c => String(c.clinical_record_id) === String(conditionForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', conditionForm.name, 'nombre de condición para este paciente')) return
        fetch('http://localhost:3000/pacientes/registrar-condicion', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                clinicalRecordId: conditionForm.clinicalRecordId, name: conditionForm.name,
                diagnosedAt: conditionForm.diagnosedAt, notes: conditionForm.notes,
            })
        })
            .then(parseResponse)
            .then(() => { setConditionForm(emptyConditionForm); setShowConditionForm(false); fetchConditions(); })
            .catch(error => { console.error('Error registrando condición. ', error); alert(error.message) })
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
        fetch('http://localhost:3000/pacientes/actualizar-condicion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editConditionForm)
        })
            .then(parseResponse)
            .then(() => { setEditingCondition(null); fetchConditions(); })
            .catch(error => { console.error('Error actualizando condición. ', error); alert(error.message) })
    }

    const handleToggleCondition = (c) => {
        const action = c.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} la condición "${c.name}" de ${patientLabel(c)}?`)) return
        fetch('http://localhost:3000/pacientes/alternar-condicion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientConditionId: c.patient_condition_id })
        })
            .then(parseResponse)
            .then(() => fetchConditions())
            .catch(error => { console.error('Error cambiando estado de condición. ', error); alert(error.message) })
    }

    //---------------------------------medicamentos: crear / editar / alternar--------------------------------------------------

    const handleCreateMedication = (e) => {
        e.preventDefault();
        const sameRecord = medications.filter(m => String(m.clinical_record_id) === String(medicationForm.clinicalRecordId))
        if (blockIfDuplicate(sameRecord, 'name', medicationForm.name, 'nombre de medicamento para este paciente')) return
        fetch('http://localhost:3000/pacientes/registrar-medicacion', {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                clinicalRecordId: medicationForm.clinicalRecordId, name: medicationForm.name,
                dosage: medicationForm.dosage, frequency: medicationForm.frequency,
            })
        })
            .then(parseResponse)
            .then(() => { setMedicationForm(emptyMedicationForm); setShowMedicationForm(false); fetchMedications(); })
            .catch(error => { console.error('Error registrando medicamento. ', error); alert(error.message) })
    }

    const openEditMedication = (m) => {
        setEditingMedication(m.patient_medication_id)
        setEditMedicationForm({ patientMedicationId: m.patient_medication_id, name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '' })
    }

    const handleUpdateMedication = (e) => {
        e.preventDefault();
        fetch('http://localhost:3000/pacientes/actualizar-medicacion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(editMedicationForm)
        })
            .then(parseResponse)
            .then(() => { setEditingMedication(null); fetchMedications(); })
            .catch(error => { console.error('Error actualizando medicamento. ', error); alert(error.message) })
    }

    const handleToggleMedication = (m) => {
        const action = m.is_active ? 'desactivar' : 'activar'
        if (!window.confirm(`¿Seguro que quieres ${action} el medicamento "${m.name}" de ${patientLabel(m)}?`)) return
        fetch('http://localhost:3000/pacientes/alternar-medicacion', {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ patientMedicationId: m.patient_medication_id })
        })
            .then(parseResponse)
            .then(() => fetchMedications())
            .catch(error => { console.error('Error cambiando estado de medicamento. ', error); alert(error.message) })
    }

    const bloodTypeNameById = (id) => bloodTypes.find(b => b.blood_type_id === id)?.blood_type || '—'

    return (
        <div className="institutions-page">
            <Navbar userName={user?.firstName || 'Usuario'} roleLabel={roleLabels[user?.roleId] || ''} links={navLinks} />

            <div className="institutions-body">
                <h2 className="institutions-title">Gestión de Pacientes</h2>

                <div className="institutions-tabs">
                    {TABS.map((tab) => (
                        <button key={tab} className={`institutions-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ── TAB: EXPEDIENTES CLÍNICOS ─────────────────────────────── */}
                {activeTab === 'Expedientes Clínicos' && (
                    <>
                        <div className="patient-search-row">
                            <select value={recordSearchMode} onChange={(e) => setRecordSearchMode(e.target.value)}>
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
                                + Nuevo Expediente
                            </button>
                        </div>

                        {showRecordForm && (
                            <form className="institutions-form" onSubmit={handleCreateRecord}>
                                <h3>Registrar Expediente Clínico</h3>
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
                                        <select value={recordForm.bloodTypeId} onChange={(e) => setRecordForm(p => ({ ...p, bloodTypeId: e.target.value }))}>
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
                        )}

                        {editingRecord !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateRecord}>
                                <h3>Editar Expediente Clínico</h3>
                                <div className="institutions-form-row">
                                    <div className="institutions-field">
                                        <label>Tipo de sangre</label>
                                        <select value={editRecordForm.bloodTypeId} onChange={(e) => setEditRecordForm(p => ({ ...p, bloodTypeId: e.target.value }))}>
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
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Paciente</th><th>CURP</th><th>Tipo de sangre</th><th>Peso</th><th>Estatura</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {clinicalRecords.filter(r => matchesSearch(r, recordSearch, recordSearchMode)).map((r) => (
                                        <tr key={r.clinical_record_id}>
                                            <td>{[r.first_name, r.first_surname, r.second_surname].filter(Boolean).join(' ') || `ID ${r.user_profile_id}`}</td>
                                            <td>{r.curp || '—'}</td>
                                            <td>{r.blood_type || bloodTypeNameById(r.blood_type_id)}</td>
                                            <td>{r.weight ?? '—'} kg</td>
                                            <td>{r.height ?? '—'} cm</td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditRecord(r)}>Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {clinicalRecords.filter(r => matchesSearch(r, recordSearch, recordSearchMode)).length === 0 && <p className="institutions-empty">No hay expedientes que coincidan con la búsqueda.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: ALERGIAS ─────────────────────────────── */}
                {activeTab === 'Alergias' && (
                    <>
                        <div className="patient-search-row">
                            <select value={allergySearchMode} onChange={(e) => setAllergySearchMode(e.target.value)}>
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
                            <select className="status-filter-select" value={allergiesFilter} onChange={(e) => setAllergiesFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowAllergyForm(!showAllergyForm)}>+ Nueva Alergia</button>
                        </div>

                        {showAllergyForm && (
                            <form className="institutions-form" onSubmit={handleCreateAllergy}>
                                <h3>Registrar Alergia</h3>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select value={allergyForm.clinicalRecordId} onChange={(e) => setAllergyForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
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
                        )}

                        {editingAllergy !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateAllergy}>
                                <h3>Editar Alergia</h3>
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
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Paciente</th><th>Nombre</th><th>Severidad</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(allergies, allergiesFilter).filter(a => matchesSearch(a, allergySearch, allergySearchMode)).map((a) => (
                                        <Fragment key={a.patient_allergy_id}>
                                        <tr>
                                            <td>{patientLabel(a)}</td>
                                            <td>{a.name}</td>
                                            <td>{a.severity || '—'}</td>
                                            <td>
                                                <span className={`institutions-status ${a.is_active ? 'status-active' : 'status-inactive'}`}>{a.is_active ? 'Activa' : 'Inactiva'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditAllergy(a)}>Editar</button>
                                                <button className="institutions-edit-btn" onClick={() => toggleAllergyHistory(a)}>Historial</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleAllergy(a)}>{a.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                        {historyAllergyId === a.patient_allergy_id && (
                                            <tr><td colSpan={5}>
                                                <div className="clinical-history">
                                                    {allergyHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : allergyHistory.map((h) => (
                                                        <span key={h.patient_allergy_history_id}>{h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                                    ))}
                                                </div>
                                            </td></tr>
                                        )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(allergies, allergiesFilter).filter(a => matchesSearch(a, allergySearch, allergySearchMode)).length === 0 && <p className="institutions-empty">No hay alergias que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: CONDICIONES ─────────────────────────────── */}
                {activeTab === 'Condiciones' && (
                    <>
                        <div className="patient-search-row">
                            <select value={conditionSearchMode} onChange={(e) => setConditionSearchMode(e.target.value)}>
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
                            <select className="status-filter-select" value={conditionsFilter} onChange={(e) => setConditionsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowConditionForm(!showConditionForm)}>+ Nueva Condición</button>
                        </div>

                        {showConditionForm && (
                            <form className="institutions-form" onSubmit={handleCreateCondition}>
                                <h3>Registrar Condición Médica</h3>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select value={conditionForm.clinicalRecordId} onChange={(e) => setConditionForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
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
                        )}

                        {editingCondition !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateCondition}>
                                <h3>Editar Condición Médica</h3>
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
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Paciente</th><th>Nombre</th><th>Fecha de diagnóstico</th><th>Notas</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(conditions, conditionsFilter).filter(c => matchesSearch(c, conditionSearch, conditionSearchMode)).map((c) => (
                                        <Fragment key={c.patient_condition_id}>
                                        <tr>
                                            <td>{patientLabel(c)}</td>
                                            <td>{c.name}</td>
                                            <td>{c.diagnosed_at ? new Date(c.diagnosed_at).toLocaleDateString('es-MX') : '—'}</td>
                                            <td>{c.notes || '—'}</td>
                                            <td>
                                                <span className={`institutions-status ${c.is_active ? 'status-active' : 'status-inactive'}`}>{c.is_active ? 'Activa' : 'Inactiva'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditCondition(c)}>Editar</button>
                                                <button className="institutions-edit-btn" onClick={() => toggleConditionHistory(c)}>Historial</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleCondition(c)}>{c.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                        {historyConditionId === c.patient_condition_id && (
                                            <tr><td colSpan={6}>
                                                <div className="clinical-history">
                                                    {conditionHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : conditionHistory.map((h) => (
                                                        <span key={h.patient_condition_history_id}>{h.is_active ? 'Activada' : 'Desactivada'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                                    ))}
                                                </div>
                                            </td></tr>
                                        )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(conditions, conditionsFilter).filter(c => matchesSearch(c, conditionSearch, conditionSearchMode)).length === 0 && <p className="institutions-empty">No hay condiciones que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}

                {/* ── TAB: MEDICAMENTOS ─────────────────────────────── */}
                {activeTab === 'Medicamentos' && (
                    <>
                        <div className="patient-search-row">
                            <select value={medicationSearchMode} onChange={(e) => setMedicationSearchMode(e.target.value)}>
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
                            <select className="status-filter-select" value={medicationsFilter} onChange={(e) => setMedicationsFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <button className="institutions-add-btn" onClick={() => setShowMedicationForm(!showMedicationForm)}>+ Nuevo Medicamento</button>
                        </div>

                        {showMedicationForm && (
                            <form className="institutions-form" onSubmit={handleCreateMedication}>
                                <h3>Registrar Medicamento</h3>
                                <div className="institutions-field">
                                    <label>Paciente</label>
                                    <select value={medicationForm.clinicalRecordId} onChange={(e) => setMedicationForm(p => ({ ...p, clinicalRecordId: e.target.value }))} required>
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
                        )}

                        {editingMedication !== null && (
                            <form className="institutions-form" onSubmit={handleUpdateMedication}>
                                <h3>Editar Medicamento</h3>
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
                        )}

                        <div className="catalog-table-wrapper">
                            <table className="catalog-table">
                                <thead><tr><th>Paciente</th><th>Nombre</th><th>Dosis</th><th>Frecuencia</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filterByStatus(medications, medicationsFilter).filter(m => matchesSearch(m, medicationSearch, medicationSearchMode)).map((m) => (
                                        <Fragment key={m.patient_medication_id}>
                                        <tr>
                                            <td>{patientLabel(m)}</td>
                                            <td>{m.name}</td>
                                            <td>{m.dosage || '—'}</td>
                                            <td>{m.frequency || '—'}</td>
                                            <td>
                                                <span className={`institutions-status ${m.is_active ? 'status-active' : 'status-inactive'}`}>{m.is_active ? 'Activo' : 'Inactivo'}</span>
                                            </td>
                                            <td>
                                                <button className="institutions-edit-btn" onClick={() => openEditMedication(m)}>Editar</button>
                                                <button className="institutions-edit-btn" onClick={() => toggleMedicationHistory(m)}>Historial</button>
                                                <button className="institutions-toggle-btn" onClick={() => handleToggleMedication(m)}>{m.is_active ? 'Desactivar' : 'Activar'}</button>
                                            </td>
                                        </tr>
                                        {historyMedicationId === m.patient_medication_id && (
                                            <tr><td colSpan={6}>
                                                <div className="clinical-history">
                                                    {medicationHistory.length === 0 ? <span>Sin cambios registrados todavía.</span> : medicationHistory.map((h) => (
                                                        <span key={h.patient_medication_history_id}>{h.is_active ? 'Activado' : 'Desactivado'} — {new Date(h.changed_at).toLocaleString('es-MX')}</span>
                                                    ))}
                                                </div>
                                            </td></tr>
                                        )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                            {filterByStatus(medications, medicationsFilter).filter(m => matchesSearch(m, medicationSearch, medicationSearchMode)).length === 0 && <p className="institutions-empty">No hay medicamentos que coincidan con el filtro.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Patients;
