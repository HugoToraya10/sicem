import { useState } from "react";
import {useAuth} from "../context/AuthContext";
import {useNavigate} from "react-router-dom"
import {API_BASE_URL} from '../config/api'
import './Login.css'

const Login = () => {
    const {login} = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        fetch(`${API_BASE_URL}/usuarios/login`, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: pass
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.jwtToken) {
                login(data.jwtToken, data.user);
                navigate('/dashboard');
            } else {
                setError(data.message || 'Credenciales incorrectas.');
            }
        })
        .catch(() => setError('No se pudo conectar con el servidor. Intenta de nuevo.'))
        .finally(() => setLoading(false));
    }

    return (
        <div className="login-screen">
            <form className="login-card" onSubmit={handleSubmit}>
                <div className="login-logo">SICEM</div>
                <p className="login-tagline">Sistema Integral de Coordinación de Emergencias Médicas</p>
                <h1 className="login-title">Inicia sesión</h1>

                <label className="login-field">
                    <span>Correo</span>
                    <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>

                <label className="login-field">
                    <span>Contraseña</span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                    />
                </label>

                {error && <div className="login-error">{error}</div>}

                <button className="login-submit" type="submit" disabled={loading}>
                    {loading ? 'Entrando…' : 'Entrar'}
                </button>
            </form>
        </div>
    )
}

export default Login
