# Empaquetado de SICEM Desktop (.exe) y SICEM Mobile (.apk)

Guía de referencia para volver a generar los instaladores/APK en el futuro, con todos los tropiezos reales que ya pisamos documentados — si sigues esto tal cual, no deberías repetir ninguno.

Todo lo de aquí asume que ya tienes: Node.js, Yarn, Android Studio con el SDK Manager (para mobile), y que el backend ya está corriendo en algún lado accesible (Codespaces, tu propia red, lo que sea) con las URLs correspondientes en los `.env` de cada cliente.

---

## Antes de compilar CUALQUIER cosa

Verifica que `clients/sicem-web/.env`, `clients/sicem-desktop/.env` y `clients/sicem-mobile/.env` tengan las URLs correctas del backend que vas a usar. Estas variables se "hornean" dentro del build — si las cambias después de compilar, tienes que compilar de nuevo, no es como una página web que lee el `.env` en cada carga.

- Desktop/Web usan: `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, `VITE_UNITS_SOCKET_URL`
- Mobile usa: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_UNITS_SOCKET_URL`

---

## 1. Desktop (.exe)

### Comandos

```powershell
cd clients\sicem-desktop
yarn vite build
npx electron-builder -c.directories.output="C:\sicem-build-output\desktop"
```

El instalador queda en `C:\sicem-build-output\desktop\SICEM Desktop Setup 1.0.0.exe`.

### Por qué NO usar simplemente `yarn build`

El script `build` del `package.json` corre `vite build && electron-builder` seguido, empacando dentro de la misma carpeta del proyecto (`release/`). Como tu carpeta `Desktop` vive dentro de OneDrive, OneDrive intenta sincronizar los archivos justo cuando electron-builder los está extrayendo/renombrando, y truena con `EPERM: operation not permitted, rename ... win-unpacked.tmp -> win-unpacked`. Por eso el comando de arriba manda la salida a `C:\sicem-build-output\desktop`, fuera de cualquier carpeta sincronizada.

### Bugs reales que ya se corrigieron en el código (no deberías volver a verlos, pero por si acaso)

1. **Pantalla en blanco total al abrir el `.exe`** — causa: el router de React (`BrowserRouter`) no funciona cuando Electron carga la app con `file://` en vez de `http://`; Electron mete la ruta completa del disco como si fuera la URL, y React Router no encuentra ninguna coincidencia. Arreglado usando `HashRouter` en vez de `BrowserRouter` (`clients/sicem-desktop/src/App.jsx`). **Si alguna vez agregas una pantalla nueva y usas por accidente `BrowserRouter` de nuevo, vuelve a pasar.**
2. **`Unable to load preload script... ENOENT`** — causa: la herramienta que compila el proceso principal de Electron (`vite-plugin-electron`) genera el archivo como `preload.mjs`, pero el código pedía `preload.js` (nombre distinto). Arreglado en `clients/sicem-desktop/main.js`. Si algún día actualizas `vite-plugin-electron` y vuelve a generar `.js` en vez de `.mjs`, este apuntador se rompe al revés — revisa qué archivo existe de verdad en `dist-electron/` después de un build.
3. **Ícono no aparece / sale el ícono genérico de Electron** — hace falta un archivo `.ico` en `clients/sicem-desktop/build/icon.ico` y que `package.json` (campo `build.icon` y `build.win.icon`) apunte ahí. Ya está configurado; si cambias el logo, solo reemplaza ese `.ico` (necesitas una herramienta que combine varios tamaños — 16/32/48/256px — en un solo `.ico`, un PNG normal no sirve directo).

### Cómo probar que el `.exe` de verdad funciona (no confíes solo en que "compiló sin error")

```powershell
C:\sicem-build-output\desktop\win-unpacked\"SICEM Desktop.exe"
```

Ábrelo directo desde ahí (no hace falta instalar) y revisa que cargue el login. Si algo sale mal, agrega temporalmente esto en `main.js` antes de `mainWindow.loadFile(...)`, para ver errores reales:

```js
mainWindow.webContents.openDevTools({ mode: 'detach' })
```

Recuerda quitarlo antes del build final — no debe quedar en el `.exe` que le des a alguien más.

---

## 2. Mobile (.apk)

### El problema de fondo: rutas largas de Windows

Tu proyecto vive en `C:\Users\Hugo Toraya\Desktop\SOA\SICEM\clients\sicem-mobile\...` — una ruta larga. Los módulos nativos en C++ que usa React Native generan archivos intermedios con nombres MUY largos (mezclando la ruta completa del código fuente dentro del nombre del archivo de salida), y Windows tiene un límite clásico de 260 caracteres por ruta. Cuando se pasa ese límite, el compilador (`ninja`) truena con `Filename longer than 260 characters`.

Activar "rutas largas" en el Registro de Windows **no es suficiente** — el `ninja.exe` que trae el SDK de Android no lo respeta completamente aunque el sistema operativo sí lo permita.

**La solución que funciona:** copiar el proyecto a una ruta corta antes de compilar.

### Comandos (cada vez que quieras generar un APK)

```powershell
# 1. Copiar a ruta corta (excluye lo que se regenera solo, para que sea rápido)
robocopy "C:\Users\Hugo Toraya\Desktop\SOA\SICEM\clients\sicem-mobile" "C:\sicem-mobile-build" /E /XD "android\app\build" "android\app\.cxx" "android\build" "android\.gradle"

# 2. Compilar desde la copia
cd C:\sicem-mobile-build\android
.\gradlew.bat assembleRelease
```

El APK queda en `C:\sicem-mobile-build\android\app\build\outputs\apk\release\app-release.apk` — cópialo a donde lo necesites.

