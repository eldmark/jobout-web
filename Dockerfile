# syntax=docker/dockerfile:1

# ---------- dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

# ---------- desarrollo: recarga en caliente ----------
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- compilación ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- producción ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl \
 && addgroup -g 10001 jobout \
 && adduser -u 10001 -G jobout -S jobout
# `output: standalone` deja en .next/standalone solo lo que el servidor usa
COPY --from=builder --chown=jobout:jobout /app/.next/standalone ./
COPY --from=builder --chown=jobout:jobout /app/.next/static ./.next/static
COPY --from=builder --chown=jobout:jobout /app/public ./public
USER jobout
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
