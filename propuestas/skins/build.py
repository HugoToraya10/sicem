import re, os, shutil
# Uso: python propuestas/skins/build.py  (regenera clients/*/src/styles/skins.css desde propuestas/triage y propuestas/skins)
root = r'C:\Proyectos\sicem'
src = open(root + r'\propuestas\triage\triage.css', encoding='utf-8').read()

TS = ':is([data-skin="triage"],[data-skin="suave"])'      # selector común de la base Triage
P = ':root' + TS

# 1) quitar el bloque @media prefers-color-scheme (los skins responden a data-theme)
src = re.sub(r'@media \(prefers-color-scheme: dark\) \{.*?\n\}\n', '', src, flags=re.S)
# 2) quitar @keyframes que redefinen animaciones globales
src = re.sub(r'/\* Entrada de página.*?\n@keyframes page-in \{[^\n]*\}\n', '', src, flags=re.S)

# 3) refuerzo de especificidad
src = src.replace(':root:root:root:root:root', P + ':not(#_)')
# 4) bloques de tokens
src = src.replace(':root[data-theme="dark"] {', ':root:is([data-skin="triage"],[data-skin="suave"])[data-theme="dark"] {')
src = re.sub(r'^:root \{', P + ' {', src, count=1, flags=re.M)
# 5) prefijo general ":root " -> base
out = []
src = src.replace(':root[data-theme="dark"] .', P + '[data-theme="dark"] .').replace(':root ', P + ' ')  # todo selector con :root (tambien tras una coma) queda limitado a estos skins
# 6) reglas sueltas
src = src.replace('body { background: var(--bg);', P + ' body { background: var(--bg);', 1)
src = src.replace('h1, h2, h3, h4 { font-family', P + ' :is(h1, h2, h3, h4) { font-family', 1)
src = src.replace('\nh1 { font-weight: 800;', '\n' + P + ' h1 { font-weight: 800;', 1)
src = src.replace('.brand-name, [class$="-name"] { letter-spacing: 0; }', P + ' :is(.brand-name, [class$="-name"]) { letter-spacing: 0; }', 1)
src = src.replace(':focus-visible { outline: 3px', P + ' :focus-visible { outline: 3px', 1)
# la franja diagonal en .app-header/.topbar usa el prefijo ya convertido
base = '/* Generado desde propuestas/triage/triage.css — skins "triage" y "suave". No editar a mano: edita las fuentes en propuestas/skins. */\n' + src

suave = open(root + r'\propuestas\skins\suave.css', encoding='utf-8').read()
sobrio = open(root + r'\propuestas\skins\sobrio.css', encoding='utf-8').read()
full = base + '\n\n' + suave + '\n\n' + sobrio + '\n'

for c in ('sicem-web', 'sicem-desktop'):
    os.makedirs(root + rf'\clients\{c}\src\styles', exist_ok=True)
    open(root + rf'\clients\{c}\src\styles\skins.css', 'w', encoding='utf-8').write(full)
os.makedirs(root + r'\clients\sicem-pacientes\src\styles', exist_ok=True)
open(root + r'\clients\sicem-pacientes\src\styles\skins.css', 'w', encoding='utf-8').write(full)

# importaciones (después de polish.css)
for f in (r'\clients\sicem-web\src\main.jsx', r'\clients\sicem-pacientes\src\main.jsx'):
    s = open(root + f, encoding='utf-8').read()
    if 'skins.css' not in s:
        s = s.replace("import './styles/polish.css'", "import './styles/polish.css'\nimport './styles/skins.css'", 1)
        open(root + f, 'w', encoding='utf-8').write(s)
f = root + r'\clients\sicem-desktop\src\index.css'
s = open(f, encoding='utf-8').read()
if 'skins.css' not in s:
    s = s.replace("@import './styles/polish.css';", "@import './styles/polish.css';\n@import './styles/skins.css';", 1)
    open(f, 'w', encoding='utf-8').write(s)
print('ok', len(full))
