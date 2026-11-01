# Avant l'isoloir, par Repères — version autonome et déployable

**80 questions · 20 axes · lecture axe par axe · 11 familles politiques · 20 économistes.**

Une aide à la préparation du choix pour l'élection présidentielle de 2027. L'outil compare les réponses à onze familles d'idées, mesure un écart plutôt qu'un pourcentage de compatibilité et ne donne aucune consigne de vote.

Cette distribution fonctionne indépendamment de ChatGPT : aucun compte, aucune clé API, aucun backend applicatif et aucun abonnement ne sont nécessaires. Les réponses et les scores sont calculés dans le navigateur. Les liens vers les sources constituent des lectures facultatives.

## 1. Distribuer un fichier ouvrable directement

Ouvrir **`reperes.html`** dans un navigateur récent, par un double-clic. Ce fichier contient l'interface, les styles, les polices, les questions, les références et les calculs. Il peut être copié, envoyé ou conservé sur une clé USB. Il fonctionne sans connexion pour le questionnaire et le bilan ; les liens bibliographiques demandent une connexion.

La sauvegarde automatique dépend du stockage local autorisé par le navigateur. Pour une page ouverte en `file://`, le comportement du stockage peut varier. L'export JSON permet de conserver la session explicitement et de la réimporter. Garder le même nom et le même emplacement de fichier facilite la reprise locale ; ne pas compter sur cette sauvegarde pour transférer une session entre appareils.

## 2. Déployer sur un hébergement web

Publier **le contenu de `dist/`** dans le répertoire web de l'hébergement :

```text
index.html
styles.css
data.js
app.mjs
engine.mjs
fonts/
```

Aucune compilation ni installation de paquets n'est nécessaire : ces fichiers sont déjà prêts. Ils peuvent être servis à la racine d'un domaine ou dans un sous-répertoire ; les chemins de l'application sont relatifs.

Exemples d'URL : `https://votre-domaine.fr/` ou `https://votre-domaine.fr/reperes/`.

Le serveur doit servir les fichiers `.mjs` avec un type MIME JavaScript (`text/javascript` ou `application/javascript`). Les pages utilisent des fragments d'URL (`#questionnaire`, `#resultats`) : aucune réécriture côté serveur n'est nécessaire.

Pour essayer cette version sur votre ordinateur avec Python 3 :

```bash
cd reperes
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Ouvrir ensuite `http://localhost:8080`. Arrêter avec `Ctrl+C`. Ce serveur est destiné à l'essai local ; pour un accès durable sur Internet, publier les fichiers sur un hébergement web avec HTTPS.

**Ne pas ouvrir `dist/index.html` par double-clic** : cette version utilise des modules JavaScript qui demandent une origine HTTP(S). Pour le double-clic, utiliser `reperes.html` à la racine de l'archive.

Il est également possible de publier le seul fichier `reperes.html` sur un serveur web. La version `dist/` sépare les fichiers pour faciliter leur maintenance et leur mise en cache.

## 3. Déployer avec Docker

Une image NGINX non privilégiée et une configuration de service des modules sont fournies.

```bash
cd reperes
docker build -t reperes:2026.11 .
docker run --rm -p 127.0.0.1:8080:8080 reperes:2026.11
```

Ouvrir `http://localhost:8080`.

Ou avec Compose :

```bash
docker compose up -d --build
docker compose down
```

La configuration NGINX fournie envoie `Cache-Control: no-cache` : le navigateur revalide chaque fichier à chaque visite, si bien qu'après une mise à jour la page ne mélange pas d'anciennes données avec le nouveau code. La liaison fournie écoute uniquement sur la machine hôte. Pour un service exposé, adapter le réseau ou le reverse proxy de votre hébergement et y terminer HTTPS. L'application n'a pas de base de données ni de volume serveur à sauvegarder.

L'image de base est `nginxinc/nginx-unprivileged:stable-alpine`, issue du projet NGINX. Ce tag suit les mises à jour de sa branche ; une infrastructure exigeant des builds reproductibles peut le remplacer par le digest approuvé dans son registre.

La configuration Docker est fournie mais son exécution n'a pas été testée dans l'environnement de préparation, qui ne dispose pas de Docker.

## 4. Sauvegarde, accès et changement d'hébergement

- Chaque personne conserve ses réponses dans son navigateur. Cette distribution n'agrège pas les résultats de plusieurs personnes et n'envoie pas les réponses à un serveur.
- Pour passer de la version hébergée dans ChatGPT à cette distribution, exporter d'abord la session JSON depuis l'ancienne version, puis utiliser **Importer une session** dans la nouvelle.
- Le stockage est lié à l'origine du site. Changer de domaine ou de navigateur ne transporte pas automatiquement les réponses : utiliser l'export/import.
- Le contrôle d'accès privé de l'hébergement ChatGPT n'est pas inclus. Cette distribution n'impose pas de connexion. Pour limiter l'accès, utiliser l'authentification de l'hébergement ou du reverse proxy.

## 5. Modifier les sources

