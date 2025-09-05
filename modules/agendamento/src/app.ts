import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import config, { validateCriticalConfig, logConfigSummary } from './utils/config';
// import { logger } from './utils/logger';
// import { initializeRedis } from './utils/redis';
import { errorHandler, notFoundHandler } from './middleware/error';
// import { createRateLimit, sanitizeInput } from './middleware/validation';
import routes from './routes';

// Import Prisma client to ensure database connection
import { prisma } from './utils/database';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    // this.validateConfiguration();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  // private validateConfiguration(): void {
  //   validateCriticalConfig();
  //   logConfigSummary();
  // }

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

    // CORS configuration - Allow communication with other modules
    this.app.use(cors({
      origin: [
        'http://localhost:3000', // Frontend
        'http://localhost:5001', // API Gateway
        'http://localhost:5003', // User Management
        'http://localhost:5004', // CRM
        'http://localhost:5005', // Services
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Company-ID',
        'X-User-ID',
        'X-User-Role',
        'X-Gateway-Request-ID',
        'X-Gateway-Source'
      ],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Input sanitization
    // this.app.use(sanitizeInput);

    // Rate limiting
    // const rateLimiter = createRateLimit(
    //   config.rateLimit.windowMs,
    //   config.rateLimit.maxRequests
    // );
    // this.app.use('/api', rateLimiter);

    // Request logging middleware
    this.app.use((req, res, next) => {
      console.log(`HTTP Request: ${req.method} ${req.url}`);
      next();
    });

    // Response time middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`HTTP Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    console.log('🚨 DEBUG: initializeRoutes started');
    // Health check route (before other routes)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          service: 'Nexus Agendamento',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        },
        message: 'Agendamento service is healthy',
      });
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        data: {
          service: 'Nexus Agendamento',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        },
        message: 'Nexus Agendamento service is running - Complete appointment scheduling system',
      });
    });

    // API routes padronizados (sem prefixo interno - pathRewrite remove no Gateway)
    console.log('🚨 DEBUG: About to register routes:', typeof routes);
    this.app.use('/', routes); // PADRÃO: sem prefixo interno
    console.log('🚨 DEBUG: Routes registered successfully');
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
      // await initializeRedis();
      console.log('Redis connection skipped for debugging');

      // Test database connection
      await prisma.$connect();
      console.log('✅ Database connection established');

      // Start the server
      const PORT = process.env.PORT || 5002;
      this.app.listen(PORT, () => {
        console.log(`🚀 Agendamento Service started on port ${PORT}`);
        console.log('Available endpoints:');
        console.log('  - /health');
        console.log('  - /');
        console.log('  - /api/agendamento/appointments');
        console.log('  - /api/agendamento/calendar');
        console.log('  - /api/agendamento/availability');
        console.log('  - /api/agendamento/notifications');
        console.log('  - /api/agendamento/waiting-list');
      });

    } catch (error) {
      console.error('Failed to start Agendamento service', error);
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
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database connection closed');

    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception', error.message, error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection', reason, promise);
  process.exit(1);
});

// Start the application if this file is executed directly
if (require.main === module) {
  app.start();
}

export default app;