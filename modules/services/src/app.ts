import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { config } from './utils/config';
import { logger, requestLogger } from './utils/logger';
import { initializeRedis } from './utils/redis';
import { errorHandler, notFoundHandler } from './middleware/error';
import { rateLimitMiddleware, sanitizeInput } from './middleware/validation';
import routes from './routes';

// Import Prisma client to ensure database connection
import { prisma } from './utils/database';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Trust proxy (important for rate limiting and IP detection)
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // In development, allow localhost on any port
        if (config.nodeEnv === 'development' && origin.includes('localhost')) {
          return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Company-ID',
        'X-User-ID',
        'Accept',
        'Origin'
      ],
      optionsSuccessStatus: 200, // Support legacy browsers
    }));

    // Compression middleware
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024 // Only compress if size > 1KB
    }));

    // Static files middleware - serve uploaded files
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: config.nodeEnv === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true,
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '50mb', // Large limit for photo uploads
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '50mb',
      parameterLimit: 1000
    }));

    // Input sanitization middleware
    this.app.use(sanitizeInput);

    // Rate limiting middleware
    this.app.use(rateLimitMiddleware);

    // Request logging middleware
    this.app.use(requestLogger);

    // Response time middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.originalUrl,
            duration: `${duration}ms`,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          });
        }
      });
      
      next();
    });

    // Health check headers middleware
    this.app.use('/health', (req, res, next) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Root health check route
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        data: {
          service: 'Nexus Services',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          environment: config.nodeEnv,
          port: config.port,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
          },
        },
        message: 'Nexus Services module is running successfully',
      });
    });

    // API routes with prefix
    this.app.use('/api', routes);
    
    // REMOVIDO: Alternative root route (causava conflitos)
    // this.app.use(routes);
  }

  private initializeErrorHandling(): void {
    // 404 handler for unmatched routes
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Initialize Redis connection
      await initializeRedis();
      logger.info('Services: Redis connection established');

      // Test database connection
      await prisma.$connect();
      logger.info('Services: Database connection established');

      // Create uploads directory if it doesn't exist
      const fs = require('fs-extra');
      await fs.ensureDir(config.uploadPath);
      logger.info('Services: Upload directory ensured', { path: config.uploadPath });

      // Start the server
      this.app.listen(config.port, () => {
        logger.info(`🚀 Services module started successfully`, {
          service: 'nexus-services',
          environment: config.nodeEnv,
          port: config.port,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          uptime: process.uptime(),
        });

        // Log available endpoints in development
        if (config.nodeEnv === 'development') {
          logger.info('Available API endpoints:', {
            root: `http://localhost:${config.port}/`,
            health: `http://localhost:${config.port}/api/health`,
            services: {
              list: `GET http://localhost:${config.port}/api/services`,
              create: `POST http://localhost:${config.port}/api/services`,
              get: `GET http://localhost:${config.port}/api/services/:id`,
              update: `PUT http://localhost:${config.port}/api/services/:id`,
              delete: `DELETE http://localhost:${config.port}/api/services/:id`,
            },
            professionals: {
              list: `GET http://localhost:${config.port}/api/professionals`,
              create: `POST http://localhost:${config.port}/api/professionals`,
              get: `GET http://localhost:${config.port}/api/professionals/:id`,
              update: `PUT http://localhost:${config.port}/api/professionals/:id`,
              delete: `DELETE http://localhost:${config.port}/api/professionals/:id`,
            },
            appointments: {
              completed: `GET http://localhost:${config.port}/api/appointments/completed`,
              create: `POST http://localhost:${config.port}/api/appointments/completed`,
              photos: `POST http://localhost:${config.port}/api/appointments/:id/photos`,
            },
            reports: {
              daily: `GET http://localhost:${config.port}/api/reports/daily`,
              professional: `GET http://localhost:${config.port}/api/reports/professional/:id`,
            },
            integrations: {
              customers: `GET http://localhost:${config.port}/api/customers/:id`,
              notes: `POST http://localhost:${config.port}/api/customers/:id/notes`,
            },
            uploads: `http://localhost:${config.port}/uploads/`,
          });
        }
      });

    } catch (error) {
      logger.error('Services: Failed to start module', { error });
      process.exit(1);
    }
  }

  public getApp(): Application {
    return this.app;
  }

  public async stop(): Promise<void> {
    try {
      logger.info('Services: Stopping module...');
      
      // Close database connection
      await prisma.$disconnect();
      logger.info('Services: Database connection closed');

      logger.info('Services: Module stopped successfully');
    } catch (error) {
      logger.error('Services: Error stopping module', { error });
      throw error;
    }
  }
}

// Create and export app instance
const app = new App();

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  logger.info(`Services: Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop the application
    await app.stop();
    
    logger.info('Services: Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Services: Error during graceful shutdown', { error });
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Services: Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Services: Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Export app for testing and external use
export default app;

// Start the application if this file is executed directly
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('Services: Failed to start application', { error });
    process.exit(1);
  });
}