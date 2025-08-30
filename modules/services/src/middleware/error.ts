import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { logger, logError } from '../utils/logger';
import { ServiceError, ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError } from '../types';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error with context
  logError(error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    companyId: req.companyId,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  });

  // Handle different types of errors
  if (error instanceof ServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code || 'SERVICE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  // Handle Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    return handlePrismaError(error, req, res);
  }

  if (error instanceof PrismaClientValidationError) {
    logger.error('Prisma validation error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
  }

  // Handle syntax errors (malformed JSON, etc.)
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  }

  // Handle validation errors from express-validator or similar
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
    });
  }

  // Handle multer errors (file upload)
  if (error.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;

    switch ((error as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = 'File upload failed';
    }

    return res.status(statusCode).json({
      success: false,
      error: message,
      code: 'FILE_UPLOAD_ERROR',
    });
  }

  // Handle CORS errors
  if (error.message && error.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS error: Origin not allowed',
      code: 'CORS_ERROR',
    });
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    return res.status(408).json({
      success: false,
      error: 'Request timeout',
      code: 'REQUEST_TIMEOUT',
    });
  }

  // Handle connection errors
  if (error.message && (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ETIMEDOUT')
  )) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }

  // Default error response
  const statusCode = (error as any).statusCode || (error as any).status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && {
      stack: error.stack,
      type: error.constructor.name,
    }),
  });
};

/**
 * Handle Prisma-specific errors
 */
const handlePrismaError = (
  error: PrismaClientKnownRequestError,
  req: Request,
  res: Response
): void => {
  logger.error('Prisma error occurred', {
    code: error.code,
    message: error.message,
    meta: error.meta,
    url: req.originalUrl,
    method: req.method,
  });

  switch (error.code) {
    case 'P2000':
      // Value too long for column
      res.status(400).json({
        success: false,
        error: 'Input value is too long',
        code: 'VALUE_TOO_LONG',
        field: error.meta?.column_name,
      });
      break;

    case 'P2001':
      // Record not found
      res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
        details: error.meta?.cause,
      });
      break;

    case 'P2002':
      // Unique constraint violation
      const field = Array.isArray(error.meta?.target) 
        ? (error.meta.target as string[]).join(', ')
        : error.meta?.target;
      
      res.status(409).json({
        success: false,
        error: `Record with this ${field} already exists`,
        code: 'DUPLICATE_ENTRY',
        field,
      });
      break;

    case 'P2003':
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        error: 'Referenced record does not exist',
        code: 'FOREIGN_KEY_VIOLATION',
        field: error.meta?.field_name,
      });
      break;

    case 'P2004':
      // Constraint violation
      res.status(400).json({
        success: false,
        error: 'Database constraint violation',
        code: 'CONSTRAINT_VIOLATION',
        details: error.meta?.database_error,
      });
      break;

    case 'P2011':
      // Null constraint violation
      res.status(400).json({
        success: false,
        error: 'Required field is missing',
        code: 'NULL_CONSTRAINT_VIOLATION',
        field: error.meta?.column,
      });
      break;

    case 'P2012':
      // Missing required value
      res.status(400).json({
        success: false,
        error: 'Missing required value',
        code: 'MISSING_REQUIRED_VALUE',
        field: error.meta?.path,
      });
      break;

    case 'P2013':
      // Missing required argument
      res.status(400).json({
        success: false,
        error: 'Missing required argument',
        code: 'MISSING_REQUIRED_ARGUMENT',
        field: error.meta?.argument_name,
      });
      break;

    case 'P2014':
      // Relation violation
      res.status(400).json({
        success: false,
        error: 'Invalid relation',
        code: 'RELATION_VIOLATION',
        details: error.meta?.relation_name,
      });
      break;

    case 'P2015':
      // Related record not found
      res.status(404).json({
        success: false,
        error: 'Related record not found',
        code: 'RELATED_RECORD_NOT_FOUND',
        details: error.meta?.details,
      });
      break;

    case 'P2016':
      // Query interpretation error
      res.status(400).json({
        success: false,
        error: 'Query interpretation error',
        code: 'QUERY_INTERPRETATION_ERROR',
        details: error.meta?.details,
      });
      break;

    case 'P2017':
      // Records for relation not connected
      res.status(400).json({
        success: false,
        error: 'Records are not connected',
        code: 'RECORDS_NOT_CONNECTED',
        relation: error.meta?.relation_name,
      });
      break;

    case 'P2018':
      // Required connected records not found
      res.status(404).json({
        success: false,
        error: 'Required connected records not found',
        code: 'CONNECTED_RECORDS_NOT_FOUND',
        details: error.meta?.details,
      });
      break;

    case 'P2019':
      // Input error
      res.status(400).json({
        success: false,
        error: 'Invalid input data',
        code: 'INPUT_ERROR',
        details: error.meta?.details,
      });
      break;

    case 'P2020':
      // Value out of range
      res.status(400).json({
        success: false,
        error: 'Value out of range',
        code: 'VALUE_OUT_OF_RANGE',
        details: error.meta?.details,
      });
      break;

    case 'P2021':
      // Table does not exist
      res.status(500).json({
        success: false,
        error: 'Database schema error',
        code: 'SCHEMA_ERROR',
        table: error.meta?.table,
      });
      break;

    case 'P2022':
      // Column does not exist
      res.status(500).json({
        success: false,
        error: 'Database schema error',
        code: 'SCHEMA_ERROR',
        column: error.meta?.column,
      });
      break;

    case 'P2023':
      // Inconsistent column data
      res.status(400).json({
        success: false,
        error: 'Inconsistent column data',
        code: 'INCONSISTENT_COLUMN_DATA',
        details: error.meta?.message,
      });
      break;

    case 'P2024':
      // Connection pool timeout
      res.status(503).json({
        success: false,
        error: 'Database connection timeout',
        code: 'CONNECTION_TIMEOUT',
      });
      break;

    case 'P2025':
      // Record not found for update/delete
      res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'RECORD_NOT_FOUND',
        operation: error.meta?.cause,
      });
      break;

    default:
      // Unknown Prisma error
      res.status(500).json({
        success: false,
        error: 'Database error occurred',
        code: 'DATABASE_ERROR',
        prismaCode: error.code,
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message,
          meta: error.meta,
        }),
      });
  }
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    availableEndpoints: process.env.NODE_ENV === 'development' ? {
      health: '/api/health',
      services: '/api/services',
      professionals: '/api/professionals',
      appointments: '/api/appointments',
      reports: '/api/reports',
    } : undefined,
  });
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error boundary for specific route groups
 */
export const createErrorBoundary = (context: string) => {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Add context to the error
    logError(error, {
      context,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      companyId: req.companyId,
    });

    // Pass to main error handler
    errorHandler(error, req, res, next);
  };
};

/**
 * Validation error helper
 */
export const createValidationError = (message: string, details?: any): ValidationError => {
  return new ValidationError(message, details);
};

/**
 * Not found error helper
 */
export const createNotFoundError = (resource: string): NotFoundError => {
  return new NotFoundError(resource);
};

/**
 * Conflict error helper
 */
export const createConflictError = (message: string): ConflictError => {
  return new ConflictError(message);
};

/**
 * Unauthorized error helper
 */
export const createUnauthorizedError = (message?: string): UnauthorizedError => {
  return new UnauthorizedError(message);
};

/**
 * Forbidden error helper
 */
export const createForbiddenError = (message?: string): ForbiddenError => {
  return new ForbiddenError(message);
};

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createErrorBoundary,
  createValidationError,
  createNotFoundError,
  createConflictError,
  createUnauthorizedError,
  createForbiddenError,
};