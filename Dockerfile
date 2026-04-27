FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ dumb-init

# ── Stage 1: Build the TypeScript backend ────────────────────────────────────
FROM base AS backend-builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build:backend

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache dumb-init

# Copy backend production deps
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist

# Copy public pages
COPY public ./public

# Runtime directories
RUN mkdir -p /app/data /app/logs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
