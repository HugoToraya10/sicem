import { useState } from "react";
import {useAuth} from "../context/AuthContext";
import {useNavigate, useLocation} from "react-router-dom"
import {API_BASE_URL} from '../config/api'
import Icon from '../components/ui/Icon'
import './Login.css'

const Login = () => {
    const {login} = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

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
                // Esta aplicación es para despachadores y administradores: las demás cuentas tienen su propia aplicación.
                const roleId = parseInt(data.user?.roleId)
                const wrongApp = {
                    3: 'Tu cuenta es de paramédico. Entra desde la app móvil del paramédico.',
                    4: 'Tu cuenta es de personal hospitalario. Entra desde el portal hospitalario.',
                    5: 'Tu cuenta es de paciente. Entra desde el portal de pacientes.',
                }[roleId]
                if (wrongApp) { setError(wrongApp); return }
                login(data.jwtToken, data.user);
                navigate(location.state?.from || '/dashboard');
            } else {
                setError(data.message || 'Credenciales incorrectas.');
            }
        })
        .catch(() => setError('No se pudo conectar con el servidor. Intenta de nuevo.'))
        .finally(() => setLoading(false));
    }

    return (
        <div className="login-screen">
            <aside className="login-brand" aria-hidden="false">
                <div className="login-brand-top">
                    <span className="login-mark"><Icon name="plus" size={22} strokeWidth={2.8} /></span>
                    <span className="login-brand-name">SICEM</span>
                </div>
                <div className="login-brand-body">
                    <h2>Coordinación de emergencias médicas</h2>
                    <p>Registra emergencias, asigna la unidad más cercana y da seguimiento a cada traslado hasta el hospital, en tiempo real.</p>
                </div>
                <p className="login-brand-foot">México</p>
            </aside>

            <main className="login-panel">
                <form className="login-card" onSubmit={handleSubmit}>
                    <h1 className="login-title">Inicia sesión</h1>
                    <p className="login-sub">Usa la cuenta que te dio tu institución.</p>

                    <div className="login-field">
                        <label htmlFor="login-email">Correo</label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="login-pass">Contraseña</label>
                        <div className="login-pass">
                            <input
                                id="login-pass"
                                type={showPass ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="login-pass-toggle"
                                onClick={() => setShowPass((v) => !v)}
                                aria-pressed={showPass}
                                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                <Icon name={showPass ? 'eye-off' : 'eye'} size={18} />
                            </button>
                        </div>
                    </div>

                    <div role="alert" aria-live="assertive">
                        {error && <div className="login-error"><Icon name="alert" size={16} />{error}</div>}
                    </div>

                    <button className="login-submit" type="submit" disabled={loading}>
                        {loading ? 'Entrando…' : 'Entrar'}
                    </button>
                </form>
            </main>
        </div>
    )
}

export default Login
