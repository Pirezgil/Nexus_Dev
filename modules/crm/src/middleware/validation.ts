import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../types';

/**
 * Validation middleware factory
 */
export const validate = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request data
      const validationData = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      schema.parse(validationData);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMap: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.slice(1).join('.'); // Remove 'body', 'query', or 'params' prefix
          if (!errorMap[path]) {
            errorMap[path] = [];
          }
          errorMap[path].push(err.message);
        });

        const validationError = new ValidationError('Dados de entrada inválidos', errorMap);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Body validation middleware
 */
export const validateBody = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMap: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errorMap[path]) {
            errorMap[path] = [];
          }
          errorMap[path].push(err.message);
        });

        const validationError = new ValidationError('Dados do body inválidos', errorMap);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Query validation middleware
 */
export const validateQuery = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMap: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errorMap[path]) {
            errorMap[path] = [];
          }
          errorMap[path].push(err.message);
        });

        const validationError = new ValidationError('Parâmetros de consulta inválidos', errorMap);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Params validation middleware
 */
export const validateParams = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMap: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errorMap[path]) {
            errorMap[path] = [];
          }
          errorMap[path].push(err.message);
        });

        const validationError = new ValidationError('Parâmetros da URL inválidos', errorMap);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request data
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};