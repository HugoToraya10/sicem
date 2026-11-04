# Auditoría del frontend de SICEM

Revisión pantalla por pantalla de las cuatro aplicaciones: web del despachador (`:5173`), escritorio del hospital (`:5174`), portal de pacientes (`:5175`) y app del paramédico (Expo).

Criterio: cada pantalla se abre y se prueba (botones, menús, formularios, filtros, estados vacíos y errores), en los cuatro temas (Clásico, Triage, Triage suave, Sobrio) y en claro/oscuro, y con la herramienta de accesibilidad axe. Lo que falla se corrige y se anota aquí.

## Cambios en el backend (mínimos, pedidos por el frontend)

| Cambio | Archivo | Por qué |
|---|---|---|
| `PATCH /emergencias/desasignar-ambulancia` responde **después** de regresar la emergencia a "Registrada" | `services/emergencias/controllers/emergency.js` | Carrera: el tablero recargaba antes de que terminara el UPDATE y la emergencia no aparecía en "Por aceptar". |
| Nuevo `GET /unidades/ubicaciones` (última ubicación de todas las ambulancias) | `services/unidades/{routes,controllers,models}` | El tablero hacía 33 llamadas (una por unidad) y llenaba la consola de 404. Ahora hace una. |
| (anterior) `GET /hospitales/contexto-regional/:institutionId` y `includeInactive` en pacientes | `services/hospitales`, `services/pacientes` | Región por institución; el portal de pacientes ve sus registros inactivos. |

## Errores corregidos

### Web del despachador
- **"Por aceptar" no se actualizaba al desasignar** una unidad (la carrera de arriba). Verificado: crear sin unidad (22→23), asignar (→22), desasignar (→23, estado "Registrada").
- **No había botón para desasignar una unidad** desde el detalle de la emergencia (solo desde la campana de fallas). Ahora cada unidad asignada tiene "Desasignar", con confirmación que avisa si es la última.
- **Cualquier rol entraba a la web** (un paramédico llegaba al tablero y todo le daba "Acceso denegado"). Ahora la web solo acepta administrador y despachador; paramédico, hospital y paciente reciben el mensaje de en qué aplicación entrar. Además cada ruta exige sesión y rol (un despachador ya no abre `/admin/*`) y, al iniciar sesión, regresa a donde iba.
- **Menú "Más" quedaba detrás de la tarjeta de abajo** → portal con posición fija, se abre hacia arriba si no cabe, flechas/Esc.
- **Editar/crear abrían un formulario hasta arriba de la página** → panel lateral en todo el sistema (ver abajo).
- **`window.prompt`/`alert` nativos** (cierre forzado, duplicados) → diálogos del sistema (el cierre forzado ahora exige motivo).
- **Nueva emergencia:** "Número de pacientes" arrancaba vacío (ahora 1); campos de la fila "Quién reporta / Teléfono" desalineados; el paso de pacientes decía "la ambulancia ya va en camino" aunque no hubiera unidad, y usaba solo placeholders como etiquetas (ahora etiquetas visibles).
- **Errores de red y de servidor** ya no fallan en silencio: aviso único cada 10 s ("No hay conexión…" / "El servidor tuvo un problema…").
- Formularios en panel: etiquetas enlazadas con su campo, teléfono (10 dígitos) y CURP (18) con formato, y el navegador ya no rellena las credenciales guardadas al crear un empleado.

### Escritorio del hospital
- Modales rehechos (detalle del paciente, motivo de rechazo con motivos frecuentes, camas con matriz táctil, solicitud de unidad, detalle de ambulancia).
- Edición de empleados, credenciales, camas, especialidades y ambulancias en panel lateral (antes, formularios dentro de la tarjeta). "Mi institución" es contenido de la pestaña, no un panel.
- Probado: rechazar un paciente desde el modal nuevo → el despachador lo ve como "Rechazada" con el motivo y "Reasignar hospital".

### Portal de pacientes
- **Aceptaba cualquier rol** (un paramédico entraba y podía "crear su expediente"): ahora solo pacientes; el personal recibe un mensaje de que el portal no es para su cuenta.
- Campos de "Datos generales" desalineados cuando uno lleva texto de ayuda.
- Probado: crear expediente, agregar alergia, vacío/duplicados, tema (4) y claro/oscuro del sistema.

### App del paramédico (celular)
- **Aceptaba cualquier rol:** ahora solo paramédicos, con mensaje de a dónde entrar según el rol (administrador/despachador, hospital, paciente). El mensaje de error se borra al editar los campos.
- **Diálogos nativos de Android** (azul del sistema) → diálogo propio con la paleta de la app, botones grandes y apilados cuando hay textos largos. Reemplaza `Alert.alert` en todas las pantallas con la misma firma (`utils/alert.js` + `components/AlertHost.js`).
- **Mapa:** la duración mostraba "3206 min" y la distancia "3747839 m"; ahora "53 h 26 min" y "3748 km".
- **Pacientes:** "Registrar paciente" era un texto subrayado; ahora es un botón. En **Nota de urgencia**, si no hay pacientes, antes solo decía que los registraras; ahora ofrece el botón para hacerlo.
- Botón "Buscar" junto al CURP alineado con el campo.
- Animaciones: botones con respuesta al presionar, bloques de Stats y Pacientes en cascada, radar en la pantalla de espera.
- Probado en el emulador: login (rechazo por rol), iniciar turno (diálogo nuevo), alerta en tiempo real al asignar la unidad, mapa, pacientes, registro de paciente (validación), nota sin pacientes.

### Todo el sistema
- Temas visuales (Clásico, Triage, Triage suave, Sobrio) con selector; un error de alcance hacía que reglas de Triage afectaran al Clásico (corregido).
- Contraste de texto secundario y de botones en oscuro.

## Pendiente / límites
- **Celular real:** GPS, notificaciones y rotación no se pueden probar en el emulador/Expo Go; faltan en un dispositivo físico.
- **Temas visuales en el celular:** no existen (los estilos del celular usan colores fijos).
- **Sesión única:** iniciar sesión en la web o en el portal con una cuenta de paramédico cierra su sesión del celular (el backend permite una sola sesión por cuenta). No se cambió.
- **Diálogos con fuente del sistema** en el celular: el nuevo diálogo usa la fuente del sistema Android, no una propia.
- Los barridos de accesibilidad y de desborde horizontal se hicieron a 1280×720 y 1024×768; no a tablet vertical ni a pantallas muy anchas en los cambios de esta pasada.
- Los datos de prueba (emergencias de auditoría #104 y #105, cuentas `qa.*`, ambulancia QA-01) siguen en la base de datos; hay que borrarlos antes de entregar el sistema.
