import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { initializeRedis } from './utils/redis';
import { errorHandler, notFoundHandler } from './middleware/error';
import { sanitizeInput } from './middleware/validation';
import { createRateLimit } from './middleware/auth';
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
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware - simplified for timeout diagnosis
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Temporarily disabled for timeout diagnosis
    // this.app.use(sanitizeInput);
    // const rateLimiter = createRateLimit(config.rateLimitWindowMs, config.rateLimitMaxRequests);
    // this.app.use(rateLimiter);

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });
      next();
    });

    // Response time middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('HTTP Response', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('content-length'),
        });
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check route (before other routes)
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        data: {
          service: 'Nexus CRM',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.nodeEnv,
        },
        message: 'Nexus CRM service is running',
      });
    });

    // API routes - temporarily disable all auth for testing
    this.app.use('/api', routes);
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
      logger.info('Redis connection established');

      // Test database connection
      await prisma.$connect();
      logger.info('Database connection established');

      // Start the server
      this.app.listen(config.port, () => {
        logger.info(`🚀 CRM Service started on port ${config.port}`, {
          environment: config.nodeEnv,
          port: config.port,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        });

        // Log available endpoints
        logger.info('Available endpoints:', {
          health: `/health`,
          api: `/api`,
          customers: `/api/customers`,
          statistics: `/api/stats`,
        });
      });

    } catch (error) {
      logger.error('Failed to start CRM service', { error });
      process.exit(1);
    }
  }

  public getApp(): Application {
    return this.app;
  }
}

// Create and export app instance
const app = new App();

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    logger.info('Database connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the application if this file is executed directly
if (require.main === module) {
  app.start();
}

export default app;