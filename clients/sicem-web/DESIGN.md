# Sistema de diseño — sicem-web

Dirección: **"Sala de situación"**. Institucional y sobrio, con un solo momento memorable
(el Dashboard con el mapa como escenario). El rojo significa **urgencia y marca**, nunca decoración.

## Dónde se cambia la apariencia
- **Todo color, tipografía, radio y sombra vive en `src/styles/tokens.css`.** Tema claro en `:root`,
  oscuro en `:root[data-theme="dark"]`. No escribir colores a mano en componentes nuevos: usar `var(--…)`.
- Base global (reset, foco visible, `prefers-reduced-motion`): `src/index.css`.
- Fuentes (Google Fonts) en `index.html`: **Inter** (títulos, cifras y texto),
  **IBM Plex Mono** (solo identificadores de unidad, ej. `TAB-005`).

## Tokens principales
| Grupo | Tokens |
|---|---|
| Superficies | `--bg` `--surface` `--surface-2` `--line` `--line-strong` |
| Texto | `--text` `--text-2` `--text-3` |
| Marca / significado | `--brand` (urgencia) · `--steel` (selección, rutas, "en ruta") · `--ok` · `--warn` · `--hosp` |
| Barra superior | `--nav-bg` `--nav-text` `--nav-line` |
| Triage I–V | `--t1` … `--t5` (semántica fija) |
| Unidades en mapa | `--u-free` `--u-route` `--u-scene` `--u-transfer` `--u-off` |
| Forma | `--r-sm` 6 · `--r-md` 8 · `--r-lg` 12 · `--shadow-panel` · `--shadow-card` · `--ring` |

## Tema claro / oscuro
- `utils/theme.js`: `useTheme()`, `setTheme()` (recuerda la elección en `localStorage`).
- `App.jsx` → `ThemeGate` aplica `data-theme` al `<html>` **solo en rutas listadas en `DARK_READY_PATHS`**
  (hoy `/dashboard`). Al rediseñar otra pantalla, **agregar su ruta a `DARK_READY_PATHS`**.
- Mapa oscuro: se invierte el mosaico de OSM con un filtro CSS (`MapArea.css`), sin servicio de pago.

## Componentes compartidos
- `components/ui/Icon.jsx` — íconos de línea (`search, bell, sun, moon, pin, plus, minus, chevron, chevron-left/right, check, alert, hospital, arrow, clock, fit, crosshair, layers, expand, volume, volume-off, wrench, list, x`).
- `components/ui/LiveClock.jsx` — reloj con estado propio (no re-renderiza el mapa cada segundo).
- `components/layout/Navbar.jsx` — barra superior, campana, tema, `Ctrl+K`. **Sin atajos de una sola tecla**: en una app de emergencias una tecla suelta nunca debe sacar al despachador de lo que hace.
- `components/layout/CommandPalette.jsx` — paleta `Ctrl+K` (pantallas + emergencias activas), montada por portal en `<body>`.
- `components/emergencies/EmergencyCard.jsx` — tarjeta con riel y nivel de triage (es un `<button>`).
- `components/map/MapArea.jsx` — Leaflet; props: `emergencies`, `selectedEmergencyId`, `onEmergencyClick`, `legendCentered`, `hideZoomControl`, `onMapReady` (entrega la instancia del mapa). Los íconos se cachean (`iconCache`) para no reiniciar animaciones al re-renderizar.
- `components/map/MapControls.jsx` — barra de control del mapa: zoom, ver todo, ir a la más crítica, capas (Emergencias/Unidades/Hospitales/Rutas), filtro de unidades por estado, pantalla completa.
- `components/emergencies/QuickAssignCard.jsx` — resumen de la emergencia seleccionada; si está "Registrada", recomienda las 3 unidades propias disponibles más cercanas (tiempo real por calle con OSRM, `utils/osrm.js`) y asigna con **Confirmar/Cancelar** vía `POST /emergencias/registrar-asignacion`.
- `utils/alertSound.js` — aviso sonoro con silencio recordado. `utils/osrm.js` — ruteo (servidor demo público de OSRM: para producción, alojar uno propio).

