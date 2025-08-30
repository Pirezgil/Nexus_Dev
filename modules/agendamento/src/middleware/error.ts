/**
 * Middleware de tratamento de erros
 * Captura e formata erros de forma consistente
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, AppointmentError, ErrorCode } from '../types';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Mapa de códigos HTTP para erros comuns
const HTTP_STATUS_CODES = {
  [ErrorCode.APPOINTMENT_NOT_FOUND]: 404,
  [ErrorCode.CUSTOMER_NOT_FOUND]: 404,
  [ErrorCode.PROFESSIONAL_NOT_FOUND]: 404,
  [ErrorCode.SERVICE_NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.SCHEDULE_CONFLICT]: 409,
  [ErrorCode.INVALID_TIME_SLOT]: 400,
  [ErrorCode.OUTSIDE_BUSINESS_HOURS]: 400,
  [ErrorCode.PROFESSIONAL_NOT_AVAILABLE]: 409,
  [ErrorCode.INVALID_APPOINTMENT_STATUS]: 400,
  [ErrorCode.NOTIFICATION_FAILED]: 500,
  [ErrorCode.INTEGRATION_ERROR]: 502
};

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Se resposta já foi enviada, passar para próximo middleware
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let errorResponse: ApiResponse;

  // Log do erro
  logger.error('Erro capturado pelo middleware:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    user: (req as any).user?.id,
    company: (req as any).user?.company_id
  });

  if (error instanceof AppointmentError) {
    // Erros customizados do sistema
    statusCode = HTTP_STATUS_CODES[error.code] || error.statusCode;
    
    errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };

  } else if (error instanceof ZodError) {
    // Erros de validação Zod
    statusCode = 400;
    
    errorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Dados de entrada inválidos',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }
    };

  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Erros do Prisma/Banco de dados
    statusCode = 400;
    
    switch (error.code) {
      case 'P2002':
        // Violação de constraint unique
        const target = error.meta?.target as string[] || [];
        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: `Já existe um registro com estes dados: ${target.join(', ')}`,
            details: { constraint: target }
          }
        };
        break;

      case 'P2025':
        // Registro não encontrado
        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.APPOINTMENT_NOT_FOUND,
            message: 'Registro não encontrado'
          }
        };
        statusCode = 404;
        break;

      case 'P2003':
        // Violação de foreign key
        errorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Referência inválida - registro relacionado não existe'
          }
        };
        break;

      default:
        errorResponse = {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Erro de banco de dados',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          }
        };
        statusCode = 500;
    }

  } else if (error.name === 'ValidationError') {
    // Erros de validação genéricos
    statusCode = 400;
    
    errorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
        details: error.details
      }
    };

  } else if (error.name === 'UnauthorizedError' || error.status === 401) {
    // Erros de autenticação
    statusCode = 401;
    
    errorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token de autorização inválido ou expirado'
      }
    };

  } else if (error.name === 'ForbiddenError' || error.status === 403) {
    // Erros de autorização
    statusCode = 403;
    
    errorResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso negado - permissões insuficientes'
      }
    };

  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    // Erros de conexão (Redis, APIs externas)
    statusCode = 503;
    
    errorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTEGRATION_ERROR,
        message: 'Serviço temporariamente indisponível'
      }
    };

  } else if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
    // Erros de timeout
    statusCode = 504;
    
    errorResponse = {
      success: false,
      error: {
        code: 'TIMEOUT_ERROR',
        message: 'Operação expirou - tente novamente'
      }
    };

  } else {
    // Erros não tratados
    statusCode = 500;
    
    errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  // Em desenvolvimento, incluir mais detalhes
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error!.details = {
      ...errorResponse.error!.details,
      originalError: error.message,
      timestamp: new Date().toISOString()
    };
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware para capturar erros async não tratados
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para endpoints não encontrados
export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint não encontrado: ${req.method} ${req.path}`
    }
  };
  
  res.status(404).json(response);
};

// Handler para erros não capturados
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  
  // Em produção, não derrubar o processo imediatamente
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  
  // Fechar conexões gracefully
  process.exit(1);
});