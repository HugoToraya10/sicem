# Aprende SICEM: de lo más simple a lo más complejo

Este documento es tu ruta de estudio personal para entender, a fondo, absolutamente todo el código de SICEM (web, desktop, mobile y los 5 servicios de backend). Está ordenado por dificultad, no por carpeta — vas a ir de conceptos que ya conoces (SQL, backend básico) hacia los más avanzados del proyecto (tiempo real, empaquetado nativo, arquitectura de microservicios).

**Cómo usar esto:** cada sección tiene tres partes:
1. **El concepto**, explicado en corto.
2. **Dónde vive en TU proyecto** — archivo y líneas reales, no ejemplos inventados.
3. **Prompts para pedirle a una IA** — cópialos tal cual (son autocontenidos, no necesitas explicarle nada más de contexto) para que te dé una clase enfocada solo en eso, con ejercicios.

No hace falta que lo hagas en una sola sentada ni en orden estricto — pero si un nivel no te queda claro, los siguientes se te van a complicar más, porque todo está construido encima de lo anterior.

---

## Índice

- Nivel 0 — Antes de todo: cómo está organizado el proyecto
- Nivel 1 — JavaScript moderno (lo que necesitas para leer CUALQUIER archivo de aquí)
- Nivel 2 — Backend: Express, rutas, controladores, modelos (repaso + profundizar)
- Nivel 3 — Autenticación: JWT, middleware, roles
- Nivel 4 — Frontend: React desde cero (componentes, props, estado)
- Nivel 5 — React: Hooks (useState, useEffect, useContext) y Context API
- Nivel 6 — Enrutamiento en React (React Router) — y por qué desktop necesitó un fix
- Nivel 7 — Tiempo real: Socket.IO
- Nivel 8 — Las 3 plataformas y sus diferencias reales (Web vs Desktop vs Mobile)
- Nivel 9 — Herramientas de build (Vite, Metro) y por qué existen
- Nivel 10 — Empaquetado nativo (Electron, Android/NDK) — lo más avanzado
- Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces
- Nivel 12 — La arquitectura completa del sistema (para verlo todo junto al final)

---

## Nivel 0 — Cómo está organizado el proyecto

Antes de tocar código, entiende la forma general. SICEM es un **monorepo** (un solo repositorio de git con varios proyectos independientes adentro):

```
SICEM/
├── gateway/              Un solo punto de entrada HTTP (puerto 3000)
├── services/
│   ├── usuarios/          :3001 — cuentas, login, roles
│   ├── hospitales/        :3002 — instituciones, camas, especialidades
│   ├── unidades/          :3003 — ambulancias, turnos, sockets
│   ├── pacientes/         :3004 — expediente clínico
│   └── emergencias/       :3005 — el corazón del sistema, sockets, push
├── clients/
│   ├── sicem-web/          React normal, para el despachador
│   ├── sicem-desktop/      React + Electron, para el hospital
│   └── sicem-mobile/       React Native + Expo, para el paramédico
```

**Idea clave:** los 5 servicios de `services/` son programas de Node.js INDEPENDIENTES — cada uno tiene su propio `package.json`, corre en su propio puerto, y se le puede reiniciar sin afectar a los otros. El `gateway` es el único que sabe de los 5, y su trabajo es solo reenviar peticiones (no tiene lógica propia). Esto se llama **arquitectura de microservicios** — lo vas a entender más a fondo en el Nivel 12.

Cada servicio de backend sigue SIEMPRE la misma estructura interna:
```
services/usuarios/
├── index.js          arranca el servidor Express
├── config/db.js       conexión a MySQL
├── routes/            "qué URL existe" (sin lógica)
├── controllers/       "qué hacer cuando llega esa URL" (la lógica)
└── models/            "cómo hablarle a la base de datos"
```

### Prompt para pedirle a una IA

```
Estoy aprendiendo la arquitectura de un proyecto backend en Node.js
organizado como monorepo con microservicios (varios servicios Express
independientes: usuarios, hospitales, unidades, pacientes, emergencias,
más un gateway que los reenvía). Cada servicio sigue el patrón
routes -> controllers -> models. Explícame, con un ejemplo inventado
simple (una tienda en línea con servicios de "productos" y "pedidos"),
por qué se separan routes/controllers/models en archivos distintos en
vez de poner todo junto, y qué ventajas y desventajas reales tiene
dividir un backend en varios servicios independientes en vez de uno
solo grande (monolito). Dame un ejercicio: que yo diseñe en papel
(sin código) cómo dividirías un sistema de reservas de citas médicas
en servicios, y luego revisa mi propuesta.
```

---

## Nivel 1 — JavaScript moderno

Si vienes de SQL/backend básico, hay sintaxis de JS que aparece EN CADA ARCHIVO del proyecto y que si no la dominas, vas a leer código sin entenderlo de verdad. Estos son los 5 puntos que más se repiten:

### 1.1 — `async`/`await` y Promesas

Casi cada función que habla con la base de datos o con otro servidor es asíncrona. Ejemplo real, `services/usuarios/controllers/user.js` (la lógica de login):

