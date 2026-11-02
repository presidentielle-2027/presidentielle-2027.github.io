#!/usr/bin/env python3
"""Assemble la version sans serveur à partir des mêmes fichiers que le site."""
from pathlib import Path
import base64
import json
import re
import runpy
import subprocess

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

# Présentation lisible sans JavaScript, pour les moteurs de recherche et les navigateurs sans script : ses nombres et
# la liste des sujets (les axes) viennent des catalogues, comme ceux de l'application.
catalog = json.loads(data.split('=', 1)[1].rstrip().rstrip(';'))
themes = [a['name'][0].lower() + a['name'][1:] for a in catalog['axes']]
listing = ', '.join(themes[:-1]) + ' et ' + themes[-1]
questions_n = sum(len(a['questions']) for a in catalog['axes'])
noscript = ('<noscript><div class="noscript"><h1>Présidentielle 2027 : faites le point sur vos convictions</h1>'
            f'<p>Avant l’isoloir propose {questions_n} propositions réparties sur {len(themes)} sujets : {listing}. '
            f'Le bilan situe vos positions sujet par sujet et mesure votre écart avec {len(catalog["families"])} familles d’idées ; '
            f'sous chaque sujet, des auteurs présentent les arguments des deux pôles ({len(catalog["references"]["thinkers"])} auteurs en tout).</p>'
            '<p>Le site est indépendant, sans lien avec les pouvoirs publics ni avec les partis. Le calcul se fait dans votre navigateur, '
            'sans inscription ni consigne de vote. Activez JavaScript pour répondre au questionnaire.</p>'
            f'<p><a href="methode/">La méthode</a> · <a href="axes/">Les {len(themes)} axes, leurs propositions et leurs arguments</a> · '
            f'<a href="familles/">Les {len(catalog["families"])} familles d’idées</a> · <a href="partis/">Les {len(catalog["parties"]["parties"])} partis</a> · '
            f'<a href="auteurs/">Les {len(catalog["references"]["thinkers"])} auteurs cités</a></p></div></noscript>')
loading = '<main id="main" tabindex="-1"><div class="loading">Préparation du questionnaire…</div></main>'
if html.count(loading) != 1:
    raise SystemExit('Le conteneur principal de dist/index.html a changé : adapter la présentation sans JavaScript.')
html = html.replace(loading, loading.replace('</main>', noscript + '</main>'))
html = html.replace('</head>', '  <noscript><style>.loading{display:none}</style></noscript>\n</head>', 1)
# Le fichier autonome est à la racine du site, comme les pages statiques : il n'a pas besoin de remonter depuis dist/.
site_root = '  <meta name="site-root" content="../">\n'
if html.count(site_root) != 1:
    raise SystemExit('La balise site-root de dist/index.html a changé : adapter cet assembleur.')
html = html.replace(site_root, '')

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
(base / 'index.html').write_text(html)
print('Fichier autonome prêt : index.html')

# Pages statiques de la méthode et des axes, et plan du site, à partir des mêmes données et des mêmes fonctions de rendu.
subprocess.run(['node', str(base / 'scripts' / 'build-pages.mjs')], check=True)
