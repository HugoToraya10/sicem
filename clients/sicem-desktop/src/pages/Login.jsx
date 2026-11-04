import { useState } from "react";
import { API_BASE_URL } from '../config/api';
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ROLE_IDS } from '../config/roles';
import Icon from '../components/ui/Icon';
import './Login.css';

const Login = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
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
                    const roleId = parseInt(data.user.roleId);
                    // Esta app es exclusiva para admin (1) y personal hospitalario (4) —
                    // cualquier otro rol se rechaza aquí, sin guardar sesión.
                    if (roleId !== ROLE_IDS.ADMIN && roleId !== ROLE_IDS.HOSPITAL) {
                        setError('Esta aplicación es exclusiva para personal hospitalario.');
                        return;
                    }
                    login(data.jwtToken, data.user);
                    navigate('/pacientes-en-camino');
                } else {
                    setError(data.message || 'No se pudo iniciar sesión.');
                }
            })
            .catch((error) => {
                console.error('Ocurrió un error', error);
                setError('No se pudo conectar con el servidor.');
            })
            .finally(() => setLoading(false));
    }

    return (
        <div className="login-screen">
            <aside className="login-brand">
                <div className="login-brand-top">
                    <span className="login-mark"><Icon name="plus" size={22} strokeWidth={2.8} /></span>
                    <span className="login-brand-name">SICEM</span>
                </div>
                <div className="login-brand-body">
                    <h2>Portal hospitalario</h2>
                    <p>Recibe a los pacientes que van en camino, confirma su llegada y mantén al día las camas y especialidades de tu hospital.</p>
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
