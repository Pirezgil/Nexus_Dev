/**
 * AppointmentValidation Middleware - Middleware para validação de agendamentos
 * 
 * Aplica todas as validações necessárias para agendamentos:
 * - Conflitos de horário
 * - Horários de funcionamento
 * - Disponibilidade de profissionais
 * - Regras de antecedência
 */

import { Request, Response, NextFunction } from 'express';
import { AppointmentValidator } from '../services/AppointmentValidator';
import { logger } from '../utils/logger';
import { format, parseISO, isValid } from 'date-fns';

interface ValidationError {
  field: string;
  message: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        companyId: string;
        userId: string;
        role: string;
        permissions?: Record<string, string[]>;
      };
    }
  }
}

/**
 * Middleware para validação de formato de dados do agendamento
 */
export const validateAppointmentFormat = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = [];
  
  try {
    // Validar campos obrigatórios
    const requiredFields = ['professional_id', 'service_id', 'appointment_date', 'appointment_time'];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        errors.push({
          field,
          message: `${field} é obrigatório`
        });
      }
    }
    
    // Validar formato da data (YYYY-MM-DD)
    if (req.body.appointment_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(req.body.appointment_date)) {
        errors.push({
          field: 'appointment_date',
          message: 'Data deve estar no formato YYYY-MM-DD'
        });
      } else {
        // Verificar se é uma data válida
        const date = parseISO(req.body.appointment_date);
        if (!isValid(date)) {
          errors.push({
            field: 'appointment_date',
            message: 'Data inválida'
          });
        } else {
          // Verificar se não é uma data passada
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (date < today) {
            errors.push({
              field: 'appointment_date',
              message: 'Não é possível agendar para datas passadas'
            });
          }
        }
      }
    }
    
    // Validar formato da hora (HH:MM)
    if (req.body.appointment_time) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(req.body.appointment_time)) {
        errors.push({
          field: 'appointment_time',
          message: 'Horário deve estar no formato HH:MM (24h)'
        });
      }
    }
    
    // Validar UUIDs se fornecidos
    const uuidFields = ['professional_id', 'service_id', 'customer_id'];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    for (const field of uuidFields) {
      if (req.body[field] && !uuidRegex.test(req.body[field])) {
        errors.push({
          field,
          message: `${field} deve ser um UUID válido`
        });
      }
    }
    
    // Validar status se fornecido
    if (req.body.status) {
      const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'];
      if (!validStatuses.includes(req.body.status)) {
        errors.push({
          field: 'status',
          message: `Status deve ser um dos seguintes: ${validStatuses.join(', ')}`
        });
      }
    }
    
    // Validar preço estimado se fornecido
    if (req.body.estimated_price !== undefined) {
      const price = parseFloat(req.body.estimated_price);
      if (isNaN(price) || price < 0) {
        errors.push({
          field: 'estimated_price',
          message: 'Preço estimado deve ser um número válido maior ou igual a zero'
        });
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Erros de formato no agendamento detectados', { 
        errors, 
        body: req.body 
      });
      
      return res.status(400).json({
        success: false,
        error: 'Formato de dados inválido',
        details: errors.map(err => err.message),
        fields: errors.reduce((acc, err) => {
          acc[err.field] = err.message;
          return acc;
        }, {} as Record<string, string>)
      });
    }
    
    logger.debug('Validação de formato do agendamento concluída');
    next();
    
  } catch (error) {
    logger.error('Erro na validação de formato do agendamento', { error });
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno na validação de formato'
    });
  }
};

/**
 * Middleware para validação de conflitos e regras de negócio
 */
export const validateAppointmentConflicts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.user || {};
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado ou empresa não identificada'
      });
    }
    
    const appointmentData = {
      ...req.body,
      company_id: companyId
    };
    
    logger.info('Iniciando validação completa de agendamento', {
      professional_id: appointmentData.professional_id,
      service_id: appointmentData.service_id,
      appointment_date: appointmentData.appointment_date,
      appointment_time: appointmentData.appointment_time,
      company_id: companyId
    });
    
    // Executar todas as validações de negócio
    const validation = await AppointmentValidator.validateAll(
      appointmentData,
      req.params.id // Excluir agendamento atual se for update
    );
    
    if (!validation.valid) {
      logger.warn('Validação de agendamento falhou', {
        error: validation.error,
        details: validation.details,
        conflictingAppointments: validation.conflictingAppointments
      });
      
      const statusCode = validation.conflictingAppointments ? 409 : 400;
      
      return res.status(statusCode).json({
        success: false,
        error: validation.error,
        ...(validation.conflictingAppointments && {
          conflictingAppointments: validation.conflictingAppointments
        }),
        ...(validation.details && {
          details: validation.details
        })
      });
    }
    
    logger.info('Validação completa de agendamento bem-sucedida');
    next();
    
  } catch (error) {
    logger.error('Erro na validação de conflitos de agendamento', { error });
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno na validação de agendamento'
    });
  }
};

