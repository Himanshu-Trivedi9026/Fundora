# Fundora — Production Dockerfile
# Multi-stage build: deps → build → production runtime

# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts

# ============================================================
# Stage 2: Build application
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .

ENV NEXT_PUBLIC_BUILD_ENV=production
ENV NODE_ENV=production

RUN npm run build

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js* ./next.config.js

# Copy health check scripts
COPY deploy/docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh && \
    chown nextjs:nodejs /usr/local/bin/healthcheck.sh

USER nextjs

# Node.js optimizations for production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD healthcheck.sh

CMD ["node_modules/.bin/next", "start"]
