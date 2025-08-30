/**
 * Controller para funcionalidades de calendário e disponibilidade
 * Handles visualização do calendário, verificação de disponibilidade e bloqueios
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  ApiResponse, 
  AuthRequest, 
  CalendarView,
  ErrorCode,
  AppointmentError,
  ICreateScheduleBlockRequest,
  BlockType
} from '../types';
import { calendarService } from '../services/calendarService';
import { scheduleBlockService } from '../services/scheduleBlockService';
import { integrationService } from '../services/integrationService';
import { logger } from '../utils/logger';

// === VALIDATION SCHEMAS ===
const calendarQuerySchema = z.object({
  view: z.enum(['day', 'week', 'month']).default('week'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  professional_id: z.string().uuid().optional()
});

// Availability schemas moved to availabilityController.ts

const createBlockSchema = z.object({
  professional_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD'),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  block_type: z.enum(['holiday', 'vacation', 'maintenance', 'personal', 'break', 'lunch']),
  title: z.string().min(1).max(255, 'Título deve ter no máximo 255 caracteres'),
  description: z.string().max(1000, 'Descrição deve ter no máximo 1000 caracteres').optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.any().optional()
});

const scheduleBlocksQuerySchema = z.object({
  professional_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  block_type: z.enum(['holiday', 'vacation', 'maintenance', 'personal', 'break', 'lunch']).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional()
});

// === CONTROLLER METHODS ===
export const calendarController = {

  // GET /calendar - Dados para renderização do calendário (ENDPOINT CRÍTICO)
  getCalendarData: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = calendarQuerySchema.parse(req.query);
      
      // Se não foi fornecida uma data, usar hoje
      const referenceDate = query.date ? new Date(query.date) : new Date();
      
      logger.debug('Obtendo dados do calendário', {
        userId: user.id,
        companyId: user.company_id,
        view: query.view,
        date: referenceDate,
        professionalId: query.professional_id
      });

      // 1. Buscar dados básicos do calendário
      const calendarData = await calendarService.getCalendarData({
        company_id: user.company_id,
        view: query.view as CalendarView,
        reference_date: referenceDate,
        professional_id: query.professional_id
      });

      // 2. Buscar dados dos profissionais via Services API
      const professionals = await integrationService.getProfessionals(
        user.company_id, 
        query.professional_id
      );

      // 3. Enriquecer dados com informações dos profissionais
      if (professionals && professionals.length > 0) {
        calendarData.professionals = professionals.map(prof => ({
          id: prof.id,
          name: prof.name,
          photo_url: prof.photo_url,
          color: calendarService.generateProfessionalColor(prof.id),
          specialties: prof.specialties
        }));
      }

      const response: ApiResponse = {
        success: true,
        data: calendarData
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao obter dados do calendário:', error);

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dados inválidos',
            details: error.errors
          }
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor'
        }
      };
      res.status(500).json(response);
    }
  },

  // Availability methods moved to availabilityController.ts

  // GET /schedule-blocks - Lista bloqueios de horário
  getScheduleBlocks: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = scheduleBlocksQuerySchema.parse(req.query);

      logger.debug('Listando bloqueios de horário', {
        userId: user.id,
        companyId: user.company_id,
        query
      });

      const result = await scheduleBlockService.getScheduleBlocks({
        company_id: user.company_id,
        ...query
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        meta: {
          page: query.page || 1,
          limit: query.limit || 50,
          total: result.total
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao listar bloqueios:', error);

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dados inválidos',
            details: error.errors
          }
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor'
        }
      };
      res.status(500).json(response);
    }
  },

  // POST /schedule-blocks - Criar novo bloqueio
  createScheduleBlock: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = createBlockSchema.parse(req.body);

      // Validar se data final não é anterior à inicial
      if (new Date(data.end_date) < new Date(data.start_date)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Data final não pode ser anterior à data inicial'
          }
        };
        res.status(400).json(response);
        return;
      }

      // Validar horários se fornecidos
      if (data.start_time && data.end_time) {
        const [startHour, startMin] = data.start_time.split(':').map(Number);
        const [endHour, endMin] = data.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Horário final deve ser posterior ao horário inicial'
            }
          };
          res.status(400).json(response);
          return;
        }
      }

      logger.debug('Criando bloqueio de horário', {
        userId: user.id,
        companyId: user.company_id,
        data
      });

      const scheduleBlock = await scheduleBlockService.createScheduleBlock({
        ...data,
        company_id: user.company_id,
        created_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          schedule_block: scheduleBlock
        },
        message: 'Bloqueio de horário criado com sucesso'
      };

      res.status(201).json(response);

    } catch (error) {
      logger.error('Erro ao criar bloqueio de horário:', error);

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dados inválidos',
            details: error.errors
          }
        };
        res.status(400).json(response);
        return;
      }

      if (error instanceof AppointmentError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
        res.status(error.statusCode).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor'
        }
      };
      res.status(500).json(response);
    }
  },

  // PUT /schedule-blocks/:id - Atualizar bloqueio
  updateScheduleBlock: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = createBlockSchema.partial().parse(req.body);

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do bloqueio é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Atualizando bloqueio de horário', {
        blockId: id,
        userId: user.id,
        companyId: user.company_id,
        updates
      });

      const scheduleBlock = await scheduleBlockService.updateScheduleBlock(id, {
        ...updates,
        company_id: user.company_id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          schedule_block: scheduleBlock
        },
        message: 'Bloqueio de horário atualizado com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao atualizar bloqueio:', error);

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Dados inválidos',
            details: error.errors
          }
        };
        res.status(400).json(response);
        return;
      }

      if (error instanceof AppointmentError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
        res.status(error.statusCode).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor'
        }
      };
      res.status(500).json(response);
    }
  },

  // DELETE /schedule-blocks/:id - Remover bloqueio
  deleteScheduleBlock: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do bloqueio é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Removendo bloqueio de horário', {
        blockId: id,
        userId: user.id,
        companyId: user.company_id
      });

      await scheduleBlockService.deleteScheduleBlock(id, user.company_id);

      const response: ApiResponse = {
        success: true,
        message: 'Bloqueio de horário removido com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao remover bloqueio:', error);

      if (error instanceof AppointmentError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
        res.status(error.statusCode).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor'
        }
      };
      res.status(500).json(response);
    }
  }
};