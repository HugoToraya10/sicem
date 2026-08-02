# Graph Report - .  (2026-08-01)

## Corpus Check
- 143 files · ~257,216 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1020 nodes · 1394 edges · 72 communities (43 shown, 29 thin omitted)
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 349 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- sicem-desktop UI Components
- Emergencias Model Layer
- Emergencias Controller Layer
- sicem-web Dependencies
- Pacientes Service (routes/models)
- sicem-desktop Dependencies
- Hospitales Model Layer
- Hospitales Controller Layer
- sicem-mobile Dependencies
- Emergencias Dependencies
- Emergencias Service Bootstrap
- Unidades Model Layer
- Pacientes Controller Layer
- Unidades Controller Layer
- Unidades Dependencies
- sicem-mobile App Config
- Pacientes Dependencies
- Usuarios Controller Layer
- Usuarios Model Layer
- Usuarios Dependencies
- sicem-web Admin Pages
- Gateway Dependencies
- Hospitales Dependencies
- sicem-web Profile/Institutions Pages
- Graphify Skill Reference Docs
- sicem-mobile Planning & Handoff Docs
- sicem-web Auth & App Shell
- sicem-web Requests/EmergencyDetail
- sicem-web Patients Admin Page
- Hospitales Service Bootstrap
- sicem-web Map & NewEmergency
- sicem-web Hospitals/Charts Pages
- Unidades Service Bootstrap
- Usuarios Service Bootstrap
- sicem-web Dashboard
- sicem-web Ambulances Admin Page
- Hospitales Auth/DB Config
- Unidades Auth/DB Config
- Usuarios Auth/DB Config
- Gateway Bootstrap
- Emergencias Closing/Cancelling Logic
- Hospitales Routes
- Unidades Routes
- Unidades Socket/Location Registration
- Client HTML Entry Points
- sicem-desktop Electron Main Process
- sicem-mobile Entry Screens
- Hospitales Bed Availability
- Emergencias Registration Endpoints
- Emergencias Triage/Notes
- SICEM Handoff Doc Core
- Android Adaptive Icon Background
- Android Icon Foreground
- Android Monochrome Icon
- sicem-mobile Favicon
- sicem-mobile App Icon
- sicem-mobile Splash Icon
- sicem-web Favicon
- sicem-web Social Icon Sprite
- sicem-web Hero Banner Image
- React Boilerplate Logo
- Advanced Life Support Unit Icon
- Basic Life Support Unit Icon
- Intensive Care Unit Icon
- Neonatal Unit Icon
- Transport Unit Icon
- Vite Boilerplate Logo
- Placeholder Text File

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

## Communities (72 total, 29 thin omitted)

### Community 0 - "sicem-desktop UI Components"
Cohesion: 0.07
Nodes (52): App(), RootRedirect(), AmbulanceStatusCard(), getFillLevel(), SpecialtyCapacityCard(), AmbulanceAdminCard(), SpecialityAdminCard(), InstitutionAdminRoute() (+44 more)

### Community 3 - "sicem-web Dependencies"
Cohesion: 0.04
Nodes (47): dependencies, leaflet, react, react-dom, react-is, react-leaflet, react-router-dom, recharts (+39 more)

### Community 4 - "Pacientes Service (routes/models)"
Cohesion: 0.05
Nodes (23): connection, mysql, app, cors, db, express, patientRoutes, db (+15 more)

### Community 5 - "sicem-desktop Dependencies"
Cohesion: 0.04
Nodes (44): build, appId, directories, files, productName, dependencies, leaflet, react (+36 more)

### Community 8 - "sicem-mobile Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, expo, expo-constants, expo-linking, expo-router, expo-status-bar, react, react-native (+20 more)

### Community 9 - "Emergencias Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, bcrypt, cors, dotenv, express, http-proxy-middleware, jsonwebtoken, mysql2 (+18 more)

### Community 10 - "Emergencias Service Bootstrap"
Cohesion: 0.08
Nodes (18): connection, mysql, app, configSocket, cors, { createServer }, db, emergencyRoutes (+10 more)

### Community 12 - "Pacientes Controller Layer"
Cohesion: 0.09
Nodes (5): getAllergiesByRecord(), getClinicalRecordByUser(), getConditionsByRecord(), getMedicationsByRecord(), patientModel

### Community 14 - "Unidades Dependencies"
Cohesion: 0.08
Nodes (23): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, nodemon (+15 more)

### Community 15 - "sicem-mobile App Config"
Cohesion: 0.09
Nodes (20): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, expo, android, icon (+12 more)

### Community 16 - "Pacientes Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 17 - "Usuarios Controller Layer"
Cohesion: 0.09
Nodes (7): bcrypt, createUserWithCredentials(), jwt, register(), registerPatient(), userModel, { verifyToken }

### Community 19 - "Usuarios Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, mysql2, devDependencies (+14 more)

### Community 20 - "sicem-web Admin Pages"
Cohesion: 0.16
Nodes (19): Ambulances(), EmergencyCatalogs(), emptyEditNameForm, emptyEditTriageForm, emptyNameForm, emptyTriageForm, roleLabels, TABS (+11 more)

### Community 21 - "Gateway Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, cors, dotenv, express, http-proxy-middleware, devDependencies, nodemon, cors (+10 more)

### Community 22 - "Hospitales Dependencies"
Cohesion: 0.11
Nodes (17): dependencies, cors, dotenv, express, jsonwebtoken, mysql2, nodemon, socket.io (+9 more)

### Community 23 - "sicem-web Profile/Institutions Pages"
Cohesion: 0.13
Nodes (13): emptyEditInstitutionForm, emptyEditSpecialityForm, emptyEditTypeForm, emptyForm, emptyNewSpecialityForm, emptyNewTypeForm, emptySpecialityForm, roleLabels (+5 more)

