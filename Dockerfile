# ---- Stage 1 : récupérer timezone ----
FROM node:24.15.0-alpine AS tz
RUN apk add --no-cache tzdata

# ---- Stage final ----
FROM node:24.15.0-alpine

WORKDIR /app

# Timezone
ENV TZ=Europe/Paris

COPY --from=tz /usr/share/zoneinfo /usr/share/zoneinfo
RUN ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime \
 && echo "$TZ" > /etc/timezone

# App
COPY node_modules ./node_modules
COPY server/dist ./server/dist
COPY client/dist ./client/dist

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/index.js"]