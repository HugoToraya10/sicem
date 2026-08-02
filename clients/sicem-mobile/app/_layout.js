import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '../context/AuthContext'

// Decide entre (auth) y (app) según haya sesión o no. Vive separado de
// RootLayout porque useAuth() necesita estar DENTRO de <AuthProvider> para
// funcionar — no se puede leer el contexto en el mismo componente que lo crea.
const InitialLayout = () => {
    const { token, loading } = useAuth()
    const segments = useSegments()
    const router = useRouter()

    useEffect(() => {
        if (loading) return // todavía no se sabe si hay sesión guardada — no decidir nada aún

        const inAuthGroup = segments[0] === '(auth)'

        if (!token && !inAuthGroup) {
            router.replace('/login')
        } else if (token && inAuthGroup) {
            router.replace('/')
        }
    }, [token, loading, segments])

    if (loading) return null // TODO: pantalla de splash/carga en vez de esto

    return <Stack screenOptions={{ headerShown: false }} />
}

const RootLayout = () => {
    return (
        <AuthProvider>
            <InitialLayout />
        </AuthProvider>
    )
}

export default RootLayout