```js
const login = async (req, res) => {
    const { email, password } = req.body;
    // ...
    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);
    // ...
};
```

`await` significa "espera a que esto termine antes de seguir a la siguiente línea" — sin esto, el código intentaría comparar la contraseña ANTES de que `bcrypt` terminara de calcularla.

### 1.2 — Desestructuración (`{ }` para sacar variables de un objeto)

```js
const { email, password } = req.body;
```
Es lo mismo que escribir `const email = req.body.email; const password = req.body.password;` pero en una línea. Aparece TODO el tiempo, en props de React también (`const { user, token } = useAuth()`).

### 1.3 — Funciones flecha (`=>`)

```js
const login = async (req, res) => { ... }
```
Es una forma corta de escribir una función. Vas a ver `=>` en casi cada línea de callback (`.then(x => x.data)`, `.map(item => ...)`, etc.).

### 1.4 — Módulos (`import`/`export`)

Cada archivo es su propia "caja" — solo lo que se marca `export` puede ser usado por otros archivos, y con `import` traes cosas de otras cajas. Ejemplo, `clients/sicem-mobile/context/AuthContext.jsx` línea final:
```js
export { AuthContext, AuthProvider, useAuth }
```
Y en `app/_layout.js`:
```js
import { AuthProvider, useAuth } from '../context/AuthContext'
```

### 1.5 — Template literals (comillas invertidas)

```js
fetch(`${API_BASE_URL}/usuarios/login`, { ... })
```
Las comillas invertidas ` `` ` permiten meter variables dentro de un texto con `${variable}`, en vez de concatenar con `+`.

### Prompts para pedirle a una IA

```
Soy nuevo en JavaScript moderno pero sé programar (vengo de SQL y
backend básico). Explícame estos 4 conceptos con ejemplos cortos y
prácticos: async/await y promesas, desestructuración de objetos,
funciones flecha, y template literals. Después dame 5 ejercicios
cortos de código (con solución) donde tenga que reescribir código
"a la antigua" (callbacks, concatenación con +, function normales)
usando la sintaxis moderna.
```

```
Tengo esta función real de un proyecto en Node.js/Express:

const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'No encontrado' });
    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });
    res.json({ message: 'Login exitoso' });
};

Explícame línea por línea qué hace cada parte, qué pasaría si quitara
cada uno de los "await", y por qué la función completa está marcada
como "async".
```

---

## Nivel 2 — Backend: Express, rutas, controladores, modelos

Ya conoces esto en parte — aquí lo profundizamos con el patrón EXACTO que usa el proyecto.

### El flujo completo de una petición

Toma como ejemplo real "obtener los roles del sistema": `GET /usuarios/obtener-roles`.

**1. `services/usuarios/routes/user.js`** — declara que esa URL existe y qué función la atiende:
```js
router.get('/obtener-roles', userController.getAllRoles);
```
Nota: esta ruta NO tiene `middleware.verifyToken` antes del controller — por eso es "pública" (cualquiera puede llamarla sin iniciar sesión). Compáralo con una ruta protegida:
```js
router.get('/obtener-usuarios', middleware.verifyToken, userController.getAllUsers);
```

**2. `services/usuarios/controllers/user.js`** — la lógica: qué hacer cuando llega la petición, qué le pide al modelo, y qué responde:
```js
const getAllRoles = (req, res) => {
    userModel.getAllRoles((err, roles) => {
        if (err) return res.status(500).json({ message: 'Error del servidor' });
        res.json({ message: 'Roles', roles });
    });
};
```

**3. `services/usuarios/models/user.js`** — el único lugar del servicio que sabe SQL:
```js
const getAllRoles = (callback) => {
    db.query('SELECT * FROM roles WHERE IS_ACTIVE = 1', callback);
};
```

**Por qué se separa así:** si mañana cambias de MySQL a otra base de datos, solo tocas `models/`. Si cambias qué datos regresa la API, solo tocas `controllers/`. Si cambias la URL, solo tocas `routes/`. Cada archivo tiene una sola razón para cambiar.

### El patrón "callback" que usa este proyecto (en vez de async/await en los modelos)

Fíjate que `getAllRoles` en el modelo recibe un `callback` (una función que se llama cuando el SQL termina), en vez de usar `await` directo. Es un estilo más viejo pero válido — es como funciona el driver `mysql2` en su modo callback (existe también un modo con promesas, pero este proyecto usa callbacks consistentemente). Vale la pena que entiendas AMBOS estilos porque te los vas a encontrar en cualquier código Node.js real.

### El gateway: por qué existe y qué tan simple es

`gateway/index.js` completo (resumido) es literalmente esto:
```js
app.use('/usuarios', createProxyMiddleware({ target: 'http://localhost:3001/usuarios' }))
app.use('/hospitales', createProxyMiddleware({ target: 'http://localhost:3002/hospitales' }))
// ...y así con los otros 3
```
No valida nada, no tiene lógica — solo reenvía. Cuando tu app llama a `http://gateway:3000/usuarios/login`, el gateway lo manda tal cual a `http://localhost:3001/usuarios/login`.

