import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, ErrorResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Log error
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    companyId: req.user?.companyId,
  });

  // Mongoose/Prisma duplicate key error
  if (err.message.includes('duplicate key') || err.message.includes('Unique constraint')) {
    error = new AppError('Recurso já existe', 409);
  }

  // Mongoose/Prisma validation error
  if (err.name === 'ValidationError') {
    const message = 'Dados inválidos';
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token inválido', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expirado', 401);
  }

  // Prisma errors
  if (err.message.includes('P2002')) {
    error = new AppError('Recurso já existe', 409);
  }

  if (err.message.includes('P2025')) {
    error = new AppError('Recurso não encontrado', 404);
  }

  // Validation errors
  if (error instanceof ValidationError) {
    const errorResponse: ErrorResponse & { errors: Record<string, string[]> } = {
      success: false,
      error: 'Validation Error',
      message: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
      errors: error.errors,
    };

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Default error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: error.name || 'Internal Server Error',
    message: error.isOperational ? error.message : 'Algo deu errado!',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: req.url,
  };

  res.status(error.statusCode || 500).json(errorResponse);
};

/**
 * Handle 404 errors for unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Rota ${req.originalUrl} não encontrada`, 404);
  next(error);
};