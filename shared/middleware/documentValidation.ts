/**
 * DocumentValidation Middleware - Middleware centralizado para validação de documentos
 * 
 * Aplica validações de CPF/CNPJ, email e telefone de forma centralizada
 * Inclui sanitização e formatação automática dos dados
 */

import { Request, Response, NextFunction } from 'express';
import { DocumentValidator } from '../validators/DocumentValidator';
import { ContactValidator } from '../validators/ContactValidator';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      validatedData?: {
        cpfCnpjClean?: string;
        phoneClean?: string;
        emailClean?: string;
      };
    }
  }
}

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Middleware para validação de documentos (CPF/CNPJ)
 * Aplica validação, sanitização e formatação automática
 */
export const validateDocuments = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = [];
  
  try {
    // Inicializar objeto de dados validados
    req.validatedData = req.validatedData || {};
    
    // Validar CPF/CNPJ se fornecido
    if (req.body.cpfCnpj) {
      const documentValidation = DocumentValidator.validateDocument(req.body.cpfCnpj);
      
      if (!documentValidation.valid) {
        errors.push({
          field: 'cpfCnpj',
          message: documentValidation.error!
        });
      } else {
        // Sanitizar e formatar documento
        const cleanDoc = DocumentValidator.sanitizeDocument(req.body.cpfCnpj);
        const formattedDoc = DocumentValidator.formatDocument(cleanDoc);
        
        // Armazenar versões limpa e formatada
        req.validatedData.cpfCnpjClean = cleanDoc;
        req.body.cpfCnpj = formattedDoc;
        
        logger.debug('Documento validado e formatado', {
          original: req.body.cpfCnpj,
          clean: cleanDoc,
          formatted: formattedDoc
        });
      }
    }
    
    // Validar email se fornecido
    if (req.body.email) {
      const emailValidation = ContactValidator.validateEmail(req.body.email);
      
      if (!emailValidation.valid) {
        errors.push({
          field: 'email',
          message: emailValidation.error!
        });
      } else {
        // Sanitizar email
        const cleanEmail = ContactValidator.sanitizeEmail(req.body.email);
        req.validatedData.emailClean = cleanEmail;
        req.body.email = cleanEmail;
      }
    }
    
    // Validar telefone se fornecido
    if (req.body.phone) {
      const phoneValidation = ContactValidator.validatePhone(req.body.phone);
      
      if (!phoneValidation.valid) {
        errors.push({
          field: 'phone',
          message: phoneValidation.error!
        });
      } else {
        // Sanitizar e formatar telefone
        const cleanPhone = ContactValidator.sanitizePhone(req.body.phone);
        const formattedPhone = ContactValidator.formatPhone(cleanPhone);
        
        req.validatedData.phoneClean = cleanPhone;
        req.body.phone = formattedPhone;
      }
    }
    
    // Validar telefone secundário se fornecido
    if (req.body.secondaryPhone) {
      const phoneValidation = ContactValidator.validatePhone(req.body.secondaryPhone);
      
      if (!phoneValidation.valid) {
        errors.push({
          field: 'secondaryPhone',
          message: phoneValidation.error!
        });
      } else {
        const cleanPhone = ContactValidator.sanitizePhone(req.body.secondaryPhone);
        const formattedPhone = ContactValidator.formatPhone(cleanPhone);
        req.body.secondaryPhone = formattedPhone;
      }
    }
    
    // Se houver erros, retornar resposta de erro
    if (errors.length > 0) {
      logger.warn('Erros de validação de documentos detectados', { 
        errors, 
        body: req.body 
      });
      
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.map(err => err.message),
        fields: errors.reduce((acc, err) => {
          acc[err.field] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }
    
    logger.debug('Validação de documentos concluída com sucesso');
    next();
    
  } catch (error) {
    logger.error('Erro no middleware de validação de documentos', { error });
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno na validação de dados'
    });
  }
};

/**
 * Middleware para validação de campos únicos no banco de dados
 * @param modelName - Nome do model Prisma
 * @param fields - Campos a serem validados como únicos
 * @param prismaClient - Cliente Prisma (deve ser injetado)
 */
export const validateUniqueFields = (modelName: string, fields: string[], prismaClient: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { companyId } = req.user || {};
      const errors: ValidationError[] = [];
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado ou empresa não identificada'
        });
      }
      
      // Verificar cada campo único
      for (const field of fields) {
        if (req.body[field]) {
          // Usar versão limpa do campo se disponível
          const fieldValue = req.validatedData?.[`${field}Clean`] || req.body[field];
          
          const existing = await prismaClient[modelName].findFirst({
            where: {
              companyId,
              [field]: fieldValue,
              ...(req.params.id && { id: { not: req.params.id } }) // Excluir registro atual em updates
            }
          });
          
          if (existing) {
            const fieldDisplayName = field === 'cpfCnpj' ? 'CPF/CNPJ' : 
                                   field === 'phone' ? 'Telefone' : 
                                   field === 'email' ? 'Email' : field;
            
            errors.push({
              field,
              message: `${fieldDisplayName} já está em uso por outro registro`
            });
          }
        }
      }
      
      if (errors.length > 0) {
        logger.warn('Campos únicos duplicados detectados', { 
          errors, 
          modelName, 
          companyId 
        });
        
        return res.status(409).json({
          success: false,
          error: 'Dados duplicados',
          details: errors.map(err => err.message),
          fields: errors.reduce((acc, err) => {
            acc[err.field] = err.message;
            return acc;
          }, {} as Record<string, string>)
        });
      }
      
      logger.debug('Validação de campos únicos concluída', { modelName, fields });
      next();
      
    } catch (error) {
      logger.error('Erro na validação de campos únicos', { 
        error, 
        modelName, 
        fields 
      });
      
      return res.status(500).json({
        success: false,
        error: 'Erro interno na validação de unicidade'
      });
    }
  };
};

/**
 * Middleware para validação de campos obrigatórios
 * @param requiredFields - Lista de campos obrigatórios
 */
export const validateRequiredFields = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
        const fieldDisplayName = field === 'cpfCnpj' ? 'CPF/CNPJ' : 
                                 field === 'phone' ? 'Telefone' : 
                                 field === 'email' ? 'Email' :
                                 field === 'name' ? 'Nome' : field;
        
        errors.push({
          field,
          message: `${fieldDisplayName} é obrigatório`
        });
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Campos obrigatórios não fornecidos', { errors });
      
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios não preenchidos',
        details: errors.map(err => err.message),
        fields: errors.reduce((acc, err) => {
          acc[err.field] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }
    
    next();
  };
};

/**
 * Middleware para sanitização geral de strings
 * Remove espaços desnecessários e normaliza dados
 */
export const sanitizeStrings = (req: Request, res: Response, next: NextFunction) => {
  try {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.trim();
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (value && typeof value === 'object') {
        const sanitized: any = {};
        for (const key in value) {
          sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
      }
      return value;
    };
    
    req.body = sanitizeValue(req.body);
    req.query = sanitizeValue(req.query);
    
    next();
  } catch (error) {
    logger.error('Erro na sanitização de strings', { error });
    next(); // Continuar mesmo com erro de sanitização
  }
};