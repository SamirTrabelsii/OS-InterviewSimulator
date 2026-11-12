# Roadmap — Le Portail

Chaque étape produit quelque chose qui **tourne et se teste** (`npm test`,
`npm run lint`, plus une vérification manuelle décrite). On ne passe à
l'étape suivante que si les critères « Terminé quand » sont remplis.

Ordre choisi : d'abord le socle et la sécurité des solutions (impossibles
à rattraper après coup), puis les épreuves de la plus simple à la plus
risquée, le temps réel en dernier, le déploiement dès qu'un parcours
complet existe. Un seul scénario (**retail**) jusqu'à l'étape 9 : les
trois autres ne sont que du contenu.

---

### Étape 0 — Socle ✅ (2026-11-10)
- Next.js (App Router) + TS + Tailwind, ESLint, Vitest.
- `server.ts` personnalisé (sans Socket.IO encore), build esbuild.
- `docker compose` (Postgres), Drizzle + première migration (tables du
  § 3.12 de ARCHITECTURE.md), `.env.example`.
- Route `GET /api/health` (vérifie la base).

**Terminé quand** : `docker compose up -d db && npm run dev` →
`/api/health` répond `ok` ; `npm test` passe (test de santé).

### Étape 1 — Contenu, graine et étanchéité des solutions ✅ (2026-11-10)
- Schémas Zod `public` / `private` pour les 4 épreuves + Portail.
- PRNG déterministe, générateur de données à partir d'une graine.
- Chargeur `server-only`, fonction `toPublic()`.
- Squelette du scénario **retail** avec chaînes canari.

**Terminé quand** : tests de déterminisme (même graine → mêmes données,
graines différentes → données différentes), validation Zod de tout
`/content`, test `toPublic()` sans champ privé, **test canari** : après
`next build`, aucun canari dans `.next/static`.

### Étape 2 — Connexion recruteur et création de créneau ✅ (2026-11-12)
- Auth.js Google, restriction de domaine (`hd` + callback `signIn`),
  règle indépendante du fournisseur (Entra ID ajouté plus tard).
- Faux fournisseur « Connexion de test » en dev (`AUTH_DEV_LOGIN=true`).
- Page recruteur : créer un créneau (scénario, solo/binôme, heure),
  obtenir les liens candidats (jeton aléatoire, hash en base).

**Terminé quand** : test unitaire du callback (domaine accepté / refusé /
email non vérifié) ; test que les routes recruteur renvoient 401 sans
session ; création de créneau manuelle OK en local.

### Étape 3 — Accès candidat, chrono serveur, journal ✅ (2026-11-12)
- `/s/<jeton>` → vérification fenêtre de validité → cookie de session.
- Démarrage : `started_at`, `deadline`, graine.
- Écran d'accueil : information « actions enregistrées, conservées
  6 mois » avant le démarrage.
- API d'événements par lots ; écran « hub » avec les 4 gemmes et le
  compte à rebours synchronisé.

**Terminé quand** : tests : jeton expiré/invalide refusé, reprise sur un
2ᵉ appareil journalisée, soumission après `deadline` refusée (horloge
simulée), événements ordonnés par `seq`.

### Étape 4 — Gemmes Quiz et Logique ✅ (2026-11-12)
- UI + validateurs serveur pour le quiz et l'énigme logique (valeurs
  issues de la graine).

**Terminé quand** : **un test Vitest par validateur** (bonne réponse,
mauvaise réponse, réponse mal formée) ; la réponse API ne contient
jamais la solution ; parcours manuel : obtenir 2 gemmes.

### Étape 5 — Bac à sable serveur ✅ (2026-11-12)
- Processus enfant : `env: {}`, `--permission`, timeout, plafond
  mémoire, sortie tronquée, processus jeté après usage, 1 processus chaud.
- Moteurs : sql.js et Pyodide (`jsglobals` minimal, pas de `fetch`).

**Terminé quand** : tests : boucle infinie tuée dans le délai,
`os.environ` vide, `import js` sans `process`/`fetch`, lecture de fichier
hors répertoire autorisé refusée, allocation mémoire excessive arrêtée,
2 exécutions successives sans état partagé.

Réalisé avec Node 26 LTS (permission réseau). Tests ajoutés : accès réseau
(urllib, sockets, `NODEFS`/`SOCKFS` via `pyodide_js`), lancement de
processus, évasion par `Function`, sortie géante, SQL en écriture ou
multi-instructions, file pleine, et un script JS hostile lancé avec les
drapeaux de l'enfant (frontière Node). Limites : ARCHITECTURE.md § 3.5.

### Étape 6 — Gemme SQL ✅ (2026-11-12)
- Monaco SQL + sql.js dans le navigateur (jeu de données visible).
- Validation serveur : requête candidat vs solution sur le jeu visible
  **et** le jeu caché.

