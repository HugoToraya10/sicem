# Graph Report - SICEM  (2026-08-02)

## Corpus Check
- 130 files · ~259,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1042 nodes · 1418 edges · 77 communities (47 shown, 30 thin omitted)
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 349 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a28a415c`
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
- getNavLinks
- gateway/package.json
- dependencies
- Institutions.jsx
- /graphify Command Pipeline
- Gateway Service (port 3000)
- sicem-web/src/App.jsx
- EmergencyDetail.jsx
- Patients.jsx
- hospitales/index.js
- NewEmergency.jsx
- toLowerCaseKeys
- unidades/index.js
- usuarios/index.js
- Dashboard.jsx
- Ambulances.jsx
- hospitales/config/db.js
- unidades/config/db.js
- usuarios/middlewares/auth.js
- gateway/index.js
- closeEmergencyRaw
- routes/hospital.js
- routes/unit.js
- unidades/config/socket.js
- sicem-web index.html (Vite entry, mounts main.jsx)
- main.js
- CLAUDE.md
- getIo
- getEmergencyById
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
- README.md

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 31 edges
2. `useAuth()` - 29 edges
3. `getNavLinks()` - 27 edges
4. `toLowerCaseKeys()` - 27 edges
5. `toLowerCaseKeys()` - 21 edges
6. `parseResponse()` - 19 edges
7. `Navbar()` - 15 edges
8. `expo` - 12 edges
9. `blockIfDuplicate()` - 12 edges
10. `connectEmergencySocket()` - 11 edges

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

## Communities (77 total, 30 thin omitted)

### Community 0 - "useAuth"
Cohesion: 0.07
Nodes (53): App(), RootRedirect(), AmbulanceStatusCard(), BedMatrixModal(), getFillLevel(), SpecialtyCapacityCard(), AmbulanceAdminCard(), SpecialityAdminCard() (+45 more)

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
Cohesion: 0.06
Nodes (30): dependencies, expo, expo-constants, expo-linking, expo-router, expo-secure-store, expo-status-bar, react (+22 more)

### Community 9 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, bcrypt, cors, dotenv, express, http-proxy-middleware, jsonwebtoken, mysql2 (+18 more)

### Community 10 - "emergencias/index.js"
Cohesion: 0.08
Nodes (18): connection, mysql, app, configSocket, cors, { createServer }, db, emergencyRoutes (+10 more)

### Community 12 - "controllers/patient.js"
Cohesion: 0.05
Nodes (18): connection, mysql, getAllergiesByRecord(), getClinicalRecordByUser(), getConditionsByRecord(), getMedicationsByRecord(), patientModel, app (+10 more)

### Community 14 - "dependencies"
Cohesion: 0.08
Nodes (23): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, nodemon (+15 more)

### Community 15 - "expo"
Cohesion: 0.07
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, expo, android, icon (+17 more)

### Community 16 - "pacientes/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 17 - "controllers/user.js"
Cohesion: 0.09
Nodes (7): bcrypt, createUserWithCredentials(), jwt, register(), registerPatient(), userModel, { verifyToken }

### Community 19 - "usuarios/package.json"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 20 - "getNavLinks"
Cohesion: 0.16
Nodes (19): Ambulances(), EmergencyCatalogs(), emptyEditNameForm, emptyEditTriageForm, emptyNameForm, emptyTriageForm, roleLabels, TABS (+11 more)

### Community 21 - "gateway/package.json"
Cohesion: 0.11
Nodes (18): dependencies, cors, dotenv, express, http-proxy-middleware, devDependencies, nodemon, cors (+10 more)

### Community 22 - "dependencies"
Cohesion: 0.11
Nodes (17): dependencies, cors, dotenv, express, jsonwebtoken, mysql2, nodemon, socket.io (+9 more)

### Community 23 - "Institutions.jsx"
Cohesion: 0.13
Nodes (13): emptyEditInstitutionForm, emptyEditSpecialityForm, emptyEditTypeForm, emptyForm, emptyNewSpecialityForm, emptyNewTypeForm, emptySpecialityForm, roleLabels (+5 more)

### Community 24 - "/graphify Command Pipeline"
Cohesion: 0.13
Nodes (15): Graphify Integration (root CLAUDE.md), graphify add URL Ingestion + --watch Folder Monitor, Neo4j/FalkorDB/SVG/GraphML/MCP Exports, Node ID Format Rules, GitHub Clone / Cross-Repo Merge, Post-Commit Hook + CLAUDE.md Integration, BFS/DFS Query Traversal Modes, Constrained Query Vocabulary Expansion (+7 more)

### Community 25 - "Gateway Service (port 3000)"
Cohesion: 0.16
Nodes (15): Expo Version Warning (read versioned docs before coding), sicem-mobile CLAUDE.md (includes AGENTS.md), Emergencias Service (port 3005 - core + socket.io), Expo Go for Dev, EAS Build APK for Demo, Expo Router as Likely Navigation Choice (open decision), Gateway Service (port 3000), Hospitales Service (port 3002), OSRM Real Street Routing (distance/time + polylines) (+7 more)

### Community 26 - "sicem-web/src/App.jsx"
Cohesion: 0.25
Nodes (10): App(), AuthContext, AuthProvider(), useAuth(), formatDateTime(), formatDuration(), History(), RESOLUTION_FILTERS (+2 more)

### Community 27 - "EmergencyDetail.jsx"
Cohesion: 0.25
Nodes (10): Navbar(), buildTimeline(), EmergencyDetail(), formatDateTime(), roleLabels, STATUS_SEQUENCE, Requests(), roleLabels (+2 more)

### Community 28 - "Patients.jsx"
Cohesion: 0.16
Nodes (13): emptyAllergyForm, emptyConditionForm, emptyEditAllergyForm, emptyEditConditionForm, emptyEditMedicationForm, emptyEditRecordForm, emptyMedicationForm, emptyRecordForm (+5 more)

### Community 29 - "hospitales/index.js"
Cohesion: 0.17
Nodes (11): setIo(), app, cors, db, express, hospitalRoutes, http, io (+3 more)

### Community 30 - "NewEmergency.jsx"
Cohesion: 0.24
Nodes (7): createAmbulanceIcon(), DEFAULT_CENTER, emergencyIcon, MapArea(), statusColors, fetchRouteDistance(), NewEmergency()

### Community 31 - "toLowerCaseKeys"
Cohesion: 0.25
Nodes (8): BAR_COLORS, Charts(), monthLabel, PIE_COLORS, roleLabels, Hospitals(), roleLabels, toLowerCaseKeys()

### Community 32 - "unidades/index.js"
Cohesion: 0.18
Nodes (10): app, cors, db, express, http, io, jwt, { Server } (+2 more)

### Community 33 - "usuarios/index.js"
Cohesion: 0.18
Nodes (9): app, cors, db, express, userRoutes, express, middleware, router (+1 more)

### Community 34 - "Dashboard.jsx"
Cohesion: 0.31
Nodes (8): EmergencyCard(), severityColor, Dashboard(), formatElapsed(), isStalled(), priorityScore(), roleLabels, sortByPriority()

### Community 35 - "Ambulances.jsx"
Cohesion: 0.22
Nodes (8): emptyEditForm, emptyEditStatusForm, emptyEditTypeForm, emptyForm, emptyStatusForm, emptyTypeForm, roleLabels, TABS

### Community 36 - "hospitales/config/db.js"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

### Community 37 - "unidades/config/db.js"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

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

### Community 42 - "routes/unit.js"
Cohesion: 0.40
Nodes (4): express, middleware, router, unitController

### Community 43 - "unidades/config/socket.js"
Cohesion: 0.50
Nodes (3): getIo(), setIo(), registerLocations()

### Community 44 - "sicem-web index.html (Vite entry, mounts main.jsx)"
Cohesion: 0.67
Nodes (3): sicem-desktop index.html (Electron/Vite entry, mounts main.jsx), sicem-web index.html (Vite entry, mounts main.jsx), sicem-web README (Vite+React boilerplate)

### Community 47 - "getIo"
Cohesion: 0.67
Nodes (3): getIo(), updateAvailableBedsI(), updateAvailableBedsIS()

## Knowledge Gaps
- **354 isolated node(s):** `__dirname`, `name`, `private`, `version`, `type` (+349 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `__dirname`, `name`, `private` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.06670584778136938 - nodes in this community are weakly interconnected._
- **Should `models/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.029411764705882353 - nodes in this community are weakly interconnected._
- **Should `controllers/emergency.js` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `models/patient.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._
- **Should `sicem-desktop/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._