import { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

const AuthContext = createContext(null)

const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null)
    const [user, setUser] = useState(null)
    // SecureStore es asincrono (a diferencia de localStorage en el web) — no
    // se puede saber si hay sesion guardada en el primer render. `loading`
    // es lo que el _layout raiz usa para no decidir a donde mandar al
    // usuario ((auth) o (app)) antes de que esto termine de resolver.
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const restoreSession = async () => {
            const storedToken = await SecureStore.getItemAsync('token')
            const storedUser = await SecureStore.getItemAsync('user')
            if (storedToken && storedUser) {
                setToken(storedToken)
                setUser(JSON.parse(storedUser))
            }
            setLoading(false)
        }
        restoreSession()
    }, [])

    // Mismo criterio que sicem-web/sicem-desktop: un 401 en una petición que
    // SÍ llevaba token significa que la sesión ya no es válida (token
    // vencido — dura 8h — o usuario desactivado). No se toca el fetch del
    // login mismo, ese nunca manda Authorization. Aquí es `global.fetch`,
    // no `window.fetch` — React Native no tiene `window`.
    useEffect(() => {
        const originalFetch = global.fetch
        let redirecting = false
        global.fetch = (...args) => {
            return originalFetch(...args).then(async (response) => {
                const headers = args[1]?.headers || {}
                const hadAuthHeader = Boolean(headers.Authorization || headers.authorization)
                if (response.status === 401 && hadAuthHeader && !redirecting) {
                    redirecting = true
                    await SecureStore.deleteItemAsync('token')
                    await SecureStore.deleteItemAsync('user')
                    setToken(null)
                    setUser(null)
                    router.replace('/login')
                }
                return response
            })
        }
        return () => { global.fetch = originalFetch }
    }, [])

    const login = async (receivedToken, receivedUser) => {
        await SecureStore.setItemAsync('token', receivedToken)
        await SecureStore.setItemAsync('user', JSON.stringify(receivedUser))
        setToken(receivedToken)
        setUser(receivedUser)
    }

    const logout = async () => {
        await SecureStore.deleteItemAsync('token')
        await SecureStore.deleteItemAsync('user')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

const useAuth = () => {
    return useContext(AuthContext)
}

export { AuthContext, AuthProvider, useAuth }
