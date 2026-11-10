# Le Portail

Plateforme d'entretien technique gamifiée (Olivesoft) : une escape room de
45 min où le candidat collecte 4 gemmes (Quiz, SQL, Algo Python, Logique)
puis ouvre le Portail en binôme. Le recruteur note ensuite la session à
partir d'un replay.

- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Feuille de route : [docs/ROADMAP.md](docs/ROADMAP.md)

## Démarrer en local

Prérequis : Node.js 24, Docker.

```bash
npm install
cp .env.example .env.local
docker compose up -d db
npm run db:migrate
npm run dev
```

Puis <http://localhost:3000> et <http://localhost:3000/api/health>.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (`server.ts` via tsx) |
| `npm test` | tests Vitest |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build && npm start` | build et serveur de production local |
| `npm run db:generate` | nouvelle migration après modification du schéma |
