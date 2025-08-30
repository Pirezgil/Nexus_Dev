import winston from 'winston';
import { config } from './config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

// Tell winston about the colors
winston.addColors(colors);

// Define which logs to print based on environment
const level = (): string => {
  const env = config.nodeEnv || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : config.logLevel || 'info';
};

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      // Filter out sensitive data
      const sanitizedMeta = sanitizeMetadata(meta);
      logMessage += ` ${JSON.stringify(sanitizedMeta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Sanitize sensitive information from logs
const sanitizeMetadata = (meta: any): any => {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }

  const sanitized = { ...meta };
  const sensitiveFields = [
    'password',
    'token',
    'jwt',
    'authorization',
    'cookie',
    'session',
    'secret',
    'key',
    'apikey',
    'api_key',
  ];

  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          (result as any)[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          (result as any)[key] = sanitizeObject(obj[key]);
        } else {
          (result as any)[key] = obj[key];
        }
      }
    }
    
    return result;
  };

  return sanitizeObject(sanitized);
};

// Define transports
const transports = [
  // Console transport for all environments
  new winston.transports.Console({
    format: format,
    level: level(),
  }),
];

// Add file transport for production
if (config.nodeEnv === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

// Create winston logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
  silent: config.nodeEnv === 'test',
});

// Create a custom logging interface with service context
const createServiceLogger = (service: string) => {
  return {
    error: (message: string, meta?: any) => {
      logger.error(message, { service, ...meta });
    },
    warn: (message: string, meta?: any) => {
      logger.warn(message, { service, ...meta });
    },
    info: (message: string, meta?: any) => {
      logger.info(message, { service, ...meta });
    },
    http: (message: string, meta?: any) => {
      logger.http(message, { service, ...meta });
    },
    debug: (message: string, meta?: any) => {
      logger.debug(message, { service, ...meta });
    },
  };
};

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  // Log request
  logger.http('HTTP Request Started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    contentType: req.get('Content-Type'),
    userId: req.user?.id,
    companyId: req.companyId,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const contentLength = res.get('Content-Length');

    logger.http('HTTP Request Completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength,
      userId: req.user?.id,
      companyId: req.companyId,
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging utility
export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Performance logging utility
export const logPerformance = (operation: string, duration: number, meta?: any) => {
  const level = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
  logger[level](`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...meta,
  });
};

// Database query logging utility
export const logDatabaseQuery = (query: string, duration: number, params?: any) => {
  logger.debug('Database Query', {
    query: query.replace(/\s+/g, ' ').trim(),
    duration: `${duration}ms`,
    params: params ? sanitizeMetadata(params) : undefined,
  });
};

// Business logic logging utility
export const logBusinessEvent = (event: string, data?: any, userId?: string, companyId?: string) => {
  logger.info(`Business Event: ${event}`, {
    event,
    data: data ? sanitizeMetadata(data) : undefined,
    userId,
    companyId,
    timestamp: new Date().toISOString(),
  });
};

// Security event logging utility
export const logSecurityEvent = (event: string, details?: any, req?: any) => {
  logger.warn(`Security Event: ${event}`, {
    event,
    details,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    userId: req?.user?.id,
    url: req?.originalUrl,
    method: req?.method,
    timestamp: new Date().toISOString(),
  });
};

// Health check logging utility
export const logHealthCheck = (service: string, status: 'healthy' | 'unhealthy', details?: any) => {
  const level = status === 'healthy' ? 'debug' : 'error';
  logger[level](`Health Check: ${service}`, {
    service,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Export default logger and utilities
export { logger, createServiceLogger };
export default logger;