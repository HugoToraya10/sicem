# SICEM — Contexto para continuar con Claude Code

Este documento es para pegarlo a una sesión nueva de Claude Code (o para que la retome esta misma) y que tenga todo el contexto de golpe: qué es el proyecto, qué se construyó, cómo está organizado, y cómo le gusta trabajar al dueño del proyecto. El siguiente paso planeado es **sicem-mobile** (React Native + Expo) — la última sección explica ese cambio de stack y las dudas ya resueltas sobre Expo Go vs. compilar.

---

## 1. Qué es SICEM

Sistema de coordinación de emergencias médicas para Tabasco, México. Hay tres tipos de usuario con apps separadas:

- **Despachador / Admin** → `sicem-web` (navegador). Registra emergencias, asigna ambulancias, hace seguimiento.
- **Hospital** → `sicem-desktop` (Electron). Acepta/rechaza pacientes, gestiona camas, presta/pide ambulancias entre instituciones.
- **Paramédico** (en campo) → **sicem-mobile, todavía no existe.** Es el siguiente paso.

Hay un quinto rol, "Paciente" (5), pero no tiene cliente propio construido todavía.

## 2. Estructura del monorepo

```
SICEM/
├── gateway/                  puerto 3000 — único punto de entrada para los clientes
├── services/
│   ├── usuarios/              puerto 3001 — login, JWT, perfiles, roles
│   ├── hospitales/            puerto 3002 — instituciones, especialidades, camas
│   ├── unidades/              puerto 3003 — ambulancias, ubicaciones, catálogos de unidad
│   ├── pacientes/             puerto 3004 — expedientes clínicos, alergias, condiciones, medicamentos
│   └── emergencias/           puerto 3005 — el corazón del sistema: emergencias, pacientes de
│                               emergencia, asignaciones, solicitudes interinstitucionales,
│                               triage. TAMBIÉN corre el servidor de socket.io aquí mismo
│                               (los clientes se conectan directo a :3005, sin pasar por el gateway).
└── clients/
    ├── sicem-web/              despachador/admin — React + Vite, browser normal
    └── sicem-desktop/          hospital — React + Vite + Electron
```

Todos los servicios comparten **una sola base de datos MySQL** (`sicem`) — no se comunican entre sí por HTTP para leer datos de otra tabla, hacen JOIN directo aunque la tabla "pertenezca" conceptualmente a otro servicio (ej. `emergencias` hace JOIN directo a `ambulances`, `institutions`, etc.). Es el patrón ya establecido, no un descuido — no lo cambies por "arquitectura más limpia" sin que te lo pidan.

Los clientes llaman al **gateway** (`http://localhost:3000/...`) para todo lo que es REST. Los **sockets** son la excepción: se conectan directo a `http://localhost:3005` (el servicio de emergencias), sin pasar por el gateway.

## 3. Convenciones — sígueles el paso, no las "mejores"

- **yarn**, no npm.
- `fetch` nativo con `.then()/.catch()`, nunca axios, nunca async/await en los controllers/fetches del frontend (el estilo establecido es encadenado).
- Verbos PATCH en mayúsculas donde ya se usan así.
- `mysql2` en estilo callback (`db.query(sql, params, (err, rows) => {...})`), no promesas/async.
- `toLowerCaseKeys()` — las columnas de MySQL vienen en MAYÚSCULAS, este helper las baja a minúsculas antes de mandarlas al frontend. Los alias explícitos de SQL (`AS nombre_columna`) ya vienen en minúsculas y no necesitan el helper para ese campo específico, pero igual se le pasa el objeto completo sin problema.
- "Optimistic update" en este proyecto = actualizar el state local de React directamente con `setState(current => current.map(...))`, no un patrón de librería con rollback automático.
- Los catálogos chicos y estables (triage_levels, request_statuses, ambulances_statuses, emergency_statuses) se cargan una vez y se cruzan en cliente — NO se re-piden en cada request. Los IDs de estos catálogos SÍ se hardcodean en el frontend cuando son estables y ya confirmados contra la BD (ver sección 4) — eso no es un bug, es el patrón ya usado en todo el proyecto (`Requests.jsx` ya lo hace así desde antes). El bug real que sí hay que evitar es derivar las OPCIONES de un filtro/dropdown de los datos ya cargados en vez de pedir el catálogo completo (eso sí pasó y se corrigió con triage en `History.jsx`).
- Reutiliza componentes existentes antes de crear uno nuevo — este proyecto ya tiene varios ejemplos de esto: `RejectReasonModal.jsx` se generalizó (props `title`/`message`) para servir tanto para rechazar pacientes como para rechazar solicitudes de unidad, en vez de duplicar el modal.
- `window.prompt()` y `window.alert()` para flujos importantes están mal vistos en Electron — no siempre se comportan bien empaquetados. Se reemplazaron por modales propios donde importaba (ej. `RejectReasonModal`).
- Nada de pruebas con instancias aisladas de puertos a menos que haga falta levantar un servidor real (para probar sockets end-to-end, por ejemplo). Para lógica pura de backend, es más barato requerir el modelo/controlador directamente con `node -e` o un script chico, y llamarlo con objetos `req`/`res` simulados — así se prueba de verdad contra la base de datos real sin arriesgar nada, y se limpia después. Ver sección 8 sobre por qué esto le importa al usuario.
- Nunca tocar directamente los puertos reales de desarrollo (3000-3005, 5173+) salvo para observar/leer — el usuario los corre él mismo con `yarn dev` (nodemon).

