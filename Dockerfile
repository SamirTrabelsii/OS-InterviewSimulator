# Image du Portail (Cloud Run). Multi-étapes, sans sortie « standalone »
# (incompatible avec le serveur personnalisé server.ts) : voir ARCHITECTURE.md.
FROM node:26-bookworm-slim AS base
WORKDIR /app
# Utilisateur système du bac à sable : sans shell, sans dossier personnel,
# sans droit d'écriture sur /app (fichiers copiés appartenant à root).
RUN groupadd --system bac \
 && useradd --system --gid bac --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin bac

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Tests du bac à sable sous Linux (utilisateur dédié, chien de garde RSS) :
#   npm run test:sandbox:linux
FROM deps AS sandbox-test
COPY . .
ENV SANDBOX_USER=bac
CMD ["npx", "vitest", "run", "--project", "sandbox"]

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    SANDBOX_USER=bac
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY public ./public
COPY sandbox ./sandbox
COPY next.config.ts ./
# Le serveur reste root : seul root peut lancer les processus du bac à
# sable sous l'utilisateur « bac » (ARCHITECTURE.md § 3.5). Il refuse de
# démarrer le bac à sable si SANDBOX_USER est invalide.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
