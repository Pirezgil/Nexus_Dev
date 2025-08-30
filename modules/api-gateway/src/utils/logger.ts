import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(logColors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports based on environment
const transports: winston.transport[] = [];

// Console transport (always present)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')
  })
);

// File transports (only in production or when LOG_TO_FILE is set)
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // HTTP requests log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'requests.log'),
      format: fileFormat,
      level: 'http',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  levels: logLevels,
  format: fileFormat,
  defaultMeta: { 
    service: 'nexus-api-gateway',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  );
}

// Stream for morgan HTTP logger integration (if needed)
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

// Helper functions for structured logging
export const logHelpers = {
  // Log API Gateway events
  gatewayEvent: (event: string, data?: any) => {
    logger.info(`Gateway Event: ${event}`, { 
      event, 
      gatewayEvent: true,
      ...data 
    });
  },

  // Log service interactions
  serviceCall: (service: string, method: string, path: string, duration?: number, status?: number) => {
    logger.info(`Service Call: ${service}`, {
      service,
      method,
      path,
      duration: duration ? `${duration}ms` : undefined,
      status,
      serviceCall: true
    });
  },

  // Log authentication events
  authEvent: (event: string, userId?: string, companyId?: string, success?: boolean, reason?: string) => {
    logger.info(`Auth Event: ${event}`, {
      event,
      userId,
      companyId,
      success,
      reason,
      authEvent: true,
      timestamp: new Date().toISOString()
    });
  },

  // Log security events
  securityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) => {
    const logLevel = severity === 'critical' ? 'error' : 
                     severity === 'high' ? 'warn' : 'info';
    
    logger.log(logLevel, `Security Event: ${event}`, {
      event,
      severity,
      securityEvent: true,
      timestamp: new Date().toISOString(),
      ...details
    });
  },

  // Log performance metrics
  performanceMetric: (metric: string, value: number, unit: string, context?: any) => {
    logger.info(`Performance Metric: ${metric}`, {
      metric,
      value,
      unit,
      performanceMetric: true,
      timestamp: new Date().toISOString(),
      ...context
    });
  },

  // Log business events
  businessEvent: (event: string, entityType?: string, entityId?: string, userId?: string, companyId?: string) => {
    logger.info(`Business Event: ${event}`, {
      event,
      entityType,
      entityId,
      userId,
      companyId,
      businessEvent: true,
      timestamp: new Date().toISOString()
    });
  }
};

// Export default logger
export default logger;