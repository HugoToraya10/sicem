import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Alert } from '../../utils/alert'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors, contentColumn } from '../../constants/theme'
import { Button, Field, ChoiceChips, Chip, SectionTitle, Notice } from '../../components/ui'

// Expediente clínico del paciente que el paramédico tiene enfrente. Lo primero que se ve es lo que puede salvar una
// vida (tipo de sangre y alergias); lo demás va debajo, en orden de importancia en campo.
//
// expo-router mantiene esta pantalla MONTADA al navegar de un paciente a otro (las pestañas no se desmontan solas):
// sin un remount forzado el estado seguía siendo el del paciente ANTERIOR. La key por userProfileId lo evita.
const ExpedienteScreen = () => {
    const { userProfileId } = useLocalSearchParams()
    return <ExpedienteScreenContent key={userProfileId} />
}

const EMPTY_FORM = { bloodTypeId: '', weight: '', height: '', gender: '', birthplace: '', maritalStatus: '', occupation: '', religion: '', notes: '' }

const fmtNum = (v) => { const n = Number(v); return Number.isNaN(n) ? v : String(n) }

const ExpedienteScreenContent = () => {
    const { userProfileId, firstName, firstSurname, secondSurname, emergencyPatientId, curp: curpParam } = useLocalSearchParams()
    const { token } = useAuth()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [loading, setLoading] = useState(true)
    const [bloodTypes, setBloodTypes] = useState([])
    const [clinicalRecord, setClinicalRecord] = useState(null) // null = todavía no existe
    const [allergies, setAllergies] = useState([])
    const [conditions, setConditions] = useState([])
    const [medications, setMedications] = useState([])
    const [notes, setNotes] = useState([])

    const [editingRecord, setEditingRecord] = useState(false)
    const [recordForm, setRecordForm] = useState(EMPTY_FORM)
    const [savingRecord, setSavingRecord] = useState(false)

    // La CURP vive en user_profiles (no en clinical_records): se parte de la que traía la lista de origen y se puede corregir aquí.
    const [curp, setCurp] = useState(curpParam || '')
    const [editingCurp, setEditingCurp] = useState(false)
    const [savingCurp, setSavingCurp] = useState(false)

    const [newAllergy, setNewAllergy] = useState({ name: '', severity: '' })
    const [newCondition, setNewCondition] = useState({ name: '', notes: '' })
    const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' })
    const [addingSection, setAddingSection] = useState(null) // 'allergy' | 'condition' | 'medication' | null

    const fetchLists = (clinicalRecordId) => {
        Promise.all([
            fetch(`${API_BASE_URL}/pacientes/alergias/${clinicalRecordId}`, { headers }).then((r) => r.json()),
            fetch(`${API_BASE_URL}/pacientes/condiciones/${clinicalRecordId}`, { headers }).then((r) => r.json()),
            fetch(`${API_BASE_URL}/pacientes/medicamentos/${clinicalRecordId}`, { headers }).then((r) => r.json()),
        ]).then(([alRes, condRes, medRes]) => {
            setAllergies((alRes.allergies || []).map(toLowerCaseKeys))
            setConditions((condRes.conditions || []).map(toLowerCaseKeys))
            setMedications((medRes.medications || []).map(toLowerCaseKeys))
        }).catch((err) => console.error('Error recuperando alergias/condiciones/medicamentos. ', err))
    }

    const fetchAll = () => {
        setLoading(true)
        fetch(`${API_BASE_URL}/pacientes/ece/${userProfileId}`, { headers })
            .then((res) => res.json())
            .then(({ clinicalRecord: recRows }) => {
                if (!recRows || recRows.length === 0) { setClinicalRecord(null); return }
                const rec = toLowerCaseKeys(recRows[0])
                setClinicalRecord(rec)
                setRecordForm({
                    bloodTypeId: rec.blood_type_id ? String(rec.blood_type_id) : '', weight: rec.weight ? fmtNum(rec.weight) : '', height: rec.height ? fmtNum(rec.height) : '',
                    gender: rec.gender || '', birthplace: rec.birthplace || '', maritalStatus: rec.marital_status || '',
                    occupation: rec.occupation || '', religion: rec.religion || '', notes: rec.notes || '',
                })
                fetchLists(rec.clinical_record_id)
            })
            .catch((err) => console.error('Error recuperando expediente clínico. ', err))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetch(`${API_BASE_URL}/pacientes/tipos-sangre`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ bloodTypes: bt }) => setBloodTypes((bt || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando tipos de sangre. ', err))
        fetchAll()
    }, [userProfileId])

    useEffect(() => {
        if (!emergencyPatientId) { setNotes([]); return }
        fetch(`${API_BASE_URL}/emergencias/notas/${emergencyPatientId}`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setNotes((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando notas de urgencia. ', err))
    }, [emergencyPatientId])

    const handleSaveRecord = () => {
        setSavingRecord(true)
        const isUpdate = !!clinicalRecord
        const num = (v) => (String(v).trim() === '' ? null : String(v).trim().replace(',', '.'))
        fetch(`${API_BASE_URL}/pacientes/${isUpdate ? 'actualizar-ece' : 'crear-ece'}`, {
            method: isUpdate ? 'PATCH' : 'POST',
            headers,
            body: JSON.stringify({
                userProfileId, clinicalRecordId: clinicalRecord?.clinical_record_id,
                bloodTypeId: recordForm.bloodTypeId || null, weight: num(recordForm.weight), height: num(recordForm.height),
                gender: recordForm.gender || null, birthplace: recordForm.birthplace || null, maritalStatus: recordForm.maritalStatus || null,
                occupation: recordForm.occupation || null, religion: recordForm.religion || null, notes: recordForm.notes || null,
            }),
        })
            .then((res) => res.json().then((resBody) => { if (!res.ok) throw new Error(resBody.message || 'No se pudo guardar el expediente.') }))
            .then(() => { setEditingRecord(false); fetchAll() })
            .catch((err) => { console.error('Error guardando expediente. ', err); Alert.alert('No se pudo guardar', err.message) })
            .finally(() => setSavingRecord(false))
    }

    const handleAddItem = (kind) => {
        const clinicalRecordId = clinicalRecord?.clinical_record_id
        if (!clinicalRecordId) return
        let url, body
        if (kind === 'allergy') {
            if (!newAllergy.name.trim()) return
            url = '/pacientes/registrar-alergia'
            body = { clinicalRecordId, name: newAllergy.name.trim(), severity: newAllergy.severity.trim() || null }
        } else if (kind === 'condition') {
            if (!newCondition.name.trim()) return
            url = '/pacientes/registrar-condicion'
            body = { clinicalRecordId, name: newCondition.name.trim(), diagnosedAt: null, notes: newCondition.notes.trim() || null }
        } else {
            if (!newMedication.name.trim()) return
            url = '/pacientes/registrar-medicacion'
            body = { clinicalRecordId, name: newMedication.name.trim(), dosage: newMedication.dosage.trim() || null, frequency: newMedication.frequency.trim() || null }
        }
        fetch(`${API_BASE_URL}${url}`, { method: 'POST', headers, body: JSON.stringify(body) })
            .then((res) => res.json().then((resBody) => { if (!res.ok) throw new Error(resBody.message || 'No se pudo registrar.') }))
            .then(() => {
                if (kind === 'allergy') setNewAllergy({ name: '', severity: '' })
                if (kind === 'condition') setNewCondition({ name: '', notes: '' })
                if (kind === 'medication') setNewMedication({ name: '', dosage: '', frequency: '' })
                setAddingSection(null)
                fetchLists(clinicalRecordId)
            })
            .catch((err) => { console.error('Error agregando. ', err); Alert.alert('No se pudo guardar', err.message) })
    }

    const KIND_LABELS = { allergy: 'esta alergia', condition: 'esta condición', medication: 'este medicamento' }

    // Quitar un dato médico siempre pide confirmar: un toque accidental no debe borrar información clínica.
    const applyToggle = (kind, id) => {
        const urlByKind = { allergy: '/pacientes/alternar-alergia', condition: '/pacientes/alternar-condicion', medication: '/pacientes/alternar-medicacion' }
        const bodyKeyByKind = { allergy: 'patientAllergyId', condition: 'patientConditionId', medication: 'patientMedicationId' }
        fetch(`${API_BASE_URL}${urlByKind[kind]}`, { method: 'PATCH', headers, body: JSON.stringify({ [bodyKeyByKind[kind]]: id }) })
            .then((res) => res.json().then((resBody) => { if (!res.ok) throw new Error(resBody.message || 'No se pudo actualizar.') }))
            .then(() => fetchLists(clinicalRecord.clinical_record_id))
            .catch((err) => { console.error('Error actualizando. ', err); Alert.alert('No se pudo actualizar', err.message) })
    }

    const handleRemove = (kind, id) => {
        Alert.alert('Quitar de la lista', `¿Quitar ${KIND_LABELS[kind]}? Queda en el historial, no se borra.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Quitar', style: 'destructive', onPress: () => applyToggle(kind, id) },
        ])
    }

    const handleSaveCurp = () => {
        if (!curp.trim()) { Alert.alert('CURP vacía', 'Escribe la CURP o cancela la edición.'); return }
        setSavingCurp(true)
        fetch(`${API_BASE_URL}/usuarios/actualizar-curp-paciente`, { method: 'PATCH', headers, body: JSON.stringify({ userProfileId, curp: curp.trim().toUpperCase() }) })
            .then((res) => res.json().then((body) => { if (!res.ok) throw new Error(body.message || 'No se pudo actualizar la CURP.') }))
            .then(() => { setCurp((c) => c.trim().toUpperCase()); setEditingCurp(false) })
            .catch((err) => { console.error('Error actualizando CURP. ', err); Alert.alert('No se pudo actualizar', err.message) })
            .finally(() => setSavingCurp(false))
    }

    const patientName = [firstName, firstSurname, secondSurname].filter(Boolean).join(' ') || 'Paciente'
    const bloodType = bloodTypes.find((bt) => String(bt.blood_type_id) === String(clinicalRecord?.blood_type_id))?.blood_type
    const set = (key) => (value) => setRecordForm((f) => ({ ...f, [key]: value }))

    if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.steel} /></View>

    // Una lista editable (condiciones / medicamentos): cada fila con su botón de quitar
    const itemRow = (kind, idKey, item, main, detail) => (
        <View key={item[idKey]} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
                <Text style={styles.itemMain}>{main}</Text>
                {detail ? <Text style={styles.itemDetail}>{detail}</Text> : null}
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(kind, item[idKey])} accessibilityRole="button" accessibilityLabel={`Quitar ${main}`}>
                <Text style={styles.removeText}>Quitar</Text>
            </TouchableOpacity>
        </View>
    )

    const addToggle = (kind, label) => (
        <Button
            label={addingSection === kind ? 'Cancelar' : label}
            tone={addingSection === kind ? 'ghost' : 'neutral'}
            style={{ marginTop: 8, minHeight: 48 }}
            onPress={() => setAddingSection(addingSection === kind ? null : kind)}
        />
    )

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Identidad */}
                <View style={styles.identity}>
                    <Text style={styles.name}>{patientName}</Text>
                    {editingCurp ? (
                        <View style={{ marginTop: 10 }}>
                            <Field label="CURP" value={curp} onChangeText={(v) => setCurp(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={18} />
                            <View style={styles.inlineActions}>
                                <Button label="Guardar CURP" tone="steel" style={{ flex: 1, minHeight: 48 }} onPress={handleSaveCurp} loading={savingCurp} />
                                <Button label="Cancelar" tone="neutral" style={{ minHeight: 48 }} onPress={() => { setCurp(curpParam || ''); setEditingCurp(false) }} disabled={savingCurp} />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.curpRow}>
                            <Text style={styles.curp}>CURP: {curp || 'sin registrar'}</Text>
                            <TouchableOpacity onPress={() => setEditingCurp(true)} accessibilityRole="button" accessibilityLabel={curp ? 'Corregir CURP' : 'Agregar CURP'}>
                                <Text style={styles.link}>{curp ? 'Corregir' : 'Agregar'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {!clinicalRecord && !editingRecord && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Sin expediente clínico</Text>
                        <Text style={styles.itemDetail}>Crearlo permite registrar su tipo de sangre, alergias y medicamentos para el hospital.</Text>
                        <Button label="Crear expediente" tone="primary" style={{ marginTop: 12 }} onPress={() => setEditingRecord(true)} />
                    </View>
                )}

                {/* Lo crítico, primero */}
                {clinicalRecord && !editingRecord && (
                    <>
                        <View style={styles.vitalCards}>
                            <View style={[styles.statCard, !bloodType && styles.statCardEmpty]}>
                                <Text style={styles.statLabel}>Sangre</Text>
                                <Text style={styles.statValue}>{bloodType || '—'}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Peso</Text>
                                <Text style={styles.statValue}>{clinicalRecord.weight ? `${fmtNum(clinicalRecord.weight)} kg` : '—'}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Estatura</Text>
                                <Text style={styles.statValue}>{clinicalRecord.height ? `${fmtNum(clinicalRecord.height)} m` : '—'}</Text>
                            </View>
                        </View>

                        <View style={[styles.allergyBox, allergies.length === 0 && styles.allergyBoxEmpty]}>
                            <Text style={[styles.allergyTitle, allergies.length === 0 && { color: colors.text2 }]}>
                                {allergies.length > 0 ? 'Alergias' : 'Sin alergias registradas'}
                            </Text>
                            {allergies.length === 0 && <Text style={styles.itemDetail}>Eso no confirma que no tenga: pregunta antes de administrar medicamentos.</Text>}
                            {allergies.map((a) => (
                                <View key={a.patient_allergy_id} style={styles.allergyRow}>
                                    <Text style={styles.allergyName}>{a.name}{a.severity ? ` — ${a.severity}` : ''}</Text>
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove('allergy', a.patient_allergy_id)} accessibilityRole="button" accessibilityLabel={`Quitar ${a.name}`}>
                                        <Text style={styles.removeText}>Quitar</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {addToggle('allergy', 'Agregar alergia')}
                            {addingSection === 'allergy' && (
                                <View style={styles.addForm}>
                                    <Field label="¿A qué es alérgico?" value={newAllergy.name} onChangeText={(v) => setNewAllergy((f) => ({ ...f, name: v }))} />
                                    <Text style={styles.chipLabel}>Gravedad</Text>
                                    <ChoiceChips
                                        options={['Leve', 'Moderada', 'Grave', 'Anafilaxia'].map((v) => ({ value: v, label: v }))}
                                        value={newAllergy.severity} onChange={(v) => setNewAllergy((f) => ({ ...f, severity: v }))}
                                    />
                                    <Button label="Guardar alergia" tone="primary" style={{ marginTop: 14 }} onPress={() => handleAddItem('allergy')} disabled={!newAllergy.name.trim()} />
                                </View>
                            )}
                        </View>

                        <SectionTitle>Condiciones</SectionTitle>
                        {conditions.length === 0 && <Text style={styles.empty}>Sin condiciones registradas.</Text>}
                        {conditions.map((c) => itemRow('condition', 'patient_condition_id', c, c.name, c.notes))}
                        {addToggle('condition', 'Agregar condición')}
                        {addingSection === 'condition' && (
                            <View style={styles.addForm}>
                                <Field label="Condición" hint="Por ejemplo: diabetes, hipertensión, epilepsia." value={newCondition.name} onChangeText={(v) => setNewCondition((f) => ({ ...f, name: v }))} />
                                <Field label="Notas (opcional)" value={newCondition.notes} onChangeText={(v) => setNewCondition((f) => ({ ...f, notes: v }))} />
                                <Button label="Guardar condición" tone="primary" onPress={() => handleAddItem('condition')} disabled={!newCondition.name.trim()} />
                            </View>
                        )}

                        <SectionTitle>Medicamentos</SectionTitle>
                        {medications.length === 0 && <Text style={styles.empty}>Sin medicamentos registrados.</Text>}
                        {medications.map((m) => itemRow('medication', 'patient_medication_id', m, m.name, [m.dosage, m.frequency].filter(Boolean).join(' · ')))}
                        {addToggle('medication', 'Agregar medicamento')}
                        {addingSection === 'medication' && (
                            <View style={styles.addForm}>
                                <Field label="Medicamento" value={newMedication.name} onChangeText={(v) => setNewMedication((f) => ({ ...f, name: v }))} />
                                <View style={styles.row}>
                                    <Field style={styles.half} label="Dosis" hint="Ej. 500 mg" value={newMedication.dosage} onChangeText={(v) => setNewMedication((f) => ({ ...f, dosage: v }))} />
                                    <Field style={styles.half} label="Frecuencia" hint="Ej. cada 8 h" value={newMedication.frequency} onChangeText={(v) => setNewMedication((f) => ({ ...f, frequency: v }))} />
                                </View>
                                <Button label="Guardar medicamento" tone="primary" onPress={() => handleAddItem('medication')} disabled={!newMedication.name.trim()} />
                            </View>
                        )}

                        <SectionTitle>Datos generales</SectionTitle>
                        <View style={styles.card}>
                            {[['Género', clinicalRecord.gender], ['Estado civil', clinicalRecord.marital_status], ['Ocupación', clinicalRecord.occupation], ['Lugar de nacimiento', clinicalRecord.birthplace]].map(([label, value]) => (
                                <View key={label} style={styles.kv}><Text style={styles.kvLabel}>{label}</Text><Text style={styles.kvValue}>{value || '—'}</Text></View>
                            ))}
                            {clinicalRecord.notes ? <Text style={[styles.itemDetail, { marginTop: 8 }]}>Notas: {clinicalRecord.notes}</Text> : null}
                            <Button label="Editar datos generales" tone="neutral" style={{ marginTop: 12, minHeight: 48 }} onPress={() => setEditingRecord(true)} />
                        </View>
                    </>
                )}

                {/* Edición / creación de datos generales */}
                {editingRecord && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{clinicalRecord ? 'Editar datos generales' : 'Nuevo expediente'}</Text>
                        <Text style={styles.chipLabel}>Tipo de sangre</Text>
                        <ChoiceChips
                            options={bloodTypes.map((bt) => ({ value: String(bt.blood_type_id), label: bt.blood_type }))}
                            value={recordForm.bloodTypeId} onChange={set('bloodTypeId')}
                        />
                        <View style={[styles.row, { marginTop: 14 }]}>
                            <Field style={styles.half} label="Peso" unit="kg" value={recordForm.weight} onChangeText={set('weight')} keyboardType="decimal-pad" />
                            <Field style={styles.half} label="Estatura" unit="m" hint="Ej. 1.68" value={recordForm.height} onChangeText={set('height')} keyboardType="decimal-pad" />
                        </View>
                        <Field label="Género" value={recordForm.gender} onChangeText={set('gender')} maxLength={20} />
                        <View style={styles.row}>
                            <Field style={styles.half} label="Estado civil" value={recordForm.maritalStatus} onChangeText={set('maritalStatus')} maxLength={20} />
                            <Field style={styles.half} label="Ocupación" value={recordForm.occupation} onChangeText={set('occupation')} maxLength={100} />
                        </View>
                        <Field label="Lugar de nacimiento" value={recordForm.birthplace} onChangeText={set('birthplace')} maxLength={100} />
                        <Field label="Notas generales" value={recordForm.notes} onChangeText={set('notes')} multiline maxLength={500} />
                        <View style={styles.inlineActions}>
                            <Button label="Guardar" tone="primary" style={{ flex: 1 }} onPress={handleSaveRecord} loading={savingRecord} />
                            <Button label="Cancelar" tone="neutral" onPress={() => { setEditingRecord(false); if (clinicalRecord) fetchAll() }} disabled={savingRecord} />
                        </View>
                    </View>
                )}

                {/* Notas de urgencia de ESTA emergencia */}
                {emergencyPatientId ? (
                    <>
                        <SectionTitle>Notas de esta emergencia</SectionTitle>
                        {notes.length === 0 && <Text style={styles.empty}>Todavía no hay notas.</Text>}
                        {notes.map((n) => (
                            <View key={n.emergency_note_id} style={styles.noteCard}>
                                <View style={styles.noteHead}>
                                    <Text style={styles.noteDate}>{n.recorded_at ? new Date(n.recorded_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : ''}</Text>
                                    {n.level ? <Chip label={`Triage ${n.level}`} tone="steel" /> : null}
                                </View>
                                <View style={styles.vitals}>
                                    {n.blood_pressure ? <Text style={styles.vital}>PA {n.blood_pressure}</Text> : null}
                                    {n.heart_rate ? <Text style={styles.vital}>FC {fmtNum(n.heart_rate)}</Text> : null}
                                    {n.oxygen_saturation ? <Text style={[styles.vital, Number(n.oxygen_saturation) < 92 && styles.vitalWarn]}>SpO₂ {fmtNum(n.oxygen_saturation)}%</Text> : null}
                                    {n.temperature ? <Text style={styles.vital}>T {fmtNum(n.temperature)}°</Text> : null}
                                    {n.respiratory_rate ? <Text style={styles.vital}>FR {fmtNum(n.respiratory_rate)}</Text> : null}
                                    {n.glucose_level ? <Text style={styles.vital}>Glu {fmtNum(n.glucose_level)}</Text> : null}
                                    {n.glasgow_scale ? <Text style={styles.vital}>Glasgow {fmtNum(n.glasgow_scale)}</Text> : null}
                                    {n.pain_scale !== null && n.pain_scale !== undefined && n.pain_scale !== '' ? <Text style={styles.vital}>Dolor {fmtNum(n.pain_scale)}/10</Text> : null}
                                </View>
                                {n.consciousness_level ? <Text style={styles.noteLine}>Conciencia: {n.consciousness_level}</Text> : null}
                                {n.pupils ? <Text style={styles.noteLine}>Pupilas: {n.pupils}</Text> : null}
                                {n.initial_diagnosis ? <Text style={styles.noteLine}>Diagnóstico: {n.initial_diagnosis}</Text> : null}
                                {n.treatment_applied ? <Text style={styles.noteLine}>Tratamiento: {n.treatment_applied}</Text> : null}
                                {n.patient_status ? <Text style={styles.noteLine}>Estado: {n.patient_status}</Text> : null}
                            </View>
                        ))}
                        <Button
                            label="Nueva nota de urgencia"
                            tone="primary"
                            style={{ marginTop: 6 }}
                            onPress={() => router.push({ pathname: '/notas', params: { emergencyPatientId, firstName: firstName || '', firstSurname: firstSurname || '', secondSurname: secondSurname || '' } })}
                        />
                    </>
                ) : null}
                <View style={{ height: 16 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    content: { padding: 16, paddingBottom: 28, ...contentColumn },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
    identity: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 },
    name: { fontSize: 26, fontWeight: '800', color: colors.text },
    curpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 10 },
    curp: { flex: 1, fontSize: 14, color: colors.text2, fontFamily: undefined },
    link: { color: colors.steel, fontSize: 15, fontWeight: '700', paddingVertical: 8, paddingHorizontal: 6 },
    inlineActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
    vitalCards: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 12 },
    statCardEmpty: { backgroundColor: colors.warnSoft, borderColor: '#C99A2E' },
    statLabel: { fontSize: 13, fontWeight: '600', color: colors.text3 },
    statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
    allergyBox: { backgroundColor: colors.brandSoft, borderRadius: 12, borderWidth: 1.5, borderColor: colors.brand, padding: 14 },
    allergyBoxEmpty: { backgroundColor: colors.surface2, borderColor: colors.lineStrong, borderWidth: 1 },
    allergyTitle: { fontSize: 18, fontWeight: '800', color: colors.brand, marginBottom: 6 },
    allergyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
    allergyName: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    removeBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
    removeText: { color: colors.text2, fontSize: 14, fontWeight: '700' },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingLeft: 14, paddingRight: 6, marginBottom: 8 },
    itemMain: { fontSize: 17, fontWeight: '700', color: colors.text },
    itemDetail: { fontSize: 14, color: colors.text2, marginTop: 2 },
    empty: { fontSize: 15, color: colors.text2, marginBottom: 6 },
    addForm: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10 },
    chipLabel: { fontSize: 14, fontWeight: '600', color: colors.text2, marginBottom: 8, marginTop: 4 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
    kvLabel: { fontSize: 15, color: colors.text2 },
    kvValue: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1, textAlign: 'right' },
    noteCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, gap: 4 },
    noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteDate: { fontSize: 14, fontWeight: '700', color: colors.text2 },
    vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
    vital: { fontSize: 15, fontWeight: '700', color: colors.text, backgroundColor: colors.surface2, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden' },
    vitalWarn: { color: colors.warn, backgroundColor: colors.warnSoft },
    noteLine: { fontSize: 15, color: colors.text, lineHeight: 21 },
})

export default ExpedienteScreen
