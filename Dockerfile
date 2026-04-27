FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ dumb-init

# ── Stage 1: Build the React frontend ────────────────────────────────────────
FROM base AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build the TypeScript backend ────────────────────────────────────
FROM base AS backend-builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build:backend

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app

RUN apk add --no-cache dumb-init

# Copy backend production deps
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend into the location the API server expects
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Runtime directories
RUN mkdir -p /app/data /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
