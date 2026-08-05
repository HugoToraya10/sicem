import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

const NotasScreen = () => {
    const { token, user } = useAuth()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    // Paso 1: elegir emergencia -> Paso 2: elegir paciente -> Paso 3: formulario
    const [emergencies, setEmergencies] = useState([])
    const [selectedEmergencyId, setSelectedEmergencyId] = useState(null)
    const [patients, setPatients] = useState([])
    const [selectedPatientId, setSelectedPatientId] = useState(null)
    const [triageLevels, setTriageLevels] = useState([])

    const [triageLevelId, setTriageLevelId] = useState('')
    const [bloodPressure, setBloodPressure] = useState('')
    const [heartRate, setHeartRate] = useState('')
    const [temperature, setTemperature] = useState('')
    const [oxygenSaturation, setOxygenSaturation] = useState('')
    const [respiratoryRate, setRespiratoryRate] = useState('')
    const [consciousnessLevel, setConsciousnessLevel] = useState('')
    const [initialDiagnosis, setInitialDiagnosis] = useState('')
    const [treatmentApplied, setTreatmentApplied] = useState('')
    const [patientStatus, setPatientStatus] = useState('')

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/emergencias-activas`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setEmergencies(data || []))
            .catch((err) => console.error('Error recuperando emergencias activas. ', err))

        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => setTriageLevels((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando niveles de triage. ', err))
    }, [])

    useEffect(() => {
        if (!selectedEmergencyId) { setPatients([]); return }
        fetch(`${API_BASE_URL}/emergencias/pacientes/${selectedEmergencyId}`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setPatients((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando pacientes de la emergencia. ', err))
    }, [selectedEmergencyId])

    const handleSubmit = () => {
        setError('')
        if (!selectedPatientId) {
            setError('Selecciona un paciente.')
            return
        }
        setSaving(true)
        fetch(`${API_BASE_URL}/emergencias/registrar-nota-urgencia`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                emergencyPatientId: selectedPatientId,
                userProfileId: user.profileId,
                triageLevelId: triageLevelId || null,
                bloodPressure,
                heartRate,
                temperature,
                oxygenSaturation,
                respiratoryRate,
                consciousnessLevel,
                initialDiagnosis,
                treatmentApplied,
                patientStatus,
            })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo registrar la nota.')
                return body
            }))
            .then(() => setSuccess(true))
            .catch((err) => {
                console.error('Error registrando nota de urgencia. ', err)
                setError(err.message)
            })
            .finally(() => setSaving(false))
    }

    if (success) {
        return (
            <View style={styles.centered}>
                <Text style={styles.successText}>Nota registrada ✓</Text>
                <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Volver</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Nota de urgencia</Text>

            <Text style={styles.sectionTitle}>Emergencia</Text>
            <View style={styles.list}>
                {emergencies.map((em) => (
                    <TouchableOpacity
                        key={em.emergency_id}
                        style={[styles.rowItem, String(selectedEmergencyId) === String(em.emergency_id) && styles.rowItemSelected]}
                        onPress={() => { setSelectedEmergencyId(em.emergency_id); setSelectedPatientId(null) }}
                    >
                        <Text style={String(selectedEmergencyId) === String(em.emergency_id) ? styles.rowTextSelected : styles.rowText}>
                            {em.type_name || 'Emergencia'} — {em.description}
                        </Text>
                    </TouchableOpacity>
                ))}
                {emergencies.length === 0 && <Text style={styles.hint}>Sin emergencias activas.</Text>}
            </View>

            {selectedEmergencyId && (
                <>
                    <Text style={styles.sectionTitle}>Paciente</Text>
                    <View style={styles.list}>
                        {patients.map((p) => (
                            <TouchableOpacity
                                key={p.emergency_patient_id}
                                style={[styles.rowItem, String(selectedPatientId) === String(p.emergency_patient_id) && styles.rowItemSelected]}
                                onPress={() => setSelectedPatientId(p.emergency_patient_id)}
                            >
                                <Text style={String(selectedPatientId) === String(p.emergency_patient_id) ? styles.rowTextSelected : styles.rowText}>
                                    {p.first_name ? `${p.first_name} ${p.first_surname || ''}` : 'Paciente no identificado'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        {patients.length === 0 && <Text style={styles.hint}>Esta emergencia todavía no tiene pacientes registrados — usa "Registrar paciente" primero.</Text>}
                    </View>
                </>
            )}

            {selectedPatientId && (
                <>
                    <Text style={styles.sectionTitle}>Nivel de triage</Text>
                    <View style={styles.chipRow}>
                        {triageLevels.map((t) => (
                            <TouchableOpacity
                                key={t.triage_level_id}
                                style={[styles.chip, String(triageLevelId) === String(t.triage_level_id) && styles.chipSelected]}
                                onPress={() => setTriageLevelId(t.triage_level_id)}
                            >
                                <Text style={[styles.chipText, String(triageLevelId) === String(t.triage_level_id) && styles.chipTextSelected]}>
                                    Nivel {t.level}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>Signos vitales</Text>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.half]} placeholder="Presión arterial" value={bloodPressure} onChangeText={setBloodPressure} />
                        <TextInput style={[styles.input, styles.half]} placeholder="Frec. cardiaca" value={heartRate} onChangeText={setHeartRate} keyboardType="numeric" />
                    </View>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.half]} placeholder="Temperatura" value={temperature} onChangeText={setTemperature} keyboardType="numeric" />
                        <TextInput style={[styles.input, styles.half]} placeholder="Sat. oxígeno" value={oxygenSaturation} onChangeText={setOxygenSaturation} keyboardType="numeric" />
                    </View>
                    <TextInput style={styles.input} placeholder="Frecuencia respiratoria" value={respiratoryRate} onChangeText={setRespiratoryRate} keyboardType="numeric" />
                    <TextInput style={styles.input} placeholder="Estado de conciencia (ej. Alerta, Verbal, Dolor, No responde)" value={consciousnessLevel} onChangeText={setConsciousnessLevel} />

                    <Text style={styles.sectionTitle}>Evaluación</Text>
                    <TextInput style={[styles.input, styles.textarea]} placeholder="Diagnóstico inicial" value={initialDiagnosis} onChangeText={setInitialDiagnosis} multiline />
                    <TextInput style={[styles.input, styles.textarea]} placeholder="Tratamiento aplicado" value={treatmentApplied} onChangeText={setTreatmentApplied} multiline />
                    <TextInput style={styles.input} placeholder="Estado del paciente" value={patientStatus} onChangeText={setPatientStatus} />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrar nota</Text>}
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
    hint: { fontSize: 12, color: '#999' },
    list: { marginBottom: 4 },
    rowItem: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 10, marginBottom: 6 },
    rowItemSelected: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
    rowText: { fontSize: 13, color: '#333' },
    rowTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    chipSelected: { backgroundColor: '#1565C0' },
    chipText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
    chipTextSelected: { color: '#fff' },
    row: { flexDirection: 'row', gap: 8 },
    half: { flex: 1 },
    input: {
        borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8,
        padding: 10, marginBottom: 10, fontSize: 14,
    },
    textarea: { minHeight: 60, textAlignVertical: 'top' },
    error: { color: '#C0272D', fontSize: 13, marginBottom: 10, textAlign: 'center' },
    button: {
        backgroundColor: '#1565C0', borderRadius: 8, padding: 14,
        alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 24,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    successText: { fontSize: 18, fontWeight: '700', color: '#2E7D32', marginBottom: 16 },
})

export default NotasScreen
