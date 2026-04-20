FROM node:20-alpine AS base
WORKDIR /app

# ─── Install deps (root workspace) ───────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN apk add --no-cache python3 make g++ && \
    npm ci --workspace=client --workspace=server

# ─── Build client ─────────────────────────────────────────────────────────────
FROM deps AS build-client
COPY client/ ./client/
RUN npm run build --workspace=client

# ─── Build server ─────────────────────────────────────────────────────────────
FROM deps AS build-server
COPY server/ ./server/
RUN npm run build --workspace=server

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY server/package*.json ./server/

RUN npm ci --workspace=server --omit=dev && \
    apk del python3 make g++

COPY --from=build-server /app/server/dist ./server/dist
COPY --from=build-client /app/client/dist ./client/dist

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/me || exit 1

CMD ["node", "server/dist/index.js"]
