import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import './Login.css';

const Login = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        fetch('http://localhost:3000/usuarios/login', {
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
                    if (roleId !== 1 && roleId !== 4) {
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
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <h1 className="login-logo">SICEM</h1>
                <p className="login-subtitle">Portal Hospitalario</p>

                {error && <p className="login-error">{error}</p>}

                <input
                    type="email"
                    placeholder="Correo electrónico"
                    onChange={(e) => setEmail(e.target.value)}
                    value={email}
                    required
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    onChange={(e) => setPass(e.target.value)}
                    value={pass}
                    required
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
            </form>
        </div>
    )
}

export default Login
