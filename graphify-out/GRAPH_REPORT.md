# Graph Report - SICEM  (2026-08-13)

## Corpus Check
- 155 files · ~494,952 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1338 nodes · 1941 edges · 103 communities (71 shown, 32 thin omitted)
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 416 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dfb9f783`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAuth
- models/emergency.js
- controllers/emergency.js
- devDependencies
- models/patient.js
- dependencies
- models/hospital.js
- controllers/hospital.js
- dependencies
- dependencies
- emergencias/index.js
- models/unit.js
- controllers/patient.js
- controllers/unit.js
- dependencies
- expo
- pacientes/package.json
- controllers/user.js
- models/user.js
- usuarios/package.json
- Institutions.jsx
- gateway/package.json
- dependencies
- 2. Mobile (.apk)
- /graphify Command Pipeline
- Gateway Service (port 3000)
- toLowerCaseKeys
- EmergencyDetail.jsx
- Patients.jsx
- hospitales/index.js
- pacientes/index.js
- sicem-web/src/App.jsx
- unidades/index.js
- usuarios/index.js
- Dashboard.jsx
- Ambulances.jsx
- hospitales/config/db.js
- routes/unit.js
- usuarios/middlewares/auth.js
- gateway/index.js
- closeEmergencyRaw
- Aprende SICEM: de lo más simple a lo más complejo
- getIo
- routes/patient.js
- sicem-web index.html (Vite entry, mounts main.jsx)
- main.js
- CLAUDE.md
- vercel.json
- firebase.js
- escalateEmergencyTriageLevel
- How Hugo Likes to Work (real DB verification, confirm big decisions only)
- Android Adaptive Icon Background
- Android Icon Foreground (Blue Chevron)
- Android Monochrome Icon
- SICEM Mobile Favicon Icon
- App Icon (Blue Chevron/A Logo)
- Splash Icon (Concentric Circles Logo)
- SICEM Web Favicon
- Icon Sprite Sheet (Bluesky, Discord, Documentation, GitHub, Social, X)
- Hero Banner Image
- React Logo (Vite Boilerplate)
- sicem-desktop/package.json
- build
- devDependencies
- routes/hospital.js
- metro.config.js
- Vite Logo (Boilerplate Asset)
- hola.txt (trivial placeholder file)
- useAuth
- withNdkVersion.js
- activateAcceptedExternalUnit
- startShift
- README.md
- getIo
- postCreate.sh
- Nivel 1 — JavaScript moderno
- Nivel 7 — Tiempo real: Socket.IO
- Nivel 6 — Enrutamiento en React (React Router)
- Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces
- Nivel 5 — React: Hooks y Context API
- Nivel 3 — Autenticación: JWT, middleware, roles
- Nivel 8 — Las 3 plataformas y sus diferencias reales
- Nivel 2 — Backend: Express, rutas, controladores, modelos
- Nivel 9 — Herramientas de build (Vite, Metro)
- Nivel 4 — Frontend: React desde cero
- Nivel 10 — Empaquetado nativo (lo más avanzado del proyecto)
- Users.jsx
- unassignAmbulance
- dependencies
- generatePatientReport.js
- generateEmergencyReport.js
- AmbulanceStatusCard.jsx
- sicem-web/package.json
- scripts
- leaflet
- react
- react-is
- eslint-plugin-react-refresh
- startDb.sh

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 31 edges
2. `useAuth()` - 29 edges
3. `useAuth()` - 28 edges
4. `getNavLinks()` - 27 edges
5. `toLowerCaseKeys()` - 27 edges
6. `toLowerCaseKeys()` - 21 edges
7. `parseResponse()` - 19 edges
8. `Navbar()` - 17 edges
9. `Aprende SICEM: de lo más simple a lo más complejo` - 16 edges
10. `toLowerCaseKeys()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Expo Version Warning (read versioned docs before coding)` --conceptually_related_to--> `sicem-mobile (Paramedico, React Native + Expo, planned)`  [EXTRACTED]
  clients/sicem-mobile/AGENTS.md → SICEM_HANDOFF.md
- `EmergencyDetail()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/EmergencyDetail.jsx → clients/sicem-web/src/utils/apiRequest.js
- `NewEmergency()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/NewEmergency.jsx → clients/sicem-web/src/utils/apiRequest.js
- `Requests()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/Requests.jsx → clients/sicem-web/src/utils/apiRequest.js
- `Ambulances()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/admin/Ambulances.jsx → clients/sicem-web/src/utils/apiRequest.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Skill Reference Documentation Set** — claude_skills_graphify_skill_pipeline, claude_skills_graphify_references_extraction_spec_node_id_format, claude_skills_graphify_references_query_bfs_dfs, claude_skills_graphify_references_update_incremental [EXTRACTED 1.00]
- **SICEM Client Applications (Dispatcher/Hospital/Paramedic)** — sicem_handoff_sicem_web_client, sicem_handoff_sicem_desktop_client, sicem_handoff_sicem_mobile_client [EXTRACTED 1.00]
- **SICEM Backend Microservices (SOA)** — sicem_handoff_gateway_service, sicem_handoff_usuarios_service, sicem_handoff_hospitales_service, sicem_handoff_unidades_service, sicem_handoff_pacientes_service, sicem_handoff_emergencias_service [EXTRACTED 1.00]

## Communities (103 total, 32 thin omitted)

### Community 0 - "useAuth"
Cohesion: 0.07
Nodes (59): App(), RootRedirect(), BedMatrixModal(), getFillLevel(), SpecialtyCapacityCard(), AmbulanceAdminCard(), formatSchedule(), isOnScheduleNow() (+51 more)

### Community 2 - "controllers/emergency.js"
Cohesion: 0.03
Nodes (3): configSocket, emergencyModel, { sendPushNotification }

### Community 3 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, globals, @types/react, @types/react-dom, vite (+9 more)

### Community 4 - "models/patient.js"
Cohesion: 0.09
Nodes (10): db, logAllergyHistory(), logConditionHistory(), logMedicationHistory(), registerAllergy(), registerCondition(), registerMedication(), toggleAllergy() (+2 more)

### Community 5 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, jspdf, react, react-dom, react-is, react-leaflet, react-router-dom, recharts (+9 more)

### Community 8 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, expo, expo-build-properties, expo-constants, expo-device, expo-linking, expo-location, expo-notifications (+38 more)

### Community 9 - "dependencies"
Cohesion: 0.07
Nodes (28): firebase-admin, dependencies, bcrypt, cors, dotenv, express, firebase-admin, http-proxy-middleware (+20 more)

### Community 10 - "emergencias/index.js"
Cohesion: 0.08
Nodes (18): connection, mysql, app, configSocket, cors, { createServer }, db, emergencyRoutes (+10 more)

### Community 12 - "controllers/patient.js"
Cohesion: 0.09
Nodes (5): getAllergiesByRecord(), getClinicalRecordByUser(), getConditionsByRecord(), getMedicationsByRecord(), patientModel

### Community 13 - "controllers/unit.js"
Cohesion: 0.07
Nodes (4): AMBULANCE_TO_EMERGENCY_STATUS, { getIo }, PARAMEDIC_FORWARD_TRANSITIONS, unitModel

### Community 14 - "dependencies"
Cohesion: 0.08
Nodes (23): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, nodemon (+15 more)

### Community 15 - "expo"
Cohesion: 0.09
Nodes (20): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, googleServicesFile, package, expo (+12 more)

### Community 16 - "pacientes/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 17 - "controllers/user.js"
Cohesion: 0.08
Nodes (16): bcrypt, checkShiftConflict(), createUserWithCredentials(), editUserProfile(), getAllUsers(), getUserById(), intervalOverlap(), jwt (+8 more)

### Community 19 - "usuarios/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 20 - "Institutions.jsx"
Cohesion: 0.20
Nodes (9): emptyEditInstitutionForm, emptyEditSpecialityForm, emptyEditTypeForm, emptyForm, emptyNewSpecialityForm, emptyNewTypeForm, emptySpecialityForm, roleLabels (+1 more)

### Community 21 - "gateway/package.json"
Cohesion: 0.11
Nodes (18): dependencies, cors, dotenv, express, http-proxy-middleware, devDependencies, nodemon, cors (+10 more)

### Community 22 - "dependencies"
Cohesion: 0.11
Nodes (17): dependencies, cors, dotenv, express, jsonwebtoken, mysql2, nodemon, socket.io (+9 more)

### Community 23 - "2. Mobile (.apk)"
Cohesion: 0.12
Nodes (15): 1. Desktop (.exe), 2. Mobile (.apk), 3. Recordatorio: cómo volver a modo 100% local (sin Codespace), Antes de compilar CUALQUIER cosa, Bugs reales que ya se corrigieron en el código (no deberías volver a verlos, pero por si acaso), Bugs reales que ya se corrigieron (y por qué pueden volver a aparecer), Comandos, Comandos (cada vez que quieras generar un APK) (+7 more)

### Community 24 - "/graphify Command Pipeline"
Cohesion: 0.13
Nodes (15): Graphify Integration (root CLAUDE.md), graphify add URL Ingestion + --watch Folder Monitor, Neo4j/FalkorDB/SVG/GraphML/MCP Exports, Node ID Format Rules, GitHub Clone / Cross-Repo Merge, Post-Commit Hook + CLAUDE.md Integration, BFS/DFS Query Traversal Modes, Constrained Query Vocabulary Expansion (+7 more)

### Community 25 - "Gateway Service (port 3000)"
Cohesion: 0.16
Nodes (15): Expo Version Warning (read versioned docs before coding), sicem-mobile CLAUDE.md (includes AGENTS.md), Emergencias Service (port 3005 - core + socket.io), Expo Go for Dev, EAS Build APK for Demo, Expo Router as Likely Navigation Choice (open decision), Gateway Service (port 3000), Hospitales Service (port 3002), OSRM Real Street Routing (distance/time + polylines) (+7 more)

### Community 26 - "toLowerCaseKeys"
Cohesion: 0.16
Nodes (17): BAR_COLORS, Charts(), monthLabel, PIE_COLORS, roleLabels, formatDateTime(), formatDuration(), History() (+9 more)

### Community 27 - "EmergencyDetail.jsx"
Cohesion: 0.25
Nodes (13): Navbar(), buildTimeline(), EmergencyDetail(), formatDateTime(), roleLabels, STATUS_SEQUENCE, fetchRouteDistance(), NewEmergency() (+5 more)

### Community 28 - "Patients.jsx"
Cohesion: 0.16
Nodes (13): emptyAllergyForm, emptyConditionForm, emptyEditAllergyForm, emptyEditConditionForm, emptyEditMedicationForm, emptyEditRecordForm, emptyMedicationForm, emptyRecordForm (+5 more)

### Community 29 - "hospitales/index.js"
Cohesion: 0.17
Nodes (11): setIo(), app, cors, db, express, hospitalRoutes, http, io (+3 more)

### Community 30 - "pacientes/index.js"
Cohesion: 0.22
Nodes (7): connection, mysql, app, cors, db, express, patientRoutes

### Community 31 - "sicem-web/src/App.jsx"
Cohesion: 0.19
Nodes (12): App(), AuthContext, AuthProvider(), useAuth(), EmergencyCatalogs(), emptyEditNameForm, emptyEditTriageForm, emptyNameForm (+4 more)

### Community 32 - "unidades/index.js"
Cohesion: 0.12
Nodes (14): setIo(), app, cors, db, express, http, io, jwt (+6 more)

### Community 33 - "usuarios/index.js"
Cohesion: 0.18
Nodes (9): app, cors, db, express, userRoutes, express, middleware, router (+1 more)

### Community 34 - "Dashboard.jsx"
Cohesion: 0.15
Nodes (14): EmergencyCard(), severityColor, createAmbulanceIcon(), DEFAULT_CENTER, emergencyIcon, hospitalIcon, MapArea(), statusColors (+6 more)

### Community 35 - "Ambulances.jsx"
Cohesion: 0.18
Nodes (12): Ambulances(), emptyEditForm, emptyEditStatusForm, emptyEditTypeForm, emptyForm, emptyStatusForm, emptyTypeForm, roleLabels (+4 more)

### Community 36 - "hospitales/config/db.js"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

### Community 37 - "routes/unit.js"
Cohesion: 0.17
Nodes (8): connection, mysql, db, jwt, express, middleware, router, unitController

### Community 38 - "usuarios/middlewares/auth.js"
Cohesion: 0.29
Nodes (5): connection, mysql, db, jwt, verifyToken()

### Community 39 - "gateway/index.js"
Cohesion: 0.40
Nodes (4): app, cors, {createProxyMiddleware}, express

### Community 40 - "closeEmergencyRaw"
Cohesion: 0.40
Nodes (5): cancelInterInstitutionalRequest(), cancelPendingRequestsForEmergency(), closeEmergency(), closeEmergencyRaw(), forceCloseEmergency()

### Community 41 - "Aprende SICEM: de lo más simple a lo más complejo"
Cohesion: 0.25
Nodes (7): Aprende SICEM: de lo más simple a lo más complejo, Cómo seguir después de esto, Nivel 0 — Cómo está organizado el proyecto, Nivel 12 — La arquitectura completa (para verlo todo junto), Prompt final para pedirle a una IA (repaso general), Prompt para pedirle a una IA, Índice

### Community 42 - "getIo"
Cohesion: 0.27
Nodes (10): getIo(), concludeTransfer(), endShift(), markAvailableAfterTransfer(), notifyForceLogout(), registerLocations(), reportAmbulanceFailure(), startShiftExpirySweep() (+2 more)

### Community 43 - "routes/patient.js"
Cohesion: 0.22
Nodes (6): db, jwt, express, middleware, patientController, router

### Community 44 - "sicem-web index.html (Vite entry, mounts main.jsx)"
Cohesion: 0.67
Nodes (3): sicem-desktop index.html (Electron/Vite entry, mounts main.jsx), sicem-web index.html (Vite entry, mounts main.jsx), sicem-web README (Vite+React boilerplate)

### Community 48 - "firebase.js"
Cohesion: 0.25
Nodes (6): fs, { getMessaging }, { initializeApp, cert }, path, SERVICE_ACCOUNT_PATH, serviceAccount

### Community 64 - "sicem-desktop/package.json"
Cohesion: 0.18
Nodes (10): author, description, main, name, private, scripts, build, dev (+2 more)

### Community 65 - "build"
Cohesion: 0.18
Nodes (11): build, appId, directories, files, icon, productName, win, output (+3 more)

### Community 66 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, electron, electron-builder, vite, vite-plugin-electron, @vitejs/plugin-react, vite, @vitejs/plugin-react (+3 more)

### Community 67 - "routes/hospital.js"
Cohesion: 0.40
Nodes (4): express, hospitalController, middleware, router

### Community 72 - "useAuth"
Cohesion: 0.07
Nodes (44): ExpedienteScreenContent(), styles, AlertaScreen(), formatCountdown(), formatSchedule(), styles, WEEKDAY_LABELS, LocationReporter() (+36 more)

### Community 74 - "activateAcceptedExternalUnit"
Cohesion: 0.47
Nodes (6): sendPushNotification(), activateAcceptedExternalUnit(), getEmergencyById(), registerAssignment(), registerEmergency(), respondInterInstitutionalRequest()

### Community 75 - "startShift"
Cohesion: 0.50
Nodes (4): computeScheduledEnd(), isWithinSchedule(), parseTimeToMinutes(), startShift()

### Community 77 - "getIo"
Cohesion: 0.67
Nodes (3): getIo(), updateAvailableBedsI(), updateAvailableBedsIS()

### Community 79 - "Nivel 1 — JavaScript moderno"
Cohesion: 0.29
Nodes (7): 1.1 — `async`/`await` y Promesas, 1.2 — Desestructuración (`{ }` para sacar variables de un objeto), 1.3 — Funciones flecha (`=>`), 1.4 — Módulos (`import`/`export`), 1.5 — Template literals (comillas invertidas), Nivel 1 — JavaScript moderno, Prompts para pedirle a una IA

### Community 80 - "Nivel 7 — Tiempo real: Socket.IO"
Cohesion: 0.33
Nodes (6): Cómo el cliente escucha esos eventos, Cómo se conecta un cliente, Nivel 7 — Tiempo real: Socket.IO, Por qué HTTP normal no alcanza, Prompts para pedirle a una IA, Rooms: cómo el servidor decide a quién avisar

### Community 81 - "Nivel 6 — Enrutamiento en React (React Router)"
Cohesion: 0.40
Nodes (5): `BrowserRouter` vs `HashRouter` — el bug real que arreglamos hoy, Nivel 6 — Enrutamiento en React (React Router), Prompts para pedirle a una IA, Qué problema resuelve, Rutas protegidas (el patrón `PrivateRoute`)

### Community 82 - "Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces"
Cohesion: 0.40
Nodes (5): Codespaces / contenedores / `devcontainer.json`, CORS: qué es y por qué existe, Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces, Prompts para pedirle a una IA, Variables de entorno (`.env`)

### Community 83 - "Nivel 5 — React: Hooks y Context API"
Cohesion: 0.40
Nodes (5): Context API: compartir datos SIN pasar props por 10 niveles, Nivel 5 — React: Hooks y Context API, Prompts para pedirle a una IA, `useEffect`: código que se ejecuta en momentos específicos, `useState`: cómo un componente "recuerda" cosas

### Community 84 - "Nivel 3 — Autenticación: JWT, middleware, roles"
Cohesion: 0.40
Nodes (5): Cómo se validan los ROLES en este proyecto (y por qué es importante que lo entiendas bien), Nivel 3 — Autenticación: JWT, middleware, roles, Prompts para pedirle a una IA, Qué es un JWT (JSON Web Token), Qué es un "middleware" y cómo protege rutas

### Community 85 - "Nivel 8 — Las 3 plataformas y sus diferencias reales"
Cohesion: 0.40
Nodes (5): Desktop (`sicem-desktop`) — React DENTRO de una ventana de escritorio, Mobile (`sicem-mobile`) — React, pero SIN navegador y SIN DOM, Nivel 8 — Las 3 plataformas y sus diferencias reales, Prompts para pedirle a una IA, Web (`sicem-web`) — la más "normal"

### Community 86 - "Nivel 2 — Backend: Express, rutas, controladores, modelos"
Cohesion: 0.40
Nodes (5): El flujo completo de una petición, El gateway: por qué existe y qué tan simple es, El patrón "callback" que usa este proyecto (en vez de async/await en los modelos), Nivel 2 — Backend: Express, rutas, controladores, modelos, Prompts para pedirle a una IA

### Community 87 - "Nivel 9 — Herramientas de build (Vite, Metro)"
Cohesion: 0.40
Nodes (5): Metro (usado en sicem-mobile — el bundler de React Native), Nivel 9 — Herramientas de build (Vite, Metro), Prompts para pedirle a una IA, Qué hace un "bundler" en general, Vite (usado en sicem-web y sicem-desktop)

### Community 88 - "Nivel 4 — Frontend: React desde cero"
Cohesion: 0.40
Nodes (5): Nivel 4 — Frontend: React desde cero, Prompts para pedirle a una IA, Props: cómo un componente le pasa datos a otro, Qué es JSX exactamente, Qué es un componente

### Community 89 - "Nivel 10 — Empaquetado nativo (lo más avanzado del proyecto)"
Cohesion: 0.50
Nodes (4): Desktop: `electron-builder` y el archivo `.asar`, Mobile: por qué compilar para Android es TAN distinto a "solo JavaScript", Nivel 10 — Empaquetado nativo (lo más avanzado del proyecto), Prompts para pedirle a una IA

### Community 90 - "Users.jsx"
Cohesion: 0.20
Nodes (11): emptyCredentialsForm, emptyForm, emptyPatientForm, emptyShiftWindows(), roleLabels, Users(), WEEKDAYS, emptyForm (+3 more)

### Community 92 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, jspdf, leaflet, react-dom, react-leaflet, react-router-dom, recharts, socket.io-client (+9 more)

### Community 93 - "generatePatientReport.js"
Cohesion: 0.42
Nodes (8): fetchJson(), fmtCoord(), fmtDateTime(), fmtDuration(), fmtSimple(), generatePatientReport(), toDataURL(), toLower()

### Community 94 - "generateEmergencyReport.js"
Cohesion: 0.42
Nodes (8): fetchJson(), fmtCoord(), fmtDateTime(), fmtDuration(), fmtSimple(), generateEmergencyReport(), toDataURL(), toLower()

### Community 95 - "AmbulanceStatusCard.jsx"
Cohesion: 0.47
Nodes (5): AmbulanceStatusCard(), formatSchedule(), isOnScheduleNow(), STATUS_COLOR_CLASS, WEEKDAY_LABELS

### Community 96 - "sicem-web/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 97 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

## Knowledge Gaps
- **470 isolated node(s):** `postCreate.sh script`, `PORTS`, `startDb.sh script`, `__dirname`, `name` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `useAuth` to `expo`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `Aprende SICEM: de lo más simple a lo más complejo` connect `Aprende SICEM: de lo más simple a lo más complejo` to `Nivel 1 — JavaScript moderno`, `Nivel 7 — Tiempo real: Socket.IO`, `Nivel 6 — Enrutamiento en React (React Router)`, `Nivel 11 — Infraestructura: variables de entorno, CORS, Codespaces`, `Nivel 5 — React: Hooks y Context API`, `Nivel 3 — Autenticación: JWT, middleware, roles`, `Nivel 8 — Las 3 plataformas y sus diferencias reales`, `Nivel 2 — Backend: Express, rutas, controladores, modelos`, `Nivel 9 — Herramientas de build (Vite, Metro)`, `Nivel 4 — Frontend: React desde cero`, `Nivel 10 — Empaquetado nativo (lo más avanzado del proyecto)`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `postCreate.sh script`, `PORTS`, `startDb.sh script` to the rest of the system?**
  _470 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.06716604244694133 - nodes in this community are weakly interconnected._
- **Should `models/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._
- **Should `controllers/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._