## 4. Catálogos reales (confirmados contra la BD — no adivinar)

**`request_statuses`** (usado tanto para recepción de pacientes como para solicitudes interinstitucionales):
`1 Pendiente · 2 Aceptada · 3 Rechazada · 4 Cancelada`

**`triage_levels`** (ordenados por `triage_level_id`, `max_wait_minutes` es la clave real de prioridad — menor = más urgente):
`1 Nivel I (Rojo) · 2 Nivel II (Naranja) · 3 Nivel III (Amarillo) · 4 Nivel IV (Verde) · 5 Nivel V (Azul)`

**`emergency_statuses`**:
`1 Registrada · 2 Asignada · 3 En atención · 4 Trasladando · 5 Cerrada`

**`ambulances_statuses`**:
`1 Disponible · 2 En camino · 3 En escena · 4 Trasladando · 5 Fuera de servicio · 6 En mantenimiento · 7 Reservada`
("Reservada" es el estado que se le pone a una unidad externa mientras su solicitud interinstitucional sigue pendiente — no es lo mismo que "En camino".)

**`roles`** (tabla real puede llamarse distinto, pero el `role_id` es lo que importa):
`1 Administrador · 2 Despachador · 3 Paramédico · 4 Hospital · 5 Paciente`

## 5. Tablas clave y relaciones

- **`emergencies`** — una emergencia reportada. Columnas importantes: `emergency_type_id`, `emergency_status_id`, `triage_level_id` (estimado del despachador), `closed_at`, **`close_reason`** (NULL = se resolvió sola / cierre normal; con texto = cierre forzado por admin — así se distingue "Resuelta" de "Cerrada sin resolver" en el Historial de sicem-web).
- **`emergencies_patients`** — un paciente dentro de una emergencia. Columnas clave: `reception_status_id` (usa el catálogo `request_statuses`), `destination_institution_id`, `destination_speciality_id`, `ambulance_id` (qué unidad lo transporta — se puede asignar/reasignar independientemente de `assignments`), `delivered_at` (confirmación física de llegada al hospital), `discharged_at` (alta médica), **`rejection_reason`**.
- **`assignments`** — asignación DIRECTA de una ambulancia PROPIA a una emergencia (vía `registrar-asignacion`). Solo cubre unidades de la institución dueña. **No incluye unidades externas** aunque ya estén aceptadas — ese fue un bug real que causó que ambulancias externas "en camino" nunca aparecieran en `EmergencyDetail.jsx`. Para saber TODAS las unidades ligadas a una emergencia hay que combinar `assignments` + `inter_institutional_requests` (filtradas a Pendiente/Aceptada).
- **`inter_institutional_requests`** — cuando el despachador pide prestada una ambulancia de OTRA institución. `requesting_institution_id` = quien pide (casi siempre el despachador/CRUM), `receiving_institution_id` = quien es dueño de la unidad y tiene que responder. `request_status_id` sigue el catálogo de arriba.
- **`ambulances`** — catálogo de unidades. `institution_id`, `ambulance_status_id`, `ambulance_type_id`, `unit_number` (varchar(8), ¡corto!), `license_plate` (varchar(9)).
- **`locations`** — última ubicación conocida de una ambulancia (`ambulance_id`, `latitude`, `longitude`, `recorded_at`). Hoy en día **nadie las actualiza en vivo** porque sicem-mobile no existe — se insertaron manualmente 5 ambulancias de prueba (`DEMO-01` a `DEMO-05`, institución 1 = Cruz Roja Tabasco, la única CRUM) con ubicaciones fijas para poder probar la recomendación de ruta más cercana.
- **`institutions`** — hospitales/CRUM. `is_crum_institution` determina si puede tener despachadores (rol 2) — hay una validación en el login que bloquea cuentas rol 2 en instituciones no-CRUM.
- Catálogos de apoyo: `emergency_types`, `ambulance_types`, `specialities` + `institutions_specialities` (qué especialidades ofrece cada hospital y cuántas camas), `blood_types`, `clinical_records` + `patient_allergies`/`patient_conditions`/`patient_medications`.

