import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useAmbulance } from '../../context/AmbulanceContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'
import { colors, contentColumn } from '../../constants/theme'
import { Button, Field, Chip, Notice, SectionTitle } from '../../components/ui'

const RegistrarPacienteScreen = () => {
    const { emergencyId } = useLocalSearchParams()
    const { token, user } = useAuth()
    const { activeAmbulanceId } = useAmbulance()
    const router = useRouter()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [curp, setCurp] = useState('')
    const [searchingCurp, setSearchingCurp] = useState(false)
    const [found, setFound] = useState(null) // null = sin buscar, true/false = resultado
    const [userProfileId, setUserProfileId] = useState(null)
    const [firstName, setFirstName] = useState('')
    const [firstSurname, setFirstSurname] = useState('')
    const [secondSurname, setSecondSurname] = useState('')
    const [phone, setPhone] = useState('')
    const [notes, setNotes] = useState('')

    const [institutions, setInstitutions] = useState([])
    const [hospitalFilter, setHospitalFilter] = useState('')
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

    // Con camas primero; dentro de cada grupo, por nombre. Con muchos hospitales aparece un filtro.
    const visibleHospitals = useMemo(() => {
        const q = hospitalFilter.trim().toLowerCase()
        return [...institutions]
            .filter((i) => !q || String(i.name).toLowerCase().includes(q))
            .sort((a, b) => (Number(b.available_beds) > 0) - (Number(a.available_beds) > 0) || String(a.name).localeCompare(String(b.name), 'es'))
    }, [institutions, hospitalFilter])

    const handleCurpSearch = () => {
        const value = curp.trim().toUpperCase()
        if (!value) return
        setSearchingCurp(true)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-curp/${encodeURIComponent(value)}`, { headers: { 'Content-Type': 'application/json' } })
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
                    if (p.institution_id && !destinationInstitutionId) setDestinationInstitutionId(String(p.institution_id))
                } else {
                    setFound(false)
                    setUserProfileId(null)
                }
            })
            .catch((err) => { console.error('Error buscando por CURP. ', err); setError('No se pudo buscar. Revisa tu conexión.') })
            .finally(() => setSearchingCurp(false))
    }

    const handleSubmit = () => {
        setError('')
        if (!destinationInstitutionId) { setError('Elige el hospital destino.'); return }
        if (!firstName.trim() && !curp.trim() && !notes.trim()) { setError('Captura al menos un dato del paciente: CURP, nombre o una descripción.'); return }

        setSaving(true)
        const registerInEmergency = (profileId) => fetch(`${API_BASE_URL}/emergencias/registrar-paciente`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ emergencyId, userProfileId: profileId, notes, destinationInstitutionId, ambulanceId: activeAmbulanceId || null }),
        }).then((res) => res.json().then((body) => {
            if (!res.ok) throw new Error(body.message || 'No se pudo registrar al paciente.')
            return body
        }))

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
                    cveUnicaRegistroPob: curp.trim().toUpperCase() || null,
                    emergencyContact: '',
                    emergencyPhone: '',
                }),
            })
                .then((res) => res.json().then((body) => {
                    if (!res.ok) throw new Error(body.message || 'No se pudo registrar el perfil del paciente.')
                    return body
                }))
                .then((newProfile) => registerInEmergency(newProfile.userProfileId))

        flow
            .then(() => setSuccess(true))
            .catch((err) => { console.error('Error registrando paciente. ', err); setError(err.message) })
            .finally(() => setSaving(false))
    }

    if (success) {
        return (
            <View style={styles.centered}>
                <Text style={styles.successTitle}>Paciente registrado</Text>
                <Text style={styles.successText}>El hospital ya lo ve en su lista de pacientes en camino.</Text>
                <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
                    <Button label="Volver a la atención" tone="primary" onPress={() => router.back()} />
                </View>
            </View>
        )
    }

    const locked = found === true // un perfil existente no se edita desde aquí

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.context}>Emergencia #{emergencyId}</Text>

                <SectionTitle>¿Cuenta con CURP?</SectionTitle>
                <View style={styles.curpRow}>
                    <Field
                        style={{ flex: 1, marginBottom: 0 }} label="CURP" value={curp} onChangeText={(v) => { setCurp(v.toUpperCase()); setFound(null) }}
                        autoCapitalize="characters" autoCorrect={false} maxLength={18} returnKeyType="search" onSubmitEditing={handleCurpSearch}
                    />
                    <Button label="Buscar" tone="steel" compact style={styles.curpBtn} onPress={handleCurpSearch} loading={searchingCurp} disabled={!curp.trim()} />
                </View>
                {found === true && <View style={{ marginTop: 10 }}><Notice tone="ok">Paciente encontrado. Sus datos y su expediente se vinculan solos.</Notice></View>}
                {found === false && <View style={{ marginTop: 10 }}><Notice tone="warn">No hay un perfil con esa CURP. Captura los datos que tengas; si no hay ninguno, basta con una descripción.</Notice></View>}

                <SectionTitle>Datos del paciente</SectionTitle>
                <Field label="Nombre(s)" value={firstName} onChangeText={setFirstName} editable={!locked} autoComplete="off" />
                <View style={styles.row}>
                    <Field style={styles.half} label="Apellido paterno" value={firstSurname} onChangeText={setFirstSurname} editable={!locked} />
                    <Field style={styles.half} label="Apellido materno" value={secondSurname} onChangeText={setSecondSurname} editable={!locked} />
                </View>
                <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} editable={!locked} />
                <Field
                    label="Descripción u observaciones" value={notes} onChangeText={setNotes} multiline maxLength={300}
                    hint="Si no hay identificación: edad aproximada, complexión, ropa, señas particulares."
                />

                <SectionTitle>Hospital destino</SectionTitle>
                {institutions.length === 0 && <ActivityIndicator color={colors.steel} />}
                {institutions.length > 6 && (
                    <Field label="Buscar hospital" value={hospitalFilter} onChangeText={setHospitalFilter} autoCorrect={false} />
                )}
                {visibleHospitals.map((inst) => {
                    const selected = String(destinationInstitutionId) === String(inst.institution_id)
                    const beds = Number(inst.available_beds)
                    return (
                        <TouchableOpacity
                            key={inst.institution_id}
                            style={[styles.hospital, selected && styles.hospitalOn]}
                            onPress={() => setDestinationInstitutionId(String(inst.institution_id))}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${inst.name}, ${beds} camas disponibles`}
                        >
                            <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                            <Text style={[styles.hospitalName, selected && { color: colors.steel }]} numberOfLines={2}>{inst.name}</Text>
                            <Chip label={beds > 0 ? `${beds} camas` : 'Sin camas'} tone={beds > 0 ? 'ok' : 'brand'} />
                        </TouchableOpacity>
                    )
                })}
                {institutions.length > 0 && visibleHospitals.length === 0 && <Text style={styles.empty}>Ningún hospital coincide con la búsqueda.</Text>}
                <View style={{ height: 8 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <Button label="Registrar paciente" tone="primary" onPress={handleSubmit} loading={saving} />
            </View>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    content: { padding: 16, paddingBottom: 24, ...contentColumn },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
    successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
    successText: { fontSize: 16, color: colors.text2, textAlign: 'center', marginTop: 6 },
    context: { fontSize: 14, fontWeight: '700', color: colors.text3 },
    curpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    curpBtn: { minHeight: 48, paddingHorizontal: 18 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    hospital: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
    hospitalOn: { borderColor: colors.steel, backgroundColor: colors.steelSoft },
    radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: colors.steel },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.steel },
    hospitalName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
    empty: { fontSize: 15, color: colors.text2, textAlign: 'center', paddingVertical: 12 },
    bottomBar: { padding: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
    error: { color: colors.brand, fontSize: 14, fontWeight: '700', textAlign: 'center' },
})

export default RegistrarPacienteScreen
