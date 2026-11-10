# Le Portail — plateforme d'entretien technique gamifiée (Olivesoft)

## Objectif
Escape room de 45 min pour stagiaires PFE. Le candidat collecte 4 gemmes
(Quiz, SQL, Algo Python, Logique) puis ouvre le Portail en binôme (debug).
Pas de score visible pour le candidat. Le recruteur note une grille de
compétences après la session, à partir d'un replay.

## Scénarios (contenu dans /content)
- retail : « L'inventaire de minuit » (Maison Lumen, 40 boutiques)
- ecommerce : « La vente flash » (Kartly)
- education : « L'audit de vendredi » (Académie Nova)
- hotellerie : « Nuit complète » (Hôtels Azur)
Même structure pour tous : quiz, SQL, algo, logique, binôme, rapport final.

## Stack
- Next.js (App Router) + TypeScript + Tailwind, lancé par un serveur
  personnalisé server.ts (compilé avec esbuild) qui porte Socket.IO.
  Pas de sortie "standalone" (incompatible avec un serveur personnalisé) :
  image Docker multi-étapes avec npm ci --omit=dev
- PostgreSQL + Drizzle ORM
- Temps réel binôme : Socket.IO dans l'application
- Monaco Editor (code et SQL), sql.js (SQL dans le navigateur)
- Pyodide : côté candidat pour essayer ; côté serveur (worker avec
  délai maximum, sans accès aux secrets) pour les tests cachés
- Connexion recruteurs : Auth.js avec Google, limitée au domaine de
  l'entreprise
- Assistant IA « Bip » : optionnel, désactivé par défaut, derrière une
  interface interchangeable (Groq ; faux assistant pour les tests)

## Hébergement (Google Cloud, version économique)
- Un seul service Cloud Run "portail" : min 0, max 1 instance,
  affinité de session, timeout 3600 s (WebSockets)
- Cloud SQL PostgreSQL db-f1-micro, HDD 10 Go, une zone, sauvegardes
  automatiques, connexion intégrée Cloud Run (socket Unix)
- Cloud Scheduler : base allumée 8h-20h en semaine pendant les campagnes
- Secret Manager pour tous les secrets, injectés en variables d'env
- Compte de service dédié : Cloud SQL Client, Secret Accessor
- Déploiement : gcloud run deploy --source (voir DEPLOY.md)
- En local : docker compose avec Postgres

## Règles
- Les solutions et tests cachés ne sont JAMAIS envoyés au navigateur.
- Le chrono fait foi côté serveur.
- Chaque action du candidat est journalisée (table events) pour le replay.
- Aucun secret dans le code ni dans Git : .env.local en dev,
  Secret Manager en prod.
- Le contenu (scénarios, variantes, questions) vit dans /content,
  séparé du moteur.
- Données de session générées depuis une graine (seed) reproductible.
- Les notes et l'adéquation par profil ne sont visibles que des recruteurs.
- Textes de l'interface en français.
- Tests : Vitest pour la logique, un test par validateur d'épreuve.
- Ne jamais exécuter de commande gcloud sans accord explicite.

## Commandes
- docker compose up -d db (Postgres local) / npm run dev / npm test /
  npm run lint
- Première fois : cp .env.example .env.local puis npm run db:migrate
- Schéma modifié : npm run db:generate (migration dans /drizzle)
- Production locale : npm run build && npm start (dist/server.cjs)
- Next.js 16 : lire node_modules/next/dist/docs avant d'utiliser une API