### Prompts para pedirle a una IA

```
Tengo un backend en Express organizado en 3 capas: routes (declara URLs),
controllers (lógica: qué hacer y qué responder), models (el único lugar
que toca SQL directamente). Aquí un ejemplo real de las 3 capas para un
endpoint "obtener roles":

// routes/user.js
router.get('/obtener-roles', userController.getAllRoles);

// controllers/user.js
const getAllRoles = (req, res) => {
    userModel.getAllRoles((err, roles) => {
        if (err) return res.status(500).json({ message: 'Error del servidor' });
        res.json({ message: 'Roles', roles });
    });
};

// models/user.js
const getAllRoles = (callback) => {
    db.query('SELECT * FROM roles WHERE IS_ACTIVE = 1', callback);
};

Pídeme que yo escriba, siguiendo EXACTAMENTE este mismo patrón de 3
capas y este mismo estilo de callbacks, un endpoint nuevo
"GET /obtener-especialidad/:id" que traiga una especialidad médica por
su ID de una tabla llamada "specialities". Revisa lo que yo escriba y
dime específicamente qué le falta o qué está mal, comparándolo con el
patrón del ejemplo.
```

```
Explícame qué es un "reverse proxy" (proxy inverso) usando este código
real como ejemplo (es un gateway de Express con http-proxy-middleware):

app.use('/usuarios', createProxyMiddleware({
  target: 'http://localhost:3001/usuarios',
  changeOrigin: true
}))

¿Qué problema resuelve tener un gateway así en vez de que cada app
cliente le hable directo a cada servicio en su propio puerto? Dame 3
ventajas concretas y 1 desventaja real.
```

---

## Nivel 3 — Autenticación: JWT, middleware, roles

### Qué es un JWT (JSON Web Token)

Un JWT es un texto largo que el servidor te da cuando inicias sesión, y que tu app manda de vuelta en cada petición (en el header `Authorization`) para probar quién eres, sin que el servidor tenga que "recordar" tu sesión guardada en memoria — el token mismo contiene la información (firmada, para que nadie la pueda falsificar).

Ejemplo real, `services/usuarios/controllers/user.js` (login, simplificado):
```js
const token = jwt.sign(
    { userProfileId: user.USER_PROFILE_ID, roleId: user.ROLE_ID },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
);
res.json({ jwtToken: token, user });
```

### Qué es un "middleware" y cómo protege rutas

Un middleware es una función que se ejecuta ANTES del controller, y decide si la petición puede continuar o no. Este proyecto usa `verifyToken` (existe una copia en cada servicio) para revisar que el JWT sea válido:

```js
router.get('/obtener-usuarios', middleware.verifyToken, userController.getAllUsers);
```

Cuando la petición llega, Express corre PRIMERO `verifyToken`. Si el token es inválido, `verifyToken` responde con un error 401 y el controller (`getAllUsers`) nunca se llega a ejecutar. Si es válido, `verifyToken` llama a `next()` y ahí sí sigue al controller.

### Cómo se validan los ROLES en este proyecto (y por qué es importante que lo entiendas bien)

Este es un punto que investigamos a fondo: **no existe un middleware genérico de roles** — cada controller compara el rol a mano:
```js
const getAllUsers = (req, res) => {
    if (![1, 2, 3, 4].includes(req.decoded.roleId)) {
        return res.status(403).json({ message: 'No autorizado' });
    }
    // ...
};
```
`req.decoded` es lo que `verifyToken` guardó ahí después de descifrar el JWT. Este patrón funciona, pero significa que si algún día agregas un endpoint nuevo y se te olvida poner esta validación, ese endpoint queda sin protección de rol — es justo lo que pasó con 2 endpoints reales del proyecto que encontramos sin `verifyToken` siquiera (revisa el Manual Técnico, sección 11, para el detalle exacto).

### Prompts para pedirle a una IA

```
Explícame qué es un JSON Web Token (JWT), cómo se firma, y qué significa
que esté "firmado" pero no "encriptado" (es decir, cualquiera puede leer
su contenido pero no falsificarlo). Después, dame un ejercicio: te doy
este JWT de ejemplo (inventa uno tú con jwt.io) y quiero que me expliques
qué información trae adentro sin necesitar el secreto para descifrarlo,
y por qué eso significa que NUNCA debo guardar contraseñas o datos
sensibles dentro de un JWT.
```

```
Tengo este middleware real de Express/JWT:

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Sin token' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Token inválido' });
        req.decoded = decoded;
        next();
    });
};

Explícame exactamente qué hace cada línea, qué es "next()" y por qué es
la clave de cómo funciona un middleware en Express, y qué pasaría si
alguien quitara la línea "next()" por accidente.
```

```
En mi backend, la autorización por rol se hace a mano dentro de cada
controller (no hay un middleware genérico de roles), así:

if (![1, 2, 3, 4].includes(req.decoded.roleId)) {
    return res.status(403).json({ message: 'No autorizado' });
}

Ayúdame a diseñar (solo el código, en Express) un middleware genérico
"requireRole(...roles)" que reciba una lista de roles permitidos y lo
valide automáticamente, para no tener que repetir este if en cada
controller. Muéstrame cómo se usaría en una ruta de ejemplo.
```