## Dashboard: centro de control
- Franja de situación + **cinta de atención** (rechazos, emergencias sin unidad, fallas de unidad vigentes <12 h); cada botón salta a la siguiente emergencia de su grupo.
- Paneles plegables (botón del panel; quedan como pestaña con contador). **Modo sala** = paneles ocultos + pantalla completa.
- Panel derecho con pestañas **Por aceptar** y **Bitácora** (eventos de los sockets, sin actualizaciones de ubicación).
- "Seguir emergencias nuevas" (apagado por defecto) centra el mapa en cada emergencia que llega.
- Tarjetas: botón "Ver en el mapa" y resalte del marcador al pasar el cursor; el clic en la tarjeta sigue abriendo el detalle.

## Reglas de UX acordadas
- Tiempos legibles: minutos → "h min" → "hace N días" (nunca "1909h").
- "Sin movimiento · revisar" es un aviso **discreto** (contorno). Los rechazos y pendientes son los que destacan.
- Textos en español, sentido de oración, el botón y el mensaje de éxito usan el mismo verbo.
- Estados vacíos y errores dicen qué pasó y qué hacer.
- `triage_level` puede llegar como número o en romano (`"I"`); normalizar con `levelNumber()` (ver `MapArea.jsx`).

## Estado del rediseño
- ✅ Partes 1 a 5 terminadas: tokens, tema claro/oscuro en **todas** las pantallas, Navbar (menú desplegable en tablet/teléfono),
  Dashboard + centro de control, Nueva emergencia (paso 1 y 2), Detalle, Historial, Solicitudes, Hospitales, Gráficas,
  Login, Perfil y administración (Usuarios, Instituciones, Ambulancias, Pacientes, Catálogos).
- Pantallas cargadas bajo demanda (`React.lazy` en `App.jsx`): el paquete inicial pasó de ~1.5 MB a ~240 kB.
- Accesibilidad: enlace "Saltar al contenido", foco visible, `prefers-reduced-motion`, objetivos de 44 px en pantallas táctiles,
  `lang="es"`, errores anunciados (`role="alert"`), filtros con `aria-pressed`.

## Administración: sistema compartido
`pages/admin/Institutions.css` es el sistema de listados y formularios de admin (página, tablas, formularios, pestañas, estados).
Usuarios y Ambulancias usan las mismas reglas por **alias** (`users-*`, `ambulances-*` comparten reglas con `institutions-*`);
sus propios CSS solo guardan lo exclusivo de cada pantalla. Para cambiar el look de todas, editar ese archivo.

## Antes de dar algo por terminado
1. `node node_modules/eslint/bin/eslint.js <archivos> --quiet`
2. **`node node_modules/vite/bin/vite.js build`** — el modo dev tolera CSS roto, el build no (ya pasó una vez).
3. **Cada pantalla importa el CSS que usa.** Como las pantallas se cargan bajo demanda (`React.lazy`), un CSS que otra pantalla
   "traía de rebote" deja de llegar. Verificar dependencias con un chequeo de clases usadas vs. CSS importado (ya rompió Usuarios y
   Ambulancias una vez). Reglas compartidas viven en `pages/admin/Institutions.css`, `NewEmergency.css` (tarjetas de unidad) y `index.css`.
4. Auditoría de accesibilidad: `axe-core` (wcag2a/2aa/21aa + best-practice) en claro y oscuro sobre las 14 pantallas.
   **Estado actual: 0 violaciones.**
5. Probar en el navegador en claro y oscuro, a 1440, 1024 y 390 px, sin scroll horizontal.
6. Probar acciones que escriben en la BD **interceptando la petición** (Playwright `page.route`), no contra datos reales.
7. `graphify update .`

