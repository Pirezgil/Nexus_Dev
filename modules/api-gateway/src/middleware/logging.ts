import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface LoggingRequest extends Request {
  requestId?: string;
  user?: {
    userId: string;
    companyId: string;
    role: string;
  };
  startTime?: number;
}

/**
 * Centralized logging middleware for API Gateway
 * Logs all requests with comprehensive information
 */
export const loggingMiddleware = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  req.startTime = startTime;

  // Generate request ID if not already present
  if (!req.requestId) {
    req.requestId = Math.random().toString(36).substr(2, 9);
  }

  const requestId = req.requestId;

  // Extract request information
  const requestInfo = {
    requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    accept: req.get('Accept'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    authorization: req.get('Authorization') ? `Bearer ${req.get('Authorization')?.substring(7, 20)}...` : undefined,
    timestamp: new Date().toISOString()
  };

  // Log the incoming request
  logger.info('Incoming request:', requestInfo);

  // Override res.json to capture response
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  let responseBody: any = null;
  let responseSent = false;

  // Capture JSON responses
  res.json = function(body: any) {
    if (!responseSent) {
      responseBody = body;
      logResponse();
      responseSent = true;
    }
    return originalJson.call(this, body);
  };

  // Capture send responses
  res.send = function(body: any) {
    if (!responseSent) {
      responseBody = body;
      logResponse();
      responseSent = true;
    }
    return originalSend.call(this, body);
  };

  // Capture end responses
  res.end = function(chunk?: any) {
    if (!responseSent) {
      responseBody = chunk;
      logResponse();
      responseSent = true;
    }
    return originalEnd.call(this, chunk);
  };

  const logResponse = () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const statusCode = res.statusCode;

    const responseInfo = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      contentType: res.get('Content-Type'),
      userId: req.user?.userId,
      companyId: req.user?.companyId,
      userRole: req.user?.role,
      timestamp: new Date().toISOString()
    };

    // Determine log level based on status code
    if (statusCode >= 500) {
      logger.error('Server error response:', {
        ...responseInfo,
        errorBody: typeof responseBody === 'string' ? responseBody.substring(0, 500) : responseBody,
        stack: responseBody?.stack
      });
    } else if (statusCode >= 400) {
      logger.warn('Client error response:', {
        ...responseInfo,
        errorDetails: responseBody?.error || responseBody?.message
      });
    } else if (statusCode >= 300) {
      logger.info('Redirect response:', responseInfo);
    } else {
      logger.info('Successful response:', responseInfo);
    }

    // Log slow requests (over 2 seconds)
    if (duration > 2000) {
      logger.warn('Slow request detected:', {
        ...responseInfo,
        slowRequestAlert: true,
        threshold: '2000ms'
      });
    }

    // Log large responses (over 1MB)
    const contentLength = parseInt(res.get('Content-Length') || '0');
    if (contentLength > 1024 * 1024) {
      logger.warn('Large response detected:', {
        ...responseInfo,
        largeResponseAlert: true,
        sizeBytes: contentLength,
        sizeMB: Math.round(contentLength / (1024 * 1024) * 100) / 100
      });
    }
  };

  next();
};

/**
 * Error logging middleware
 */
export const errorLoggingMiddleware = (err: any, req: LoggingRequest, res: Response, next: NextFunction): void => {
  const requestId = req.requestId || 'unknown';
  const duration = req.startTime ? Date.now() - req.startTime : 0;

  logger.error('Request error:', {
    requestId,
    error: err.message,
    stack: err.stack,
    statusCode: err.status || err.statusCode || 500,
    method: req.method,
    path: req.path,
    duration: `${duration}ms`,
    userId: req.user?.userId,
    companyId: req.user?.companyId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  next(err);
};

/**
 * Security event logging middleware
 */
export const securityLogger = {
  logFailedAuth: (req: LoggingRequest, reason: string, additionalInfo?: any) => {
    logger.warn('Authentication failed:', {
      requestId: req.requestId,
      reason,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      ...additionalInfo
    });
  },

  logSuspiciousActivity: (req: LoggingRequest, activity: string, details?: any) => {
    logger.warn('Suspicious activity detected:', {
      requestId: req.requestId,
      activity,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      companyId: req.user?.companyId,
      timestamp: new Date().toISOString(),
      ...details
    });
  },

  logRateLimitHit: (req: LoggingRequest, limitType: string, limit: number) => {
    logger.warn('Rate limit exceeded:', {
      requestId: req.requestId,
      limitType,
      limit,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.userId,
      timestamp: new Date().toISOString()
    });
  }
};

export default loggingMiddleware;