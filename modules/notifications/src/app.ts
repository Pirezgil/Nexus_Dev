import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { notificationRoutes } from './routes/notificationRoutes';
import { errorHandler } from './middleware/errorHandler';
import { healthRoutes } from './routes/healthRoutes';

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const app = express();
const PORT = config.port;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  exposedHeaders: ['X-Total-Count', 'X-Response-Time'],
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      service: 'nexus-notifications',
      environment: config.nodeEnv,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });
  });
  
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found',
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Notification service running on port ${PORT}`, {
    service: 'nexus-notifications',
    environment: config.nodeEnv,
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

export default app;