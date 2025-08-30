import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { 
  AppError, 
  ValidationError, 
  UnauthorizedError, 
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ErrorResponse 
} from '../types';
import { logger } from '../utils/logger';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Erro interno do servidor';
  let errorDetails: any = undefined;

  // Log error details
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    companyId: req.user?.companyId,
  });

  // Handle different types of errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    
    if (error instanceof ValidationError) {
      errorDetails = error.errors;
    }
  } else if (error instanceof ZodError) {
    // Zod validation errors
    statusCode = 400;
    message = 'Dados de entrada inválidos';
    errorDetails = error.errors.reduce((acc, err) => {
      const path = err.path.join('.');
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(err.message);
      return acc;
    }, {} as Record<string, string[]>);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma database errors
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        statusCode = 409;
        message = 'Registro duplicado';
        const target = error.meta?.target;
        if (Array.isArray(target) && target.length > 0) {
          message = `Já existe um registro com este ${target[0]}`;
        }
        break;
      case 'P2025':
        // Record not found
        statusCode = 404;
        message = 'Registro não encontrado';
        break;
      case 'P2003':
        // Foreign key constraint violation
        statusCode = 400;
        message = 'Violação de integridade referencial';
        break;
      case 'P2014':
        // Required relation missing
        statusCode = 400;
        message = 'Relação obrigatória não encontrada';
        break;
      default:
        statusCode = 500;
        message = 'Erro de banco de dados';
    }
    
    logger.error('Prisma error', {
      code: error.code,
      meta: error.meta,
      message: error.message,
    });
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = 'Erro desconhecido do banco de dados';
    logger.error('Prisma unknown error', { error: error.message });
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Erro de validação do banco de dados';
    logger.error('Prisma validation error', { error: error.message });
  } else {
    // Generic error handling
    logger.error('Unhandled error', { 
      error: error.message, 
      stack: error.stack,
      name: error.name,
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: error.name || 'Error',
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Add validation errors if present
  if (errorDetails) {
    (errorResponse as any).errors = errorDetails;
  }

  // Don't leak sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    delete (errorResponse as any).stack;
    
    // Generic message for 500 errors in production
    if (statusCode === 500) {
      errorResponse.message = 'Erro interno do servidor';
    }
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Rota não encontrada: ${req.method} ${req.path}`);
  next(error);
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error creator
 */
export const createValidationError = (field: string, message: string): ValidationError => {
  return new ValidationError('Erro de validação', {
    [field]: [message]
  });
};

/**
 * Custom error creators
 */
export const createNotFoundError = (resource: string): NotFoundError => {
  return new NotFoundError(`${resource} não encontrado`);
};

export const createConflictError = (resource: string): ConflictError => {
  return new ConflictError(`${resource} já existe`);
};

export const createForbiddenError = (action: string): ForbiddenError => {
  return new ForbiddenError(`Você não tem permissão para ${action}`);
};

export const createUnauthorizedError = (message?: string): UnauthorizedError => {
  return new UnauthorizedError(message || 'Acesso não autorizado');
};