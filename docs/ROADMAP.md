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

### Étape 8 — Portail en binôme ✅ (2026-11-14)
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

Réalisé : Socket.IO attaché à `server.ts` (`src/server/portal/hub.ts`,
branché sur la base et le bac à sable par `boot.ts`). Règles pures dans
`src/engine/portal.ts` (rôles, passage de main, vues). Authentification du
socket par le cookie candidat ; observateur recruteur par jeton de 5 min
émis par `/api/recruteur/creneaux/[id]/observer-token`. Sans `server-only`
côté `server.ts` (`server-only-stub.ts`) et `destroyUpgrade: false` pour ne
pas casser le rechargement à chaud de Next. Époque (`portal_rooms.epoch`) :
un ancien pilote ne peut plus écrire après un passage de main. Le copilote
peut prendre la main si le pilote est absent depuis 20 s ; une demande
expire après 30 s ; 3 s minimum entre deux exécutions. Repli solo par le
recruteur (`switchToSolo` : le partenaire retiré passe « expirée », le
créneau devient solo). Logs du copilote : journal de 6 h généré par la
graine + lignes des exemples publics à chaque exécution du pilote. Énigme
commune dérivée de la graine de la 1re session du créneau. Vérifié : 21
tests Socket.IO, validateur dans le bac à sable, essai de bout en bout sur
build de production et en dev (pilote et copilote par socket, pilote dans
le navigateur). Non fait : essai à deux navigateurs côte à côte (un seul
navigateur disponible ici).

### Étape 9 — Replay et grille recruteur ✅ (2026-11-14)
- Frise d'événements, Monaco en lecture seule, lecture/pause/vitesse.
- Grille de compétences + adéquation par profil (`evaluations`).
- Rapport final du scénario côté candidat (sans note).

**Terminé quand** : test de reconstruction de l'état à un instant `t`
depuis les événements ; test que les routes candidat ne renvoient
jamais `evaluations` ; revue d'une session réelle de bout en bout.

Réalisé : grille et profils convertis de `content/grille-et-profils.md`
en TypeScript (`content/grille/`, schéma Zod dans `src/engine/grille/`),
sans changer le sens. Adéquation pure (`src/engine/grille/adequation.ts` :
« non observé » retiré du calcul, honnêteté sous 2 → « non retenu »).
Replay pur (`src/engine/replay.ts` : `stateAt(events, t)` et `timeline`).
`src/server/grading/evaluations.ts` : l'adéquation est recalculée côté
serveur à l'enregistrement ; chaque recruteur ne relit que sa notation.
Routes `/api/recruteur/sessions/[id]/{replay,evaluation}` (401 hors domaine)
et page `/recruteur/sessions/[id]` (lien depuis le tableau de bord). Écran
de fin candidat : gemmes, durée, épilogue si le Portail est franchi, aucune
note. Test d'étanchéité : aucun fichier côté candidat ne référence
`evaluations`, la grille ou l'adéquation. Pas de migration. Non fait : revue
d'une vraie session à deux candidats, calibrage des poids (4 à 5 juniors),
relecture RH de la grille.

### Étape 9b — Interface candidat (pixel art)
Côté candidat uniquement ; le côté recruteur reste sobre et professionnel.
Références : `design/` (`reference-style.png`, maquettes hub et SQL).

Direction :
- **Plus simple** : une action par écran, HUD réduit (chrono, gemmes, Bip),
  un seul bouton principal par épreuve, Bip et indices dans un tiroir
  repliable.
