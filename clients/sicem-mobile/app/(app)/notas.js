import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

// Antes esta pantalla hacía elegir PRIMERO de entre TODAS las emergencias
// activas del sistema (/emergencias-activas — la misma lista que usa el
// Dashboard del despachador, sin ningún filtro), lo cual no tiene sentido
// para un paramédico: él solo puede registrar notas de la emergencia que
// tiene aceptada AHORA MISMO. Esa lista mostraba cualquier emergencia
// abierta en toda la BD (Hugo reportó ver más de diez, con nombres de tipo
// sueltos y sin descripción, muy confuso) y encima disparaba el warning de
// "key" de React cuando dos entradas venían con el mismo id. Ahora se usa
// acceptedEmergency directo (mismo patrón que paciente.js/mapa.js) — un
// paso menos, y ya no hay forma de elegir una emergencia ajena por error.
const NotasScreen = () => {
    // emergencyPatientId/nombre (opcionales) llegan cuando se entra desde el
    // botón "+ Registrar nueva nota de urgencia" en expediente.js — si vienen,
    // se salta el paso de elegir paciente.
    const params = useLocalSearchParams()
    const { token, user } = useAuth()
    const { acceptedEmergency } = useSocketAlerts()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [patients, setPatients] = useState([])
    const [loadingPatients, setLoadingPatients] = useState(false)
    const [selectedPatientId, setSelectedPatientId] = useState(params.emergencyPatientId || null)
    const [selectedPatientName, setSelectedPatientName] = useState(
        [params.firstName, params.firstSurname, params.secondSurname].filter(Boolean).join(' ') || ''
    )
    const [triageLevels, setTriageLevels] = useState([])

    const [triageLevelId, setTriageLevelId] = useState('')
    const [bloodPressure, setBloodPressure] = useState('')
    const [heartRate, setHeartRate] = useState('')
    const [temperature, setTemperature] = useState('')
    const [oxygenSaturation, setOxygenSaturation] = useState('')
    const [respiratoryRate, setRespiratoryRate] = useState('')
    const [glucoseLevel, setGlucoseLevel] = useState('')
    const [consciousnessLevel, setConsciousnessLevel] = useState('')
    const [glasgowScale, setGlasgowScale] = useState('')
    const [painScale, setPainScale] = useState('')
    const [pupils, setPupils] = useState('')
    const [initialDiagnosis, setInitialDiagnosis] = useState('')
    const [treatmentApplied, setTreatmentApplied] = useState('')
    const [patientStatus, setPatientStatus] = useState('')

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => setTriageLevels((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando niveles de triage. ', err))
    }, [])

    // Solo se piden los pacientes de la emergencia si hace falta elegir uno
    // (no llegó ya preseleccionado desde expediente.js).
    useEffect(() => {
        if (params.emergencyPatientId || !acceptedEmergency?.emergencyId) { setPatients([]); return }
        setLoadingPatients(true)
        fetch(`${API_BASE_URL}/emergencias/pacientes/${acceptedEmergency.emergencyId}`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setPatients((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando pacientes de la emergencia. ', err))
            .finally(() => setLoadingPatients(false))
    }, [acceptedEmergency?.emergencyId, params.emergencyPatientId])

    const handleSelectPatient = (p) => {
        setSelectedPatientId(p.emergency_patient_id)
        setSelectedPatientName(p.first_name ? `${p.first_name} ${p.first_surname || ''}` : 'Paciente no identificado')
    }

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
                glucoseLevel: glucoseLevel || null,
                consciousnessLevel,
                glasgowScale: glasgowScale || null,
                painScale: painScale || null,
                pupils,
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

    if (!acceptedEmergency && !params.emergencyPatientId) {
        return (
            <View style={styles.centered}>
                <Text style={styles.hint}>No tienes ninguna emergencia en curso. Acepta una desde la pestaña Alerta para poder registrar una nota.</Text>
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Nota de urgencia</Text>

            {!params.emergencyPatientId && (
                <>
                    <Text style={styles.sectionTitle}>Paciente</Text>
                    <View style={styles.list}>
                        {loadingPatients && <ActivityIndicator color="#1565C0" style={{ marginVertical: 8 }} />}
                        {!loadingPatients && patients.map((p) => (
                            <TouchableOpacity
                                key={p.emergency_patient_id}
                                style={[styles.rowItem, String(selectedPatientId) === String(p.emergency_patient_id) && styles.rowItemSelected]}
                                onPress={() => handleSelectPatient(p)}
                            >
                                <Text style={String(selectedPatientId) === String(p.emergency_patient_id) ? styles.rowTextSelected : styles.rowText}>
                                    {p.first_name ? `${p.first_name} ${p.first_surname || ''}` : 'Paciente no identificado'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        {!loadingPatients && patients.length === 0 && <Text style={styles.hint}>Esta emergencia todavía no tiene pacientes registrados — usa "Registrar paciente" primero.</Text>}
                    </View>
                </>
            )}

            {params.emergencyPatientId && (
                <Text style={styles.preselectedPatient}>Paciente: {selectedPatientName || 'seleccionado'}</Text>
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
                        <TextInput style={[styles.input, styles.half]} placeholder="Presión arterial (ej. 120/80)" value={bloodPressure} onChangeText={setBloodPressure} />
                        <TextInput style={[styles.input, styles.half]} placeholder="Frec. cardiaca (lpm)" value={heartRate} onChangeText={setHeartRate} keyboardType="numeric" />
                    </View>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.half]} placeholder="Temperatura (°C)" value={temperature} onChangeText={setTemperature} keyboardType="numeric" />
                        <TextInput style={[styles.input, styles.half]} placeholder="Sat. oxígeno (%)" value={oxygenSaturation} onChangeText={setOxygenSaturation} keyboardType="numeric" />
                    </View>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.half]} placeholder="Frec. respiratoria (rpm)" value={respiratoryRate} onChangeText={setRespiratoryRate} keyboardType="numeric" />
                        <TextInput style={[styles.input, styles.half]} placeholder="Glucosa (mg/dL)" value={glucoseLevel} onChangeText={setGlucoseLevel} keyboardType="numeric" />
                    </View>
                    <TextInput style={styles.input} placeholder="Estado de conciencia (ej. Alerta, Verbal, Dolor, No responde)" value={consciousnessLevel} onChangeText={setConsciousnessLevel} />
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.half]} placeholder="Escala de Glasgow (3-15)" value={glasgowScale} onChangeText={setGlasgowScale} keyboardType="numeric" maxLength={2} />
                        <TextInput style={[styles.input, styles.half]} placeholder="Escala de dolor (0-10)" value={painScale} onChangeText={setPainScale} keyboardType="numeric" maxLength={2} />
                    </View>
                    <TextInput style={styles.input} placeholder="Pupilas (ej. isocóricas y reactivas)" value={pupils} onChangeText={setPupils} />

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
    preselectedPatient: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
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
