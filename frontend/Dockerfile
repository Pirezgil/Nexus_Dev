# ERP Nexus Frontend - Next.js 15
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Install dependencies
COPY package*.json ./
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Copy static files and public folder for standalone mode (after build)
RUN mkdir -p .next/standalone/.next/static && \
    mkdir -p .next/standalone/public && \
    cp -r .next/static/* .next/standalone/.next/static/ && \
    cp -r public/* .next/standalone/public/ && \
    ls -la .next/standalone/.next/static/ && \
    ls -la .next/standalone/public/

# Change working directory to standalone
WORKDIR /app/.next/standalone

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]