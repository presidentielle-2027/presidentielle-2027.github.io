"""Régénère les icônes à partir des dessins de branding/ (demande rsvg-convert).

- dist/index.html : l'icône du site en data URI (SVG, PNG 32 px, PNG 180 px pour l'écran d'accueil iOS),
  pour que le fichier autonome index.html reste sans dépendance externe ;
- branding/logo-organisation.png : le logo de l'organisation GitHub, 1024 px, sur fond carré plein
  (GitHub arrondit lui-même les avatars d'organisation).

Relancer ensuite scripts/build-standalone.py.
"""
import base64
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
print('Icônes régénérées : dist/index.html, branding/logo-organisation.png')
