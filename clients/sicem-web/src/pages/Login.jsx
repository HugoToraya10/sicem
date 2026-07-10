import { useState } from "react";
import {useAuth} from "../context/AuthContext";

const Login = () => {
    const {user, token, login, logout} = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    return (
        <>
            <input type="email" onChange={(e)=>{setEmail(e.target.value)}} value={email}></input>
            <input type="password" onChange={(e)=>{setPass(e.target.value)}} value={pass}></input>
            <button onClick={()=>{
                fetch('http://localhost:3000/usuarios/login', {
                    method:'POST',
                    headers: {
                        'Content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        password: pass
                    })
                })
                .then(res => res.json())
                .then(data => { login(data.jwtToken, data.user) })
                .catch((error) => {console.error('Ocurrió un error', error)})
            }
            }>Login</button>
        </>
    )
}

export default Login