---

## Nivel 4 — Frontend: React desde cero

Esta es la parte que dijiste que no te quedó clara — vamos con calma.

### Qué es un componente

Un componente de React es una función de JavaScript que devuelve HTML (en realidad JSX, que se ve como HTML pero es JavaScript). Ejemplo real MUY simple, `clients/sicem-web/src/pages/Login.jsx` (versión anterior, más fácil de leer que la actual):
```jsx
const Login = () => {
    return (
        <div>
            <input type="email" />
            <button>Entrar</button>
        </div>
    )
}
```
Eso es TODO lo que necesitas para que algo aparezca en pantalla. React toma esa función, la ejecuta, y convierte lo que devuelve en HTML real.

### Qué es JSX exactamente

JSX se parece a HTML pero NO es HTML — es JavaScript que se transforma en llamadas de función. `<div>hola</div>` en realidad se convierte, por detrás, en algo como `React.createElement('div', null, 'hola')`. Por eso puedes meter `{variable}` dentro del JSX — es JavaScript normal con una sintaxis especial para escribir "árboles de elementos" más fácil.

### Props: cómo un componente le pasa datos a otro

```jsx
<img className="unit-type-image" src={`/assets/units/${type.image_url}`} alt={type.ambulance_type} />
```
`className`, `src`, `alt` son "props" — datos que le mandas al componente `img`. Con tus propios componentes funciona igual:
```jsx
const Saludo = ({ nombre }) => <p>Hola, {nombre}</p>
// uso: <Saludo nombre="Hugo" />
```

### Prompts para pedirle a una IA

```
Nunca he entendido bien React. Sé JavaScript básico y SQL/backend.
Explícame, de la forma más simple posible, qué es un "componente" de
React, qué es JSX (y por qué NO es HTML aunque se vea igual), y qué son
las "props". Usa un ejemplo de una tarjeta de producto (nombre, precio,
imagen) como componente. Después dame 3 ejercicios progresivos: (1) un
componente que reciba solo un texto y lo muestre, (2) un componente que
reciba una lista de objetos y muestre una tarjeta por cada uno con
.map(), (3) un componente que reciba una función como prop y la
ejecute al hacer clic en un botón.
```

```
Tengo este componente real de React (de una app que registra
emergencias médicas):

{unitTypes.map((type) => {
    const unitsOfThisType = groupedUnits[type.ambulance_type_id] || []
    return (
        <div key={type.ambulance_type_id} className="unit-type-group">
            <img src={`/assets/units/${type.image_url}`} alt={type.ambulance_type} />
            <span>{type.ambulance_type}</span>
            <span>{unitsOfThisType.length} disp.</span>
        </div>
    )
})}

Explícame qué hace ".map()" aquí, por qué hace falta la prop especial
"key" en cada elemento del map (qué pasa si la quito), y por qué el
código usa "|| []" después de "groupedUnits[type.ambulance_type_id]".
```

---

## Nivel 5 — React: Hooks y Context API

### `useState`: cómo un componente "recuerda" cosas

```jsx
const [email, setEmail] = useState('')
```
`email` es el valor actual, `setEmail` es la función para cambiarlo. Cuando llamas `setEmail('nuevo valor')`, React vuelve a ejecutar el componente completo con el nuevo valor — esto se llama "re-render".

Ejemplo real, `clients/sicem-web/src/pages/Login.jsx`:
```jsx
const [email, setEmail] = useState('');
const [pass, setPass] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
```
Cuatro "memorias" distintas dentro del mismo componente, cada una independiente.

### `useEffect`: código que se ejecuta en momentos específicos

Ejemplo real, `clients/sicem-mobile/context/AuthContext.jsx`:
```jsx
useEffect(() => {
    const restoreSession = async () => {
        const storedToken = await SecureStore.getItemAsync('token')
        // ...
        setLoading(false)
    }
    restoreSession()
}, [])
```
El array vacío `[]` al final significa "ejecuta esto UNA sola vez, cuando el componente aparece por primera vez" — en este caso, para revisar si ya había una sesión guardada en el celular.

### Context API: compartir datos SIN pasar props por 10 niveles

Este es el patrón MÁS importante para que entiendas las 3 apps, porque las 3 usan exactamente el mismo (`AuthContext`). El problema que resuelve: si `App` sabe quién inició sesión, pero un botón 5 componentes "adentro" necesita esa info, normalmente tendrías que pasar la prop por los 5 niveles intermedios aunque no la usen. Context evita eso.

`clients/sicem-mobile/context/AuthContext.jsx` (real, simplificado):
```jsx
const AuthContext = createContext(null)

const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null)
    const [user, setUser] = useState(null)
    // ...
    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

const useAuth = () => useContext(AuthContext)
```
Cualquier componente, sin importar qué tan profundo esté, puede hacer `const { user, token } = useAuth()` y tener acceso directo — sin que nadie le tuviera que "pasar" esos datos a mano.

