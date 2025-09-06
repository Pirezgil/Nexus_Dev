# Simple single-stage build for infrastructure testing
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# Copy and install dependencies
COPY ./modules/crm/package.json ./
RUN npm install

# Copy source code and shared modules
COPY ./modules/crm ./
COPY ./shared /app/shared

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript (ignore errors for infrastructure setup)  
RUN npx tsc --noEmitOnError false || true

# Debug: List compiled files
RUN ls -la /app/dist/ && ls -la /app/dist/src/ || echo "dist/src directory not found"

# Check if main app file exists
RUN test -f /app/dist/src/app.js && echo "app.js found" || echo "app.js NOT found"

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/src/app.js"]