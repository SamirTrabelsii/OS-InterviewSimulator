# Déploiement — Le Portail (Google Cloud)

> La procédure complète (création du projet, Cloud SQL, Scheduler,
> premier `gcloud run deploy --source`, test de fumée) sera rédigée et
> validée à l'étape 10 de docs/ROADMAP.md. Ce document fixe dès maintenant
> les règles de **secrets**, de **compte de service** et de
> **dimensionnement** exigées par le bac à sable (étape 5).
>
> Aucune commande `gcloud` n'est lancée sans accord explicite : celles
> ci-dessous sont à exécuter à la main, après relecture.

## 1. Secrets

Tous les secrets vivent dans Secret Manager, préfixés `portail-`, et sont
injectés en variables d'environnement au déploiement. Aucun dans Git ni
dans l'image (voir `.dockerignore`).

| Secret Manager          | Variable d'env       | Contenu                                   |
|-------------------------|----------------------|-------------------------------------------|
| `portail-database-url`  | `DATABASE_URL`       | URL Cloud SQL avec le mot de passe        |
| `portail-auth-secret`   | `AUTH_SECRET`        | signature des sessions et cookies candidat |
| `portail-google-secret` | `AUTH_GOOGLE_SECRET` | secret du client OAuth Google Workspace   |
| `portail-groq-api-key`  | `GROQ_API_KEY`       | seulement si Bip est activé (étape 12)    |

Non secrets (variables simples) : `AUTH_GOOGLE_ID`, `RECRUITER_EMAIL_DOMAIN`,
`APP_URL`, `SANDBOX_USER` (fixé dans l'image).

## 2. Compte de service : accès secret par secret

Le service Cloud Run tourne sous un compte de service **dédié**
(`portail-run@PROJET.iam.gserviceaccount.com`) qui n'a que :

- `roles/cloudsql.client` sur le projet (connexion par socket Unix) ;
- `roles/secretmanager.secretAccessor` **sur chacun des secrets
  `portail-*` ci-dessus, et sur rien d'autre**. Jamais au niveau du projet :
  un jeton volé ne doit pas ouvrir les autres secrets du projet.

```bash
# Une liaison par secret (à répéter pour chaque secret de la table)
gcloud secrets add-iam-policy-binding portail-auth-secret \
  --member="serviceAccount:portail-run@PROJET.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Vérification : le compte ne doit apparaître dans AUCUNE liaison
# secretAccessor au niveau du projet
gcloud projects get-iam-policy PROJET \
  --flatten="bindings[].members" \
  --filter="bindings.members:portail-run@ AND bindings.role:roles/secretmanager.secretAccessor"
```

Pourquoi : le bac à sable bloque le réseau des processus candidats
(Node 26, `--permission` sans `--allow-net`), mais si ce verrou cédait, le
serveur de métadonnées donnerait le jeton de ce compte. Le droit par secret
limite alors la fuite aux secrets du portail, que la rotation ci-dessous
rend caducs à la fin de la campagne.

## 3. Rotation des secrets à la fin de chaque campagne

À faire le lendemain du dernier créneau, quand aucune session n'est en
cours (changer `AUTH_SECRET` invalide toutes les sessions et tous les liens
candidats, ce qui est voulu).

1. **`portail-auth-secret`** : nouvelle version aléatoire.
   ```bash
   openssl rand -base64 32 | gcloud secrets versions add portail-auth-secret --data-file=-
   ```
2. **Mot de passe Cloud SQL** : nouveau mot de passe pour l'utilisateur de
   l'application, puis nouvelle version de `portail-database-url`.
   ```bash
   gcloud sql users set-password portail --instance=INSTANCE --prompt-for-password
   # puis : gcloud secrets versions add portail-database-url --data-file=fichier-temporaire
   ```
3. **Secret OAuth Google** : dans la console (Identifiants > client OAuth),
   ajouter un nouveau secret, l'ajouter en version de
   `portail-google-secret`, puis supprimer l'ancien secret côté Google après
   le redéploiement.
4. **Clé Groq** (si Bip activé) : régénérer, nouvelle version, révoquer
   l'ancienne chez Groq.
5. **Redéployer** pour que la nouvelle révision lise les versions `latest`
   (Cloud Run les résout au démarrage d'une instance) :
   ```bash
   gcloud run services update portail --region=REGION
   ```
6. **Désactiver les anciennes versions** une fois la nouvelle révision
   vérifiée (`/api/health`, connexion recruteur) :
   ```bash
   gcloud secrets versions list portail-auth-secret
   gcloud secrets versions disable VERSION --secret=portail-auth-secret
   ```
7. Noter la date de rotation dans le journal de campagne.

## 4. Dimensionnement Cloud Run (bac à sable)

| Paramètre            | Valeur          | Raison                                              |
|----------------------|-----------------|-----------------------------------------------------|
| vCPU                 | **2**           | voir ci-dessous                                     |
| Mémoire              | 2 Gio           | Next ~400 Mo + 1 enfant chaud + 2 exécutions ≤ 1,2 Go |
| Facturation CPU      | à l'instance (`--no-cpu-throttling`) | le préchargement de Pyodide a lieu hors requête |
| Instances            | min 0, max 1    | état temps réel en mémoire                          |
| Délai                | 3600 s          | WebSockets                                          |

**2 vCPU recommandés.** Un processus du bac à sable occupe un cœur à 100 %
pendant le chargement de Pyodide puis pendant l'exécution (jusqu'à 5 s par
soumission Python, 2 exécutions simultanées). Les enfants tournent en
priorité minimale (`nice 19`) : sur 1 vCPU, le serveur web et Socket.IO
restent prioritaires, mais les exécutions des candidats ralentissent
d'autant (délais mesurés en temps réel, donc risque de « temps dépassé »
injuste quand le serveur est chargé) et le processus chaud met plus de temps
à se recharger. Avec 2 vCPU, une exécution et le serveur ne se disputent
plus le même cœur. Au volume visé (quelques heures actives par semaine), le
surcoût du 2ᵉ vCPU est d'environ 0,07 $ par heure active (tarif « à
l'instance », à confirmer avec le simulateur de prix GCP).

Sans `--no-cpu-throttling`, Cloud Run réduit le CPU hors requête :
le processus chaud, préparé après chaque exécution, se chargerait très
lentement. Avec `min=0`, l'instance s'arrête de toute façon hors campagne.

## 5. Image

`Dockerfile` (multi-étapes, `node:26-bookworm-slim`) :

- l'utilisateur système `bac` (sans shell, sans dossier personnel) exécute
  les processus du bac à sable ; `SANDBOX_USER=bac` ;
- le serveur reste **root** dans le conteneur : seul root peut lancer un
  processus sous un autre utilisateur (détails : ARCHITECTURE.md § 3.5) ;
- Pyodide et sql.js viennent de `node_modules` (versions exactes, empreintes
  du `package-lock.json`), jamais d'un CDN ;
- `npm run test:sandbox:linux` lance les tests du bac à sable dans ce
  conteneur (utilisateur dédié, chien de garde mémoire Linux).