Tous les fichiers sont lisibles et modifiables, sans dépendance npm.

| Fichier | Rôle |
|---|---|
| `research/questionnaire.json` | Les quatre thèmes, les 20 axes, leurs pôles et les 80 propositions |
| `research/families.json` | La version des repères, les profils éditoriaux des onze familles, leurs coordonnées, leurs textes de référence et les textes d'autres partis comparés à leurs repères |
| `research/parties.json` | Les partis retenus selon le critère d'inclusion indiqué dans le fichier, la justification de chacun et, pour ceux dont aucun texte ne sert de référence à une famille, la raison de cette absence |
| `research/references.json` | Les vingt économistes, leurs thèses, nuances et références, et ceux mis en avant sous chaque axe |
| `research/dossiers/` | Les dossiers de sources : citations, pages et adresses qui justifient les repères d'une famille, et résultats des comparaisons de partis |
| `research/sources/` | Les copies des textes, comptes rendus et articles cités, rangées par groupe et conservées hors de Git ; seul `index.json`, versionné, donne pour chaque fichier son adresse d'origine, sa date de consultation et son empreinte SHA-256, vérifiée à l'assemblage pour chaque copie présente |
| `dist/engine.mjs` | Les calculs et la validation des imports |
| `dist/app.mjs` | Le parcours, les graphiques, les résultats et les exports |
| `dist/styles.css` | L'apparence et les adaptations mobiles |
| `dist/fonts/` | Les polices IBM Plex Sans et IBM Plex Mono (licence SIL OFL 1.1, voir `OFL.txt`), servies avec le site et intégrées en data URI dans `reperes.html` : aucune requête vers un service de polices tiers |
| `dist/index.html` | La structure de la page web |

Après modification des données, régénérer **les deux distributions** avec Python 3 :

```bash
python3 scripts/build-standalone.py
```

Le script commence par reconstruire `dist/data.js`, puis produit `reperes.html` avec exactement les mêmes données et calculs. Il n'accède pas au réseau. Ne pas modifier uniquement le HTML autonome : une reconstruction écraserait ces modifications.

Pour vérifier les calculs, Node.js récent est nécessaire uniquement au développement :

```bash
node --test tests/engine.test.mjs
node --test tests/standalone.test.mjs
node --check dist/app.mjs
```

Le script de génération vérifie aussi le nombre d'axes et de propositions, l'unicité des identifiants, les orientations des questions et la cohérence des catalogues : chaque axe appartient à un thème, chaque source de famille est décrite et renvoie, le cas échéant, à un parti du catalogue, chaque parti sert de référence à une famille ou porte la raison de son absence, et chaque économiste mis en avant sous un axe est associé à cet axe. Si le nombre de questions ou la méthode changent, adapter ces vérifications, les compteurs de l'interface et la version du questionnaire pour éviter d'importer des réponses devenues incompatibles.

Les repères des familles ont leur propre version dans `research/families.json` : `AAAA.M` pour la première version d'un mois, puis `AAAA.M.v2`, `AAAA.M.v3`… pour les révisions du même mois. Modifier une famille, en ajouter ou en retirer impose de changer cette version, affichée dans la page Méthode, dans le rapport imprimé et dans les sessions exportées. Les réponses ne dépendant pas des familles, ce changement ne rend pas les sessions existantes incompatibles.

Le test autonome exécute le script assemblé dans un environnement JavaScript simulant les événements nécessaires au parcours : il vérifie le démarrage, les 80 réponses et l'affichage des onglets du bilan, sans import ni appel réseau. Ce test ne remplace pas une vérification visuelle dans un navigateur. L'ouverture directe `file://` n'a pas pu être vérifiée dans le navigateur de préparation, dont la politique interdit ce protocole.

## 6. Méthode et périmètre

Le questionnaire et les profils des familles sont des constructions éditoriales indicatives, sans validation psychométrique ni prédiction de vote. La méthode complète, les limites, les valeurs des profils de référence et les sources restent accessibles dans l'application.

Cette archive reprend le contenu de la version publiée 2026.1, avec une identité adaptée à la présidentielle 2027 : nom, textes de l'interface et charte graphique. Les questions, les calculs, la version de méthode et le format des sessions sont inchangés ; les sessions exportées depuis la version 2026.1 restent importables. Les identifiants techniques (clé de stockage local, fichier `reperes.html`, image Docker) conservent le nom Repères. Les identifiants d'hébergement, la configuration ChatGPT, l'historique Git et toute session de répondant sont exclus. `PROVENANCE.json` identifie le commit de référence ; `SHA256SUMS.txt` permet de vérifier les fichiers livrés.

La version 2026.11 refond la présentation du bilan. Chaque score est traduit en phrase selon sa distance au milieu de l'échelle, et un bloc d'enseignements ouvre le bilan : positions les plus marquées, sujets non tranchés, famille la plus proche avec son avance, accords et écarts. Les proximités sont classées sur un graphique avec un qualificatif ; la carte à deux dimensions place les familles qui en définissent les deux coordonnées ; chaque axe est tracé comme une ligne entre ses deux pôles, à la place du radar. Les mises en garde sont regroupées dans l'encadré « Comment lire ce bilan » et l'impression produit un rapport complet, quel que soit l'onglet ouvert. Les seuils de lecture sont documentés dans la page Méthode.

