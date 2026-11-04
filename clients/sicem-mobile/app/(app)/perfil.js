import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Alert } from '../../utils/alert'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { toLowerCaseKeys } from '../../utils/formatData'

// El backend YA tenía todo esto listo (actualizar-perfil, actualizar-credenciales
// — sicem-web ya los usa en Profile.jsx), sicem-mobile simplemente no tenía
// ninguna pantalla que los usara todavía.
const ProfileScreen = () => {
    const { user, token } = useAuth()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)

    const [editingProfile, setEditingProfile] = useState(false)
    const [profileForm, setProfileForm] = useState({ firstName: '', firstSurname: '', secondSurname: '', phone: '', emergencyContact: '', emergencyPhone: '' })
    const [savingProfile, setSavingProfile] = useState(false)

    const [changingPassword, setChangingPassword] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [savingPassword, setSavingPassword] = useState(false)

    const fetchProfile = () => {
        // user se vuelve null al cerrar sesión — este efecto puede volver a
        // correr en ese momento (la dependencia user?.profileId cambia de un
        // ID a undefined) si la pantalla seguía montada de fondo, y sin esta
        // guarda tronaba con "Cannot read property 'profileId' of null".
        if (!user?.profileId) { setLoading(false); return }
        setLoading(true)
        fetch(`${API_BASE_URL}/usuarios/obtener-usuario-id/${user.profileId}`, { headers })
            .then((res) => res.json())
            .then(({ user: u }) => {
                // El backend regresa "user" como un ARREGLO (r.map(...) en
                // getUserById), no el objeto directo — sin el [0], toLowerCaseKeys
                // se aplicaba sobre el arreglo entero y todo salía undefined
                // ("todo vacío" en la pantalla).
                if (!u || u.length === 0) return
                const p = toLowerCaseKeys(u[0])
                setProfile(p)
                setProfileForm({
                    firstName: p.first_name || '',
                    firstSurname: p.first_surname || '',
                    secondSurname: p.second_surname || '',
                    phone: p.phone_number || '',
                    emergencyContact: p.emergency_contact || '',
                    emergencyPhone: p.emergency_phone || '',
                })
            })
            .catch((err) => console.error('Error recuperando tu perfil. ', err))
            .finally(() => setLoading(false))
    }

    useEffect(fetchProfile, [user?.profileId])

    const handleSaveProfile = () => {
        if (!profileForm.firstName.trim()) {
            Alert.alert('Falta tu nombre', 'El nombre no puede quedar vacío.')
            return
        }
        setSavingProfile(true)
        fetch(`${API_BASE_URL}/usuarios/actualizar-perfil`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                userProfileId: user.profileId,
                firstName: profileForm.firstName,
                firstSurname: profileForm.firstSurname,
                secondSurname: profileForm.secondSurname,
                phone: profileForm.phone,
                birthDate: profile?.birth_date || null,
                cveUnicaRegistroPob: profile?.curp || null,
                emergencyContact: profileForm.emergencyContact,
                emergencyPhone: profileForm.emergencyPhone,
            })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo guardar.')
            }))
            .then(() => { setEditingProfile(false); fetchProfile() })
            .catch((err) => { console.error('Error guardando perfil. ', err); Alert.alert('Error', err.message) })
            .finally(() => setSavingProfile(false))
    }

    const handleChangePassword = () => {
        if (newPassword.length < 8) {
            Alert.alert('Contraseña muy corta', 'Usa al menos 8 caracteres.')
            return
        }
        setSavingPassword(true)
        fetch(`${API_BASE_URL}/usuarios/actualizar-credenciales`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ userCredentialId: profile.user_credential_id, email: profile.email, password: newPassword })
        })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.message || 'No se pudo cambiar la contraseña.')
            }))
            .then(() => {
                setChangingPassword(false)
                setNewPassword('')
                Alert.alert('Listo', 'Tu contraseña se actualizó. La próxima vez que cierres sesión, entra con la nueva.')
            })
            .catch((err) => { console.error('Error cambiando contraseña. ', err); Alert.alert('Error', err.message) })
            .finally(() => setSavingPassword(false))
    }

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator color="#2E7D32" /></View>
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            <Text style={styles.title}>Mi perfil</Text>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.sectionTitle}>Datos personales</Text>
                    {!editingProfile && (
                        <TouchableOpacity onPress={() => setEditingProfile(true)}>
                            <Text style={styles.editLink}>Editar</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {editingProfile ? (
                    <>
                        <TextInput style={styles.input} placeholder="Nombre(s)" value={profileForm.firstName} onChangeText={(v) => setProfileForm((f) => ({ ...f, firstName: v }))} />
                        <TextInput style={styles.input} placeholder="Apellido paterno" value={profileForm.firstSurname} onChangeText={(v) => setProfileForm((f) => ({ ...f, firstSurname: v }))} />
                        <TextInput style={styles.input} placeholder="Apellido materno" value={profileForm.secondSurname} onChangeText={(v) => setProfileForm((f) => ({ ...f, secondSurname: v }))} />
                        <TextInput style={styles.input} placeholder="Teléfono" value={profileForm.phone} onChangeText={(v) => setProfileForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" maxLength={10} />
                        <Text style={styles.miniLabel}>Contacto de emergencia</Text>
                        <TextInput style={styles.input} placeholder="Nombre del contacto" value={profileForm.emergencyContact} onChangeText={(v) => setProfileForm((f) => ({ ...f, emergencyContact: v }))} />
                        <TextInput style={styles.input} placeholder="Teléfono del contacto" value={profileForm.emergencyPhone} onChangeText={(v) => setProfileForm((f) => ({ ...f, emergencyPhone: v }))} keyboardType="phone-pad" maxLength={10} />
                        <View style={styles.formActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditingProfile(false); fetchProfile() }} disabled={savingProfile}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile} disabled={savingProfile}>
                                {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.row}><Text style={styles.label}>Nombre</Text><Text style={styles.value}>{profile?.first_name} {profile?.first_surname} {profile?.second_surname}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>Correo</Text><Text style={styles.value}>{profile?.email || '—'}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>Teléfono</Text><Text style={styles.value}>{profile?.phone_number || '—'}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>CURP</Text><Text style={styles.value}>{profile?.curp || '—'}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>Contacto emergencia</Text><Text style={styles.value}>{profile?.emergency_contact || '—'} {profile?.emergency_phone ? `· ${profile.emergency_phone}` : ''}</Text></View>
                    </>
                )}
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.sectionTitle}>Contraseña</Text>
                    {!changingPassword && (
                        <TouchableOpacity onPress={() => setChangingPassword(true)}>
                            <Text style={styles.editLink}>Cambiar</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {changingPassword && (
                    <>
                        <TextInput style={styles.input} placeholder="Nueva contraseña (mínimo 8 caracteres)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                        <View style={styles.formActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => { setChangingPassword(false); setNewPassword('') }} disabled={savingPassword}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleChangePassword} disabled={savingPassword}>
                                {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: '#14181F', marginBottom: 16 },
    card: { borderWidth: 1, borderColor: '#E3E8EE', borderRadius: 10, padding: 14, marginBottom: 16, backgroundColor: '#F0F3F6' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#4A5360', textTransform: 'uppercase' },
    editLink: { color: '#0F766E', fontSize: 13, fontWeight: '600' },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EDEBE5' },
    label: { fontSize: 13, color: '#4A5360' },
    value: { fontSize: 13, fontWeight: '600', color: '#14181F', flexShrink: 1, textAlign: 'right' },
    input: { borderWidth: 1, borderColor: '#CBD3DD', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 },
    miniLabel: { fontSize: 13, color: '#4A5360', marginTop: 4, marginBottom: 6 },
    formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    primaryButton: { backgroundColor: '#0F766E', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center' },
    cancelButtonText: { color: '#4A5360', fontSize: 14, fontWeight: '600' },
})

export default ProfileScreen