## Accesibilidad: lo que ya cumple
- Zona principal (`role="main"` / `<main id="contenido">`), cabecera `<header>`, y enlace "Saltar al contenido".
- Todo `<select>` e `<input>` con nombre accesible; marcadores del mapa con `title`/`alt`.
- Texto sobre colores de triage elegido por contraste WCAG real (`utils/color.js` → `readableTextOn`); nunca blanco fijo.
- Rojo de texto en modo oscuro (`--brand` #F26B6F) con contraste ≥ 4.5 sobre las superficies.
- Títulos en orden (h1 → h2), sin saltos.

## Reglas de copy
Oraciones con mayúscula solo en la primera palabra ("Registrar nueva institución"), nunca Title Case. Botones con verbo
("Confirmar asignación"). Errores: qué pasó y qué hacer. Estados vacíos: cómo salir de ahí.

## Región y configuración (sin valores fijos de un estado)
- La región (centro del mapa, zona horaria, sufijo de búsqueda de direcciones) sale de la **institución de la cuenta**, nunca de la IP.
  Backend: `GET /hospitales/contexto-regional/:institutionId` (único cambio de backend del rediseño). Código: `src/utils/region.js`,
  `src/utils/mexico.js` (catálogo de estados), `src/context/RegionContext.jsx` + `useRegion.js`.
- La búsqueda de dirección en Nueva emergencia (`src/utils/geocode.js`) ya no está atada a Tabasco: usa el estado de la institución,
  permite elegir otro estado y, si hay varias coincidencias, muestra la lista en vez de elegir una.
- Valores configurables en `src/config/` (`roles.js`, `services.js`, `operations.js`): mosaicos del mapa, geocodificador, enrutador
  y umbrales. Se sobrescriben con variables `VITE_*`.
- Desktop y pacientes siguen el mismo criterio (`clients/sicem-desktop/src/config`, `clients/sicem-pacientes/src/api.js`).

## Pendientes conocidos (fuera del rediseño)
- (Resuelto 2026-10-09) La BD local no tenía `user_profiles.identification_number`; se aplicó la migración
  `2026-08-14_01_add_identification_number_to_user_profiles.sql` (respaldo previo en `backup-sicem-antes-de-migracion-2026-10-09.sql`).
- El Dashboard pide la ubicación de cada ambulancia una por una (`/unidades/ubicacion/:id`) y las que no tienen responden 404
  (ruido en consola y peticiones de más). Conviene un endpoint que devuelva todas las ubicaciones.
- Hay errores de lint preexistentes `react-hooks/set-state-in-effect` en NewEmergency, EmergencyDetail e Institutions (lógica, no visual).

Maqueta de referencia (fuera del código): `maqueta-rediseno-sicem.html` en la raíz del repo.

## Paneles, diálogos, menús y temas (obligatorio para pantallas nuevas)
- **Crear, editar o ver detalle**: `Drawer` (panel lateral) de `components/ui/Overlay.jsx`. **Nunca** un formulario "en línea" que empuja la página. Decisiones cortas y vistas que piden atención total: `Modal`. Confirmaciones y preguntas: `useDialogs()` → `confirm` / `prompt` / `notify` (nada de `window.alert/confirm/prompt`).
- Los paneles van en portal, atrapan el foco, cierran con Esc, devuelven el foco y bloquean el scroll. Los formularios dentro conservan sus clases (`*-form`, `*-form-row`, `*-field`, `*-form-actions`): el CSS del panel los adapta (botones fijos abajo, etiquetas enlazadas, teléfono de 10 dígitos y CURP de 18).
- **Menús de acciones**: `MoreMenu` (portal, posición fija). No usar `position: absolute` dentro de tarjetas: las tarjetas se mueven al pasar el cursor y tapan el menú.
- **Temas (skins)**: `Clásico`, `Triage`, `Triage suave`, `Sobrio` (`data-skin` en `<html>`, selector en la barra y en Mi perfil). Todo color/forma sale de los tokens; los skins viven en `propuestas/` y se compilan con `python propuestas/skins/build.py` a `src/styles/skins.css` (generado: no editar a mano). Probar cada pantalla nueva en los 4 temas, claro y oscuro.
- Cada ruta se protege con `RequireRole` (App.jsx): la web es solo para administrador (1) y despachador (2).
