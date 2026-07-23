import { useState, createContext, useContext, useEffect } from "react";

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
        window.fetch = (...args) => {
            return originalFetch(...args).then((response) => {
                const headers = args[1]?.headers || {}
                const hadAuthHeader = Boolean(headers.Authorization || headers.authorization)
                if (response.status === 401 && hadAuthHeader && !redirecting) {
                    redirecting = true
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    window.location.href = '/login'
                }
                return response
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