## 6. Qué se construyó (inventario completo)

### sicem-desktop (Hospital)

- **Ciclo de vida completo del paciente**: Pendiente → Aceptada (reserva cama de inmediato) → `delivered_at` (confirmar llegada física) → `discharged_at` (dar de alta, libera cama) | o Rechazada / Cerrada-sin-resolver.
- **Pantallas** (nav): Pacientes en Camino (bandeja pura de decisiones — solo Pendientes) → Seguimiento (casos ya aceptados: esperando llegada / esperando alta, con botones directos de Confirmar/Dar de alta en la tarjeta, sin abrir modal) → **Solicitudes de Unidad** (nueva — bandeja de solicitudes interinstitucionales pendientes dirigidas a esta institución, con mapa+detalles+Confirmar/Rechazar) → Capacidad → Historial (archivo puro y filtrable: por estado compuesto y por nivel de triage real) → Gráficas → Mis Ambulancias.
- **Notificaciones nativas + sonido** (`utils/notify.js`) para: paciente nuevo, solicitud de unidad nueva, solicitud cancelada tras haber sido aceptada. Viven en `PrivateRoute.jsx` (montado siempre, no en una pantalla específica) para que suenen sin importar dónde esté el usuario. Ojo con el bug de Chromium: un `AudioContext` creado fuera de un gesto directo del usuario queda "suspended" — hay que llamar `.resume()` (ya está arreglado).
- **`PatientDetailModal.jsx`** — modal grande con mapa (ubicación de la ambulancia + ubicación de la emergencia + **ruta real dibujada entre ambas vía OSRM**), datos clínicos, botones de acción condicionados al estado real (isClosed/isPending/canConfirmDelivery — este último ahora exige `reception_status_name === 'Aceptada'`, antes dejaba confirmar llegada de un paciente que ni siquiera había sido aceptado). Callback `onPatientUpdated` para que la pantalla que lo abrió se actualice sin recargar.
- **`MyAmbulances.jsx`** — ahora tiene sockets (antes no tenía ninguno, había que recargar para ver el estado real de tus unidades).

### sicem-web (Despachador/Admin)

- **Dashboard** — 3 columnas: sidebar izquierdo (Emergencias Activas con scroll propio + filtro de triage real + Unidades colapsable con su propio espacio protegido, no se aplastan entre sí) / mapa central / sidebar derecho nuevo "Necesitan aceptación" (filtro FIJO, no togglable: activas con pacientes pendientes O rechazados). Orden de prioridad real: rechazados primero, luego por severidad de triage, empate por antigüedad.
- **Historial** — separa "Resueltas" de "Cerradas sin resolver" (por `close_reason`), filtro de triage real, columna de motivo cuando fue forzado.
- **`NewEmergency.jsx`** — Paso 1 (registrar emergencia + elegir unidades propias/externas) → Paso 2 (identificar pacientes, con selector de hospital destino + especialidad + **unidad asignada por paciente**, validando que dos pacientes con la misma unidad no puedan tener destinos distintos). Tiene "+ Agregar otra unidad a esta emergencia" en el Paso 2 para cuando ya se registró pero hace falta más transporte (la emergencia ya existe en ese punto, así que esto es aditivo, NO reintenta el submit original — eso hubiera duplicado la emergencia).
  - **Recomendación de ambulancia más cercana**: en cuanto se marca la ubicación de la emergencia (clic en mapa o Nominatim), cada unidad propia disponible muestra distancia+tiempo REAL por calle (vía OSRM, no línea recta) y se ordena por cercanía; la más rápida lleva etiqueta "Más cercana". Se traza la ruta completa (polyline) solo de esa unidad ganadora en el mapa.
  - El mapa también pinta TODAS las ambulancias disponibles (propias y externas) — antes no se veía ninguna porque el catálogo de unidades no trae lat/long, había que fusionarlo con las ubicaciones pedidas aparte.
