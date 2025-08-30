/**
 * Middleware de validação
 * Validações customizadas e helpers para requisições
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';
import { ApiResponse, ErrorCode } from '../types';
import { logger } from '../utils/logger';

// Middleware genérico para validação com Zod
export const validateSchema = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      schema.parse(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dados de entrada inválidos',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
              received: err.received
            }))
          }
        };
        return res.status(400).json(response);
      }
      next(error);
    }
  };
};

// Validações específicas para agendamentos
export const validateAppointmentData = (req: Request, res: Response, next: NextFunction) => {
  const { appointment_date, appointment_time, professional_id, service_id, customer_id } = req.body;

  const errors: string[] = [];

  // Validar data (não pode ser no passado)
  if (appointment_date) {
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      errors.push('Data do agendamento não pode ser no passado');
    }
  }

  // Validar horário (formato HH:MM)
  if (appointment_time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(appointment_time)) {
      errors.push('Horário deve estar no formato HH:MM');
    }
  }

  // Validar UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (professional_id && !uuidRegex.test(professional_id)) {
    errors.push('ID do profissional inválido');
  }
  
  if (service_id && !uuidRegex.test(service_id)) {
    errors.push('ID do serviço inválido');
  }
  
  if (customer_id && !uuidRegex.test(customer_id)) {
    errors.push('ID do cliente inválido');
  }

  if (errors.length > 0) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Dados inválidos para agendamento',
        details: errors
      }
    };
    return res.status(400).json(response);
  }

  next();
};

// Validar período de datas para relatórios
export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'start_date e end_date são obrigatórios'
      }
    };
    return res.status(400).json(response);
  }

  const startDate = new Date(start_date as string);
  const endDate = new Date(end_date as string);

  const errors: string[] = [];

  // Validar se são datas válidas
  if (isNaN(startDate.getTime())) {
    errors.push('start_date deve ser uma data válida (YYYY-MM-DD)');
  }
  
  if (isNaN(endDate.getTime())) {
    errors.push('end_date deve ser uma data válida (YYYY-MM-DD)');
  }

  // Validar se data final é posterior à inicial
  if (startDate && endDate && endDate < startDate) {
    errors.push('end_date deve ser posterior ou igual a start_date');
  }

  // Validar se período não é muito longo (máximo 1 ano)
  if (startDate && endDate) {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) {
      errors.push('Período não pode ser superior a 365 dias');
    }
  }

  if (errors.length > 0) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Período de datas inválido',
        details: errors
      }
    };
    return res.status(400).json(response);
  }

  next();
};

// Validar paginação
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;

  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'page deve ser um número maior que 0'
      }
    };
    return res.status(400).json(response);
  }

  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'limit deve ser um número entre 1 e 100'
      }
    };
    return res.status(400).json(response);
  }

  next();
};

// Sanitizar entrada de strings
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    // Remove caracteres perigosos básicos
    return str
      .trim()
      .replace(/[<>'"]/g, '') // Remove HTML/JS básico
      .substring(0, 1000); // Limita tamanho
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitizar body, query e params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Rate limiting específico para criação de agendamentos
const appointmentCreationAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const rateLimit = (maxAttempts: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = (req as any).user?.id || req.ip;
    const now = Date.now();
    
    const attempts = appointmentCreationAttempts.get(identifier);
    
    if (attempts) {
      // Reset window se passou o tempo
      if (now - attempts.lastAttempt > windowMs) {
        appointmentCreationAttempts.set(identifier, { count: 1, lastAttempt: now });
      } else if (attempts.count >= maxAttempts) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas - tente novamente mais tarde'
          }
        };
        return res.status(429).json(response);
      } else {
        attempts.count++;
        attempts.lastAttempt = now;
      }
    } else {
      appointmentCreationAttempts.set(identifier, { count: 1, lastAttempt: now });
    }

    // Cleanup old entries periodicamente
    if (Math.random() < 0.1) {
      for (const [key, value] of appointmentCreationAttempts.entries()) {
        if (now - value.lastAttempt > windowMs * 2) {
          appointmentCreationAttempts.delete(key);
        }
      }
    }

    next();
  };
};

// Validar horário comercial
export const validateBusinessHours = (req: Request, res: Response, next: NextFunction) => {
  const { appointment_time } = req.body;
  
  if (appointment_time) {
    const [hours, minutes] = appointment_time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Horário comercial típico: 8:00 - 18:00
    const startMinutes = 8 * 60; // 8:00
    const endMinutes = 18 * 60;  // 18:00
    
    if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.OUTSIDE_BUSINESS_HOURS,
          message: 'Horário fora do funcionamento comercial (8:00 - 18:00)'
        }
      };
      return res.status(400).json(response);
    }
  }
  
  next();
};

// Schemas Zod comuns
export const commonSchemas = {
  uuid: z.string().uuid('Deve ser um UUID válido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM'),
  pagination: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional()
  })
};

// Rate limiting functions for app.ts compatibility
export const createRateLimit = (windowMs: number, maxRequests: number) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas - tente novamente mais tarde'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};