### Community 24 - "Graphify Skill Reference Docs"
Cohesion: 0.13
Nodes (15): Graphify Integration (root CLAUDE.md), graphify add URL Ingestion + --watch Folder Monitor, Neo4j/FalkorDB/SVG/GraphML/MCP Exports, Node ID Format Rules, GitHub Clone / Cross-Repo Merge, Post-Commit Hook + CLAUDE.md Integration, BFS/DFS Query Traversal Modes, Constrained Query Vocabulary Expansion (+7 more)

### Community 25 - "sicem-mobile Planning & Handoff Docs"
Cohesion: 0.16
Nodes (15): Expo Version Warning (read versioned docs before coding), sicem-mobile CLAUDE.md (includes AGENTS.md), Emergencias Service (port 3005 - core + socket.io), Expo Go for Dev, EAS Build APK for Demo, Expo Router as Likely Navigation Choice (open decision), Gateway Service (port 3000), Hospitales Service (port 3002), OSRM Real Street Routing (distance/time + polylines) (+7 more)

### Community 26 - "sicem-web Auth & App Shell"
Cohesion: 0.25
Nodes (10): App(), AuthContext, AuthProvider(), useAuth(), formatDateTime(), formatDuration(), History(), RESOLUTION_FILTERS (+2 more)

### Community 27 - "sicem-web Requests/EmergencyDetail"
Cohesion: 0.25
Nodes (10): Navbar(), buildTimeline(), EmergencyDetail(), formatDateTime(), roleLabels, STATUS_SEQUENCE, Requests(), roleLabels (+2 more)

### Community 28 - "sicem-web Patients Admin Page"
Cohesion: 0.16
Nodes (13): emptyAllergyForm, emptyConditionForm, emptyEditAllergyForm, emptyEditConditionForm, emptyEditMedicationForm, emptyEditRecordForm, emptyMedicationForm, emptyRecordForm (+5 more)

### Community 29 - "Hospitales Service Bootstrap"
Cohesion: 0.17
Nodes (11): setIo(), app, cors, db, express, hospitalRoutes, http, io (+3 more)

### Community 30 - "sicem-web Map & NewEmergency"
Cohesion: 0.24
Nodes (7): createAmbulanceIcon(), DEFAULT_CENTER, emergencyIcon, MapArea(), statusColors, fetchRouteDistance(), NewEmergency()

### Community 31 - "sicem-web Hospitals/Charts Pages"
Cohesion: 0.25
Nodes (8): BAR_COLORS, Charts(), monthLabel, PIE_COLORS, roleLabels, Hospitals(), roleLabels, toLowerCaseKeys()

### Community 32 - "Unidades Service Bootstrap"
Cohesion: 0.18
Nodes (10): app, cors, db, express, http, io, jwt, { Server } (+2 more)

### Community 33 - "Usuarios Service Bootstrap"
Cohesion: 0.18
Nodes (9): app, cors, db, express, userRoutes, express, middleware, router (+1 more)

### Community 34 - "sicem-web Dashboard"
Cohesion: 0.31
Nodes (8): EmergencyCard(), severityColor, Dashboard(), formatElapsed(), isStalled(), priorityScore(), roleLabels, sortByPriority()

### Community 35 - "sicem-web Ambulances Admin Page"
Cohesion: 0.22
Nodes (8): emptyEditForm, emptyEditStatusForm, emptyEditTypeForm, emptyForm, emptyStatusForm, emptyTypeForm, roleLabels, TABS

### Community 36 - "Hospitales Auth/DB Config"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

### Community 37 - "Unidades Auth/DB Config"
Cohesion: 0.29
Nodes (4): connection, mysql, db, jwt

### Community 38 - "Usuarios Auth/DB Config"
Cohesion: 0.29
Nodes (5): connection, mysql, db, jwt, verifyToken()

### Community 39 - "Gateway Bootstrap"
Cohesion: 0.40
Nodes (4): app, cors, {createProxyMiddleware}, express

### Community 40 - "Emergencias Closing/Cancelling Logic"
Cohesion: 0.40
Nodes (5): cancelInterInstitutionalRequest(), cancelPendingRequestsForEmergency(), closeEmergency(), closeEmergencyRaw(), forceCloseEmergency()

### Community 41 - "Hospitales Routes"
Cohesion: 0.40
Nodes (4): express, hospitalController, middleware, router

### Community 42 - "Unidades Routes"
Cohesion: 0.40
Nodes (4): express, middleware, router, unitController

### Community 43 - "Unidades Socket/Location Registration"
Cohesion: 0.50
Nodes (3): getIo(), setIo(), registerLocations()

### Community 44 - "Client HTML Entry Points"
Cohesion: 0.67
Nodes (3): sicem-desktop index.html (Electron/Vite entry, mounts main.jsx), sicem-web index.html (Vite entry, mounts main.jsx), sicem-web README (Vite+React boilerplate)

### Community 47 - "Hospitales Bed Availability"
Cohesion: 0.67
Nodes (3): getIo(), updateAvailableBedsI(), updateAvailableBedsIS()

## Knowledge Gaps
- **350 isolated node(s):** `__dirname`, `name`, `private`, `version`, `type` (+345 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `__dirname`, `name`, `private` to the rest of the system?**
  _350 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sicem-desktop UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06851851851851852 - nodes in this community are weakly interconnected._
- **Should `Emergencias Model Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.029411764705882353 - nodes in this community are weakly interconnected._
- **Should `Emergencias Controller Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._
- **Should `sicem-web Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `Pacientes Service (routes/models)` be split into smaller, more focused modules?**
  _Cohesion score 0.050241545893719805 - nodes in this community are weakly interconnected._
- **Should `sicem-desktop Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._