### Prompts para pedirle a una IA

```
Explícame useState y useEffect de React con ejemplos MUY simples
(un contador que sube al hacer clic, y un componente que carga datos
de una API falsa al aparecer en pantalla). Después dame este código
real y pídeme que te explique yo, línea por línea, qué hace (para
comprobar que entendí):

const [token, setToken] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
    const restoreSession = async () => {
        const storedToken = await SecureStore.getItemAsync('token')
        if (storedToken) setToken(storedToken)
        setLoading(false)
    }
    restoreSession()
}, [])

Corrígeme si me equivoco en algo.
```

```
Explícame el patrón "Context API" de React usando este ejemplo real
(un contexto de autenticación compartido entre toda una app):

const AuthContext = createContext(null)

const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null)
    const [user, setUser] = useState(null)
    return (
        <AuthContext.Provider value={{ user, token }}>
            {children}
        </AuthContext.Provider>
    )
}

const useAuth = () => useContext(AuthContext)

Explícame: (1) qué problema resuelve esto que useState normal no
resuelve, (2) qué es "children" y por qué se usa así, (3) por qué se
crea un hook personalizado "useAuth" en vez de que cada componente use
"useContext(AuthContext)" directo. Luego pídeme que diseñe (solo en
palabras, sin código) un Context nuevo para manejar un "carrito de
compras" en una tienda en línea, y revisa mi diseño.
```

---

## Nivel 6 — Enrutamiento en React (React Router)

### Qué problema resuelve

Una app de React es, técnicamente, UNA sola página HTML. React Router hace que se SIENTA como si tuviera varias páginas (login, dashboard, etc.) cambiando qué componente se muestra según la "URL" actual, sin recargar realmente la página.

### `BrowserRouter` vs `HashRouter` — el bug real que arreglamos hoy

Esto te lo explico con detalle porque literalmente lo vivimos juntos hoy en `sicem-desktop`.

- **`BrowserRouter`** usa la URL real del navegador (`https://sicem.com/dashboard`). Funciona perfecto en la web (Vercel) porque hay un servidor real detrás.
- **`HashRouter`** usa un `#` (`https://sicem.com/#/dashboard`). No necesita servidor — la parte después del `#` nunca se manda al servidor, la maneja JavaScript solo en el navegador.

**El bug real:** Electron carga la app con `file://` (un archivo local, no un servidor). Con `BrowserRouter`, Electron ponía la ruta COMPLETA del disco (`C:\Users\...\dist\index.html`) como si fuera la "URL actual", y React Router no encontraba ninguna ruta que hiciera match con eso — pantalla en blanco total. Cambiar a `HashRouter` en `clients/sicem-desktop/src/App.jsx` lo arregló, porque `HashRouter` no le importa cuál sea el archivo real, solo lo que esté después del `#`.

**Por qué `sicem-web` SÍ puede usar `BrowserRouter`:** porque corre en Vercel, un servidor real, no `file://`.

### Rutas protegidas (el patrón `PrivateRoute`)

`clients/sicem-desktop/src/App.jsx`:
```jsx
<Route element={<PrivateRoute />}>
    <Route path="/pacientes-en-camino" element={<IncomingPatients />} />
    {/* ...más rutas que requieren sesión */}
</Route>
```
`PrivateRoute` es un componente que revisa si hay sesión (usando `useAuth()`) y, si no la hay, redirige a `/login` en vez de mostrar la página pedida.

### Prompts para pedirle a una IA

```
Explícame la diferencia entre BrowserRouter y HashRouter de React
Router, y por qué BrowserRouter falla en una app de Electron que carga
el HTML con file:// en vez de http://. Dame un ejemplo de la URL exacta
que Electron generaría en cada caso para que yo vea la diferencia
concreta. Después pregúntame: "¿en qué otro tipo de app, además de
Electron, tendría sentido usar HashRouter en vez de BrowserRouter?" y
dime si mi respuesta tiene sentido.
```

```
Tengo este patrón real de "ruta protegida" con React Router v7:

const PrivateRoute = () => {
    const { token, loading } = useAuth()
    if (loading) return null
    return token ? <Outlet /> : <Navigate to="/login" replace />
}

// uso:
<Route element={<PrivateRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
</Route>

Explícame qué es "Outlet" y por qué se usa aquí en vez de renderizar
directo el componente hijo. Después dame un ejercicio: que yo escriba
un "AdminRoute" parecido pero que además de revisar que haya sesión,
revise que el rol del usuario sea de administrador, y si no lo es,
redirija a una página de "no autorizado" en vez de al login.
```

---

## Nivel 7 — Tiempo real: Socket.IO

### Por qué HTTP normal no alcanza

Con `fetch`, tu app SIEMPRE tiene que preguntar ("¿hay algo nuevo?"). Para que el despachador vea en tiempo real dónde está una ambulancia sin refrescar la página cada 2 segundos, se necesita algo donde el SERVIDOR pueda avisar al cliente cuando algo pasa, sin que el cliente pregunte. Eso es Socket.IO (una librería sobre WebSockets).