- **Pixel art avancé** : monde vu de dessus, nuit, néons sombres,
  résolution pixel fixe agrandie en nombres entiers, palette limitée,
  lumières par paliers, petites animations discrètes (désactivées si
  l'utilisateur réduit les animations).
- **Lisibilité** : énoncés et code dans une police très lisible.
- **Graphismes remplaçables** : fichiers dans un dossier de sprites, pour
  passer plus tard à un pack acheté ou à un illustrateur.

Parties (une à la fois, arrêt et revue entre chaque) :
1. **Socle visuel** ✅ (2026-11-15) — palette, polices, grille pixel,
   composants (panneaux, boutons, barres, HUD), page de démonstration
   réservée au dev.
   Réalisé : `src/ui/pixel/` (jetons `tokens.css` scopés sous `.theme-night`,
   `pixel.css`, composants, tiroir, cadre à échelle entière, catalogue
   `sprites.ts` → `public/sprites/`, substituts générés par
   `scripts/make-sprites.mjs`), polices via `next/font` (Silkscreen,
   Pixelify Sans, Atkinson Hyperlegible pour les énoncés, JetBrains Mono
   pour le code), démo sur `/dev/ui` (404 en production). Aucun écran
   existant modifié ; `NightShell` n'est pas encore appliqué au parcours
   candidat (partie 2 et 3). Tests : échelle entière, contrastes AA de la
   palette, existence des sprites, page dev désactivée en production.
2. **Monde du hub** ✅ (2026-11-15) — quartier vu de dessus, bâtiments
   des 4 gemmes, Portail, personnage, déplacement, sprites remplaçables.
   Réalisé : règles pures dans `src/engine/hub/world.ts` (monde 320 × 200,
   collisions avec glissement, chemins A*, proximité des portes ; testées),
   rendu canvas dans `src/ui/pixel/world/` (décor fixe, lumières par
   paliers, gemmes flottantes, Portail à 4 emplacements, tri en profondeur),
   `HubWorld` (échelle entière, flèches/ZQSD/WASD, clic sur un bâtiment ou
   sur le sol, invite unique « Entrer · NOM », une zone cliquable et
   focalisable par bâtiment, position mémorisée au retour d'une épreuve,
   animations réduites : pas de clignotement, gemmes immobiles, trajets
   instantanés). Graphismes dans `public/sprites/world` (catalogue
   `atlas.ts`, substituts générés par `scripts/make-world-sprites.mjs`).
   Branché sur `/session` (HUD réduit : chrono, gemmes ; pas de Bip tant
   qu'il est désactivé) ; accueil et fin inchangés (partie 4). Démo :
   `/dev/hub` (404 en production).
3. **Épreuves et Portail** ✅ (2026-11-15) — quiz, SQL, algo, logique et
   binôme habillés avec les composants ; tiroir d'aide ; un bouton principal.
   Réalisé : cadre commun `StageFrame` (HUD réduit : chrono, gemmes, tiroir
   « Aide » ; titre ; énoncé ; une zone d'action), `StageShell` inchangé
   côté contenu public. Quiz : une question par écran (Suivante / Valider,
   barre d'avancement). Logique : cadenas, un bouton « Essayer ». SQL et
   Algo : Monaco au thème nuit (`CodeEditor night`), « Soumettre » principal
   et « Exécuter / Tester » secondaire, statuts « X / Y » inchangés, tables
   et exemples en rubriques repliables. Portail : `PortalClient` réécrit
   côté affichage seulement (socket, rôles et passage de main inchangés),
   un bouton principal par rôle. Le tiroir ne contient que les règles de
   l'épreuve : il n'y a ni indices ni Bip tant que le contenu et
   l'étape 12 n'existent pas (le bouton n'apparaît que s'il y a quelque
   chose à ouvrir). Côté recruteur : rien de changé (`CodeEditor` garde son
   thème clair/sombre hors `night`).
4. **Accueil et finitions** ✅ (2026-11-15) — accueil, fin, états d'erreur,
   animations, réduction des animations, passe d'accessibilité et de
   performance.
   Réalisé : layout `/session` en thème nuit (`NightShell` une seule fois,
   `error.tsx` calme avec « Réessayer »), écrans `WelcomeScreen` et
   `ReportScreen` (`Screens.tsx`) : accueil avec aperçu du quartier
   (`WorldPreview`, image fixe réutilisant le rendu du hub), règles, avis
   d'enregistrement de 6 mois conservé, un seul bouton « Commencer » ;
   rapport de fin avec le Portail ouvert ou fermé, gemmes, durée, jamais de
   note ; page d'accueil publique, `/lien-invalide` et « pas de session »
   habillés. Monde : 5 accessoires de décor (sprites remplaçables, positions
   dans `PROPS`, testées hors zones praticables), néons des distributeurs.
   Performance : au repos le canvas se redessine à 10 images/s (60 en
   déplacement) ; rien ne tourne onglet masqué (`requestAnimationFrame`).
   Accessibilité : titre caché `h1` sur le hub, libellés des zones
   cliquables, aperçus en `role="img"`, focus visibles, contrastes AA testés ;
   animations réduites (système ou interrupteur de la démo) : pas de
   clignotement, gemmes immobiles, trajets instantanés. Démos : `/dev/ui`,
   `/dev/hub`, `/dev/screens` (404 en production).

**Terminé quand** : aucun changement de logique serveur ; `npm test`,
`npm run lint`, `npm run test:build` passent ; parcours complet candidat
revu au clavier et avec « réduire les animations ».

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
