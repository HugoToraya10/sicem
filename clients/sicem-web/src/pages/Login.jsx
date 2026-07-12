import { useState } from "react";
import {useAuth} from "../context/AuthContext";
import {useNavigate} from "react-router-dom"

const Login = () => {
    const {user, token, login, logout} = useAuth();
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const navigate = useNavigate();

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
                .then(data => { 
                    if (data.jwtToken) {
                        login(data.jwtToken, data.user); navigate('/dashboard') 
                    }
                    else {
                        console.error(data.message);
                    }})
                .catch((error) => {console.error('Ocurrió un error', error)})
            }
            }>Login</button>
        </>
    )
}

export default Login