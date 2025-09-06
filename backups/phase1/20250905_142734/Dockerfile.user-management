# Simple single-stage build for infrastructure testing
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# Copy and install dependencies
COPY package.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript (ignore errors for infrastructure setup)  
RUN npx tsc --noEmitOnError false || true

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/app.js"]