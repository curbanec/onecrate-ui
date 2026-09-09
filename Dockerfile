# syntax=docker/dockerfile:1

# Next 16 requires Node >= 20.9. On 22 (current LTS) rather than the trading
# bot's 20 for the longer support window; nothing here depends on the difference.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Turbopack writes a lot; keep telemetry out of a build that runs in CI.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Container Apps probes and routes to this port.
ENV PORT=3000
# Bind all interfaces — the default localhost bind is unreachable from outside
# the container, which presents as an ingress that never becomes healthy.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` emits a server bundle with only the traced dependencies.
# The static assets and public dir are not part of it and are copied separately.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
