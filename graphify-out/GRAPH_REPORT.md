# Graph Report - sicem  (2026-10-10)

## Corpus Check
- 230 files · ~538,402 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1748 nodes · 3102 edges · 113 communities (81 shown, 32 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 445 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `40fdd56d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sicem-desktop/src/App.jsx
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
- admin/Patients.jsx
- gateway/package.json
- dependencies
- 2. Mobile (.apk)
- /graphify Command Pipeline
- Gateway Service (port 3000)
- useAuth
- sicem-web/src/components/layout/Navbar.jsx
- routes/unit.js
- hospitales/index.js
- pacientes/index.js
- sicem-desktop/src/context/RegionContext.jsx
- unidades/index.js
- usuarios/index.js
- sicem-web/src/App.jsx
- Institutions.jsx
- routes/hospital.js
- unidades/config/db.js
- routes/emergency.js
- gateway/index.js
- closeEmergencyRaw
- Aprende SICEM: de lo más simple a lo más complejo
- getIo
- react
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
- QuickAssignCard.jsx
- metro.config.js
- Vite Logo (Boilerplate Asset)
- hola.txt (trivial placeholder file)
- (app)/index.js
- withNdkVersion.js
- activateAcceptedExternalUnit
- isWithinSchedule
- README.md
- react-is
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
- crear-cuentas-qa.mjs
- unassignAmbulance
- dependencies
- Sistema de diseño — sicem-web
- generateEmergencyReport.js
- generatePatientReport.js
- sicem-web/package.json
- scripts
- sicem-desktop/src/components/ui/SkinMenu.jsx
- eslint-plugin-react-refresh
- startDb.sh
- sicem-pacientes/package.json
- Plan — Paciente fuera de institución: afiliación + página pública
- sicem-pacientes/src/App.jsx
- NewEmergency.jsx
- Dashboard.jsx
- Errores corregidos
- sicem-web/src/components/ui/SkinMenu.jsx
- leaflet

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 35 edges
2. `useAuth()` - 33 edges
3. `toLowerCaseKeys()` - 31 edges
4. `useAuth()` - 28 edges
5. `roleLabel()` - 27 edges
6. `getNavLinks()` - 27 edges
7. `useDialogs()` - 23 edges
8. `toLowerCaseKeys()` - 21 edges
9. `Navbar()` - 21 edges
10. `API_BASE_URL` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Expo Version Warning (read versioned docs before coding)` --conceptually_related_to--> `sicem-mobile (Paramedico, React Native + Expo, planned)`  [EXTRACTED]
  clients/sicem-mobile/AGENTS.md → SICEM_HANDOFF.md
- `RequireRole()` --calls--> `useAuth()`  [EXTRACTED]
  clients/sicem-web/src/App.jsx → clients/sicem-web/src/context/AuthContext.jsx
- `QuickAssignCard()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/components/emergencies/QuickAssignCard.jsx → clients/sicem-web/src/utils/apiRequest.js
- `Login()` --calls--> `useAuth()`  [EXTRACTED]
  clients/sicem-web/src/pages/Login.jsx → clients/sicem-web/src/context/AuthContext.jsx
- `sicem-web index.html (Vite entry, mounts main.jsx)` --semantically_similar_to--> `sicem-desktop index.html (Electron/Vite entry, mounts main.jsx)`  [INFERRED] [semantically similar]
  clients/sicem-web/index.html → clients/sicem-desktop/index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Skill Reference Documentation Set** — claude_skills_graphify_skill_pipeline, claude_skills_graphify_references_extraction_spec_node_id_format, claude_skills_graphify_references_query_bfs_dfs, claude_skills_graphify_references_update_incremental [EXTRACTED 1.00]
- **SICEM Client Applications (Dispatcher/Hospital/Paramedic)** — sicem_handoff_sicem_web_client, sicem_handoff_sicem_desktop_client, sicem_handoff_sicem_mobile_client [EXTRACTED 1.00]
- **SICEM Backend Microservices (SOA)** — sicem_handoff_gateway_service, sicem_handoff_usuarios_service, sicem_handoff_hospitales_service, sicem_handoff_unidades_service, sicem_handoff_pacientes_service, sicem_handoff_emergencias_service [EXTRACTED 1.00]

## Communities (113 total, 32 thin omitted)

### Community 0 - "sicem-desktop/src/App.jsx"
Cohesion: 0.05
Nodes (98): App(), RootRedirect(), ThemeGate(), AmbulanceDetailPanel(), formatSchedule(), isOnScheduleNow(), WEEKDAY_LABELS, AmbulanceStatusCard() (+90 more)

### Community 2 - "controllers/emergency.js"
Cohesion: 0.03
Nodes (3): configSocket, emergencyModel, { sendPushNotification }

### Community 3 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, globals, @types/react, @types/react-dom, vite (+9 more)

### Community 4 - "models/patient.js"
Cohesion: 0.08
Nodes (10): db, logAllergyHistory(), logConditionHistory(), logMedicationHistory(), registerAllergy(), registerCondition(), registerMedication(), toggleAllergy() (+2 more)

### Community 5 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, jspdf, react, react-dom, react-is, react-leaflet, react-router-dom, recharts (+9 more)

### Community 7 - "controllers/hospital.js"
Cohesion: 0.06
Nodes (5): getIo(), { getIo }, hospitalModel, updateAvailableBedsI(), updateAvailableBedsIS()

### Community 8 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, expo, expo-build-properties, expo-constants, expo-device, expo-linking, expo-location, expo-notifications (+38 more)

### Community 9 - "dependencies"
Cohesion: 0.07
Nodes (28): firebase-admin, dependencies, bcrypt, cors, dotenv, express, firebase-admin, http-proxy-middleware (+20 more)

### Community 10 - "emergencias/index.js"
Cohesion: 0.14
Nodes (10): app, configSocket, cors, { createServer }, db, emergencyRoutes, express, io (+2 more)

### Community 12 - "controllers/patient.js"
Cohesion: 0.10
Nodes (10): getAllergiesByRecord(), getClinicalRecordByUser(), getConditionsByRecord(), getMedicationsByRecord(), getOwnClinicalRecordId(), patientModel, registerAllergy(), registerCondition() (+2 more)

### Community 13 - "controllers/unit.js"
Cohesion: 0.06
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
Nodes (18): bcrypt, checkShiftConflict(), claimAccountByCurp(), createUserWithCredentials(), editUserProfile(), getAllUsers(), getUserByCURP(), getUserById() (+10 more)

### Community 19 - "usuarios/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 20 - "admin/Patients.jsx"
Cohesion: 0.17
Nodes (11): emptyAllergyForm, emptyConditionForm, emptyEditAllergyForm, emptyEditConditionForm, emptyEditMedicationForm, emptyEditRecordForm, emptyMedicationForm, emptyRecordForm (+3 more)

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

### Community 26 - "useAuth"
Cohesion: 0.25
Nodes (25): roleLabel(), useAuth(), useDialogs(), Ambulances(), EmergencyCatalogs(), Institutions(), Patients(), Users() (+17 more)

### Community 27 - "sicem-web/src/components/layout/Navbar.jsx"
Cohesion: 0.14
Nodes (22): CommandPalette(), flattenLinks(), PaletteBody(), Navbar(), API_BASE_URL, SOCKET_URL, UNITS_SOCKET_URL, ROLE_IDS (+14 more)

### Community 28 - "routes/unit.js"
Cohesion: 0.40
Nodes (4): express, middleware, router, unitController

### Community 29 - "hospitales/index.js"
Cohesion: 0.17
Nodes (11): setIo(), app, cors, db, express, hospitalRoutes, http, io (+3 more)

### Community 30 - "pacientes/index.js"
Cohesion: 0.12
Nodes (13): connection, mysql, app, cors, db, express, patientRoutes, db (+5 more)

### Community 31 - "sicem-desktop/src/context/RegionContext.jsx"
Cohesion: 0.12
Nodes (22): createAmbulanceIcon(), emergencyIcon, MapArea(), RegionNotice(), NOMINATIM_SEARCH_URL, OSRM_ROUTE_URL, TILE_ATTRIBUTION, TILE_URL (+14 more)

### Community 32 - "unidades/index.js"
Cohesion: 0.12
Nodes (14): setIo(), app, cors, db, express, http, io, jwt (+6 more)

### Community 33 - "usuarios/index.js"
Cohesion: 0.12
Nodes (14): connection, mysql, app, cors, db, express, userRoutes, db (+6 more)

### Community 34 - "sicem-web/src/App.jsx"
Cohesion: 0.07
Nodes (41): ADMIN, Ambulances, App(), Charts, Dashboard, EmergencyCatalogs, EmergencyDetail, History (+33 more)

### Community 35 - "Institutions.jsx"
Cohesion: 0.08
Nodes (39): AnimatedNumber(), prefersReducedMotion(), MoreMenu(), Drawer(), linkLabels(), lockScroll(), Modal(), Overlay() (+31 more)

### Community 36 - "routes/hospital.js"
Cohesion: 0.17
Nodes (8): connection, mysql, db, jwt, express, hospitalController, middleware, router

### Community 37 - "unidades/config/db.js"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

### Community 38 - "routes/emergency.js"
Cohesion: 0.17
Nodes (8): connection, mysql, db, jwt, emergencyController, express, middleware, router

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
Cohesion: 0.23
Nodes (12): getIo(), computeScheduledEnd(), concludeTransfer(), endShift(), markAvailableAfterTransfer(), notifyForceLogout(), registerLocations(), reportAmbulanceFailure() (+4 more)

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

### Community 67 - "QuickAssignCard.jsx"
Cohesion: 0.13
Nodes (19): EmergencyCard(), ROMAN, severityColor, fmtMin(), QuickAssignCard(), ROMAN, LAYER_LABELS, MapControls() (+11 more)

### Community 72 - "(app)/index.js"
Cohesion: 0.05
Nodes (84): EMPTY_FORM, ExpedienteScreenContent(), fmtNum(), styles, AlertaScreen(), formatCountdown(), formatSchedule(), PatientsPanel() (+76 more)

### Community 74 - "activateAcceptedExternalUnit"
Cohesion: 0.47
Nodes (6): sendPushNotification(), activateAcceptedExternalUnit(), getEmergencyById(), registerAssignment(), registerEmergency(), respondInterInstitutionalRequest()

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

### Community 90 - "crear-cuentas-qa.mjs"
Cohesion: 0.20
Nodes (7): base, crum, employees, existing, hospital, qaAmb, week

### Community 92 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, jspdf, leaflet, react-dom, react-leaflet, react-router-dom, recharts, socket.io-client (+9 more)

### Community 93 - "Sistema de diseño — sicem-web"
Cohesion: 0.12
Nodes (15): Accesibilidad: lo que ya cumple, Administración: sistema compartido, Antes de dar algo por terminado, Componentes compartidos, Dashboard: centro de control, Dónde se cambia la apariencia, Estado del rediseño, Paneles, diálogos, menús y temas (obligatorio para pantallas nuevas) (+7 more)

### Community 94 - "generateEmergencyReport.js"
Cohesion: 0.42
Nodes (8): fetchJson(), fmtCoord(), fmtDateTime(), fmtDuration(), fmtSimple(), generateEmergencyReport(), toDataURL(), toLower()

### Community 95 - "generatePatientReport.js"
Cohesion: 0.42
Nodes (8): fetchJson(), fmtCoord(), fmtDateTime(), fmtDuration(), fmtSimple(), generatePatientReport(), toDataURL(), toLower()

### Community 96 - "sicem-web/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 97 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 100 - "sicem-desktop/src/components/ui/SkinMenu.jsx"
Cohesion: 0.33
Nodes (11): SkinMenu(), SkinSwatch(), SkinPicker(), apply(), listeners, read(), setSkin(), SKINS (+3 more)

### Community 103 - "sicem-pacientes/package.json"
Cohesion: 0.11
Nodes (18): dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react, react, react-dom (+10 more)

### Community 104 - "Plan — Paciente fuera de institución: afiliación + página pública"
Cohesion: 0.18
Nodes (10): Dependencias, Estado actual, Fase 1 — Base de datos ✅ (IMPLEMENTADA), Fase 2 — Página pública de captura + login ✅ (IMPLEMENTADA), Fase 3 — sicem-desktop: pantalla de pacientes + detección ✅ (IMPLEMENTADA), Fase 4 — sicem-mobile: reasignar destino ✅ (IMPLEMENTADA), Fase 5 — sicem-web: reasignación ✅ (IMPLEMENTADA), Flujo final (visión de las 5 fases) (+2 more)

### Community 105 - "sicem-pacientes/src/App.jsx"
Cohesion: 0.09
Nodes (38): api(), API_BASE_URL, App(), ICONS, NAV, readUser(), TITLES, MedicalCard() (+30 more)

### Community 107 - "NewEmergency.jsx"
Cohesion: 0.09
Nodes (22): cached(), createAmbulanceIcon(), createEmergencyPinIcon(), emergencyIcon, hospitalIcon, iconCache, levelNumber(), MapArea() (+14 more)

### Community 108 - "Dashboard.jsx"
Cohesion: 0.19
Nodes (17): LiveClock(), RegionNotice(), useRegion(), Dashboard(), formatElapsed(), formatResponseTime(), isStalled(), plural() (+9 more)

### Community 109 - "Errores corregidos"
Cohesion: 0.20
Nodes (9): App del paramédico (celular), Auditoría del frontend de SICEM, Cambios en el backend (mínimos, pedidos por el frontend), Errores corregidos, Escritorio del hospital, Pendiente / límites, Portal de pacientes, Todo el sistema (+1 more)

### Community 110 - "sicem-web/src/components/ui/SkinMenu.jsx"
Cohesion: 0.33
Nodes (11): SkinMenu(), SkinSwatch(), SkinPicker(), apply(), listeners, read(), setSkin(), SKINS (+3 more)

## Knowledge Gaps
- **569 isolated node(s):** `postCreate.sh script`, `PORTS`, `startDb.sh script`, `__dirname`, `name` (+564 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `useAuth` to `sicem-web/src/App.jsx`, `Institutions.jsx`, `QuickAssignCard.jsx`, `NewEmergency.jsx`, `Dashboard.jsx`, `admin/Patients.jsx`, `sicem-web/src/components/layout/Navbar.jsx`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `sicem-desktop/src/App.jsx` to `sicem-desktop/src/context/RegionContext.jsx`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `toLowerCaseKeys()` connect `useAuth` to `Institutions.jsx`, `QuickAssignCard.jsx`, `NewEmergency.jsx`, `Dashboard.jsx`, `admin/Patients.jsx`, `sicem-web/src/components/layout/Navbar.jsx`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `postCreate.sh script`, `PORTS`, `startDb.sh script` to the rest of the system?**
  _569 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sicem-desktop/src/App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05126646403242148 - nodes in this community are weakly interconnected._
- **Should `models/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.022988505747126436 - nodes in this community are weakly interconnected._
- **Should `controllers/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._