### Cómo se conecta un cliente

`clients/sicem-web/src/sockets/emergencySocket.js`:
```js
const connectEmergencySocket = (token) => {
    return io(SOCKET_URL, { auth: { token } })
}
```

### Rooms: cómo el servidor decide a quién avisar

El backend mete a cada usuario conectado en una o varias "rooms" según su rol (`dispatcher`, `hospital`, `paramedic`, `admin`) y según su propio ID (`user_<id>`). Cuando algo pasa, el servidor no le avisa a TODOS los conectados, solo a la room correcta:
```js
io.to('hospital').emit('eventTransferConcluded', data)
```
Solo los clientes que están en la room `hospital` reciben ese evento.

### Cómo el cliente escucha esos eventos

```js
socket.on('eventAmbulanceStatusChanged', (data) => {
    // actualizar el estado local con lo que llegó
})
```

### Prompts para pedirle a una IA

```
Explícame qué es un WebSocket y en qué se diferencia de una petición
HTTP normal (fetch/axios) — específicamente, por qué HTTP no sirve
bien para "avisar" al cliente cuando algo cambia sin que el cliente
pregunte. Usa como ejemplo una app de rastreo de ambulancias en tiempo
real. Después explícame qué es una "room" en Socket.IO y por qué un
servidor agruparía a los usuarios conectados en rooms en vez de
mandarle el mismo evento a todos.
```

```
Tengo este código real de Socket.IO en el backend (Node.js):

io.on('connection', (socket) => {
    const role = socket.decoded.roleId // ya viene de un JWT verificado
    if (role === 2) socket.join('dispatcher')
    if (role === 4) socket.join('hospital')
    socket.join(`user_${socket.decoded.userProfileId}`)
})

// más adelante, cuando pasa algo:
io.to('hospital').emit('eventTransferConcluded', { emergencyId: 5 })

Explícame paso a paso qué pasa desde que un usuario se conecta hasta
que recibe ese evento. Después dame un ejercicio: diseña (en código)
cómo emitirías un evento SOLO a un usuario específico (no a toda una
room), usando el patrón "user_<id>" del ejemplo.
```

---

## Nivel 8 — Las 3 plataformas y sus diferencias reales

### Web (`sicem-web`) — la más "normal"

React puro + Vite. Corre en un navegador normal, se despliega en Vercel como archivos estáticos (HTML/CSS/JS) que cualquier navegador puede abrir.

### Desktop (`sicem-desktop`) — React DENTRO de una ventana de escritorio

Electron = Chromium (el motor del navegador) + Node.js, empaquetados juntos como una app de escritorio. Tiene DOS "mundos" que debes entender:

- **Proceso principal** (`main.js`): es Node.js puro, controla la ventana, el ícono, el menú. NO puede usar React ni el DOM.
- **Proceso de renderizado**: es donde vive tu app de React normal, DENTRO de la ventana — es literalmente un navegador Chromium mostrando tu `dist/index.html`.
- **`preload.js`**: un puente controlado entre los dos mundos (por seguridad, no se les deja hablarse directo). En SICEM Desktop este puente casi no se usa todavía (es un placeholder) porque la app solo consume la API por HTTP normal (`fetch`), no necesita funciones especiales del sistema operativo.

### Mobile (`sicem-mobile`) — React, pero SIN navegador y SIN DOM

Este es el salto más grande. React Native NO usa HTML/CSS reales — usa componentes especiales (`<View>` en vez de `<div>`, `<Text>` en vez de `<p>`) que se traducen a componentes NATIVOS de Android/iOS de verdad (botones reales del sistema operativo, no dibujados en un navegador). Por eso mobile necesita **compilación nativa** (C++/Java/Kotlin) y no solo JavaScript — de ahí vienen TODOS los dolores de cabeza de rutas largas y NDK que viste hoy.

`expo-router` (usado en sicem-mobile) organiza las pantallas por CARPETAS y NOMBRES DE ARCHIVO en vez de una lista de `<Route>` como en React Router web — `app/(auth)/login.js` se convierte automáticamente en la ruta `/login`.

### Prompts para pedirle a una IA

```
Explícame la diferencia entre el "proceso principal" y el "proceso de
renderizado" en una app de Electron, y por qué existe un archivo
especial llamado "preload.js" como puente entre los dos. Usa un
ejemplo concreto: quiero que una app de Electron pueda leer un archivo
del disco duro del usuario cuando le da clic a un botón en la interfaz
de React — explícame por qué el código de React NO puede simplemente
hacer eso directo, y qué papel jugaría preload.js ahí.
```

```
Explícame la diferencia fundamental entre React (para web) y React
Native, específicamente: por qué "<div>" no existe en React Native y
se usa "<View>" en su lugar, y qué significa que React Native
"compile a componentes nativos" en vez de dibujar HTML. Después
explícame, en términos simples, por qué construir una app de React
Native para Android requiere herramientas de compilación de C++
(NDK, CMake) cuando mi código está escrito en JavaScript.
```

---

## Nivel 9 — Herramientas de build (Vite, Metro)

