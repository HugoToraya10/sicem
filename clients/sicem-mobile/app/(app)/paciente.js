import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { useSocketAlerts } from '../../context/SocketContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

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
            .then((res) => res.json())
            .then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo reasignar el destino')
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

        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp.trim()}`, { headers: { 'Content-Type': 'application/json' } })
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
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Pacientes</Text>

            {acceptedEmergency && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pacientes de esta emergencia</Text>
                    {loadingEmergencyPatients && <ActivityIndicator color="#1565C0" style={{ marginVertical: 8 }} />}
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
                                        <Text style={styles.patientRowMeta}>
                                            CURP: {p.curp || 'sin registrar'}
                                            {'\n'}{p.destination_institution_name ? `→ ${p.destination_institution_name}` : 'Sin hospital destino'}
                                            {p.reception_status_name ? ` · ${p.reception_status_name}` : ''}
                                        </Text>
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
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => router.push({ pathname: '/registrar-paciente', params: { emergencyId: acceptedEmergency.emergencyId } })}
                    >
                        <Text style={styles.linkButtonText}>+ Registrar paciente nuevo en esta emergencia</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Buscar cualquier paciente por CURP</Text>
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
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8 },
    input: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 10, fontSize: 14 },
    searchBtn: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
    searchBtnText: { color: '#1565C0', fontWeight: '600', fontSize: 13 },
    hint: { fontSize: 12, color: '#999', marginTop: 4 },
    notFoundBox: { marginTop: 12 },
    notFoundText: { color: '#E67E22', fontSize: 13, fontStyle: 'italic' },
    patientRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e4e4ec', borderRadius: 8, padding: 12, marginTop: 8 },
    patientRowName: { fontSize: 14, fontWeight: '700', color: '#222' },
    mineTag: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },
    patientRowMeta: { fontSize: 11, color: '#888', marginTop: 2 },
    chevron: { fontSize: 22, color: '#ccc', marginLeft: 8 },
    linkButton: { marginTop: 12, padding: 6 },
    linkButtonText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
    reassignBox: { borderWidth: 1, borderColor: '#b39ddb', borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: '#f3eefb' },
    reassignTitle: { fontSize: 12, fontWeight: '700', color: '#6a1b9a', marginBottom: 8 },
    reassignOption: { paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#e0d4f0' },
    reassignOptionText: { fontSize: 13, color: '#222' },
    reassignCancel: { marginTop: 8, padding: 6, alignItems: 'center' },
    reassignCancelText: { color: '#888', fontSize: 13, fontWeight: '600' },
})

export default PacienteScreen
