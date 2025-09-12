import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { crmRoutes } from './routes/crm';
import { servicesRoutes } from './routes/services';
import { notificationsRoutes } from './routes/notifications';
import { agendamentoRoutes } from './routes/agendamento';
import { analyticsRoutes } from './routes/analytics';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import healthCheckRouter from './utils/healthCheck';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

interface GatewayError extends Error {
  status?: number;
  code?: string;
}

const app: Express = express();
const PORT = process.env.PORT || 5001;

// ==== SECURITY & MIDDLEWARE ====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));

// Parse JSON with size limit - SKIP for proxy routes to prevent body consumption
app.use((req, res, next) => {
  // Skip body parsing for proxy routes (handled by proxy middleware)
  if (req.path.startsWith('/api/services') || req.path.startsWith('/api/notifications')) {
    return next();
  }
  
  express.json({ 
    limit: '10mb',
    verify: (req: any, _res: any, buf) => {
      req.rawBody = buf;
    }
  })(req, res, next);
});

app.use((req, res, next) => {
  // Skip body parsing for proxy routes (handled by proxy middleware)
  if (req.path.startsWith('/api/services') || req.path.startsWith('/api/notifications')) {
    return next();
  }
  
  express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  })(req, res, next);
});

// CORS Configuration - Centralized for all modules
app.use(cors({
  origin: [
    'http://localhost:3000', // Frontend development
    'http://localhost:3002', // Frontend development (port 3002)
    'http://localhost:5000', // Frontend container
    process.env.FRONTEND_URL || 'http://localhost:3002',
    process.env.CORS_ORIGINS?.split(',') || []
  ].flat().filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-Company-ID',
    'X-User-ID',
    'Accept'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Response-Time']
}));

// Global Rate Limiting (disabled in development)
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 0 : 1000, // unlimited in development, 1000 in production
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request): boolean => {
    // Skip rate limiting in development environment
    return process.env.NODE_ENV === 'development';
  },
  keyGenerator: (req: Request): string => {
    // Use X-Forwarded-For if behind a proxy, otherwise use IP
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  }
});

// Only apply rate limiting in production
if (process.env.NODE_ENV !== 'development') {
  app.use(globalRateLimit);
} else {
  console.log('🚀 Rate limiting disabled in development mode');
}

// Request logging middleware
app.use(loggingMiddleware);

// Add request ID for tracing
app.use((req: any, res: Response, next: NextFunction) => {
  req.requestId = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ==== HEALTH CHECK (Public - No Auth) ====
app.use('/health', healthCheckRouter);

// Basic ping endpoint
app.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// ==== PUBLIC ROUTES (No Authentication) ====
app.use('/api/auth', authRoutes);

// ==== PROTECTED ROUTES (Require Authentication) ====
// Services and notifications routes handle authentication via proxy middleware
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/crm', authMiddleware, crmRoutes);
app.use('/api/services', servicesRoutes);  // Auth handled in proxy middleware
app.use('/api/professionals', servicesRoutes);  // Professionals also handled by services module
app.use('/api/notifications', notificationsRoutes);  // Auth handled in proxy middleware
app.use('/api/agendamento', authMiddleware, agendamentoRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

// ==== GLOBAL ERROR HANDLING ====
app.use((err: GatewayError, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).requestId;
  
  logger.error('API Gateway Error:', {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Service unavailable errors
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      requestId
    });
  }

  // Timeout errors
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Service timeout',
      code: 'GATEWAY_TIMEOUT',
      requestId
    });
  }

  // Authentication errors
  if (err.status === 401) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      requestId
    });
  }

  // Authorization errors
  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
      requestId
    });
  }

  // Default error
  const status = err.status || 500;
  return res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : err.message,
    code: err.code || 'GATEWAY_ERROR',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 Handler - Must be last
app.use('*', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  logger.warn('Route not found:', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    requestId
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    requestId,
    availableRoutes: [
      'GET /health - Health check',
      'GET /ping - Gateway status',
      'POST /api/auth/* - Authentication routes',
      'GET|POST|PUT|DELETE /api/users/* - User management routes (auth required)',
      'GET|POST|PUT|DELETE /api/crm/* - CRM routes (auth required)',
      'GET|POST|PUT|DELETE /api/services/* - Services routes (auth required)',
      'GET|POST|PUT|DELETE /api/professionals/* - Professionals routes (auth required)',
      'GET|POST|PUT|DELETE /api/notifications/* - Notifications routes (auth required)',
      'GET|POST|PUT|DELETE /api/agendamento/* - Scheduling routes (auth required)',
      'GET /api/analytics/* - Analytics routes (auth required)'
    ]
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 API Gateway shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 API Gateway terminated');
  process.exit(0);
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`🌐 API Gateway running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    routes: {
      userManagement: process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000',
      crm: process.env.CRM_URL || 'http://nexus-crm:3000',
      services: process.env.SERVICES_URL || 'http://nexus-services:3000',
      notifications: process.env.NOTIFICATIONS_URL || 'http://nexus-notifications:5006',
      agendamento: process.env.AGENDAMENTO_URL || 'http://nexus-agendamento:3000'
    }
  });

  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log(`📍 Available routes:`);
  console.log(`   - /health → Health check`);
  console.log(`   - /api/auth/* → User Management (${process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000'})`);
  console.log(`   - /api/users/* → User Management (${process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000'})`);
  console.log(`   - /api/crm/* → CRM (${process.env.CRM_URL || 'http://nexus-crm:3000'})`);
  console.log(`   - /api/services/* → Services (${process.env.SERVICES_URL || 'http://nexus-services:3000'})`);
  console.log(`   - /api/professionals/* → Services (${process.env.SERVICES_URL || 'http://nexus-services:3000'})`);
  console.log(`   - /api/notifications/* → Notifications (${process.env.NOTIFICATIONS_URL || 'http://nexus-notifications:5006'})`);
  console.log(`   - /api/agendamento/* → Agendamento (${process.env.AGENDAMENTO_URL || 'http://nexus-agendamento:3000'})`);
});

export default app;