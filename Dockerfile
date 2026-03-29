FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ dumb-init

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create data directory for database
RUN mkdir -p /app/data /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD npm run health

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the bot
CMD ["npm", "start"]