### Qué hace un "bundler" en general

Tu código está separado en decenas de archivos (`import` por todos lados). Un navegador o un teléfono no puede cargar 100 archivos por separado de forma eficiente — un bundler los combina todos en 1 o pocos archivos finales, optimizados, listos para producción.

### Vite (usado en sicem-web y sicem-desktop)

Corre 2 modos:
- **Desarrollo** (`yarn dev`): NO empaqueta nada, sirve los archivos casi tal cual, súper rápido para iterar, pero necesita que Vite siga corriendo.
- **Producción** (`vite build`): sí empaqueta todo en archivos finales optimizados dentro de `dist/`, listos para subir a un servidor o meter en un `.exe`.

### Metro (usado en sicem-mobile — el bundler de React Native)

Es el equivalente de Vite pero para React Native. Tiene sus propias reglas de cómo encuentra los paquetes (`node_modules`) — el bug real de "la app se cierra sola" que vivimos hoy (Nivel de empaquetado) fue justo una configuración de Metro (`unstable_enablePackageExports`) resolviendo mal el paquete `react`.

### Prompts para pedirle a una IA

```
Explícame qué es un "bundler" de JavaScript (como Vite o Webpack) y por
qué hace falta uno — específicamente, qué problema resuelve combinar
100 archivos en 1 o 2 archivos finales antes de subir una app a
producción. Compáralo con simplemente subir todos los archivos
".js" sueltos a un servidor y por qué eso sería más lento/peor para
el usuario final.
```

```
Explícame la diferencia entre correr un proyecto en "modo desarrollo"
(por ejemplo "yarn dev" con Vite) y hacer un "build de producción"
("vite build"). ¿Por qué el modo desarrollo no está optimizado
(archivos más grandes, sin minificar) y el de producción sí? ¿Qué es
"minificar"?
```

---

## Nivel 10 — Empaquetado nativo (lo más avanzado del proyecto)

Esto es, honestamente, la parte más difícil de todo SICEM — y lo viviste en carne propia hoy. No hace falta que la domines a fondo, pero sí que entiendas las piezas grandes.

### Desktop: `electron-builder` y el archivo `.asar`

Un `.exe` de Electron no es "un archivo" — es Chromium + Node.js + tu código, todo empaquetado. Tu código (`dist/`, `dist-electron/`) se comprime dentro de un archivo especial llamado `.asar` (parecido a un `.zip`), que vive dentro de `resources/app.asar` en la carpeta final. `electron-builder` es la herramienta que arma todo esto y genera el instalador (`.exe`).

### Mobile: por qué compilar para Android es TAN distinto a "solo JavaScript"

React Native tiene módulos escritos en C++ (para rendimiento — animaciones, listas, cámara, etc.). Compilar la app para Android significa, literalmente, compilar C++ real usando el **NDK** (Native Development Kit de Android) y **CMake/Ninja** (herramientas de compilación de C++), además de empaquetar tu JavaScript. Por eso los errores que viste hoy (`std::format`, rutas de 260 caracteres, versión de NDK) son errores de COMPILADOR DE C++, no de JavaScript — un mundo totalmente distinto al que quizás ya conocías.

### Prompts para pedirle a una IA

```
Explícame, en términos simples, qué es un archivo ".asar" en el
contexto de Electron, y por qué una app de Electron empaqueta tu
código ahí en vez de dejar los archivos sueltos. ¿Qué ventaja de
seguridad o de organización da comprimir todo en un solo archivo?
```

```
Nunca he compilado C++ y no sé nada de eso, pero mi app de React
Native necesita compilarlo para generar el APK de Android. Explícame,
sin dar por hecho que sé C++, qué hace un compilador de C++ en
términos generales (código fuente -> código máquina), qué es el "NDK"
de Android, y por qué React Native necesita código en C++ en vez de
ser "solo JavaScript" de principio a fin. No necesito escribir C++,
solo entender qué está pasando cuando compilo.
```

---

## Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces

### Variables de entorno (`.env`)

Un archivo `.env` guarda configuración que CAMBIA según dónde corra la app (contraseñas, URLs) SIN tener que cambiar el código fuente. `process.env.NOMBRE` en Node, o `import.meta.env.NOMBRE` en Vite, leen esos valores. Nunca se suben a git (por seguridad) — cada máquina/entorno tiene su propia copia.

### CORS: qué es y por qué existe

Los navegadores, por seguridad, bloquean por default que una página web (`sicem.vercel.app`) le hable a un servidor en OTRO dominio (`tu-codespace.app.github.dev`) — a menos que ese servidor diga explícitamente "sí, acepto peticiones de otros orígenes" con un header `Access-Control-Allow-Origin`. Por eso el backend de SICEM tiene `app.use(cors())` — sin eso, sicem-web literalmente no podría hablarle al backend desde Vercel.

### Codespaces / contenedores / `devcontainer.json`

Un "contenedor" es una máquina virtual ligera, aislada, con su propio sistema operativo dentro. GitHub Codespaces te da uno gratis (con límites) conectado a tu repositorio. `devcontainer.json` es un archivo que le dice a Codespaces "cuando crees este contenedor, instala esto, corre este script" — automatiza lo que hicimos a mano tantas veces hoy (instalar MariaDB, crear usuarios, etc.).

