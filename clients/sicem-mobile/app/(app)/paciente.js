import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

const PacienteScreen = () => {
    const { token } = useAuth()
    const { acceptedEmergency } = useSocketAlerts()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [curp, setCurp] = useState('')
    const [searching, setSearching] = useState(false)
    const [found, setFound] = useState(null) // null=no buscado, true/false=resultado
    const [profile, setProfile] = useState(null)
    const [clinicalRecord, setClinicalRecord] = useState(null)
    const [allergies, setAllergies] = useState([])
    const [conditions, setConditions] = useState([])
    const [medications, setMedications] = useState([])

    const handleSearch = () => {
        if (!curp.trim()) return
        setSearching(true)
        setFound(null)
        setClinicalRecord(null)

        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp.trim()}`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => {
                if (!data || data.length === 0) {
                    setFound(false)
                    setSearching(false)
                    return
                }
                const p = toLowerCaseKeys(data[0])
                setProfile(p)
                setFound(true)

                // Antecedentes clínicos: primero el expediente (ece), luego sus 3
                // catálogos en paralelo — GET /pacientes/ece/:userProfileId nunca se
                // había llamado desde ningún cliente antes de esto.
                fetch(`${API_BASE_URL}/pacientes/ece/${p.user_profile_id}`, { headers })
                    .then((res) => res.json())
                    .then(({ clinicalRecord: recRows }) => {
                        if (!recRows || recRows.length === 0) { setSearching(false); return }
                        const rec = toLowerCaseKeys(recRows[0])
                        setClinicalRecord(rec)

                        Promise.all([
                            fetch(`${API_BASE_URL}/pacientes/alergias/${rec.clinical_record_id}`, { headers }).then((r) => r.json()),
                            fetch(`${API_BASE_URL}/pacientes/condiciones/${rec.clinical_record_id}`, { headers }).then((r) => r.json()),
                            fetch(`${API_BASE_URL}/pacientes/medicamentos/${rec.clinical_record_id}`, { headers }).then((r) => r.json()),
                        ])
                            .then(([alRes, condRes, medRes]) => {
                                setAllergies((alRes.allergies || []).map(toLowerCaseKeys))
                                setConditions((condRes.conditions || []).map(toLowerCaseKeys))
                                setMedications((medRes.medications || []).map(toLowerCaseKeys))
                            })
                            .finally(() => setSearching(false))
                    })
                    .catch((err) => { console.error('Error recuperando expediente clínico. ', err); setSearching(false) })
            })
            .catch((err) => {
                console.error('Error buscando por CURP. ', err)
                setSearching(false)
            })
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Historial clínico</Text>
            <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="CURP del paciente" value={curp} onChangeText={setCurp} autoCapitalize="characters" maxLength={18} />
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                    {searching ? <ActivityIndicator color="#1565C0" /> : <Text style={styles.searchBtnText}>Buscar</Text>}
                </TouchableOpacity>
            </View>

            {found === false && (
                <View style={styles.notFoundBox}>
                    <Text style={styles.notFoundText}>No se encontró ningún paciente con esa CURP.</Text>
                    {acceptedEmergency ? (
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => router.push({ pathname: '/registrar-paciente', params: { emergencyId: acceptedEmergency.emergencyId } })}
                        >
                            <Text style={styles.linkButtonText}>Registrar como paciente nuevo →</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.hint}>Acepta una emergencia primero para poder registrar pacientes en ella.</Text>
                    )}
                </View>
            )}

            {found === true && profile && (
                <View style={styles.card}>
                    <Text style={styles.psName}>{profile.first_name} {profile.first_surname} {profile.second_surname}</Text>
                    <Text style={styles.psCurp}>CURP: {curp.trim()}</Text>

                    {clinicalRecord ? (
                        <>
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Datos básicos</Text>
                                <View style={styles.psRow}><Text style={styles.psLabel}>Peso</Text><Text style={styles.psValue}>{clinicalRecord.weight || '—'} kg</Text></View>
                                <View style={styles.psRow}><Text style={styles.psLabel}>Estatura</Text><Text style={styles.psValue}>{clinicalRecord.height || '—'} m</Text></View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>⚠️ Alergias</Text>
                                {allergies.length === 0 && <Text style={styles.hint}>Sin alergias registradas.</Text>}
                                <View style={styles.tagRow}>
                                    {allergies.map((a) => <Text key={a.patient_allergy_id} style={[styles.tag, styles.tagRed]}>{a.name}</Text>)}
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Condiciones crónicas</Text>
                                {conditions.length === 0 && <Text style={styles.hint}>Sin condiciones registradas.</Text>}
                                <View style={styles.tagRow}>
                                    {conditions.map((c) => <Text key={c.patient_condition_id} style={[styles.tag, styles.tagOrange]}>{c.name}</Text>)}
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Medicamentos</Text>
                                {medications.length === 0 && <Text style={styles.hint}>Sin medicamentos registrados.</Text>}
                                {medications.map((m) => (
                                    <View key={m.patient_medication_id} style={styles.psRow}>
                                        <Text style={styles.psLabel}>{m.name}</Text>
                                        <Text style={styles.psValue}>{m.dosage} · {m.frequency}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : (
                        <Text style={styles.hint}>Este paciente no tiene expediente clínico registrado todavía.</Text>
                    )}

                    {acceptedEmergency && (
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => router.push({ pathname: '/notas', params: { emergencyId: acceptedEmergency.emergencyId } })}
                        >
                            <Text style={styles.linkButtonText}>Registrar nota de urgencia para esta emergencia →</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
    row: { flexDirection: 'row', gap: 8 },
    input: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 10, fontSize: 14 },
    searchBtn: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
    searchBtnText: { color: '#1565C0', fontWeight: '600', fontSize: 13 },
    hint: { fontSize: 12, color: '#999', marginTop: 4 },
    notFoundBox: { marginTop: 16 },
    notFoundText: { color: '#E67E22', fontSize: 13, fontStyle: 'italic' },
    card: { marginTop: 16 },
    psName: { fontSize: 16, fontWeight: '700', color: '#222' },
    psCurp: { fontSize: 11, color: '#888', marginBottom: 12 },
    section: { marginBottom: 14 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 6 },
    psRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    psLabel: { fontSize: 12, color: '#444' },
    psValue: { fontSize: 12, fontWeight: '700', color: '#222' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { fontSize: 11, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
    tagRed: { backgroundColor: '#fde8e8', color: '#C0272D' },
    tagOrange: { backgroundColor: '#fff3e0', color: '#E65100' },
    linkButton: { marginTop: 12, padding: 10 },
    linkButtonText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
})

export default PacienteScreen