**Terminé quand** : test du validateur (requête juste, résultat juste
mais ordre différent selon l'énoncé, requête codée en dur qui échoue sur
le jeu caché, CTE récursive infinie coupée) ; parcours manuel.

Réalisé : Monaco 0.57 (version AMD) et sql.js servis depuis
`public/vendor` (copiés par `scripts/copy-vendor.mjs`, jamais de CDN) ;
requête du navigateur dans un Web Worker arrêté après 3 s. Côté serveur,
une seule exécution dans le bac à sable passe sur les deux jeux
(`extraSetups`) ; la requête solution, code de confiance, est exécutée
dans le processus serveur (sql.js) et n'atteint jamais l'enfant. Réponse
au candidat : « X / 2 » et l'erreur de sa requête (syntaxe, délai).
Règle de gemme décidée le 2026-11-12 (ARCHITECTURE.md § 3.7).

### Étape 7 — Gemme Algo Python ✅ (2026-11-12)
- Monaco Python + Pyodide navigateur avec exemples publics.
- Tests cachés exécutés dans le bac à sable ; réponse « X / Y ».
- Instantanés de code toutes les ~5 s dans `events`.

**Terminé quand** : test du validateur (solution juste, solution fausse,
solution trop lente, tentative d'afficher les tests cachés → rien ne
fuit dans la réponse) ; parcours complet des 4 gemmes en local.

Réalisé : Pyodide 314.0.7 servi depuis `public/vendor/pyodide` (même
version que le bac à sable, `packageBaseUrl` local) dans un Web Worker de
type module, gardé chargé entre deux essais et recréé après 5 s
d'exécution. Réponse au candidat : « X / 7 » et, seulement si elle ne
dépend d'aucune entrée cachée, l'erreur de compilation ou « Temps
d'exécution dépassé ». Le détail par test (erreur, durée) est journalisé
pour le recruteur (`algo.result`). Parcours des 4 gemmes vérifié sur un
build de production local.

### Étape 8 — Portail en binôme
- Socket.IO dans `server.ts`, salle par créneau, authentification du
  socket par le cookie candidat.
- Pilote / copilote à **vues asymétriques** (pilote : code ; copilote :
  logs + contexte client), filtrées côté serveur ; « demander la main »
  échange rôles et vues. Diffusion
  du code, persistance `portal_rooms`, reconnexion.
- Ouverture du Portail dès que les 2 ont leurs 4 gemmes, au plus tard à
  T0+33 ; repli solo ; observateur
  recruteur en lecture seule.
- Validation du debug dans le bac à sable.

**Terminé quand** : tests d'intégration avec `socket.io-client` dans
Vitest : 2 clients, un seul peut écrire, passage de main, reconnexion
qui retrouve le code, un socket sans cookie valide est refusé, un
observateur ne peut pas écrire ; essai manuel à deux navigateurs.

### Étape 9 — Replay et grille recruteur
- Frise d'événements, Monaco en lecture seule, lecture/pause/vitesse.
- Grille de compétences + adéquation par profil (`evaluations`).
- Rapport final du scénario côté candidat (sans note).

**Terminé quand** : test de reconstruction de l'état à un instant `t`
depuis les événements ; test que les routes candidat ne renvoient
jamais `evaluations` ; revue d'une session réelle de bout en bout.

### Étape 10 — Déploiement Google Cloud
- `Dockerfile` multi-étapes, migrations au démarrage, `DEPLOY.md`
  (création des ressources, Secret Manager, compte de service,
  Scheduler, `gcloud run deploy --source`).
- **Aucune commande gcloud exécutée sans accord explicite.**

**Terminé quand** : image construite et lancée en local avec
`docker compose` complet ; après accord, déploiement et test de fumée
(santé, connexion recruteur, une session solo, un Portail à deux).

### Étape 11 — Scénarios ecommerce, education, hotellerie
- Contenu seul ; aucun changement du moteur attendu.

**Terminé quand** : les tests de contenu (Zod, déterminisme, canaris,
un test par validateur) passent pour les 4 scénarios.

### Étape 12 — Bip (optionnel)
- Interface `Assistant`, `FakeAssistant`, `GroqAssistant`, drapeau
  `BIP_ENABLED`, journalisation.

**Terminé quand** : tests avec `FakeAssistant` ; test que le contexte
envoyé ne contient aucun champ `private` ; désactivé → aucune requête
sortante.

### Étape 13 — Durcissement
- Limitation de débit, en-têtes de sécurité (CSP compatible Monaco et
  Pyodide), purge RGPD planifiée (6 mois), détection perte de focus (journalisée,
  jamais bloquante).

**Terminé quand** : tests de limitation de débit et de purge ; revue de
sécurité (`/security-review`) sans point bloquant.
