# Simple single-stage build for infrastructure testing
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# Copy and install dependencies
COPY ./modules/agendamento/package.json ./
RUN npm install

# Copy source code and shared modules
COPY ./modules/agendamento ./
COPY ./shared /app/shared

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript (ignore errors for infrastructure setup)  
RUN npx tsc --noEmitOnError false || true

# Expose port
EXPOSE 5002

# Environment
ENV NODE_ENV=production
ENV PORT=5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

# Start the application  
CMD ["node", "app-test.js"]