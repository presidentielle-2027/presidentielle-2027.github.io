# Avant l'isoloir, par Repères — version autonome et déployable

**72 questions · 18 axes · lecture axe par axe · 10 familles politiques · 20 économistes.**

Une aide à la préparation du choix pour l'élection présidentielle de 2027. L'outil compare les réponses à dix familles d'idées, mesure un écart plutôt qu'un pourcentage de compatibilité et ne donne aucune consigne de vote.

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

La liaison fournie écoute uniquement sur la machine hôte. Pour un service exposé, adapter le réseau ou le reverse proxy de votre hébergement et y terminer HTTPS. L'application n'a pas de base de données ni de volume serveur à sauvegarder.

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
| `research/questionnaire.json` | Les quatre thèmes, les 18 axes, leurs pôles et les 72 propositions |
| `research/families.json` | La version des repères, les profils éditoriaux des dix familles, leurs coordonnées et leurs sources (titre, éditeur, type de document, parti éventuel) |
| `research/parties.json` | Les partis retenus selon le critère d'inclusion indiqué dans le fichier, la justification de chacun et, pour ceux dont aucun texte ne sert de référence à une famille, la raison de cette absence |
| `research/references.json` | Les vingt économistes, leurs thèses, nuances et références, et ceux mis en avant sous chaque axe |
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

Les repères des familles ont leur propre version, au format `AAAA.M`, dans `research/families.json`. Modifier une famille, en ajouter ou en retirer impose de changer cette version, affichée dans la page Méthode, dans le rapport imprimé et dans les sessions exportées. Les réponses ne dépendant pas des familles, ce changement ne rend pas les sessions existantes incompatibles.

Le test autonome exécute le script assemblé dans un environnement JavaScript simulant les événements nécessaires au parcours : il vérifie le démarrage, les 72 réponses et l'affichage des onglets du bilan, sans import ni appel réseau. Ce test ne remplace pas une vérification visuelle dans un navigateur. L'ouverture directe `file://` n'a pas pu être vérifiée dans le navigateur de préparation, dont la politique interdit ce protocole.

## 6. Méthode et périmètre

Le questionnaire et les profils des familles sont des constructions éditoriales indicatives, sans validation psychométrique ni prédiction de vote. La méthode complète, les limites, les valeurs des profils de référence et les sources restent accessibles dans l'application.

Cette archive reprend le contenu de la version publiée 2026.1, avec une identité adaptée à la présidentielle 2027 : nom, textes de l'interface et charte graphique. Les questions, les calculs, la version de méthode et le format des sessions sont inchangés ; les sessions exportées depuis la version 2026.1 restent importables. Les identifiants techniques (clé de stockage local, fichier `reperes.html`, image Docker) conservent le nom Repères. Les identifiants d'hébergement, la configuration ChatGPT, l'historique Git et toute session de répondant sont exclus. `PROVENANCE.json` identifie le commit de référence ; `SHA256SUMS.txt` permet de vérifier les fichiers livrés.

La version 2026.11 refond la présentation du bilan. Chaque score est traduit en phrase selon sa distance au milieu de l'échelle, et un bloc d'enseignements ouvre le bilan : positions les plus marquées, sujets non tranchés, famille la plus proche avec son avance, accords et écarts. Les proximités sont classées sur un graphique avec un qualificatif ; la carte à deux dimensions place les familles qui en définissent les deux coordonnées ; chaque axe est tracé comme une ligne entre ses deux pôles, à la place du radar. Les mises en garde sont regroupées dans l'encadré « Comment lire ce bilan » et l'impression produit un rapport complet, quel que soit l'onglet ouvert. Les seuils de lecture sont documentés dans la page Méthode. Les questions, les scores, la version de méthode (`reperes-fr-2026.1`) et le format des sessions sont inchangés : les sessions exportées depuis les versions précédentes restent importables.

Sources techniques consultées pour la portabilité :

- MDN, modules JavaScript : https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Projet officiel NGINX non privilégié : https://github.com/nginx/docker-nginx-unprivileged

Les règles Docker et les notes de déploiement sont des ajouts de cette distribution ; elles ne modifient ni les questions ni les scores.
