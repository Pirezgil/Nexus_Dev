import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config, validateConfig } from './utils/config';
import { logger } from './utils/logger';
import { connectDatabase } from './utils/database';
import { connectRedis } from './utils/redis';
import { errorHandler, notFoundHandler } from './middleware/error';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import healthRoutes from './routes/healthRoutes';
import companyRoutes from './routes/companyRoutes';

// Create Express application
const app: Application = express();

/**
 * Security Middleware
 */
// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting (disabled in development)
const isDevelopment = config.nodeEnv === 'development';

if (!isDevelopment) {
  const globalRateLimit = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
      success: false,
      error: 'Too Many Requests',
      message: 'Muitas requisições. Tente novamente mais tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(globalRateLimit);
  console.log('🔒 Rate limiting enabled for production');
} else {
  console.log('🚀 Rate limiting disabled in development mode');
}

/**
 * General Middleware
 */
// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Trust proxy (for accurate IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      companyId: (req as any).user?.companyId,
    };

    if (res.statusCode >= 400) {
      logger.error('HTTP Request Error', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
});

/**
 * Static Files - Serve uploaded files
 */
// Create uploads directory if it doesn't exist
import fs from 'fs';
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory:', uploadsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));
logger.info('Static file server configured for /uploads');

/**
 * API Routes
 */
app.use('/health', healthRoutes);
// Validation routes temporarily disabled for infrastructure setup
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/api/companies', companyRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Nexus ERP - User Management Module API',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/auth',
      users: '/users',
    },
  });
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'User Management API',
      version: '1.0.0',
      description: 'JWT multi-tenant authentication system for Nexus ERP',
      endpoints: {
        authentication: {
          login: 'POST /auth/login',
          logout: 'POST /auth/logout',
          refresh: 'POST /auth/refresh',
          register: 'POST /auth/register',
          forgotPassword: 'POST /auth/forgot-password',
          resetPassword: 'POST /auth/reset-password',
          changePassword: 'POST /auth/change-password',
          validateToken: 'GET /auth/validate',
          currentUser: 'GET /auth/me',
        },
        users: {
          create: 'POST /users',
          list: 'GET /users',
          get: 'GET /users/:id',
          update: 'PUT /users/:id',
          delete: 'DELETE /users/:id',
          profile: 'GET /users/profile',
          updateProfile: 'PUT /users/profile',
          stats: 'GET /users/stats',
          search: 'GET /users/search',
          activate: 'POST /users/:id/activate',
          deactivate: 'POST /users/:id/deactivate',
          resetPassword: 'POST /users/:id/reset-password',
        },
        health: {
          check: 'GET /health',
          ready: 'GET /health/ready',
          live: 'GET /health/live',
        },
      },
    },
  });
});

/**
 * Error Handling
 */
// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

/**
 * Start Server
 */
const startServer = async (): Promise<void> => {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated successfully');

    // Connect to database
    await connectDatabase();
    
    // Connect to Redis
    await connectRedis();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 User Management Module running on port ${config.port}`, {
        port: config.port,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        processId: process.pid,
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close database connection
          const { disconnectDatabase } = await import('./utils/database');
          await disconnectDatabase();
          
          // Close Redis connection
          const { disconnectRedis } = await import('./utils/redis');
          await disconnectRedis();
          
          logger.info('All connections closed, exiting process');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', { error });
          process.exit(1);
        }
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forceful shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        promise: promise.toString(),
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

export { app, startServer };