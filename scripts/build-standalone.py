#!/usr/bin/env python3
"""Assemble la version sans serveur à partir des mêmes fichiers que le site."""
from pathlib import Path
import base64
import re
import runpy

base = Path(__file__).resolve().parents[1]
runpy.run_path(str(base / 'assemble-data.py'), run_name='__main__')
dist = base / 'dist'
html = (dist / 'index.html').read_text()
css = (dist / 'styles.css').read_text()
# Les polices sont intégrées en data URI : le fichier autonome n'appelle aucun serveur, même pour la typographie.
css = re.sub(r'url\((fonts/[\w.-]+\.woff2)\)',
             lambda m: 'url(data:font/woff2;base64,' + base64.b64encode((dist / m.group(1)).read_bytes()).decode('ascii') + ')',
             css)
data = (dist / 'data.js').read_text()
engine = (dist / 'engine.mjs').read_text()
app = (dist / 'app.mjs').read_text()

# Le module local contient uniquement des exports nommés et un import statique.
# Arrêter la construction plutôt que produire un HTML incomplet si cela évolue.
engine = re.sub(r'^export\s+', '', engine, flags=re.MULTILINE)
app, imports_removed = re.subn(
    r'^import\s+[^\n]+\s+from\s+[\'"]\./engine\.mjs[\'"];?\s*\n',
    '', app, count=1, flags=re.MULTILINE)
if imports_removed != 1 or re.search(r'^\s*(?:import|export)\b', engine + '\n' + app, flags=re.MULTILINE):
    raise SystemExit('La structure des modules a changé : adapter cet assembleur.')

script = data + '\n(function(){\n"use strict";\n' + engine + '\n' + app + '\n})();\n'
script = re.sub(r'</script', r'<\\/script', script, flags=re.IGNORECASE)
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="data.js"></script>', '')
html = html.replace('<script type="module" src="app.mjs"></script>', '')
html = html.replace('</body>', '<script>\n' + script + '</script>\n</body>')
if re.search(r'<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=[\'"]stylesheet', html, flags=re.IGNORECASE):
    raise SystemExit('Une ressource externe subsiste dans le document autonome.')
if re.search(r'url\((?!data:)', css):
    raise SystemExit('Une police ou une image n’a pas été intégrée au document autonome.')
(base / 'reperes.html').write_text(html)
print('Fichier autonome prêt : reperes.html')
