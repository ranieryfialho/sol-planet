# Um Dockerfile, dois alvos: `web` (Next standalone) e `worker` (tsx).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/solplanet/package.json packages/solplanet/
COPY packages/whatsapp/package.json packages/whatsapp/
RUN pnpm install --frozen-lockfile

FROM deps AS src
COPY . .

FROM src AS web-build
RUN pnpm --filter @sol/web build

FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
# o standalone não leva o public (imagens, ícones): copiar à parte
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM src AS worker
ENV NODE_ENV=production
WORKDIR /app/apps/worker
USER node
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