- **`EmergencyDetail.jsx`**:
  - Mapa con la ubicación de la emergencia + cada ambulancia ligada (propia o externa, pendiente o aceptada) + **ruta real dibujada de cada una** hacia la emergencia (a diferencia de NewEmergency, aquí se dibujan TODAS, no solo la más cercana — porque aquí ya se sabe cuáles van).
  - "+ Agregar ambulancia" — ahora también lista unidades EXTERNAS (antes solo propias), y muestra la misma recomendación de distancia/tiempo real que NewEmergency para las propias, con "Más cercana". Mientras el formulario está abierto, esas candidatas también se ven como puntos en el mapa (antes solo se veían las ya asignadas).
  - **Asignar unidad a un paciente específico**: selector "Unidad asignada" por paciente (con Aceptar/Cancelar para confirmar el cambio antes de que se mande — evita "pendejadas" accidentales; avisa con `confirm()` si intentas salir de la página con cambios sin confirmar, y con `beforeunload` si cierras/recargas la pestaña). Se puede asignar una unidad externa **aunque todavía no haya sido aceptada** — si al final la rechazan/cancelan, el backend la suelta sola del paciente (`clearAmbulanceFromEmergencyPatients`).
  - Desasignar unidad propia y cancelar solicitud externa (esta última funciona tanto en Pendiente como ya Aceptada — si ya la habían aceptado, se le avisa al hospital con sonido/notificación que ya no hace falta).
- **`Requests.jsx`** — ahora tiene sockets (antes cargaba una vez y ya).

### Backend (mayormente `services/emergencias`)

- **Endpoint nuevo**: `GET /emergencias/solicitudes-pendientes-institucion/:institutionId` — pendientes dirigidas a un hospital, con todo lo necesario para decidir (unidad, emergencia, triage) en una sola consulta.
- **Endpoint nuevo**: `PATCH /emergencias/asignar-ambulancia-paciente` — liga una unidad a un paciente específico SIN tocar destino ni reception_status (a propósito distinto de `reasignar-destino-paciente`, que si tocaba esas dos cosas — hubiera sido un efecto secundario dañino reusarlo solo para cambiar de unidad).
- **`respondInterInstitutionalRequest`** — ahora acepta rol 4 (antes solo 1 y 3 — el hospital dueño de la unidad no podía responder nada desde sicem-desktop, por eso las solicitudes se quedaban pendientes para siempre). Valida que quien responde de verdad pertenezca a la institución receptora (antes cualquiera podía aceptar la solicitud de cualquier otro hospital).
- **`cancelInterInstitutionalRequest`** — ahora también funciona sobre solicitudes YA Aceptadas, no solo Pendientes. Siempre suelta la ambulancia (`ambulance_status_id = 1`) y limpia `ambulance_id` de cualquier paciente que la tuviera asignada.
- **Salas de socket arregladas**: `eventInterInstitutionalRequest`, `eventInterInstitutionalRequestResponded`, `eventAmbulanceAssigned`, `eventAmbulanceUnassigned` ahora también emiten a la sala `'hospital'` (antes se quedaban cortos y sicem-desktop nunca se enteraba).
- **`index.js`** (emergencias) — la verificación de JWT del socket ahora comenta por qué desconecta si el token es inválido/vencido (antes fallaba en silencio absoluto).

### Autenticación (ambos clientes)

- **Interceptor global de `fetch`** en `AuthContext.jsx` (desktop y web): cualquier 401 en una petición que sí llevaba `Authorization` limpia la sesión y manda a `/login` al instante. No afecta al login mismo (esa petición nunca manda ese header). Esto se agregó porque un JWT vencido (dura 8h) fallaba en silencio en TODOS lados — sockets, fetches, todo — y era muy difícil de diagnosticar sin esto.

## 7. Ruteo real (OSRM) — cómo y por qué

Se usa el **servidor demo público de OSRM** (`https://router.project-osrm.org`) para distancia/tiempo real por calle y para dibujar rutas completas (polyline). Se eligió porque ya se usa el mismo ecosistema OpenStreetMap para todo lo demás (Nominatim para geocodificar direcciones en `NewEmergency.jsx`, tiles de OSM en Leaflet) — cero llaves de API, cero costo.

