import winston from 'winston';
import { config } from './config';

/**
 * Winston logger configuration
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

/**
 * Create logger instance
 */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.nodeEnv === 'production' ? logFormat : developmentFormat,
  defaultMeta: {
    service: 'user-management',
    environment: config.nodeEnv,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: config.nodeEnv === 'test',
    }),
    
    // File transports for production
    ...(config.nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ] : []),
  ],
  
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Stream object for Morgan HTTP logging
 */
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

/**
 * Log request context
 */
export const logRequestContext = (req: any) => ({
  method: req.method,
  url: req.url,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  userId: req.user?.userId,
  companyId: req.user?.companyId,
});