Cette version organise aussi les données en catalogues vérifiés à l'assemblage : thèmes, familles, partis et économistes. Les repères des familles ont leur propre version, 2026.11 : une onzième famille, Gauche de rupture écologique, s'appuie sur les textes de La France insoumise ; le Communisme étatiste et la Droite nationale souverainiste s'appuient sur des sources plus solides ; des textes d'autres partis sont cités comme textes comparés lorsqu'ils restent proches des repères d'une famille. La page Méthode présente ces textes et le tableau des partis retenus. Les dossiers de `research/dossiers/` gardent les citations et les pages qui justifient ces choix.

Les questions, les scores des axes, la version de méthode (`reperes-fr-2026.1`) et le format des sessions sont inchangés : les sessions exportées depuis les versions précédentes restent importables. Les proximités peuvent différer, puisque les repères des familles ont évolué.

La version 2026.11.v2 des repères des familles complète l'axe Défense, qui n'était renseigné que pour deux familles. Il l'est désormais pour six : Écologie politique (1), Social-démocratie (2), Anticapitalisme émancipateur (8), Droite nationale souverainiste (9), Communisme étatiste (10) et Gauche de rupture écologique (10). Le Gaullisme social n'a plus de repère sur cet axe, faute de texte de référence qui traite des alliances militaires. Les citations sont dans `research/dossiers/defense.md`. Les questions, les calculs et le format des sessions sont inchangés.

La méthode `reperes-fr-2026.2` ajoute deux axes au thème « Écologie & souveraineté », renommé « Écologie, Europe & monde », soit 8 propositions de plus : « Effort de défense » (priorité des dépenses militaires et de la dissuasion par rapport aux autres dépenses et au désarmement) et « Soutien à un pays agressé » (livraisons d'armes, saisie des avoirs de l'agresseur, coût de l'aide, priorité au cessez-le-feu). Les 72 propositions précédentes sont reprises à l'identique : une session de la méthode `reperes-fr-2026.1`, enregistrée ou exportée, reste importable, et reprend à la première proposition sans réponse. La version 2026.11.v3 des repères des familles renseigne ces deux axes et complète l'axe Défense pour le Centre social-libéral (4), le Libéralisme progressiste (4), la Droite libérale conservatrice (6) et le Gaullisme social (8). Quand les textes de référence d'une famille ne traitent pas un sujet, des déclarations publiques datées de ses responsables, citées mot pour mot, servent de repère provisoire en attendant les programmes de 2027 ; la page Méthode les liste à part. Les citations sont dans `research/dossiers/defense.md` et `research/dossiers/politique-etrangere.md`, les copies des sources dans `research/sources/`.

La vue d'ensemble du bilan présente aussi une cible animée, « Votre position face aux familles d'idées ». Vous êtes au centre ; chaque famille comparée rejoint une distance égale à son écart moyen, avec les mêmes calculs et les mêmes seuils de lecture que la liste des proximités (cercles à 1, 2 et 3 points). Les familles sont rangées par ordre alphabétique autour du centre, pour que la direction ne suggère aucun axe gauche-droite, et les familles non comparées restent sur le pourtour. Une visite guidée met chaque famille en avant, de la plus proche à la plus éloignée, et fait glisser ses repères sur les lignes des axes en regard de vos scores ; on peut la mettre en pause, passer d'une famille à l'autre ou en choisir une au clavier. Avec le réglage système « réduire les animations », la cible s'affiche directement dans son état final. Elle n'apparaît pas dans le bilan imprimé, qui garde la liste des proximités.

Dans l'onglet Proximités, chaque carte de famille garde visibles son rang, ses axes comparés, son niveau de proximité, son écart moyen et une jauge sur une échelle commune à toutes les cartes ; le bouton « Détails » la déplie. Le corps présente d'abord ce qui vous rapproche (axes à 1 point au plus) et ce qui vous sépare le plus (écarts de plus de 2 points, tracés sur la ligne de l'axe), puis le courant en bref. Deux volets repliables distincts donnent les sources, par catégorie (textes de référence, déclarations provisoires, textes comparés), et les repères axe par axe, regroupés par thème. Le bilan imprimé déplie ces volets.

Sur la page d'accueil, l'encart « Votre futur bilan » annonce ce que le bilan apporte (positions axe par axe, écart avec chaque famille d'idées, accords et écarts expliqués) autour d'une mini-cible où les familles, sans nom, dérivent entre les cercles sans jamais se fixer : aucun résultat n'est simulé.

Sources techniques consultées pour la portabilité :

- MDN, modules JavaScript : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Projet officiel NGINX non privilégié : https://github.com/nginx/docker-nginx-unprivileged

Les règles Docker et les notes de déploiement sont des ajouts de cette distribution ; elles ne modifient ni les questions ni les scores.
