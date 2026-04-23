FROM node:24-alpine AS base
WORKDIR /app

# ─── Server deps (native compilation: better-sqlite3, bcrypt) ─────────────────
FROM base AS deps-server
COPY package*.json ./
COPY server/package*.json ./server/
RUN apk add --no-cache python3 make g++ && \
    npm ci --workspace=server

# ─── Client deps ──────────────────────────────────────────────────────────────
FROM base AS deps-client
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --workspace=client

# ─── Test server ──────────────────────────────────────────────────────────────
FROM deps-server AS test
COPY server/ ./server/
RUN npm test --workspace=server

# ─── Build server ─────────────────────────────────────────────────────────────
FROM test AS build-server
RUN npm run build --workspace=server

# ─── Build client ─────────────────────────────────────────────────────────────
FROM deps-client AS build-client
COPY client/ ./client/
RUN npm run build --workspace=client

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/

# Réutilise les binaires natifs déjà compilés — évite de relancer python3/make/g++
COPY --from=build-server /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build-server /app/server/dist ./server/dist
COPY --from=build-client /app/client/dist ./client/dist

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
