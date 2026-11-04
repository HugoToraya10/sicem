import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Alert } from '../../utils/alert'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors, contentColumn, TOUCH } from '../../constants/theme'
import { Reveal, Button } from '../../components/ui'

const PacienteScreen = () => {
    const { token } = useAuth()
    const { activeAmbulanceId } = useAmbulance()
    const { acceptedEmergency, patientListVersion } = useSocketAlerts()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    // Pacientes YA registrados en la emergencia en curso — antes solo se podía
    // buscar de uno en uno por CURP, sin ver de un vistazo a quién le falta
    // destino, o si ya se registró su nota de urgencia.
    const [emergencyPatients, setEmergencyPatients] = useState([])
    const [loadingEmergencyPatients, setLoadingEmergencyPatients] = useState(false)

    const [curp, setCurp] = useState('')
    const [searching, setSearching] = useState(false)
    const [found, setFound] = useState(null) // null=no buscado, true/false=resultado
    const [profile, setProfile] = useState(null)

    // Reasignación de destino por el paramédico (Fase 4): cuando el paciente
    // pertenece a otra institución, el paramédico lo manda a donde corresponde.
    const [institutions, setInstitutions] = useState([])
    const [reassigningPatientId, setReassigningPatientId] = useState(null)
    const [reassigningBusy, setReassigningBusy] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/usuarios/obtener-instituciones`)
            .then((res) => res.json())
            .then(({ institutions }) => setInstitutions((institutions || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando instituciones. ', err))
    }, [])

    const handleReassign = (emergencyPatientId, newDestinationInstitutionId) => {
        setReassigningBusy(true)
        fetch(`${API_BASE_URL}/emergencias/reasignar-destino-paciente`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ emergencyPatientId, newDestinationInstitutionId })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo reasignar el destino')
                return body
            }))
            .then(() => {
                setReassigningPatientId(null)
                fetchEmergencyPatients()
            })
            .catch((err) => Alert.alert('No se pudo reasignar', err.message || 'Intenta de nuevo.'))
            .finally(() => setReassigningBusy(false))
    }

    const fetchEmergencyPatients = () => {
        if (!acceptedEmergency?.emergencyId) { setEmergencyPatients([]); return }
        setLoadingEmergencyPatients(true)
        fetch(`${API_BASE_URL}/emergencias/pacientes/${acceptedEmergency.emergencyId}`, { headers })
            .then((res) => res.json())
            .then(({ data }) => setEmergencyPatients((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando pacientes de la emergencia. ', err))
            .finally(() => setLoadingEmergencyPatients(false))
    }

    useEffect(fetchEmergencyPatients, [acceptedEmergency?.emergencyId, patientListVersion])

    // Las pestañas de expo-router se quedan MONTADAS al cambiar entre ellas
    // (no se desmontan/vuelven a montar) — así que el useEffect de arriba
    // (que depende de acceptedEmergency?.emergencyId) NO se vuelve a correr
    // solo por volver a esta pestaña si la emergencia ya era la misma de
    // antes. useFocusEffect sí corre cada vez que la pestaña vuelve a estar
    // en pantalla — se deja como respaldo (p. ej. si el socket se perdió un
    // aviso mientras la app estaba en segundo plano), pero patientListVersion
    // arriba ya cubre el caso normal: un paciente que se registra (desde
    // sicem-web/NewEmergency.jsx, sicem-desktop, o "Registrar paciente" en
    // este mismo celular) ahora aparece al instante, sin tener que salir y
    // volver a entrar a la pestaña.
    useFocusEffect(useCallback(() => { fetchEmergencyPatients() }, [acceptedEmergency?.emergencyId]))

    const handleSearch = () => {
        if (!curp.trim()) return
        setSearching(true)
        setFound(null)

        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${encodeURIComponent(curp.trim().toUpperCase())}`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => {
                setSearching(false)
                if (!data || data.length === 0) {
                    setFound(false)
                    return
                }
                setProfile(toLowerCaseKeys(data[0]))
                setFound(true)
            })
            .catch((err) => {
                console.error('Error buscando por CURP. ', err)
                setSearching(false)
            })
    }

    const goToExpediente = (userProfileId, firstName, firstSurname, secondSurname, emergencyPatientId, curpValue) => {
        router.push({
            pathname: '/expediente',
            params: { userProfileId, firstName: firstName || '', firstSurname: firstSurname || '', secondSurname: secondSurname || '', emergencyPatientId: emergencyPatientId || '', curp: curpValue || '' }
        })
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Pacientes</Text>
            <Text style={styles.lead}>{acceptedEmergency ? 'Quién va en tu emergencia y a qué hospital lo llevas.' : 'Busca un paciente por CURP para consultar o completar su expediente.'}</Text>

            {acceptedEmergency && (
                <Reveal><View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pacientes de esta emergencia</Text>
                    {loadingEmergencyPatients && <ActivityIndicator color={colors.steel} style={{ marginVertical: 8 }} />}
                    {!loadingEmergencyPatients && emergencyPatients.length === 0 && (
                        <Text style={styles.hint}>Todavía no hay pacientes registrados en esta emergencia.</Text>
                    )}
                    {emergencyPatients.map((p) => {
                        const isMine = String(p.ambulance_id) === String(activeAmbulanceId)
                        const canReassign = isMine && !p.delivered_at && !p.discharged_at
                        return (
                            <View key={p.emergency_patient_id}>
                                <TouchableOpacity
                                    style={styles.patientRow}
                                    onPress={() => goToExpediente(p.user_profile_id, p.first_name, p.first_surname, p.second_surname, p.emergency_patient_id, p.curp)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.patientRowName}>
                                            {p.first_name ? `${p.first_name} ${p.first_surname || ''}` : 'Paciente no identificado'}
                                            {isMine && <Text style={styles.mineTag}> · tu unidad</Text>}
                                        </Text>
                                        <Text style={styles.patientRowMeta}>CURP: {p.curp || 'sin registrar'}</Text>
                                        <Text style={[styles.destination, !p.destination_institution_name && styles.destinationMissing]}>
                                            {p.destination_institution_name ? `→ ${p.destination_institution_name}` : 'Sin hospital destino'}
                                        </Text>
                                        {p.reception_status_name ? <Text style={styles.statusPill}>{p.reception_status_name}</Text> : null}
                                    </View>
                                    <Text style={styles.chevron}>›</Text>
                                </TouchableOpacity>

                                {canReassign && reassigningPatientId === p.emergency_patient_id && (
                                    <View style={styles.reassignBox}>
                                        <Text style={styles.reassignTitle}>¿A dónde llevas al paciente?</Text>
                                        {institutions.map((inst) => (
                                            <TouchableOpacity
                                                key={inst.institution_id}
                                                style={styles.reassignOption}
                                                onPress={() => handleReassign(p.emergency_patient_id, inst.institution_id)}
                                                disabled={reassigningBusy}
                                            >
                                                <Text style={styles.reassignOptionText}>{inst.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity style={styles.reassignCancel} onPress={() => setReassigningPatientId(null)} disabled={reassigningBusy}>
                                            <Text style={styles.reassignCancelText}>Cancelar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {canReassign && reassigningPatientId !== p.emergency_patient_id && (
                                    <TouchableOpacity style={styles.linkButton} onPress={() => setReassigningPatientId(p.emergency_patient_id)}>
                                        <Text style={styles.linkButtonText}>↦ Cambiar destino de este paciente</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )
                    })}
                    <Button
                        label="Registrar paciente en esta emergencia"
                        tone={emergencyPatients.length === 0 ? 'steel' : 'neutral'}
                        onPress={() => router.push({ pathname: '/registrar-paciente', params: { emergencyId: acceptedEmergency.emergencyId } })}
                        style={{ marginTop: 14 }}
                    />
                </View></Reveal>
            )}

            <Reveal delay={90}><View style={styles.section}>
                <Text style={styles.sectionTitle}>Buscar cualquier paciente por CURP</Text>
                <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="CURP del paciente" value={curp} onChangeText={(v) => setCurp(v.toUpperCase())} autoCapitalize="characters" maxLength={18} />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                        {searching ? <ActivityIndicator color={colors.steel} /> : <Text style={styles.searchBtnText}>Buscar</Text>}
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
                    <TouchableOpacity
                        style={styles.patientRow}
                        onPress={() => goToExpediente(profile.user_profile_id, profile.first_name, profile.first_surname, profile.second_surname, null, profile.curp)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.patientRowName}>{profile.first_name} {profile.first_surname} {profile.second_surname}</Text>
                            <Text style={styles.patientRowMeta}>Ver/editar expediente clínico completo</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                )}
            </View></Reveal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, gap: 4, ...contentColumn },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    lead: { fontSize: 14, color: colors.text2, marginTop: 2, marginBottom: 14 },
    section: { marginBottom: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8 },
    input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: TOUCH, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
    searchBtn: { borderWidth: 1, borderColor: colors.steel, borderRadius: 8, minHeight: TOUCH, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    searchBtnText: { color: colors.steel, fontWeight: '700', fontSize: 14 },
    hint: { fontSize: 13, color: colors.text3, marginTop: 4 },
    notFoundBox: { marginTop: 12 },
    notFoundText: { color: colors.warn, fontSize: 14, fontWeight: '600' },
    patientRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderLeftColor: colors.steel, borderRadius: 8, padding: 12, marginTop: 8, backgroundColor: colors.surface2, minHeight: TOUCH },
    patientRowName: { fontSize: 15, fontWeight: '700', color: colors.text },
    mineTag: { fontSize: 13, fontWeight: '600', color: colors.ok },
    patientRowMeta: { fontSize: 13, color: colors.text3, marginTop: 2 },
    destination: { fontSize: 14, fontWeight: '600', color: colors.steel, marginTop: 4 },
    destinationMissing: { color: colors.brand },
    statusPill: { alignSelf: 'flex-start', marginTop: 6, fontSize: 12.5, fontWeight: '600', color: colors.text2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },
    chevron: { fontSize: 24, color: colors.text3, marginLeft: 8 },
    linkButton: { marginTop: 10, minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 4 },
    linkButtonText: { color: colors.steel, fontSize: 14, fontWeight: '700' },
    reassignBox: { borderWidth: 1, borderColor: colors.hosp, borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: colors.surface2 },
    reassignTitle: { fontSize: 14, fontWeight: '700', color: colors.hosp, marginBottom: 6 },
    reassignOption: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
    reassignOptionText: { fontSize: 15, color: colors.text },
    reassignCancel: { marginTop: 4, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
    reassignCancelText: { color: colors.text2, fontSize: 14, fontWeight: '600' },
})

export default PacienteScreen