### Prompts para pedirle a una IA

```
Explícame qué es CORS (Cross-Origin Resource Sharing), por qué existe
como medida de seguridad de los navegadores, y qué significa
exactamente el error "blocked by CORS policy: No 'Access-Control-Allow-
Origin' header is present". Dame un ejemplo concreto: mi frontend vive
en https://miapp.vercel.app y mi backend en https://miapi.com — explica
paso a paso qué pasa cuando el navegador intenta hacer una petición
entre esos dos, con y sin CORS configurado en el backend.
```

```
Explícame qué es un "contenedor" (como Docker) en términos simples,
usando la analogía de una caja aislada con su propio sistema operativo
mini adentro. Después explícame para qué sirve un archivo
"devcontainer.json" en el contexto de GitHub Codespaces, y qué
diferencia hay entre poner comandos de instalación (como "instalar
MySQL") en ese archivo versus correrlos a mano cada vez que abro un
entorno nuevo.
```

---

## Nivel 12 — La arquitectura completa (para verlo todo junto)

Ya con todos los niveles anteriores, esto debería tener sentido de corrido:

1. Tres apps cliente (web, desktop, mobile) — cada una construida con su propia herramienta (Vite, Vite+Electron, Expo+Metro) porque cada plataforma es fundamentalmente distinta.
2. Las tres le hablan al mismo **gateway** por HTTP normal (con `fetch`), protegido por **CORS**, y se identifican con un **JWT** que consiguieron al hacer login.
3. El gateway reenvía (proxy simple) a 5 **microservicios** independientes, cada uno con su patrón interno de **routes → controllers → models**.
4. Dos de esos servicios (`unidades` y `emergencias`) además exponen conexiones de **Socket.IO** para avisar en tiempo real sobre cambios (ubicación de ambulancias, estado de emergencias), separadas del tráfico HTTP normal.
5. Todos comparten UNA sola base de datos MySQL/MariaDB — no se hablan entre sí por HTTP, cada servicio consulta directo las tablas que necesita (una decisión de diseño consciente para mantener el proyecto simple, con sus propias ventajas y desventajas — ver Manual Técnico sección 2).
6. Todo el backend corre dentro de un **Codespace** (un contenedor en la nube), configurado automáticamente por un `devcontainer.json`.
7. `sicem-web` se despliega en **Vercel** (build de producción de Vite); `sicem-desktop` y `sicem-mobile` se compilan LOCALMENTE en tu PC a `.exe`/`.apk`, con las URLs del backend "horneadas" dentro vía variables de entorno.

### Prompt final para pedirle a una IA (repaso general)

```
Voy a describirte la arquitectura completa de mi proyecto y quiero que
me hagas preguntas de examen oral sobre ella, una por una, esperando mi
respuesta antes de la siguiente, para comprobar que de verdad la
entendí (no me des las respuestas primero):

- 3 apps cliente (web en React/Vite, desktop en Electron, mobile en
  React Native/Expo) le hablan por HTTP a un gateway (proxy simple).
- El gateway reenvía a 5 microservicios de Express, cada uno con
  patrón routes/controllers/models y su propia base compartida MySQL.
- Autenticación con JWT, verificado por un middleware en cada
  servicio; los roles se validan a mano dentro de cada controller.
- Dos servicios exponen Socket.IO aparte del HTTP normal, para avisos
  en tiempo real agrupados por "rooms" según el rol del usuario.
- El backend corre en un contenedor (Codespaces), configurado con un
  devcontainer.json; sicem-web se despliega en Vercel, y
  sicem-desktop/sicem-mobile se compilan localmente a .exe/.apk con
  las URLs del backend fijadas en tiempo de compilación vía
  variables de entorno.

Hazme entre 8 y 10 preguntas, de lo más simple a lo más complejo,
sobre por qué se diseñó así y qué pasaría si cambiara alguna pieza
(por ejemplo: "¿qué pasaría si quitas el gateway y cada app le habla
directo a cada servicio?").
```

---

## Cómo seguir después de esto

Cuando ya te sientas cómodo con todos los niveles, la mejor forma de consolidarlo es **modificar algo pequeño de verdad** en tu propio proyecto (no en un ejemplo inventado) y ver qué pasa. Ideas de práctica, de más fácil a más difícil:

1. Agrega un campo nuevo, sencillo, a una tabla existente (por ejemplo `notas_internas` en `institutions`) y expónlo en un endpoint GET ya existente.
2. Agrega una pantalla nueva simple en `sicem-web` (una lista de algo que ya existe en la base, sin editar nada, solo mostrar).
3. Agrega un evento de Socket.IO nuevo para algo que hoy se actualiza solo con `fetch` manual.
4. Lee el Manual Técnico (`Manual_Tecnico_SICEM.pdf`, en la raíz de SICEM) completo, sección por sección, y para cada sección que no entiendas del todo, usa el prompt correspondiente de este documento.
