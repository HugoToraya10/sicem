# Herramienta de migración: convierte formularios "en línea" ({cond && (<form ...>)}) en <Drawer>.
# Uso: python to_drawer.py <archivo.jsx> <ruta relativa a components/ui/Overlay>
import re, sys

path, rel = sys.argv[1], sys.argv[2]
s = open(path, encoding='utf-8').read()
FORM_OPEN = re.compile(r'\{\s*([^{}\n]+?)\s*&&\s*\(\s*\n(\s*)<form className="([a-z-]*form)" onSubmit=\{([^}]+)\}>')
count = 0
out = []
pos = 0
while True:
    m = FORM_OPEN.search(s, pos)
    if not m:
        out.append(s[pos:])
        break
    end = s.find('</form>', m.end())
    close = re.compile(r'</form>\s*\n\s*\)\}').match(s, end)
    if end < 0 or not close:
        out.append(s[pos:m.end()])
        pos = m.end()
        continue
    block_end = close.end()
    inner = s[m.end():end]
    h3 = re.match(r'\s*\n\s*<h3>(.*?)</h3>', inner, flags=re.S)
    title_attr = 'title="Formulario"'
    if h3:
        t = h3.group(1).strip()
        if t.startswith('{') and t.endswith('}'):
            title_attr = 'title=' + t
        else:
            title_attr = 'title="' + t.replace('"', "'") + '"'
        inner = inner[h3.end():]
    cancel = re.search(r'className="[a-z-]*form-cancel"[^>]*onClick=\{(\(\) => [^}]+?)\}\s*>', s[m.end():end])
    if not cancel:
        cancel = re.search(r'onClick=\{(\(\) => [^}]+?)\}[^>]*className="[a-z-]*form-cancel"', s[m.end():end])
    on_close = cancel.group(1) if cancel else '() => {}'
    size = 'lg' if 'MapArea' in inner else 'md'
    cond = m.group(1)
    form_open = f'<form className="{m.group(3)}" onSubmit={{{m.group(4)}}}>'
    out.append(s[pos:m.start()])
    out.append(f'<Drawer open={{Boolean({cond})}} onClose={{{on_close}}} {title_attr} size="{size}">\n{m.group(2)}{form_open}{inner}</form>\n{m.group(2)}</Drawer>')
    pos = block_end
    count += 1

res = ''.join(out)
if count and 'components/ui/Overlay' not in res:
    lines = res.split('\n')
    idx = max(i for i, l in enumerate(lines) if l.startswith('import '))
    lines.insert(idx + 1, f"import {{ Drawer }} from '{rel}components/ui/Overlay'")
    res = '\n'.join(lines)
open(path, 'w', encoding='utf-8').write(res)
print(path, 'convertidos:', count)