/**
 * Middleware para sugerir horários alternativos em caso de conflito
 */
export const suggestAlternativeTimes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Este middleware só é executado se houve erro de conflito
    // Verificar se a resposta já foi enviada com erro de conflito
    if (res.headersSent) {
      return;
    }
    
    const { companyId } = req.user || {};
    
    if (!companyId) {
      return next();
    }
    
    const appointmentData = {
      ...req.body,
      company_id: companyId
    };
    
    // Sugerir horários alternativos
    const suggestions = await AppointmentValidator.suggestAlternativeTimes(appointmentData, 5);
    
    if (suggestions.length > 0) {
      logger.info('Horários alternativos sugeridos', { 
        original_time: appointmentData.appointment_time,
        suggestions 
      });
      
      // Adicionar sugestões à resposta de erro
      const originalJson = res.json;
      res.json = function(body: any) {
        if (body && !body.success && body.error) {
          body.suggestions = suggestions;
          body.message = `${body.error} Horários alternativos disponíveis: ${suggestions.join(', ')}`;
        }
        return originalJson.call(this, body);
      };
    }
    
    next();
    
  } catch (error) {
    logger.error('Erro ao sugerir horários alternativos', { error });
    next(); // Continuar mesmo com erro nas sugestões
  }
};

/**
 * Middleware para validação de permissões específicas de agendamento
 */
export const validateAppointmentPermissions = (action: 'create' | 'read' | 'update' | 'delete') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
      }
      
      // Admin sempre tem acesso
      if (user.role === 'ADMIN' || user.role === 'OWNER') {
        return next();
      }
      
      // CORREÇÃO: Processar permissões no formato correto do user-management
      // Formato recebido: ['AGENDAMENTO:read', 'AGENDAMENTO:write', 'SERVICES:read']
      // Extrair permissões do módulo AGENDAMENTO
      const userPermissions = user.permissions || [];
      const modulePermissions = userPermissions
        .filter(permission => permission.startsWith('AGENDAMENTO:'))
        .map(permission => permission.split(':')[1]); // Extrair 'read' de 'AGENDAMENTO:read'
      
      const hasPermission = 
        modulePermissions.includes(action) ||
        modulePermissions.includes('admin') ||
        (action === 'read' && modulePermissions.includes('write'));
      
      if (!hasPermission) {
        logger.warn('Acesso negado para agendamento', {
          userId: user.userId,
          action,
          userPermissions,
          modulePermissions,
          requiredPermission: `AGENDAMENTO:${action}`
        });
        
        return res.status(403).json({
          success: false,
          error: `Acesso negado. Permissão necessária: AGENDAMENTO:${action}`
        });
      }
      
      logger.debug('Permissão validada com sucesso', {
        userId: user.userId,
        action,
        modulePermissions
      });
      
      next();
      
    } catch (error) {
      logger.error('Erro na validação de permissões de agendamento', { error });
      
      return res.status(500).json({
        success: false,
        error: 'Erro interno na validação de permissões'
      });
    }
  };
};

/**
 * Middleware para logging de operações de agendamento
 */
export const logAppointmentOperation = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Log da operação iniciada
    logger.info(`Operação de agendamento iniciada: ${operation}`, {
      userId: req.user?.userId,
      companyId: req.user?.companyId,
      appointmentId: req.params.id,
      body: operation === 'create' || operation === 'update' ? req.body : undefined
    });
    
    // Override do res.json para capturar resultado
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      
      if (body && body.success) {
        logger.info(`Operação de agendamento bem-sucedida: ${operation}`, {
          userId: req.user?.userId,
          companyId: req.user?.companyId,
          appointmentId: req.params.id || body.data?.id,
          duration
        });
      } else {
        logger.warn(`Operação de agendamento falhou: ${operation}`, {
          userId: req.user?.userId,
          companyId: req.user?.companyId,
          appointmentId: req.params.id,
          error: body?.error,
          duration
        });
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};