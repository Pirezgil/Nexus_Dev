# Multi-stage build for production-ready API Gateway
FROM node:18-alpine AS builder

# Install system dependencies needed for build
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json ./

# Install ALL dependencies (including devDependencies needed for TypeScript compilation)
RUN npm install

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Build TypeScript - strict compilation (no ignoring errors)
RUN npx tsc

# Production stage - minimal image
FROM node:18-alpine AS production

# Install system dependencies for runtime
RUN apk add --no-cache libc6-compat openssl curl dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files
COPY package.json ./

# Install ONLY production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 5001

# Environment
ENV NODE_ENV=production
ENV PORT=5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]