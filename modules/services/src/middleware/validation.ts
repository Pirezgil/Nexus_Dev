import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z, ZodSchema, ZodError } from 'zod';
// Simple sanitization without DOMPurify for now
const simpleSanitize = (str: any, options?: any): string => {
  if (typeof str !== 'string') return str;
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
};
import { config } from '../utils/config';
import { logger, logSecurityEvent } from '../utils/logger';
import { cacheService } from '../utils/redis';
import { ValidationError, ServiceError } from '../types';

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logSecurityEvent('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(config.rateLimitWindowMs / 1000),
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  keyGenerator: (req: Request) => {
    // Use IP + User ID if authenticated, otherwise just IP
    const baseKey = req.ip || 'unknown';
    const userKey = req.user?.id ? `:${req.user.id}` : '';
    return `${baseKey}${userKey}`;
  },
});

/**
 * Custom rate limit using Redis
 */
export const customRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
      const windowSeconds = Math.round(options.windowMs / 1000);
      
      const result = await cacheService.incrementRateLimit(key, windowSeconds, options.max);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.max.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });

      if (!result.allowed) {
        logSecurityEvent('Custom rate limit exceeded', {
          key,
          limit: options.max,
          window: windowSeconds,
          url: req.originalUrl,
          method: req.method,
        });

        return res.status(429).json({
          success: false,
          error: options.message || 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      next();
    } catch (error) {
      logger.error('Custom rate limit error', { error });
      // Continue on error to avoid blocking legitimate requests
      next();
    }
  };
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error', { error });
    next(error);
  }
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return simpleSanitize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitize key name
        const sanitizedKey = simpleSanitize(key);
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Zod validation middleware factory
 */
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: Record<string, any> = {};

      // Validate request body
      if (schema.body) {
        try {
          req.body = schema.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.body = formatZodError(error);
          } else {
            errors.body = { message: 'Invalid request body format' };
          }
        }
      }

      // Validate query parameters
      if (schema.query) {
        try {
          req.query = schema.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.query = formatZodError(error);
          } else {
            errors.query = { message: 'Invalid query parameters format' };
          }
        }
      }

      // Validate URL parameters
      if (schema.params) {
        try {
          req.params = schema.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.params = formatZodError(error);
          } else {
            errors.params = { message: 'Invalid URL parameters format' };
          }
        }
      }

      // If there are validation errors, return them
      if (Object.keys(errors).length > 0) {
        logger.warn('Validation failed', {
          errors,
          url: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
          ip: req.ip,
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        });
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error during validation',
        code: 'VALIDATION_INTERNAL_ERROR',
      });
    }
  };
};

/**
 * Format Zod validation errors
 */
const formatZodError = (error: ZodError): any => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });

  return {
    message: 'Validation failed',
    errors: formattedErrors,
  };
};

/**
 * Request size limit middleware
 */
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeInMB = parseFloat(maxSize.replace('mb', ''));
      
      if (sizeInMB > maxSizeInMB) {
        logSecurityEvent('Request size limit exceeded', {
          contentLength,
          maxSize,
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
        });

        return res.status(413).json({
          success: false,
          error: `Request body too large. Maximum size: ${maxSize}`,
          code: 'PAYLOAD_TOO_LARGE',
        });
      }
    }

    next();
  };
};

/**
 * SQL injection protection middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const suspiciousPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
      /('|"|;|--|\*|\?|\||&|\$|<|>|\[|\]|\{|\}|\(|\))/,
      /(script|javascript|vbscript|onload|onerror|onclick)/i,
      /(\bOR\b|\bAND\b)\s+\w+\s*=\s*\w+/i,
      /\b(exec|execute|sp_|xp_)\b/i,
    ];

    const checkForSuspiciousInput = (obj: any, path: string = ''): boolean => {
      if (typeof obj === 'string') {
        return suspiciousPatterns.some(pattern => pattern.test(obj));
      }

      if (Array.isArray(obj)) {
        return obj.some((item, index) => checkForSuspiciousInput(item, `${path}[${index}]`));
      }

      if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).some(key => 
          checkForSuspiciousInput(obj[key], path ? `${path}.${key}` : key)
        );
      }

      return false;
    };

    // Check request body, query, and params
    const requestData = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    if (checkForSuspiciousInput(requestData)) {
      logSecurityEvent('Potential SQL injection attempt detected', {
        body: req.body,
        query: req.query,
        params: req.params,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid input detected',
        code: 'INVALID_INPUT',
      });
    }

    next();
  } catch (error) {
    logger.error('SQL injection protection error', { error });
    next();
  }
};

/**
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<\s*\/?\s*(script|iframe|object|embed|link|meta|style|form|input|button|select|textarea)/gi,
    ];

    const checkForXSS = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return xssPatterns.some(pattern => pattern.test(obj));
      }

      if (Array.isArray(obj)) {
        return obj.some(item => checkForXSS(item));
      }

      if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(value => checkForXSS(value));
      }

      return false;
    };

    // Check request data for XSS attempts
    const requestData = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    if (checkForXSS(requestData)) {
      logSecurityEvent('Potential XSS attempt detected', {
        body: req.body,
        query: req.query,
        params: req.params,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid content detected',
        code: 'INVALID_CONTENT',
      });
    }

    next();
  } catch (error) {
    logger.error('XSS protection error', { error });
    next();
  }
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          url: req.originalUrl,
          method: req.method,
          timeout: timeoutMs,
          ip: req.ip,
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for GET requests or requests without body
    if (req.method === 'GET' || req.method === 'HEAD' || !req.get('Content-Type')) {
      return next();
    }

    const contentType = req.get('Content-Type')?.toLowerCase() || '';
    const isValidType = allowedTypes.some(type => contentType.includes(type.toLowerCase()));

    if (!isValidType) {
      return res.status(415).json({
        success: false,
        error: `Unsupported content type. Allowed types: ${allowedTypes.join(', ')}`,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    next();
  };
};

/**
 * Pagination validation helper
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Set defaults
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Update query with validated values
    req.query = {
      ...req.query,
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    };

    next();
  } catch (error) {
    logger.error('Pagination validation error', { error });
    res.status(400).json({
      success: false,
      error: 'Invalid pagination parameters',
      code: 'INVALID_PAGINATION',
    });
  }
};

export default {
  rateLimitMiddleware,
  customRateLimit,
  sanitizeInput,
  validate,
  requestSizeLimit,
  sqlInjectionProtection,
  xssProtection,
  requestTimeout,
  validateContentType,
  validatePagination,
};