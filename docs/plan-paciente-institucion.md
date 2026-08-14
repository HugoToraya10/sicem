# Plan — Paciente fuera de institución: afiliación + página pública

> Estado: **Fases 1–5 implementadas y compilando**. Fecha: 2026-08-14

## Problema que resuelve
Si llega un paciente que **no es de la institución** que lo atiende, SICEM debe identificarlo para que el paramédico lo mande a donde realmente corresponde y el despachador reasigne la emergencia.

## Flujo final (visión de las 5 fases)
1. El paciente captura sus datos (NSS, CURP, nombre, etc.) en una **página pública** con login común (rol 5).
2. Al atenderse una emergencia, **sicem-desktop** detecta que el paciente de esa emergencia pertenece a otra institución.
3. **sicem-mobile** permite al paramédico reasignar el destino.
4. **sicem-web** se entera por la campanita y puede redirigirse ("Ver emergencia") para reasignar.

---

## Fase 1 — Base de datos ✅ (IMPLEMENTADA)
**Decisiones del usuario:**
- El identificador **NO se llama NSS** porque no todas las instituciones lo usan (solo dos). Es un identificador **general de afiliación**.
- Es **NULLABLE** (opcional) y **solo texto** (sin validación contra IMSS/ISSSTE).

**Implementación:**
- Columna `identification_number varchar(20) DEFAULT NULL` agregada a `user_profiles` (después de `CURP`).
- Índice `idx_userprofiles_identification_number` para búsqueda rápida.
- Archivo: `migrations/2026-08-14_01_add_identification_number_to_user_profiles.sql` (ya aplicada a la BD).
- `sicem_backup.sql` **no se tocó**: su `INSERT` posicional se rompería; la migración va a la BD viva y el dump se regenerará.

**Afiliación** = `user_profiles.institution_id` (ya existe; hoy todos los pacientes apuntan a la institución 1 por defecto). No hace falta columna nueva.

---

## Fase 2 — Página pública de captura + login ✅ (IMPLEMENTADA)
**Decisiones del usuario:**
- **Login común** con rol de paciente, lo más básico posible, pero que permita llenar sus datos.
- Si no tiene cuenta, **el propio usuario se registra** (email + password básico).
- Página única, variante de sicem-web, **accesible a todos**.

**Implementación:**
- Nueva mini-app `clients/sicem-pacientes` (Vite/React, pública, sin login obligatorio): pestañas "Iniciar sesión" y "Registrarme" + vista "Mis datos" al estar autenticado.
- Extendidos `models/user.js` (`createProfile`, `editUserProfile`) y el controller para guardar/editar `identification_number`.

**Endpoints reutilizados** (`services/usuarios/routes/user.js`):
| Endpoint | Método | Acceso | Uso |
|---|---|---|---|
| `/registro-paciente` | POST | público | Registrar paciente rol 5 |
| `/login` | POST | público | Login |
| `/obtener-instituciones` | GET | público | Catálogo de instituciones |
| `/obtener-usuario-id/:id` | GET | token (self/1-4) | Cargar datos del paciente |
| `/actualizar-perfil` | PATCH | token (self) | Editar datos propios |
- Si el usuario ya existe (CURP/NSS repetido), actualizar afiliación en vez de duplicar.

---

## Fase 3 — sicem-desktop: pantalla de pacientes + detección ✅ (IMPLEMENTADA)
**Decisiones del usuario:**
- Los datos del paciente salen de la **emergencia en curso** (trae consigo a los pacientes, registrados o no).
- Añadir **pantalla sencilla de pacientes** en sicem-desktop: ver pacientes **afiliados** y **buscarlos con filtro** (por NSS/CURP/nombre).
- Cruzar la institución de afiliación del paciente vs la institución actual del hospital → marcar "paciente de otra institución".

**Implementación:**
- Backend: `getIncomingPatientsByInstitution` y `getPatientHistoryByInstitution` ahora devuelven `patient_institution_id`, `patient_institution_name`, `patient_identification_number` (afiliación del paciente).
- Nuevo endpoint `GET /usuarios/pacientes?q=&institutionId=` (rol 1/4) → búsqueda por nombre/CURP/identificación + filtro por institución.
- Nueva pantalla `src/pages/Patients.jsx` en sicem-desktop + ruta `/pacientes` + link en navbar.
- Badge "Afiliado a: …" en `IncomingPatientCard` y `PatientDetailModal` cuando el paciente es de otra institución.

**Nota:** los pacientes "No identificado" (perfiles rol 5 sin CURP creados al vuelo) no pueden cruzarse; solo aplica a pacientes con perfil real/afiliación.

---

## Fase 4 — sicem-mobile: reasignar destino ✅ (IMPLEMENTADA)
- El paramédico puede cambiar el destino/institución del paciente desde la app cuando es de otra institución.
- Endpoint `PATCH /emergencias/reasignar-destino-paciente` ahora acepta rol 3, con restricción: solo pacientes que van en SU propia ambulancia, emergencia abierta y sin entregar; la ambulancia NO cambia.
- UI en `app/(app)/paciente.js`: botón "Cambiar destino" por paciente (solo los de tu unidad) → selector de instituciones.
- La reasignación resetea el estado a "Pendiente" y avisa por socket al nuevo hospital (evento existente `eventPatientRegistered`).

---

## Fase 5 — sicem-web: reasignación ✅ (IMPLEMENTADA)
- La pantalla de reasignación **ya existía** (`/emergencias/:emergencyId`).
- Cuando el **paramédico** reasigna el destino, el backend emite `eventDestinationReassigned` a las salas `admin` y `dispatcher`.
- La **campana** de sicem-web (`components/layout/Navbar.jsx`) escucha ese evento, lo muestra con "Ver emergencia" y navega a la emergencia para reasignar/re-confirmar.

---

## Dependencias
1 → 2 → 3 → 4 → 5 (3–5 dependen de afiliación real desde Fase 2).

## Estado actual
Todas las fases implementadas. Fases 1–3 y 5 verificadas compilando (web, desktop, pacientes) y probadas contra la BD real. Fase 4 (mobile) parseada correctamente; requiere correr Expo para verificación visual.
