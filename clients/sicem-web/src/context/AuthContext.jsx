import { useState, createContext, useContext, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext(null);

const AuthProvider = ({children}) => {
    const [token, setToken] = useState(localStorage.getItem('token') || null);
const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

    // Un 401 en cualquier request que SÍ llevaba token significa que la sesión
    // ya no es válida (token vencido — dura 8h — o usuario desactivado, según
    // verifyToken en el backend). No se toca el fetch del propio login: esa
    // petición nunca manda Authorization, así que un 401 ahí (contraseña
    // incorrecta, etc.) no dispara esto.
    useEffect(() => {
        const originalFetch = window.fetch
        let redirecting = false
        // Avisos de red y de servidor (una vez cada 10 s por tipo) para que ninguna pantalla falle en silencio.
        const lastShown = {}
        const warn = (key, message) => {
            const now = Date.now()
            if (lastShown[key] && now - lastShown[key] < 10000) return
            lastShown[key] = now
            window.dispatchEvent(new CustomEvent('sicem:notify', { detail: { message, tone: 'error' } }))
        }
        const isApi = (input) => String(input?.url || input || '').startsWith(API_BASE_URL)
        window.fetch = (...args) => {
            return originalFetch(...args).then((response) => {
                if (isApi(args[0]) && response.status >= 500) warn('server', 'El servidor tuvo un problema. Intenta de nuevo en unos segundos.')
                const headers = args[1]?.headers || {}
                const hadAuthHeader = Boolean(headers.Authorization || headers.authorization)
                if (response.status === 401 && hadAuthHeader && !redirecting) {
                    redirecting = true
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    window.location.href = '/login'
                }
                return response
            }).catch((error) => {
                if (isApi(args[0]) && error?.name !== 'AbortError') warn('network', 'No hay conexión con el servidor. Revisa tu red; vuelve a intentarlo en un momento.')
                throw error
            })
        }
        return () => { window.fetch = originalFetch }
    }, [])

    const login = (receivedToken, receivedUser) => {
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));
        setToken(receivedToken);
        setUser(receivedUser);
    }

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }


    return(
        <AuthContext.Provider value={{user, token, login, logout}}>
            {children}
        </AuthContext.Provider>
    )
}

const useAuth = () => {
    return useContext(AuthContext);
}

export {AuthContext, AuthProvider, useAuth};