# Avant l'isoloir — consignes de travail

Outil civique neutre pour la présidentielle 2027 : 72 propositions, 18 axes, comparaison à des familles d'idées. Il décrit des positions et ne donne aucune consigne de vote. Tout texte affiché doit rester descriptif et neutre.

## Architecture

- `research/` : catalogues sources, en JSON. `questionnaire.json` (thèmes, axes, propositions), `families.json` (version des repères, familles, textes de référence `sources`, textes comparés `compared`), `parties.json` (critère d'inclusion, partis, statut), `references.json` (économistes, `axisHighlights`). `research/dossiers/` garde les citations et pages qui justifient les repères.
- `assemble-data.py` : vérifie la cohérence des catalogues par des `assert` et écrit `dist/data.js`. Une incohérence arrête la construction.
- `dist/engine.mjs` : calculs purs (profil, écarts, lecture des scores, seuils `READING`, `MIN_COMMON_AXES`). `dist/app.mjs` : rendu en gabarits de chaînes. `dist/styles.css` : règles sur de très longues lignes ; modifier par remplacement exact d'une règle, jamais par numéro de ligne.
- `scripts/build-standalone.py` : reconstruit `dist/data.js` puis `reperes.html` (tout intégré, sans module). Ne jamais modifier `reperes.html` ni `dist/data.js` à la main.

## Après toute modification livrée

```bash
python3 scripts/build-standalone.py
node --check dist/app.mjs
node --test tests/engine.test.mjs tests/standalone.test.mjs
```

Puis régénérer `SHA256SUMS.txt` sur sa propre liste de fichiers (ajouter tout nouveau fichier livré). Le shell est zsh : ne pas compter sur le découpage d'une variable, passer la liste par `xargs` :

```bash
L=$(mktemp) T=$(mktemp); awk '{print $2}' SHA256SUMS.txt > "$L" && xargs shasum -a 256 < "$L" > "$T" && mv "$T" SHA256SUMS.txt; rm -f "$L"
```

`tests/standalone.test.mjs` exécute `reperes.html` dans un navigateur simulé (`boot(session)`) : reconstruire avant de lancer les tests.

## Règles éditoriales

- Un repère de famille est un entier de 0 à 10, justifié par une citation exacte d'un texte officiel, vérifiée mot pour mot dans le texte téléchargé. Un axe que les textes ne tranchent pas reste non défini plutôt que deviné. Ni presse, ni réputation, ni votes comme source de position.
- Textes de référence (`sources`) : ils fixent les repères. Textes comparés (`compared`) : textes d'autres partis restés à `READING.diverge` points au plus du repère sur chaque axe vérifié ; ils ne fixent rien. Seules les comparaisons de confiance moyenne ou haute sont intégrées ; les autres portent une raison « à confirmer » dans `unmodelled`.
- Chaque parti de `parties.json` a un texte de référence, un texte comparé, ou une raison `unmodelled`. Les critères fragiles portent `toVerify`.
- Modifier, ajouter ou retirer une famille impose de changer `version` dans `families.json` (format `AAAA.M`) et de mettre à jour les nombres écrits en dur : README, balise meta de `dist/index.html`, `PROVENANCE.json`.
- `METHOD_VERSION` ne change que si le questionnaire, les calculs ou le format de session changent : elle conditionne l'import des sessions.
- Les seuils de lecture (`READING`) ont été validés par l'éditeur ; les réutiliser plutôt que d'en inventer.

## Cohérence de l'interface

- Toute liste de familles affiche le catalogue complet dans l'ordre de `familyList(ranked)` : d'abord les familles comparées, de la plus proche à la plus éloignée, puis les autres. Une famille qu'on ne peut pas comparer apparaît comme « non comparée », elle ne disparaît pas.
- Tout nombre affiché (familles, partis, économistes) est calculé à partir des catalogues.

## Vérification visuelle

Copier `dist/` dans un dossier temporaire, ajouter un `seed.js` chargé avant `data.js` qui écrit une session dans `localStorage` (clé `reperes-politique-fr-v1`), servir le dossier avec `python3 -m http.server`, puis capturer avec Chrome sans interface (`--headless=new --screenshot` ou `--print-to-pdf`). Pour une largeur de téléphone, afficher la page dans une iframe de 390 px en `position:fixed` : la fenêtre sans interface ne descend pas sous environ 500 px.

## Commits

Seulement à la demande de l'éditeur. Messages en français, au format `<type>: <description>`, qui décrivent le comportement et non le déroulement du travail, sans ligne d'attribution.