**Advertencia real, no cosmética**: ese servidor demo es gratuito pero está pensado para pruebas/bajo volumen, no para producción con muchas unidades o consultas por segundo. Si esto se presenta y se quiere usar en serio después, lo correcto es self-hostear OSRM (es software libre, se le puede cargar el mapa de México) en vez de seguir pegándole al servidor compartido público. No es urgente para una demo de tesis/proyecto escolar, pero menciónalo si el proyecto crece.

Patrón de llamada:
- Solo distancia/duración (liviano, para ordenar varias unidades): `?overview=false`
- Geometría completa para dibujar la línea (solo se pide para la unidad ganadora/relevante, nunca para todas a la vez): `?overview=full&geometries=geojson` — las coordenadas vienen `[lon, lat]`, Leaflet quiere `[lat, lon]`, hay que invertir.

`MapArea.jsx` de sicem-web soporta **varias** rutas a la vez (prop `routes`, array de `{coordinates, color?}`) porque `EmergencyDetail.jsx` puede tener varias unidades. El de sicem-desktop soporta **una sola** ruta (prop `routeCoordinates`) porque cada modal de paciente solo tiene una ambulancia relevante — no había que igualar la complejidad de más.

## 8. Cómo le gusta trabajar al usuario (Hugo)

- **Verificación real, no "debería funcionar"**: cuando se puede, probar contra la base de datos de verdad (insertar filas sintéticas, llamar al controlador/modelo directo, revisar el resultado, limpiar). Esto destapó bugs reales varias veces en esta sesión que una revisión de código sola no hubiera visto (el JWT vencido, el `WHERE` que solo aceptaba Pendiente, etc.).
- **Honestidad sin autodefensa**: si algo que construiste no funciona o fue un error, dilo directo ("sí, metí la pata") y explica la causa real — no lo minimices ni lo disfraces.
- **Confirmar antes de features grandes/con decisiones de diseño**, pero NO pedir permiso para cada paso de algo que ya se acordó — evita el ping-pong innecesario. Si el cambio es chico o es continuación directa de algo ya aprobado, solo hazlo y reporta al final.
- **Cuidado con los tokens** — este usuario se ha quedado bajo de tokens más de una vez en esta sesión y lo menciona explícitamente. No repitas exploración que ya hiciste, no leas archivos completos si ya sabes qué hay, no generes resúmenes larguísimos.
- **Velocidad y agilidad son literalmente de seguridad del paciente** — este es un sistema de emergencias médicas reales (bueno, simulado para un proyecto escolar, pero el usuario lo trata con esa seriedad). Por eso insiste tanto en botones de acción directos en las tarjetas en vez de "abrir detalle → buscar el botón", y en que todo se actualice en vivo sin recargar.
- **Confirmar/deshacer antes de mandar cambios sensibles** — pidió explícitamente el patrón de "seleccionar → Aceptar/Cancelar" para no mandar un cambio por accidente ("por si hice una pendejada que no quería hacer").
- **Reusar antes que duplicar** — cuando encuentres un patrón ya resuelto en otra parte del código (un modal, un helper, un endpoint), reutilízalo o generalízalo un poco en vez de escribir uno nuevo desde cero.
- Español informal, directo, con groserías ocasionales — responde en el mismo tono, sin ser el asistente que suena robotizado o que se disculpa de más.
- Le gusta que al final de cada tarea le digas **qué cambió concretamente**, en lenguaje claro, no una lista genérica de "se mejoró la UX".

## 9. Siguiente paso: sicem-mobile (React Native + Expo)

Esto es lo que planeaban empezar justo después de este documento. El rol objetivo es **Paramédico (rol 3)** — hoy en día varias cosas del sistema están literalmente esperando a que exista esta app:

- Reportar la ubicación en vivo de la ambulancia (`POST /unidades/registrar-ubicacion` — la ruta YA EXISTE en el backend, marcada `// TODO (app móvil)`, nunca se ha llamado desde ningún cliente real).
- Registrar pacientes de una emergencia en campo (`POST /emergencias/registrar-paciente`, también marcado TODO).
- Registrar notas de urgencia / signos vitales (`POST /emergencias/registrar-nota-urgencia`, también TODO).
- El "handshake" de aceptar una solicitud interinstitucional se decidió DELIBERADAMENTE dejarlo solo del lado del hospital (sicem-desktop) por ahora — no había manera de construir la confirmación del paramédico sin la app móvil. Cuando exista, el patrón natural (ya usado para pacientes: aceptar reserva administrativamente, confirmar llegada física es un paso posterior separado) se puede repetir aquí.

