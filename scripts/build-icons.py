"""Régénère les icônes à partir des dessins de branding/ (demande rsvg-convert).

- dist/index.html : l'icône du site en data URI (SVG, PNG 32 px, PNG 180 px pour l'écran d'accueil iOS),
  pour que le fichier autonome index.html reste sans dépendance externe ;
- branding/logo-organisation.png : le logo de l'organisation GitHub, 1024 px, sur fond carré plein
  (GitHub arrondit lui-même les avatars d'organisation).

Relancer ensuite scripts/build-standalone.py.
"""
import base64
import json
import re
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

base = Path(__file__).resolve().parent.parent
icon = (base / 'branding/icon.svg').read_text()


def png(svg_text, size):
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp) / 'in.svg', Path(tmp) / 'out.png'
        src.write_text(svg_text)
        subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), str(src), '-o', str(out)], check=True)
        return out.read_bytes()


# Dans une adresse data:, « # » ouvrirait un fragment et un guillemet double fermerait l'attribut href.
compact = re.sub(r'>\s+<', '><', icon.strip()).replace('"', "'")
svg_uri = 'data:image/svg+xml,' + urllib.parse.quote(compact, safe=" =:/',.-")
links = [
    f'  <link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,{base64.b64encode(png(icon, 32)).decode()}">',
    f'  <link rel="icon" type="image/svg+xml" href="{svg_uri}">',
    f'  <link rel="apple-touch-icon" href="data:image/png;base64,{base64.b64encode(png(icon, 180)).decode()}">',
]
page = base / 'dist/index.html'
lines = [l for l in page.read_text().split('\n') if not re.match(r'\s*<link rel="(icon|apple-touch-icon)"', l)]
title = next(i for i, l in enumerate(lines) if l.strip().startswith('<title>'))
page.write_text('\n'.join(lines[:title] + links + lines[title:]))

logo = (base / 'branding/logo.svg').read_text().replace('rx="14"', 'rx="0"', 1)
(base / 'branding/logo-organisation.png').write_bytes(png(logo, 1024))

# Image de partage (Open Graph), 1200 × 630, à la racine du site publié. Ses nombres viennent des catalogues ;
# elle ne montre aucun résultat. Le rendu passe par Chrome sans interface, avec les polices du site.
questionnaire = json.loads((base / 'research/questionnaire.json').read_text())
families = json.loads((base / 'research/families.json').read_text())['families']
questions_n = sum(len(a['questions']) for a in questionnaire['axes'])
fonts = base / 'dist/fonts'
card = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
@font-face{{font-family:Plex;font-weight:400;src:url({(fonts / 'ibm-plex-sans-latin-400-normal.woff2').as_uri()})}}
@font-face{{font-family:Plex;font-weight:600;src:url({(fonts / 'ibm-plex-sans-latin-600-normal.woff2').as_uri()})}}
@font-face{{font-family:PlexMono;font-weight:500;src:url({(fonts / 'ibm-plex-mono-latin-500-normal.woff2').as_uri()})}}
html,body{{margin:0;width:1200px;height:630px;overflow:hidden}}
body{{background:#f6f1e7;font-family:Plex,sans-serif;color:#141414;display:flex;align-items:center;gap:70px;padding:0 90px;box-sizing:border-box}}
.logo{{width:290px;height:290px;flex:none}}
.tag{{display:inline-block;font-family:PlexMono,monospace;font-weight:500;font-size:22px;letter-spacing:.1em;color:#4f4636;background:#fff;border-left:5px solid #c9a571;padding:10px 18px}}
h1{{font-size:68px;line-height:1.05;letter-spacing:-.025em;font-weight:600;margin:28px 0 26px}}
h1 em{{font-style:normal;color:#5b3fa3}}
.facts{{font-family:PlexMono,monospace;font-weight:500;font-size:21px;white-space:nowrap;color:#5c6066}}
.site{{margin-top:34px;font-size:26px}}
</style></head><body>
<div class="logo">{(base / 'branding/logo.svg').read_text()}</div>
<div><span class="tag">ÉLECTION PRÉSIDENTIELLE 2027</span>
<h1>Faites le point<br><em>sur vos convictions.</em></h1>
<div class="facts">{questions_n} propositions · {len(questionnaire['axes'])} sujets · {len(families)} familles politiques</div>
<div class="site">Avant l’isoloir · presidentielle-2027.github.io</div></div>
</body></html>'''
chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
with tempfile.TemporaryDirectory() as tmp:
    page_file = Path(tmp) / 'card.html'
    page_file.write_text(card)
    shot = Path(tmp) / 'card.png'
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--window-size=1200,630', f'--screenshot={shot}', page_file.as_uri()],
                   check=True, capture_output=True)
    (base / 'og-image.png').write_bytes(shot.read_bytes())
print('Icônes régénérées : dist/index.html, branding/logo-organisation.png, og-image.png')
