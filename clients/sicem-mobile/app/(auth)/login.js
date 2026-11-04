import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'
import { colors, TOUCH } from '../../constants/theme'

const LoginScreen = () => {
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const passwordRef = useRef(null)

    const handleLogin = () => {
        if (loading) return
        if (!email.trim() || !password) { setError('Escribe tu correo y tu contraseña.'); return }
        setError('')
        setLoading(true)
        fetch(`${API_BASE_URL}/usuarios/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
        })
            .then(res => res.json())
            .then((data) => {
                if (data.jwtToken) {
                    // Esta app es solo para paramédicos: las demás cuentas tienen su propia aplicación.
                    const roleId = parseInt(data.user?.roleId)
                    if (roleId !== 3) {
                        setError({ 1: 'Tu cuenta es de administrador. Entra desde la web del despachador.', 2: 'Tu cuenta es de despachador. Entra desde la web del despachador.', 4: 'Tu cuenta es de personal hospitalario. Entra desde el portal hospitalario.', 5: 'Tu cuenta es de paciente. Entra desde el portal de pacientes.' }[roleId] || 'Esta aplicación es solo para paramédicos.')
                        return
                    }
                    // No hace falta navegar manualmente — en cuanto login() actualiza
                    // el token, el _layout raíz detecta que ya no debe estar en
                    // (auth) y redirige solo a (app).
                    login(data.jwtToken, data.user)
                } else {
                    setError(data.message || 'Correo o contraseña incorrectos.')
                }
            })
            .catch((err) => {
                console.error('Error de login. ', err)
                setError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')
            })
            .finally(() => setLoading(false))
    }

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.brandRow}>
                    <View style={styles.brandMark}><Text style={styles.brandPlus}>+</Text></View>
                    <View>
                        <Text style={styles.title}>SICEM</Text>
                        <Text style={styles.subtitle}>Paramédicos</Text>
                    </View>
                </View>

                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (error) setError("") }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    accessibilityLabel="Correo electrónico"
                />

                <Text style={styles.label}>Contraseña</Text>
                <View style={styles.passwordRow}>
                    <TextInput
                        ref={passwordRef}
                        style={[styles.input, styles.passwordInput]}
                        value={password}
                        onChangeText={(v) => { setPassword(v); if (error) setError("") }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
                        accessibilityLabel="Contraseña"
                    />
                    <TouchableOpacity style={styles.toggle} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                    </TouchableOpacity>
                </View>

                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

                <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading} accessibilityRole="button">
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 460, alignSelf: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
    brandMark: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
    brandPlus: { color: '#fff', fontSize: 34, fontWeight: '700', lineHeight: 38 },
    title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 1 },
    subtitle: { fontSize: 15, color: colors.text2 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text2, marginBottom: 6 },
    input: {
        minHeight: TOUCH,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineStrong,
        borderRadius: 8,
        paddingHorizontal: 14,
        marginBottom: 16,
        fontSize: 16,
        color: colors.text,
    },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 92 },
    toggle: { position: 'absolute', right: 4, top: 0, height: TOUCH, paddingHorizontal: 14, justifyContent: 'center' },
    toggleText: { color: colors.steel, fontSize: 14, fontWeight: '700' },
    error: { color: colors.brand, marginBottom: 12, fontSize: 14, fontWeight: '600' },
    button: {
        backgroundColor: colors.brand,
        borderRadius: 8,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})

export default LoginScreen
