import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { API_BASE_URL } from '../../constants/api'

const toLowerCaseKeys = (obj) => {
    const out = {}
    for (const key in obj) out[key.toLowerCase()] = obj[key]
    return out
}

const RegistrarPacienteScreen = () => {
    const { emergencyId } = useLocalSearchParams()
    const { token, user } = useAuth()
    const { activeAmbulanceId } = useAmbulance()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [curp, setCurp] = useState('')
    const [searchingCurp, setSearchingCurp] = useState(false)
    const [found, setFound] = useState(null) // null = no buscado, true/false = resultado
    const [userProfileId, setUserProfileId] = useState(null)
    const [firstName, setFirstName] = useState('')
    const [firstSurname, setFirstSurname] = useState('')
    const [secondSurname, setSecondSurname] = useState('')
    const [phone, setPhone] = useState('')
    const [notes, setNotes] = useState('')

    const [institutions, setInstitutions] = useState([])
    const [destinationInstitutionId, setDestinationInstitutionId] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        fetch(`${API_BASE_URL}/hospitales/instituciones-destino`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => setInstitutions((data || []).map(toLowerCaseKeys)))
            .catch((err) => console.error('Error recuperando hospitales destino. ', err))
    }, [])

    const handleCurpSearch = () => {
        if (!curp.trim()) return
        setSearchingCurp(true)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${curp.trim()}`, { headers: { 'Content-Type': 'application/json' } })
            .then((res) => res.json())
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const p = toLowerCaseKeys(data[0])
                    setFound(true)
                    setUserProfileId(p.user_profile_id)
                    setFirstName(p.first_name || '')
                    setFirstSurname(p.first_surname || '')
                    setSecondSurname(p.second_surname || '')
                    setPhone(p.phone_number || '')
                } else {
                    setFound(false)
                    setUserProfileId(null)
                }
            })
            .catch((err) => console.error('Error buscando por CURP. ', err))
            .finally(() => setSearchingCurp(false))
    }

    const handleSubmit = () => {
        setError('')
        if (!destinationInstitutionId) {
            setError('Selecciona un hospital destino.')
            return
        }
        if (!firstName.trim() && !curp.trim() && !notes.trim()) {
            setError('Llena al menos un dato del paciente (CURP, nombre o notas).')
            return
        }

        setSaving(true)

        const registerInEmergency = (profileId) => {
            return fetch(`${API_BASE_URL}/emergencias/registrar-paciente`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    emergencyId,
                    userProfileId: profileId,
                    notes,
                    destinationInstitutionId,
                    ambulanceId: activeAmbulanceId || null,
                })
            }).then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo registrar al paciente.')
                return body
            }))
        }

        const flow = userProfileId
            ? registerInEmergency(userProfileId)
            : fetch(`${API_BASE_URL}/usuarios/registro-paciente`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    institutionId: user.institutionId,
                    firstName: firstName || 'No identificado',
                    firstSurname: firstSurname || '',
                    secondSurname: secondSurname || '',
                    phone,
                    cveUnicaRegistroPob: curp || null,
                    emergencyContact: '',
                    emergencyPhone: '',
                })
            })
                .then((res) => res.json().then((body) => {
                    if (!res.ok) throw new Error(body.message || 'No se pudo registrar el perfil del paciente.')
                    return body
                }))
                .then((newProfile) => registerInEmergency(newProfile.userProfileId))

        flow
            .then(() => setSuccess(true))
            .catch((err) => {
                console.error('Error registrando paciente. ', err)
                setError(err.message)
            })
            .finally(() => setSaving(false))
    }

    if (success) {
        return (
            <View style={styles.centered}>
                <Text style={styles.successText}>Paciente registrado ✓</Text>
                <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Volver</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Registrar paciente</Text>
            <Text style={styles.hint}>Emergencia #{emergencyId}</Text>

            <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="CURP" value={curp} onChangeText={setCurp} autoCapitalize="characters" maxLength={18} />
                <TouchableOpacity style={styles.searchBtn} onPress={handleCurpSearch} disabled={searchingCurp}>
                    {searchingCurp ? <ActivityIndicator color="#1565C0" /> : <Text style={styles.searchBtnText}>Buscar</Text>}
                </TouchableOpacity>
            </View>
            {found === true && <Text style={styles.found}>✓ Paciente encontrado — datos cargados</Text>}
            {found === false && <Text style={styles.notFound}>No se encontró. Llena los datos manualmente si los tienes.</Text>}

            <TextInput style={styles.input} placeholder="Nombre(s)" value={firstName} onChangeText={setFirstName} editable={found !== true} />
            <TextInput style={styles.input} placeholder="Apellido paterno" value={firstSurname} onChangeText={setFirstSurname} editable={found !== true} />
            <TextInput style={styles.input} placeholder="Apellido materno" value={secondSurname} onChangeText={setSecondSurname} editable={found !== true} />
            <TextInput style={styles.input} placeholder="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={found !== true} />
            <TextInput style={[styles.input, styles.textarea]} placeholder="Notas (ej. descripción física si no hay identificación)" value={notes} onChangeText={setNotes} multiline />

            <Text style={styles.sectionTitle}>Hospital destino</Text>
            <View style={styles.institutionList}>
                {institutions.map((inst) => (
                    <TouchableOpacity
                        key={inst.institution_id}
                        style={[styles.institutionRow, String(destinationInstitutionId) === String(inst.institution_id) && styles.institutionRowSelected]}
                        onPress={() => setDestinationInstitutionId(inst.institution_id)}
                    >
                        <Text style={String(destinationInstitutionId) === String(inst.institution_id) ? styles.institutionTextSelected : styles.institutionText}>
                            {inst.name} — {inst.available_beds} camas
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrar paciente</Text>}
            </TouchableOpacity>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
    hint: { fontSize: 12, color: '#999', marginBottom: 16 },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
        borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8,
        padding: 10, marginBottom: 10, fontSize: 14,
    },
    textarea: { minHeight: 70, textAlignVertical: 'top' },
    searchBtn: {
        borderWidth: 1, borderColor: '#1565C0', borderRadius: 8,
        paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10,
    },
    searchBtnText: { color: '#1565C0', fontWeight: '600', fontSize: 13 },
    found: { color: '#2E7D32', fontSize: 12, marginBottom: 8 },
    notFound: { color: '#E67E22', fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginTop: 8, marginBottom: 6 },
    institutionList: { marginBottom: 12 },
    institutionRow: { borderWidth: 1, borderColor: '#dcdce4', borderRadius: 8, padding: 10, marginBottom: 6 },
    institutionRowSelected: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
    institutionText: { fontSize: 13, color: '#333' },
    institutionTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },
    error: { color: '#C0272D', fontSize: 13, marginBottom: 10, textAlign: 'center' },
    button: {
        backgroundColor: '#1565C0', borderRadius: 8, padding: 14,
        alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 24,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    successText: { fontSize: 18, fontWeight: '700', color: '#2E7D32', marginBottom: 16 },
})

export default RegistrarPacienteScreen
