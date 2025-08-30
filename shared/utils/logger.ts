/**
 * Shared Logger utility for cross-module communication
 * Provides consistent logging across all ERP Nexus modules
 * Extended with validation, security and audit logging
 */

import winston from 'winston';
import path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(private context: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `${timestamp} [${level.toUpperCase()}] [${context || this.context}] ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/cross-module-integration.log',
          level: 'info'
        }),
        new winston.transports.File({
          filename: 'logs/cross-module-errors.log',
          level: 'error'
        })
      ]
    });
  }

  info(message: string, meta?: any) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, meta?: any) {
    this.logger.error(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, { context: this.context, ...meta });
  }
}

// Configuração base do logger
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Logger principal para uso direto
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'erp-nexus',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Logger de performance
export const performanceLogger = {
  database: (operation: string, duration: number, details?: string) => {
    logger.info('Database Operation', {
      type: 'performance',
      category: 'database',
      operation,
      duration,
      details
    });
  },
  
  api: (endpoint: string, method: string, duration: number, statusCode: number) => {
    logger.info('API Request', {
      type: 'performance',
      category: 'api',
      endpoint,
      method,
      duration,
      statusCode
    });
  },
  
  validation: (validationType: string, duration: number, success: boolean) => {
    logger.info('Validation', {
      type: 'performance',
      category: 'validation',
      validationType,
      duration,
      success
    });
  }
};

// Logger de auditoria
export const auditLogger = {
  create: (resource: string, resourceId: string, userId: string, data: any) => {
    logger.info('Resource Created', {
      type: 'audit',
      action: 'create',
      resource,
      resourceId,
      userId,
      data: JSON.stringify(data)
    });
  },
  
  update: (resource: string, resourceId: string, userId: string, changes: any) => {
    logger.info('Resource Updated', {
      type: 'audit',
      action: 'update',
      resource,
      resourceId,
      userId,
      changes: JSON.stringify(changes)
    });
  },
  
  delete: (resource: string, resourceId: string, userId: string) => {
    logger.info('Resource Deleted', {
      type: 'audit',
      action: 'delete',
      resource,
      resourceId,
      userId
    });
  }
};

export default Logger;