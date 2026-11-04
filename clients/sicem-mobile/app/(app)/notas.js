import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors, contentColumn } from '../../constants/theme'
import { Button, Field, ChoiceChips, Notice, SectionTitle, ROMAN, TRIAGE_COLORS, TRIAGE_NAMES } from '../../components/ui'

// Nota de urgencia del paciente que el paramédico tiene enfrente. Solo se escribe lo que se mide: todo es opcional,
// pero al menos un dato debe capturarse. Los rangos imposibles se bloquean (un dedo mal puesto no debe quedar en el
// expediente); los valores fuera de lo normal se marcan para que se noten al revisar.
const LIMITS = {
    heartRate: { label: 'Frec. cardiaca', unit: 'lpm', min: 10, max: 300, warn: (v) => (v < 50 ? 'Baja' : v > 120 ? 'Alta' : '') },
    temperature: { label: 'Temperatura', unit: '°C', min: 25, max: 45, warn: (v) => (v < 35.5 ? 'Baja' : v >= 38 ? 'Fiebre' : '') },
    oxygenSaturation: { label: 'Sat. de oxígeno', unit: '%', min: 30, max: 100, warn: (v) => (v < 92 ? 'Baja' : '') },
    respiratoryRate: { label: 'Frec. respiratoria', unit: 'rpm', min: 2, max: 80, warn: (v) => (v < 10 ? 'Baja' : v > 24 ? 'Alta' : '') },
    glucoseLevel: { label: 'Glucosa', unit: 'mg/dL', min: 10, max: 1000, warn: (v) => (v < 70 ? 'Baja' : v > 250 ? 'Alta' : '') },
    glasgowScale: { label: 'Escala de Glasgow', unit: '3-15', min: 3, max: 15, warn: (v) => (v <= 12 ? 'Alterada' : '') },
    painScale: { label: 'Dolor', unit: '0-10', min: 0, max: 10, warn: (v) => (v >= 7 ? 'Intenso' : '') },
}

const CONSCIOUSNESS = ['Alerta', 'Responde a la voz', 'Responde al dolor', 'No responde'].map((v) => ({ value: v, label: v }))
const PUPILS = ['Isocóricas reactivas', 'Midriáticas', 'Mióticas', 'Anisocóricas', 'Arreactivas'].map((v) => ({ value: v, label: v }))
const PATIENT_STATUS = ['Estable', 'Delicado', 'Grave', 'Crítico'].map((v) => ({ value: v, label: v }))

