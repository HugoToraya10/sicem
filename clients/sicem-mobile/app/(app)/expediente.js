import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

// Expediente clínico (clinical_records) + alergias/condiciones/medicamentos —
// tablas que YA existían en la BD y ya se leían en paciente.js, pero nadie
// podía CREARLAS ni EDITARLAS desde ningún cliente todavía (el backend en
// services/pacientes ya tenía todo el CRUD listo para rol 3, simplemente no
// había ninguna pantalla que lo usara). El paramédico en escena mide
// constantes/datos básicos y los captura aquí mismo, para el paciente que
// tiene enfrente — no necesita esperar a que alguien más lo haga después.
//
// emergencyPatientId (opcional, viene de paciente.js cuando se entra desde la
// lista de "pacientes de esta emergencia") habilita el historial de notas de
// urgencia — sin él (búsqueda genérica por CURP, paciente no ligado todavía a
// la emergencia en curso) esa sección se oculta.
// expo-router mantiene esta pantalla MONTADA al navegar de un paciente a
// otro (es un Tabs.Screen, ver comentario igual en paciente.js/mapa.js sobre
// que las pestañas no se desmontan solas) — sin un remount forzado, todo el
// state de abajo (clinicalRecord, allergies, recordForm, etc.) seguía siendo
// el del paciente ANTERIOR hasta que el fetch nuevo terminaba, y en la
// práctica Hugo reportó ver "los mismos datos llenados" al entrar a
// cualquier paciente — el backend sí filtra bien por userProfileId (columna
// UNIQUE en clinical_records), el problema era puramente de estado viejo en
// pantalla. La solución más segura contra CUALQUIER causa exacta (params que
// no disparan el efecto a tiempo, orden de renders, etc.) es forzar un
// remount completo de React cada vez que cambia el paciente, vía key.
const ExpedienteScreen = () => {
    const { userProfileId } = useLocalSearchParams()
    return <ExpedienteScreenContent key={userProfileId} />
}

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
    const [recordForm, setRecordForm] = useState({ bloodTypeId: '', weight: '', height: '', gender: '', birthplace: '', maritalStatus: '', occupation: '', religion: '', notes: '' })
    const [savingRecord, setSavingRecord] = useState(false)

    // La CURP no vive en clinical_records (es de user_profiles, ya asignada
    // desde sicem-web) — se parte del valor que traía la lista de origen
    // (curpParam) y se puede corregir aquí mismo, ver handleSaveCurp.
    const [curp, setCurp] = useState(curpParam || '')
    const [editingCurp, setEditingCurp] = useState(false)
    const [savingCurp, setSavingCurp] = useState(false)

    const [newAllergy, setNewAllergy] = useState({ name: '', severity: '' })
    const [newCondition, setNewCondition] = useState({ name: '', notes: '' })
    const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' })
    const [addingSection, setAddingSection] = useState(null) // 'allergy' | 'condition' | 'medication' | null

    const fetchAllergiesConditionsMedications = (clinicalRecordId) => {
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
                if (!recRows || recRows.length === 0) {
                    setClinicalRecord(null)
                    return
                }
                const rec = toLowerCaseKeys(recRows[0])
                setClinicalRecord(rec)
                setRecordForm({
                    bloodTypeId: rec.blood_type_id ? String(rec.blood_type_id) : '',
                    weight: rec.weight ? String(rec.weight) : '',
                    height: rec.height ? String(rec.height) : '',
                    gender: rec.gender || '',
                    birthplace: rec.birthplace || '',
                    maritalStatus: rec.marital_status || '',
                    occupation: rec.occupation || '',
                    religion: rec.religion || '',
                    notes: rec.notes || '',
                })
                fetchAllergiesConditionsMedications(rec.clinical_record_id)
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
        const body = {
            userProfileId,
            clinicalRecordId: clinicalRecord?.clinical_record_id,
            bloodTypeId: recordForm.bloodTypeId || null,
            weight: recordForm.weight || null,
            height: recordForm.height || null,
            gender: recordForm.gender || null,
            birthplace: recordForm.birthplace || null,
            maritalStatus: recordForm.maritalStatus || null,
            occupation: recordForm.occupation || null,
            religion: recordForm.religion || null,
            notes: recordForm.notes || null,
        }
        const isUpdate = !!clinicalRecord
        fetch(`${API_BASE_URL}/pacientes/${isUpdate ? 'actualizar-ece' : 'crear-ece'}`, {
            method: isUpdate ? 'PATCH' : 'POST',
            headers,
            body: JSON.stringify(body)
        })
            .then((res) => res.json().then((resBody) => {
                if (!res.ok) throw new Error(resBody.message || 'No se pudo guardar el expediente.')
            }))
            .then(() => {
                setEditingRecord(false)
                fetchAll()
            })
            .catch((err) => { console.error('Error guardando expediente. ', err); Alert.alert('Error', err.message) })
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
            .then((res) => res.json().then((resBody) => {
                if (!res.ok) throw new Error(resBody.message || 'No se pudo registrar.')
            }))
            .then(() => {
                if (kind === 'allergy') setNewAllergy({ name: '', severity: '' })
                if (kind === 'condition') setNewCondition({ name: '', notes: '' })
                if (kind === 'medication') setNewMedication({ name: '', dosage: '', frequency: '' })
                setAddingSection(null)
                fetchAllergiesConditionsMedications(clinicalRecordId)
            })
            .catch((err) => { console.error('Error agregando. ', err); Alert.alert('Error', err.message) })
    }

    const KIND_LABELS = { allergy: 'esta alergia', condition: 'esta condición crónica', medication: 'este medicamento' }

    // Antes esto activaba/desactivaba con un solo toque — un toque accidental
    // sobre la tarjeta (fácil, están una debajo de otra) desactivaba un dato
    // médico real sin darse cuenta. Ahora siempre pide confirmar primero, y el
    // texto de confirmación dice hacia dónde va (activar vs. desactivar),
    // porque el mismo botón sirve para las dos direcciones.
    const applyToggle = (kind, id) => {
        const urlByKind = { allergy: '/pacientes/alternar-alergia', condition: '/pacientes/alternar-condicion', medication: '/pacientes/alternar-medicacion' }
        const bodyKeyByKind = { allergy: 'patientAllergyId', condition: 'patientConditionId', medication: 'patientMedicationId' }
        fetch(`${API_BASE_URL}${urlByKind[kind]}`, {
            method: 'PATCH', headers, body: JSON.stringify({ [bodyKeyByKind[kind]]: id })
        })
            .then((res) => res.json().then((resBody) => {
                if (!res.ok) throw new Error(resBody.message || 'No se pudo actualizar.')
            }))
            .then(() => fetchAllergiesConditionsMedications(clinicalRecord.clinical_record_id))
            .catch((err) => { console.error('Error actualizando. ', err); Alert.alert('Error', err.message) })
    }

    const handleToggle = (kind, id, isCurrentlyActive) => {
        const willActivate = !isCurrentlyActive
        Alert.alert(
            willActivate ? 'Reactivar' : 'Quitar',
            willActivate
                ? `¿Quieres marcar ${KIND_LABELS[kind]} como activa otra vez?`
                : `¿Quieres quitar ${KIND_LABELS[kind]} de la lista activa? Queda en el historial, no se borra.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: willActivate ? 'Reactivar' : 'Quitar', style: willActivate ? 'default' : 'destructive', onPress: () => applyToggle(kind, id) },
            ]
        )
    }

    // La CURP vive en user_profiles (services/usuarios), no en clinical_records
    // — endpoint aparte y deliberadamente angosto (solo permite tocar curp de
    // un paciente rol 5, ver updatePatientCurp en services/usuarios).
    const handleSaveCurp = () => {
        if (!curp.trim()) {
            Alert.alert('CURP vacía', 'Escribe la CURP o cancela la edición.')
            return
        }
        setSavingCurp(true)
        fetch(`${API_BASE_URL}/usuarios/actualizar-curp-paciente`, {
            method: 'PATCH', headers, body: JSON.stringify({ userProfileId, curp: curp.trim() })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo actualizar la CURP.')
            }))
            .then(() => { setCurp((c) => c.trim().toUpperCase()); setEditingCurp(false) })
            .catch((err) => { console.error('Error actualizando CURP. ', err); Alert.alert('Error', err.message) })
            .finally(() => setSavingCurp(false))
    }

    const patientName = [firstName, firstSurname, secondSurname].filter(Boolean).join(' ') || 'Paciente'

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator color="#1565C0" /></View>
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>{patientName}</Text>
            <Text style={styles.hint}>Expediente clínico</Text>

            <View style={styles.curpRow}>
                {editingCurp ? (
                    <>
                        <TextInput
                            style={[styles.input, styles.curpInput]}
                            placeholder="CURP"
                            value={curp}
                            onChangeText={setCurp}
                            autoCapitalize="characters"
                            maxLength={18}
                        />
                        <TouchableOpacity onPress={handleSaveCurp} disabled={savingCurp}>
                            {savingCurp ? <ActivityIndicator color="#1565C0" /> : <Text style={styles.editLink}>Guardar</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setCurp(curpParam || ''); setEditingCurp(false) }} disabled={savingCurp}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.curpText}>CURP: {curp || 'sin registrar'}</Text>
                        <TouchableOpacity onPress={() => setEditingCurp(true)}>
                            <Text style={styles.editLink}>{curp ? 'Corregir' : 'Agregar'}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {!clinicalRecord && !editingRecord && (
                <View style={styles.noRecordBox}>
                    <Text style={styles.hint}>Este paciente no tiene expediente clínico todavía.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => setEditingRecord(true)}>
                        <Text style={styles.primaryButtonText}>Crear expediente</Text>
                    </TouchableOpacity>
                </View>
            )}

            {(clinicalRecord || editingRecord) && (
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.sectionTitle}>Datos básicos</Text>
                        {clinicalRecord && !editingRecord && (
                            <TouchableOpacity onPress={() => setEditingRecord(true)}>
                                <Text style={styles.editLink}>Editar</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {editingRecord ? (
                        <>
                            <View style={styles.row}>
                                <TextInput style={[styles.input, styles.half]} placeholder="Peso (kg)" value={recordForm.weight} onChangeText={(v) => setRecordForm((f) => ({ ...f, weight: v }))} keyboardType="numeric" />
                                <TextInput style={[styles.input, styles.half]} placeholder="Estatura (m)" value={recordForm.height} onChangeText={(v) => setRecordForm((f) => ({ ...f, height: v }))} keyboardType="numeric" />
                            </View>
                            <Text style={styles.miniLabel}>Tipo de sangre</Text>
                            <View style={styles.chipRow}>
                                {bloodTypes.map((bt) => (
                                    <TouchableOpacity
                                        key={bt.blood_type_id}
                                        style={[styles.chip, String(recordForm.bloodTypeId) === String(bt.blood_type_id) && styles.chipSelected]}
                                        onPress={() => setRecordForm((f) => ({ ...f, bloodTypeId: bt.blood_type_id }))}
                                    >
                                        <Text style={[styles.chipText, String(recordForm.bloodTypeId) === String(bt.blood_type_id) && styles.chipTextSelected]}>{bt.blood_type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TextInput style={styles.input} placeholder="Género" value={recordForm.gender} onChangeText={(v) => setRecordForm((f) => ({ ...f, gender: v }))} />
                            <TextInput style={styles.input} placeholder="Lugar de nacimiento" value={recordForm.birthplace} onChangeText={(v) => setRecordForm((f) => ({ ...f, birthplace: v }))} />
                            <View style={styles.row}>
                                <TextInput style={[styles.input, styles.half]} placeholder="Estado civil" value={recordForm.maritalStatus} onChangeText={(v) => setRecordForm((f) => ({ ...f, maritalStatus: v }))} />
                                <TextInput style={[styles.input, styles.half]} placeholder="Ocupación" value={recordForm.occupation} onChangeText={(v) => setRecordForm((f) => ({ ...f, occupation: v }))} />
                            </View>
                            <TextInput style={styles.input} placeholder="Religión" value={recordForm.religion} onChangeText={(v) => setRecordForm((f) => ({ ...f, religion: v }))} />
                            <TextInput style={[styles.input, styles.textarea]} placeholder="Notas generales" value={recordForm.notes} onChangeText={(v) => setRecordForm((f) => ({ ...f, notes: v }))} multiline />

                            <View style={styles.formActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditingRecord(false); if (clinicalRecord) fetchAll() }} disabled={savingRecord}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveRecord} disabled={savingRecord}>
                                    {savingRecord ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.psRow}><Text style={styles.psLabel}>Peso</Text><Text style={styles.psValue}>{clinicalRecord.weight || '—'} kg</Text></View>
                            <View style={styles.psRow}><Text style={styles.psLabel}>Estatura</Text><Text style={styles.psValue}>{clinicalRecord.height || '—'} m</Text></View>
                            <View style={styles.psRow}><Text style={styles.psLabel}>Tipo de sangre</Text><Text style={styles.psValue}>{bloodTypes.find((bt) => String(bt.blood_type_id) === String(clinicalRecord.blood_type_id))?.blood_type || '—'}</Text></View>
                            <View style={styles.psRow}><Text style={styles.psLabel}>Género</Text><Text style={styles.psValue}>{clinicalRecord.gender || '—'}</Text></View>
                        </>
                    )}
                </View>
            )}

            {clinicalRecord && (
                <>
                    <ItemSection
                        title="⚠️ Alergias"
                        items={allergies}
                        idKey="patient_allergy_id"
                        renderItem={(a) => `${a.name}${a.severity ? ` (${a.severity})` : ''}`}
                        tagStyle={styles.tagRed}
                        adding={addingSection === 'allergy'}
                        onToggleAdd={() => setAddingSection(addingSection === 'allergy' ? null : 'allergy')}
                        onToggleActive={(id, isActive) => handleToggle('allergy', id, isActive)}
                        formInputs={
                            <>
                                <TextInput style={styles.input} placeholder="¿A qué es alérgico?" value={newAllergy.name} onChangeText={(v) => setNewAllergy((f) => ({ ...f, name: v }))} />
                                <TextInput style={styles.input} placeholder="Severidad (leve, moderada, grave)" value={newAllergy.severity} onChangeText={(v) => setNewAllergy((f) => ({ ...f, severity: v }))} />
                            </>
                        }
                        onSubmit={() => handleAddItem('allergy')}
                    />

                    <ItemSection
                        title="Condiciones crónicas"
                        items={conditions}
                        idKey="patient_condition_id"
                        renderItem={(c) => c.name}
                        tagStyle={styles.tagOrange}
                        adding={addingSection === 'condition'}
                        onToggleAdd={() => setAddingSection(addingSection === 'condition' ? null : 'condition')}
                        onToggleActive={(id, isActive) => handleToggle('condition', id, isActive)}
                        formInputs={
                            <>
                                <TextInput style={styles.input} placeholder="Condición (ej. Diabetes, Hipertensión)" value={newCondition.name} onChangeText={(v) => setNewCondition((f) => ({ ...f, name: v }))} />
                                <TextInput style={styles.input} placeholder="Notas (opcional)" value={newCondition.notes} onChangeText={(v) => setNewCondition((f) => ({ ...f, notes: v }))} />
                            </>
                        }
                        onSubmit={() => handleAddItem('condition')}
                    />

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Medicamentos</Text>
                            <TouchableOpacity onPress={() => setAddingSection(addingSection === 'medication' ? null : 'medication')}>
                                <Text style={styles.editLink}>{addingSection === 'medication' ? 'Cancelar' : '+ Agregar'}</Text>
                            </TouchableOpacity>
                        </View>
                        {medications.length === 0 && <Text style={styles.hint}>Sin medicamentos registrados.</Text>}
                        {medications.map((m) => (
                            <TouchableOpacity key={m.patient_medication_id} style={[styles.psRow, !m.is_active && styles.inactiveRow]} onPress={() => handleToggle('medication', m.patient_medication_id, m.is_active)}>
                                <Text style={styles.psLabel}>{m.name}</Text>
                                <Text style={styles.psValue}>{m.dosage} · {m.frequency}</Text>
                            </TouchableOpacity>
                        ))}
                        {addingSection === 'medication' && (
                            <View style={styles.addForm}>
                                <TextInput style={styles.input} placeholder="Medicamento" value={newMedication.name} onChangeText={(v) => setNewMedication((f) => ({ ...f, name: v }))} />
                                <View style={styles.row}>
                                    <TextInput style={[styles.input, styles.half]} placeholder="Dosis" value={newMedication.dosage} onChangeText={(v) => setNewMedication((f) => ({ ...f, dosage: v }))} />
                                    <TextInput style={[styles.input, styles.half]} placeholder="Frecuencia" value={newMedication.frequency} onChangeText={(v) => setNewMedication((f) => ({ ...f, frequency: v }))} />
                                </View>
                                <TouchableOpacity style={styles.primaryButton} onPress={() => handleAddItem('medication')}>
                                    <Text style={styles.primaryButtonText}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </>
            )}

            {emergencyPatientId && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Notas de urgencia de esta emergencia</Text>
                    </View>
                    {notes.length === 0 && <Text style={styles.hint}>Sin notas registradas todavía para esta emergencia.</Text>}
                    {notes.map((n) => (
                        <View key={n.emergency_note_id} style={styles.noteCard}>
                            <Text style={styles.noteDate}>{n.recorded_at ? new Date(n.recorded_at).toLocaleString() : ''}</Text>
                            {n.level ? <Text style={styles.noteTriage}>Triage: Nivel {n.level}</Text> : null}
                            {n.blood_pressure ? <Text style={styles.noteLine}>PA: {n.blood_pressure} · FC: {n.heart_rate || '—'} · Temp: {n.temperature || '—'} · SatO2: {n.oxygen_saturation || '—'} · FR: {n.respiratory_rate || '—'}</Text> : null}
                            {(n.glucose_level || n.glasgow_scale || n.pain_scale) ? (
                                <Text style={styles.noteLine}>
                                    {n.glucose_level ? `Glucosa: ${n.glucose_level} mg/dL` : ''}
                                    {n.glasgow_scale ? `${n.glucose_level ? ' · ' : ''}Glasgow: ${n.glasgow_scale}/15` : ''}
                                    {n.pain_scale ? `${(n.glucose_level || n.glasgow_scale) ? ' · ' : ''}Dolor: ${n.pain_scale}/10` : ''}
                                </Text>
                            ) : null}
                            {n.pupils ? <Text style={styles.noteLine}>Pupilas: {n.pupils}</Text> : null}
                            {n.consciousness_level ? <Text style={styles.noteLine}>Conciencia: {n.consciousness_level}</Text> : null}
                            {n.initial_diagnosis ? <Text style={styles.noteLine}>Dx: {n.initial_diagnosis}</Text> : null}
                            {n.treatment_applied ? <Text style={styles.noteLine}>Tx: {n.treatment_applied}</Text> : null}
                            {n.patient_status ? <Text style={styles.noteLine}>Estado: {n.patient_status}</Text> : null}
                        </View>
                    ))}
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => router.push({ pathname: '/notas', params: { emergencyPatientId, firstName: firstName || '', firstSurname: firstSurname || '', secondSurname: secondSurname || '' } })}
                    >
                        <Text style={styles.linkButtonText}>+ Registrar nueva nota de urgencia</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    )
}

// Bloque repetido para alergias/condiciones (lista de tags + form de alta) —
// medicamentos se quedó aparte arriba porque su tarjeta muestra dos líneas
// (nombre + dosis/frecuencia), no un tag suelto.
const ItemSection = ({ title, items, idKey, renderItem, tagStyle, adding, onToggleAdd, onToggleActive, formInputs, onSubmit }) => (
    <View style={styles.section}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <TouchableOpacity onPress={onToggleAdd}>
                <Text style={styles.editLink}>{adding ? 'Cancelar' : '+ Agregar'}</Text>
            </TouchableOpacity>
        </View>
        {items.length === 0 && <Text style={styles.hint}>Sin registros.</Text>}
        <View style={styles.tagRow}>
            {items.map((item) => (
                <TouchableOpacity key={item[idKey]} onPress={() => onToggleActive(item[idKey], item.is_active)}>
                    <Text style={[styles.tag, tagStyle, !item.is_active && styles.tagInactive]}>{renderItem(item)}</Text>
                </TouchableOpacity>
            ))}
        </View>
        {adding && (
            <View style={styles.addForm}>
                {formInputs}
                <TouchableOpacity style={styles.primaryButton} onPress={onSubmit}>
                    <Text style={styles.primaryButtonText}>Guardar</Text>
                </TouchableOpacity>
            </View>
        )}
    </View>
)

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
    hint: { fontSize: 12, color: '#999', marginTop: 4, marginBottom: 8 },
    curpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    curpText: { fontSize: 12, color: '#444', fontWeight: '600', flex: 1 },
    curpInput: { flex: 1, marginBottom: 0, paddingVertical: 6 },
    noRecordBox: { marginTop: 16, alignItems: 'center', gap: 10 },
    card: { marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, backgroundColor: '#fafafa' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    section: { marginTop: 18 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: '#555', textTransform: 'uppercase' },
    editLink: { color: '#1565C0', fontSize: 12, fontWeight: '600' },
    row: { flexDirection: 'row', gap: 8 },
    half: { flex: 1 },
    input: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 },
    textarea: { minHeight: 60, textAlignVertical: 'top' },
    miniLabel: { fontSize: 11, color: '#666', marginBottom: 6, marginTop: 2 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    chip: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 12 },
    chipSelected: { backgroundColor: '#1565C0' },
    chipText: { color: '#1565C0', fontSize: 12, fontWeight: '600' },
    chipTextSelected: { color: '#fff' },
    formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    primaryButton: { backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center' },
    cancelButtonText: { color: '#666', fontSize: 14, fontWeight: '600' },
    psRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    inactiveRow: { opacity: 0.4 },
    psLabel: { fontSize: 12, color: '#444' },
    psValue: { fontSize: 12, fontWeight: '700', color: '#222' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { fontSize: 11, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, overflow: 'hidden' },
    tagRed: { backgroundColor: '#fde8e8', color: '#C0272D' },
    tagOrange: { backgroundColor: '#fff3e0', color: '#E65100' },
    tagInactive: { textDecorationLine: 'line-through', opacity: 0.5 },
    addForm: { marginTop: 8, padding: 10, backgroundColor: '#f7f7fb', borderRadius: 8 },
    linkButton: { marginTop: 10, padding: 6 },
    linkButtonText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
    noteCard: { borderWidth: 1, borderColor: '#e4e4ec', borderRadius: 8, padding: 10, marginBottom: 8 },
    noteDate: { fontSize: 10, color: '#999', marginBottom: 4 },
    noteTriage: { fontSize: 12, fontWeight: '700', color: '#E65100', marginBottom: 2 },
    noteLine: { fontSize: 12, color: '#444', marginBottom: 2 },
})

export default ExpedienteScreen
