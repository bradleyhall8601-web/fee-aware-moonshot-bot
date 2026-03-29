# Dockerfile for Fee-Aware Moonshot Bot
# Production-ready Docker image

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create data directory for database
RUN mkdir -p /data /logs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

# Start application
CMD ["node", "dist/index.js"]