### Diferencias grandes de stack a explicar (React Native / Expo)

- **No hay DOM.** Nada de `<div>`, `<span>`, CSS normal. Se usa `<View>`, `<Text>`, `<Image>`, etc., y estilos con `StyleSheet.create({...})` (objetos JS, no archivos `.css`) o alguna librería de estilos si se decide usar una.
- **No hay `react-router-dom`.** La navegación es otra librería — típicamente **Expo Router** (basado en archivos, parecido a Next.js) o React Navigation. Dado que el resto del proyecto ya usa react-router en los otros dos clientes, probablemente Expo Router sea el más natural por la similitud conceptual, pero es una decisión a tomar con el usuario, no asumida.
- **Mapas**: no hay Leaflet en RN. La opción típica es `react-native-maps`. La lógica de OSRM (fetch + dibujar polyline) se puede reutilizar casi igual, solo cambia el componente de mapa.
- **`fetch` nativo SÍ funciona igual en React Native** — no hay que reescribir esa parte, es una de las pocas cosas que se traduce directo.
- **Sockets**: `socket.io-client` también funciona en React Native, la lógica de conexión/salas se traduce casi igual que en los otros dos clientes.
- **Almacenamiento de sesión**: no hay `localStorage` en React Native — hace falta `AsyncStorage` (o `expo-secure-store` para el JWT, más apropiado para un token). El patrón de `AuthContext.jsx` (login/logout/token/user) se puede portar conceptualmente, pero el storage subyacente cambia.
- **Permisos nativos**: para ubicación en vivo (GPS) y notificaciones va a hacer falta pedir permisos explícitos vía Expo (`expo-location`, `expo-notifications`) — no es un simple `Notification.requestPermission()` como en el navegador/Electron.

### Expo Go vs. compilar — tu pregunta

Tu intuición es correcta: **Expo Go es solo para desarrollo/pruebas rápidas**, no algo que le presentes a un maestro como "la app terminada". Cómo funciona:

- **Expo Go** es una app genérica que Expo publica en la Play Store / App Store. Durante desarrollo, corres `npx expo start`, te sale un QR, lo escaneas con el celular que ya tiene Expo Go instalado, y carga tu proyecto DENTRO de esa app genérica — sin compilar nada tú mismo, con hot reload instantáneo. Es rapidísimo para iterar, pero el ícono, el nombre, y el hecho de que corre dentro de "Expo Go" es obvio para cualquiera que lo vea.
- Para algo presentable (ícono propio, nombre propio, funciona como una app real instalada, no depende de tener Expo Go instalado) hay que hacer un **build**, con `EAS Build` (Expo Application Services, el servicio de build en la nube de Expo — tiene un tier gratuito con límites de builds al mes) o un build local si se instala el toolchain de Android/iOS. Esto genera un `.apk`/`.aab` (Android) instalable directo, o un build de iOS (que requiere cuenta de Apple Developer para instalarlo en un iPhone físico sin la App Store, eso sí tiene costo anual — Android es much más simple/gratis para este caso).
- **Para una presentación de escuela, lo normal y suficiente es**: desarrollar todo con Expo Go (rápido, sin fricción), y cuando ya esté listo para mostrar, generar un **build de desarrollo/preview con EAS Build para Android** (`.apk` instalable), instalarlo en el celular que se vaya a usar para la demo. No hace falta subir nada a Google Play — un APK se puede instalar directo. Esto es gratis (dentro de los límites del tier gratuito de EAS) y no requiere cuenta de desarrollador de pago.
- iOS es más complicado/caro (requiere cuenta Apple Developer, $99 USD/año, para instalar fuera de TestFlight/App Store) — si el maestro va a ver la demo en un Android, no hace falta tocar esa parte para nada.

**Recomendación concreta cuando se empiece**: desarrollar con Expo Go todo el tiempo, y dejar el build de EAS para Android como el último paso, cerca de la fecha de entrega — no hay que preocuparse por compilar desde el día uno.

---

*Generado al cierre de una sesión larga de trabajo en sicem-web y sicem-desktop. Si algo de este documento ya no coincide con el código (por cambios posteriores), el código manda — este documento es un mapa, no la fuente de verdad.*