const NotasScreen = () => {
    // emergencyPatientId/nombre llegan cuando se entra desde la pantalla de atención o el expediente
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
    const [f, setF] = useState({
        triageLevelId: '', bloodPressure: '', heartRate: '', temperature: '', oxygenSaturation: '', respiratoryRate: '',
        glucoseLevel: '', consciousnessLevel: '', glasgowScale: '', painScale: '', pupils: '',
        initialDiagnosis: '', treatmentApplied: '', patientStatus: '',
    })
    const set = (key) => (value) => setF((cur) => ({ ...cur, [key]: value }))

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/emergencias/niveles-triage`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => setTriageLevels((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando niveles de triage. ', err))
    }, [])

    // Solo se piden los pacientes si hace falta elegir uno (no llegó preseleccionado)
    useEffect(() => {
        if (params.emergencyPatientId || !acceptedEmergency?.emergencyId) { setPatients([]); return }
        setLoadingPatients(true)
        fetch(`${API_BASE_URL}/emergencias/pacientes/${acceptedEmergency.emergencyId}`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setPatients((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando pacientes de la emergencia. ', err))
            .finally(() => setLoadingPatients(false))
    }, [acceptedEmergency?.emergencyId, params.emergencyPatientId])

    // Validación de los campos numéricos: error si es imposible, aviso si es anormal
    const checks = useMemo(() => {
        const out = {}
        Object.entries(LIMITS).forEach(([key, lim]) => {
            const raw = String(f[key] ?? '').trim().replace(',', '.')
            if (raw === '') return
            const n = Number(raw)
            if (Number.isNaN(n)) out[key] = { error: 'Escribe solo números.' }
            else if (n < lim.min || n > lim.max) out[key] = { error: `Valor imposible: debe estar entre ${lim.min} y ${lim.max}.` }
            else if (lim.warn(n)) out[key] = { warn: lim.warn(n) }
        })
        if (f.bloodPressure.trim() && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(f.bloodPressure.trim())) {
            out.bloodPressure = { error: 'Usa el formato 120/80.' }
        }
        return out
    }, [f])

    const hasErrors = Object.values(checks).some((c) => c.error)
    const hasAnyData = [f.bloodPressure, f.heartRate, f.temperature, f.oxygenSaturation, f.respiratoryRate, f.glucoseLevel, f.glasgowScale, f.painScale,
        f.consciousnessLevel, f.pupils, f.initialDiagnosis, f.treatmentApplied, f.patientStatus, f.triageLevelId].some((v) => String(v).trim() !== '')

    const handleSubmit = () => {
        setSubmitted(true)
        setError('')
        if (!selectedPatientId) { setError('Elige primero al paciente.'); return }
        if (!hasAnyData) { setError('Captura al menos un dato antes de guardar.'); return }
        if (hasErrors) { setError('Corrige los valores marcados en rojo.'); return }
        setSaving(true)
        const num = (v) => (String(v).trim() === '' ? '' : String(v).trim().replace(',', '.'))
        fetch(`${API_BASE_URL}/emergencias/registrar-nota-urgencia`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                emergencyPatientId: selectedPatientId,
                userProfileId: user.profileId,
                triageLevelId: f.triageLevelId || null,
                bloodPressure: f.bloodPressure.trim(),
                heartRate: num(f.heartRate),
                temperature: num(f.temperature),
                oxygenSaturation: num(f.oxygenSaturation),
                respiratoryRate: num(f.respiratoryRate),
                glucoseLevel: num(f.glucoseLevel) || null,
                consciousnessLevel: f.consciousnessLevel,
                glasgowScale: num(f.glasgowScale) || null,
                painScale: num(f.painScale) || null,
                pupils: f.pupils,
                initialDiagnosis: f.initialDiagnosis.trim(),
                treatmentApplied: f.treatmentApplied.trim(),
                patientStatus: f.patientStatus,
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

    const numberField = (key, extra = {}) => {
        const lim = LIMITS[key]
        const chk = checks[key]
        return (
            <Field
                key={key}
                style={styles.half}
                label={lim.label}
                unit={lim.unit}
                value={f[key]}
                onChangeText={set(key)}
                keyboardType="decimal-pad"
                maxLength={6}
                error={chk?.error}
                hint={chk?.warn ? `⚠ ${chk.warn}` : undefined}
                inputStyle={chk?.warn ? styles.inputWarn : undefined}
                {...extra}
            />
        )
    }

    if (success) {
        return (
            <View style={styles.centered}>
                <Text style={styles.successTitle}>Nota guardada</Text>
                <Text style={styles.successText}>Ya la puede ver el hospital destino.</Text>
                <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
                    <Button label="Volver" tone="primary" onPress={() => router.back()} />
                    <Button label="Registrar otra nota" tone="neutral" onPress={() => { setSuccess(false); setSubmitted(false) }} />
                </View>
            </View>
        )
    }

    if (!acceptedEmergency && !params.emergencyPatientId) {
        return (
            <View style={styles.centered}>
                <Text style={styles.successTitle}>Sin emergencia en curso</Text>
                <Text style={styles.successText}>Cuando te asignen una, aquí podrás registrar la nota de cada paciente.</Text>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {params.emergencyPatientId ? (
                    <View style={styles.patientBar}>
                        <Text style={styles.patientBarLabel}>Paciente</Text>
                        <Text style={styles.patientBarName}>{selectedPatientName || 'Paciente seleccionado'}</Text>
                    </View>
                ) : (
                    <>
                        <SectionTitle>¿De qué paciente es la nota?</SectionTitle>
                        {loadingPatients && <ActivityIndicator color={colors.steel} />}
                        {!loadingPatients && patients.length === 0 && (
                            <>
                                <Notice tone="warn">Esta emergencia todavía no tiene pacientes. Registra al paciente primero y después anota sus signos.</Notice>
                                <Button
                                    label="Registrar paciente"
                                    tone="steel"
                                    onPress={() => router.push({ pathname: '/registrar-paciente', params: { emergencyId: acceptedEmergency?.emergencyId } })}
                                    style={{ marginTop: 4 }}
                                />
                            </>
                        )}
                        {patients.map((p) => {
                            const selected = String(selectedPatientId) === String(p.emergency_patient_id)
                            const name = p.first_name ? `${p.first_name} ${p.first_surname || ''}`.trim() : 'Paciente no identificado'
                            return (
                                <TouchableOpacity
                                    key={p.emergency_patient_id}
                                    style={[styles.patientOption, selected && styles.patientOptionOn]}
                                    onPress={() => { setSelectedPatientId(p.emergency_patient_id); setSelectedPatientName(name) }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                >
                                    <Text style={[styles.patientOptionText, selected && { color: colors.steel }]}>{name}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </>
                )}

                {selectedPatientId ? (
                    <>
                        <SectionTitle>Nivel de triage</SectionTitle>
                        <ChoiceChips
                            options={triageLevels.map((t) => {
                                const n = Number(t.level) || ({ I: 1, II: 2, III: 3, IV: 4, V: 5 })[String(t.level).toUpperCase()]
                                return { value: t.triage_level_id, label: `${ROMAN[n] || t.level} ${TRIAGE_NAMES[n] || ''}`.trim(), n }
                            })}
                            value={f.triageLevelId}
                            onChange={set('triageLevelId')}
                            getColor={(opt) => TRIAGE_COLORS[opt.n] || colors.steel}
                        />

                        <SectionTitle>Signos vitales</SectionTitle>
                        <View style={styles.grid}>
                            <Field
                                style={styles.half} label="Presión arterial" unit="mmHg" value={f.bloodPressure} onChangeText={set('bloodPressure')}
                                keyboardType="numbers-and-punctuation" maxLength={7} placeholder="120/80" error={checks.bloodPressure?.error}
                            />
                            {numberField('heartRate')}
                            {numberField('oxygenSaturation')}
                            {numberField('temperature')}
                            {numberField('respiratoryRate')}
                            {numberField('glucoseLevel')}
                        </View>

                        <SectionTitle>Estado neurológico</SectionTitle>
                        <Text style={styles.chipLabel}>Conciencia</Text>
                        <ChoiceChips options={CONSCIOUSNESS} value={f.consciousnessLevel} onChange={set('consciousnessLevel')} />
                        <Text style={styles.chipLabel}>Pupilas</Text>
                        <ChoiceChips options={PUPILS} value={f.pupils} onChange={set('pupils')} />
                        <View style={[styles.grid, { marginTop: 14 }]}>
                            {numberField('glasgowScale', { maxLength: 2, keyboardType: 'number-pad' })}
                            {numberField('painScale', { maxLength: 2, keyboardType: 'number-pad' })}
                        </View>

                        <SectionTitle>Evaluación</SectionTitle>
                        <Field label="Diagnóstico inicial" value={f.initialDiagnosis} onChangeText={set('initialDiagnosis')} multiline maxLength={500} />
                        <Field label="Tratamiento aplicado" value={f.treatmentApplied} onChangeText={set('treatmentApplied')} multiline maxLength={500} />
                        <Text style={styles.chipLabel}>Estado del paciente</Text>
                        <ChoiceChips
                            options={PATIENT_STATUS} value={f.patientStatus} onChange={set('patientStatus')}
                            getColor={(opt) => ({ Estable: colors.ok, Delicado: '#D9A400', Grave: '#E8710A', Crítico: colors.brand }[opt.value])}
                        />
                    </>
                ) : null}
                <View style={{ height: 12 }} />
            </ScrollView>

            {selectedPatientId ? (
                <View style={styles.bottomBar}>
                    {error && submitted ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                    <Button label="Guardar nota" tone="primary" onPress={handleSubmit} loading={saving} />
                </View>
            ) : null}
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16, paddingBottom: 24, ...contentColumn },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
    successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
    successText: { fontSize: 16, color: colors.text2, textAlign: 'center', marginTop: 6 },
    patientBar: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
    patientBarLabel: { fontSize: 13, fontWeight: '700', color: colors.text3 },
    patientBarName: { fontSize: 20, fontWeight: '800', color: colors.text },
    patientOption: { minHeight: 52, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 14, justifyContent: 'center', marginBottom: 8 },
    patientOptionOn: { borderColor: colors.steel, backgroundColor: colors.steelSoft },
    patientOptionText: { fontSize: 17, fontWeight: '700', color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    half: { width: '47.5%', marginBottom: 2 },
    inputWarn: { borderColor: colors.warn, backgroundColor: colors.warnSoft },
    chipLabel: { fontSize: 14, fontWeight: '600', color: colors.text2, marginBottom: 8, marginTop: 4 },
    bottomBar: { padding: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, gap: 8, alignItems: 'center' },
    error: { color: colors.brand, fontSize: 14, fontWeight: '700', textAlign: 'center' },
})

export default NotasScreen
