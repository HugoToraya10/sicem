# Graph Report - SICEM  (2026-08-04)

## Corpus Check
- 144 files · ~299,712 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1193 nodes · 1730 edges · 77 communities (49 shown, 28 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 403 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e88b87c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAuth
- models/emergency.js
- controllers/emergency.js
- dependencies
- models/patient.js
- sicem-desktop/package.json
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
- Users.jsx
- gateway/package.json
- dependencies
- Institutions.jsx
- /graphify Command Pipeline
- Gateway Service (port 3000)
- sicem-web/src/App.jsx
- EmergencyDetail.jsx
- Patients.jsx
- hospitales/index.js
- pacientes/index.js
- getNavLinks
- unidades/index.js
- usuarios/index.js
- Dashboard.jsx
- Ambulances.jsx
- hospitales/config/db.js
- routes/unit.js
- usuarios/middlewares/auth.js
- gateway/index.js
- closeEmergencyRaw
- routes/hospital.js
- getIo
- routes/patient.js
- sicem-web index.html (Vite entry, mounts main.jsx)
- main.js
- CLAUDE.md
- getIo
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
- Advanced Life Support Unit Icon
- Basic Life Support Unit Icon
- Intensive Care Ambulance Icon
- Neonatal Unit Icon
- Transport Unit Icon (Ambulance)
- Vite Logo (Boilerplate Asset)
- hola.txt (trivial placeholder file)
- useAuth
- withNdkVersion.js
- activateAcceptedExternalUnit
- startShift
- README.md

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 31 edges
2. `useAuth()` - 29 edges
3. `useAuth()` - 28 edges
4. `getNavLinks()` - 27 edges
5. `toLowerCaseKeys()` - 27 edges
6. `toLowerCaseKeys()` - 21 edges
7. `parseResponse()` - 19 edges
8. `toLowerCaseKeys()` - 15 edges
9. `Navbar()` - 15 edges
10. `API_BASE_URL` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Expo Version Warning (read versioned docs before coding)` --conceptually_related_to--> `sicem-mobile (Paramedico, React Native + Expo, planned)`  [EXTRACTED]
  clients/sicem-mobile/AGENTS.md → SICEM_HANDOFF.md
- `EmergencyDetail()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/EmergencyDetail.jsx → clients/sicem-web/src/utils/apiRequest.js
- `NewEmergency()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/NewEmergency.jsx → clients/sicem-web/src/utils/apiRequest.js
- `Requests()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/Requests.jsx → clients/sicem-web/src/utils/apiRequest.js
- `Patients()` --indirect_call--> `parseResponse()`  [INFERRED]
  clients/sicem-web/src/pages/admin/Patients.jsx → clients/sicem-web/src/utils/apiRequest.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Skill Reference Documentation Set** — claude_skills_graphify_skill_pipeline, claude_skills_graphify_references_extraction_spec_node_id_format, claude_skills_graphify_references_query_bfs_dfs, claude_skills_graphify_references_update_incremental [EXTRACTED 1.00]
- **SICEM Client Applications (Dispatcher/Hospital/Paramedic)** — sicem_handoff_sicem_web_client, sicem_handoff_sicem_desktop_client, sicem_handoff_sicem_mobile_client [EXTRACTED 1.00]
- **SICEM Backend Microservices (SOA)** — sicem_handoff_gateway_service, sicem_handoff_usuarios_service, sicem_handoff_hospitales_service, sicem_handoff_unidades_service, sicem_handoff_pacientes_service, sicem_handoff_emergencias_service [EXTRACTED 1.00]

## Communities (77 total, 28 thin omitted)

### Community 0 - "useAuth"
Cohesion: 0.06
Nodes (56): App(), RootRedirect(), AmbulanceStatusCard(), BedMatrixModal(), getFillLevel(), SpecialtyCapacityCard(), AmbulanceAdminCard(), SpecialityAdminCard() (+48 more)

### Community 2 - "controllers/emergency.js"
Cohesion: 0.03
Nodes (3): configSocket, emergencyModel, { sendPushNotification }

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (47): dependencies, leaflet, react, react-dom, react-is, react-leaflet, react-router-dom, recharts (+39 more)

### Community 4 - "models/patient.js"
Cohesion: 0.09
Nodes (10): db, logAllergyHistory(), logConditionHistory(), logMedicationHistory(), registerAllergy(), registerCondition(), registerMedication(), toggleAllergy() (+2 more)

### Community 5 - "sicem-desktop/package.json"
Cohesion: 0.04
Nodes (44): build, appId, directories, files, productName, dependencies, leaflet, react (+36 more)

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
Cohesion: 0.09
Nodes (11): bcrypt, createUserWithCredentials(), editUserProfile(), getAllUsers(), getUserById(), jwt, parseShiftWindowsRow(), register() (+3 more)

### Community 19 - "usuarios/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 20 - "Users.jsx"
Cohesion: 0.29
Nodes (7): emptyCredentialsForm, emptyForm, emptyPatientForm, emptyShiftWindows(), roleLabels, Users(), WEEKDAYS

### Community 21 - "gateway/package.json"
Cohesion: 0.11
Nodes (18): dependencies, cors, dotenv, express, http-proxy-middleware, devDependencies, nodemon, cors (+10 more)

### Community 22 - "dependencies"
Cohesion: 0.11
Nodes (17): dependencies, cors, dotenv, express, jsonwebtoken, mysql2, nodemon, socket.io (+9 more)

### Community 23 - "Institutions.jsx"
Cohesion: 0.12
Nodes (25): Ambulances(), EmergencyCatalogs(), emptyEditNameForm, emptyEditTriageForm, emptyNameForm, emptyTriageForm, roleLabels, TABS (+17 more)

### Community 24 - "/graphify Command Pipeline"
Cohesion: 0.13
Nodes (15): Graphify Integration (root CLAUDE.md), graphify add URL Ingestion + --watch Folder Monitor, Neo4j/FalkorDB/SVG/GraphML/MCP Exports, Node ID Format Rules, GitHub Clone / Cross-Repo Merge, Post-Commit Hook + CLAUDE.md Integration, BFS/DFS Query Traversal Modes, Constrained Query Vocabulary Expansion (+7 more)

### Community 25 - "Gateway Service (port 3000)"
Cohesion: 0.16
Nodes (15): Expo Version Warning (read versioned docs before coding), sicem-mobile CLAUDE.md (includes AGENTS.md), Emergencias Service (port 3005 - core + socket.io), Expo Go for Dev, EAS Build APK for Demo, Expo Router as Likely Navigation Choice (open decision), Gateway Service (port 3000), Hospitales Service (port 3002), OSRM Real Street Routing (distance/time + polylines) (+7 more)

### Community 26 - "sicem-web/src/App.jsx"
Cohesion: 0.22
Nodes (13): App(), Navbar(), AuthContext, AuthProvider(), useAuth(), formatDateTime(), formatDuration(), History() (+5 more)

### Community 27 - "EmergencyDetail.jsx"
Cohesion: 0.27
Nodes (9): buildTimeline(), EmergencyDetail(), formatDateTime(), roleLabels, STATUS_SEQUENCE, Requests(), roleLabels, statusClass (+1 more)

### Community 28 - "Patients.jsx"
Cohesion: 0.16
Nodes (13): emptyAllergyForm, emptyConditionForm, emptyEditAllergyForm, emptyEditConditionForm, emptyEditMedicationForm, emptyEditRecordForm, emptyMedicationForm, emptyRecordForm (+5 more)

### Community 29 - "hospitales/index.js"
Cohesion: 0.17
Nodes (11): setIo(), app, cors, db, express, hospitalRoutes, http, io (+3 more)

### Community 30 - "pacientes/index.js"
Cohesion: 0.22
Nodes (7): connection, mysql, app, cors, db, express, patientRoutes

### Community 31 - "getNavLinks"
Cohesion: 0.24
Nodes (8): BAR_COLORS, Charts(), monthLabel, PIE_COLORS, roleLabels, adminDropdown, baseNavLinks, getNavLinks()

### Community 32 - "unidades/index.js"
Cohesion: 0.15
Nodes (12): setIo(), app, cors, db, express, http, io, jwt (+4 more)

### Community 33 - "usuarios/index.js"
Cohesion: 0.18
Nodes (9): app, cors, db, express, userRoutes, express, middleware, router (+1 more)

### Community 34 - "Dashboard.jsx"
Cohesion: 0.13
Nodes (17): EmergencyCard(), severityColor, createAmbulanceIcon(), DEFAULT_CENTER, emergencyIcon, hospitalIcon, MapArea(), statusColors (+9 more)

### Community 35 - "Ambulances.jsx"
Cohesion: 0.22
Nodes (8): emptyEditForm, emptyEditStatusForm, emptyEditTypeForm, emptyForm, emptyStatusForm, emptyTypeForm, roleLabels, TABS

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

### Community 41 - "routes/hospital.js"
Cohesion: 0.40
Nodes (4): express, hospitalController, middleware, router

### Community 42 - "getIo"
Cohesion: 0.27
Nodes (10): getIo(), concludeTransfer(), endShift(), markAvailableAfterTransfer(), notifyForceLogout(), registerLocations(), reportAmbulanceFailure(), startShiftExpirySweep() (+2 more)

### Community 43 - "routes/patient.js"
Cohesion: 0.22
Nodes (6): db, jwt, express, middleware, patientController, router

### Community 44 - "sicem-web index.html (Vite entry, mounts main.jsx)"
Cohesion: 0.67
Nodes (3): sicem-desktop index.html (Electron/Vite entry, mounts main.jsx), sicem-web index.html (Vite entry, mounts main.jsx), sicem-web README (Vite+React boilerplate)

### Community 47 - "getIo"
Cohesion: 0.67
Nodes (3): getIo(), updateAvailableBedsI(), updateAvailableBedsIS()

### Community 48 - "firebase.js"
Cohesion: 0.33
Nodes (5): fs, { getMessaging }, { initializeApp, cert }, path, SERVICE_ACCOUNT_PATH

### Community 72 - "useAuth"
Cohesion: 0.07
Nodes (47): ExpedienteScreenContent(), styles, AlertaScreen(), formatCountdown(), formatSchedule(), styles, WEEKDAY_LABELS, LocationReporter() (+39 more)

### Community 74 - "activateAcceptedExternalUnit"
Cohesion: 0.47
Nodes (6): sendPushNotification(), activateAcceptedExternalUnit(), getEmergencyById(), registerAssignment(), registerEmergency(), respondInterInstitutionalRequest()

### Community 75 - "startShift"
Cohesion: 0.50
Nodes (4): computeScheduledEnd(), isWithinSchedule(), parseTimeToMinutes(), startShift()

## Knowledge Gaps
- **393 isolated node(s):** `__dirname`, `name`, `private`, `version`, `type` (+388 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `useAuth` to `expo`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `expo` connect `expo` to `useAuth`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `__dirname`, `name`, `private` to the rest of the system?**
  _393 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.06415396952686447 - nodes in this community are weakly interconnected._
- **Should `models/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.024691358024691357 - nodes in this community are weakly interconnected._
- **Should `controllers/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03389830508474576 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._