**Nota sobre `robocopy`:** cuando termina bien, PowerShell puede mostrar "código de salida 1" — para `robocopy` eso significa ÉXITO (copió archivos), no error. Solo preocúpate si el código es 2 o mayor.

**Importante:** esa copia en `C:\sicem-mobile-build` queda desactualizada en cuanto cambies código fuente. No la reuses de una sesión a otra sin repetir el paso 1 — bórrala cuando termines, o vuelve a copiar antes de cada build nuevo.

### ¿Por qué no usar una "unión" (`mklink /J`) en vez de copiar?

Se probó primero — es más rápida (no duplica 2GB de `node_modules`) pero **no es compatible** con el archivo `metro.config.js` que el proyecto ya necesita (ver bug #3 abajo): Node resuelve la unión a la ruta real en un punto del proceso de build, pero Metro se queda pensando que la raíz del proyecto es la ruta corta de la unión, y las dos vistas de la misma carpeta no coinciden como texto — el build truena con `Unable to resolve module`. Si en el futuro quitas `metro.config.js` del proyecto, la unión volvería a ser viable y más rápida.

### Requisitos previos en la máquina (una sola vez por PC)

**a) NDK correcto — 26.1.10909125, NO la versión más nueva**

Android Studio por defecto solo ofrece instalar la versión más nueva del NDK, y esa (27.x) **rompe el enlazado** contra la librería precompilada de React Native (errores tipo `undefined symbol: operator new`, `std::bad_alloc`). En SDK Manager → SDK Tools → "Show Package Details" → NDK (Side by side) → marca específicamente **26.1.10909125**.

Esto ya está fijado en el código (`clients/sicem-mobile/plugins/withNdkVersion.js`), no deberías tener que tocar nada mientras esa versión del NDK exista en tu máquina.

**b) `local.properties`**

Gradle necesita saber dónde está el SDK. Es un archivo que NUNCA se sube a git (es específico de cada máquina). Créalo así:

```powershell
"sdk.dir=C:/Users/TU_USUARIO/AppData/Local/Android/Sdk" | Out-File -Encoding utf8 clients\sicem-mobile\android\local.properties
```

**c) Rutas largas de Windows (PowerShell como Administrador, una sola vez por PC)**

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

No resuelve el problema de rutas por sí solo (ver arriba, por qué igual hace falta copiar a una ruta corta), pero ayuda con otras herramientas y no está de más tenerlo activado.

### Bugs reales que ya se corrigieron (y por qué pueden volver a aparecer)

1. **`no member named 'format' in namespace 'std'`** — un header interno de React Native (`graphicsConversions.h`, que viene DENTRO del paquete precompilado de React Native, no en tu código) usa `std::format`, una función de C++20 que el NDK 26.1 no soporta completo. El fix vive **fuera del repositorio**, en el caché de Gradle de tu PC:
   ```
   C:\Users\TU_USUARIO\.gradle\caches\<version>\transforms\<hash>\transformed\react-android-0.81.5-release\prefab\modules\reactnative\include\react\renderer\core\graphicsConversions.h
   ```
   Busca la línea `std::format("{}%", dimension.value);` y cámbiala por:
   ```cpp
   std::to_string(dimension.value) + "%";
   ```
   **Este parche se puede perder solo** — si Gradle decide re-extraer el paquete de React Native (pasa a veces sin razón aparente, sobre todo después de limpiar cachés), el archivo vuelve a su versión original y hay que repetir el parche. Si el build vuelve a fallar con este mismo error, ya sabes exactamente qué hacer. El `<hash>` de la ruta cambia entre builds/máquinas — búscalo con:
   ```powershell
   Get-ChildItem -Recurse -Filter graphicsConversions.h "$env:USERPROFILE\.gradle\caches"
   ```

2. **La app se cierra sola al abrirla (`TypeError: Cannot read property 'useState' of null`)** — bug real de Metro (el empaquetador de JavaScript), no de tu código: con una opción llamada `unstable_enablePackageExports` (activa por default en versiones recientes), Metro puede terminar cargando el paquete `react` como si fueran dos copias distintas dentro del mismo paquete final, cada una con su propio estado interno de "hooks" — esto SOLO se nota en un build de producción real (APK release), nunca corriendo `expo start` en desarrollo. Arreglado con `clients/sicem-mobile/metro.config.js`, que desactiva esa opción. Ya es parte del código, no deberías tener que tocarlo.

### Cómo probar que el APK de verdad funciona antes de dárselo a alguien

Si tienes un emulador de Android corriendo (Android Studio → Device Manager, o simplemente ya tenías uno abierto):

```powershell
adb install "C:\sicem-mobile-build\android\app\build\outputs\apk\release\app-release.apk"
adb shell monkey -p com.sicem.mobile -c android.intent.category.LAUNCHER 1
```

Si se abre y no se cierra solo en los primeros segundos, vas bien. Para ver errores reales si algo falla:

```powershell
adb logcat -d *:E AndroidRuntime:E ReactNativeJS:V
```

---

## 3. Recordatorio: cómo volver a modo 100% local (sin Codespace)

Si algún día ya no necesitas el backend en la nube, borra o comenta las variables `VITE_API_BASE_URL`/`EXPO_PUBLIC_API_BASE_URL` (y las otras dos de cada archivo) en los `.env` de las 3 apps. Sin esas variables, cada app vuelve sola a `localhost` (desktop/web) o a detectar automáticamente la IP de tu red (mobile) — no hace falta tocar ningún otro archivo ni recompilar el código, solo el `.env` y volver a correr los comandos de arriba.
