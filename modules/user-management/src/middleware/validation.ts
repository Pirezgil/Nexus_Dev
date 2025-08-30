import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../types';

/**
 * Validation middleware factory
 * Validates request body, query, or params using Zod schema
 */
export const validate = (
  schema: ZodSchema,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[property];
      const validatedData = schema.parse(data);
      
      // Replace the original data with validated data
      (req as any)[property] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });
        
        const validationError = new ValidationError('Dados inválidos', errors);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};