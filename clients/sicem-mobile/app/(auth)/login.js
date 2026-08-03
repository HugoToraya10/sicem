import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../constants/api'

const LoginScreen = () => {
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = () => {
        setError('')
        setLoading(true)
        fetch(`${API_BASE_URL}/usuarios/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
            .then(res => res.json())
            .then((data) => {
                if (data.jwtToken) {
                    // No hace falta navegar manualmente — en cuanto login() actualiza
                    // el token, el _layout raíz detecta que ya no debe estar en
                    // (auth) y redirige solo a (app).
                    login(data.jwtToken, data.user)
                } else {
                    setError(data.message || 'No se pudo iniciar sesión.')
                }
            })
            .catch((err) => {
                console.error('Error de login. ', err)
                setError('Error de conexión. Revisa tu internet o la URL del backend.')
            })
            .finally(() => setLoading(false))
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SICEM</Text>
            <Text style={styles.subtitle}>Paramédico</Text>

            <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                style={styles.input}
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#1565C0' },
    subtitle: { fontSize: 14, textAlign: 'center', color: '#888', marginBottom: 32 },
    input: {
        borderWidth: 1,
        borderColor: '#dcdce4',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 15,
    },
    error: { color: '#C0272D', textAlign: 'center', marginBottom: 12, fontSize: 13 },
    button: {
        backgroundColor: '#1565C0',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default LoginScreen
