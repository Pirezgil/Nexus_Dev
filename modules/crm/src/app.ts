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
    // CORS PRIMEIRO - PRIORIDADE MÁXIMA para resolver problema CORS
    this.app.use(cors({
      origin: function(origin, callback) {
        console.log(`🌐 CORS Origin check: ${origin || 'no-origin'}`);
        
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost origins
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        
        // Allow any origin in development
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      exposedHeaders: ['X-Total-Count', 'Content-Range'],
      preflightContinue: false,
      optionsSuccessStatus: 200
    }));

    // Security middleware - APÓS CORS e com configuração mínima
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false
    }));

    // Compression middleware
    this.app.use(compression());

    // SIMPLIFICADO: Body parsing padrão para todas as requisições
    // O API Gateway já cuida do parsing e envia como JSON válido
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

    // Test endpoint for body parsing validation (no auth required)
    this.app.post('/api/test-body', (req, res) => {
      const isFromGateway = req.headers['x-gateway-proxy'] === 'true';
      const bodyParsed = req.headers['x-gateway-body-parsed'] === 'true';
      
      logger.info('Test body endpoint called', {
        method: req.method,
        isFromGateway,
        bodyParsed,
        hasBody: !!req.body,
        bodyType: typeof req.body,
        headers: {
          'x-gateway-proxy': req.headers['x-gateway-proxy'],
          'x-gateway-source': req.headers['x-gateway-source'],
          'x-gateway-body-parsed': req.headers['x-gateway-body-parsed']
        }
      });
      
      res.json({
        success: true,
        data: {
          receivedBody: req.body,
          isFromGateway,
          bodyParsed,
          timestamp: new Date().toISOString()
        },
        message: 'Body parsing test completed successfully'
      });
    });

    // Health check endpoint for Docker
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          service: 'Nexus CRM',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          environment: config.nodeEnv,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
          },
        },
        message: 'CRM module is healthy and ready',
      });
    });

    // ENDPOINT DE TESTE DIRETO NO APP - SEM MIDDLEWARE
    this.app.post('/api/test-direct', (req, res) => {
      res.json({
        success: true,
        message: 'Endpoint direto funcionando!',
        body: req.body,
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(([key]) => 
            key.startsWith('x-') || key === 'authorization'
          )
        ),
        timestamp: new Date().toISOString()
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