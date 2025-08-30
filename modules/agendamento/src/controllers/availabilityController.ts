/**
 * Controller para verificação de disponibilidade de agendamentos
 * Handles availability checks, conflict detection and slot recommendations
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  ApiResponse, 
  AuthRequest, 
  ErrorCode,
  AppointmentError
} from '../types';
import { availabilityService } from '../services/availabilityService';
import { integrationService } from '../services/integrationService';
import { waitingListService } from '../services/waitingListService';
import { logger } from '../utils/logger';

// === VALIDATION SCHEMAS ===
const availabilityQuerySchema = z.object({
  professional_id: z.string().uuid('ID do profissional deve ser um UUID válido'),
  service_id: z.string().uuid('ID do serviço deve ser um UUID válido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  days: z.coerce.number().min(1).max(30).default(7)
});

const quickAvailabilitySchema = z.object({
  professional_id: z.string().uuid('ID do profissional deve ser um UUID válido'),
  service_id: z.string().uuid('ID do serviço deve ser um UUID válido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM')
});

// === CONTROLLER METHODS ===
export const availabilityController = {

  // GET /availability - Endpoint CRÍTICO da especificação
  getAvailability: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = availabilityQuerySchema.parse(req.query);

      logger.debug('Verificando disponibilidade', {
        userId: user.id,
        companyId: user.company_id,
        professionalId: query.professional_id,
        serviceId: query.service_id,
        date: query.date,
        days: query.days
      });

      // 1. BUSCAR DADOS DO SERVIÇO (duração) via Services API
      const service = await integrationService.getServiceById(query.service_id, user.company_id);
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: 'Serviço não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      // 2. BUSCAR DADOS DO PROFISSIONAL via Services API
      const professional = await integrationService.getProfessionalById(query.professional_id, user.company_id);
      if (!professional) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PROFESSIONAL_NOT_FOUND',
            message: 'Profissional não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      // 3. CALCULAR DISPONIBILIDADE REAL
      const availability = await availabilityService.checkAvailability({
        company_id: user.company_id,
        professional_id: query.professional_id,
        service_id: query.service_id,
        start_date: new Date(query.date),
        days: query.days
      });

      // 4. VERIFICAR SE HÁ SLOTS DISPONÍVEIS
      const hasAvailableSlots = availability.days.some(day => 
        day.available_slots && day.available_slots.some(slot => slot.available)
      );

      // 5. SE NÃO HÁ DISPONIBILIDADE, SUGERIR WAITING LIST
      let waitingListSuggestion = null;
      if (!hasAvailableSlots) {
        waitingListSuggestion = {
          message: 'Não há horários disponíveis no período solicitado. Gostaria de entrar na lista de espera?',
          action: 'add_to_waiting_list',
          benefits: [
            'Notificação automática quando vaga abrir',
            'Prioridade no agendamento',
            'Não perde tempo ligando para verificar',
            'WhatsApp automático quando houver vaga'
          ],
          suggested_data: {
            customer_id: null, // Será preenchido pelo frontend
            service_id: query.service_id,
            professional_id: query.professional_id,
            preferred_date: query.date,
            flexible_date: true,
            flexible_time: true,
            priority: 0,
            notify_whatsapp: true
          }
        };
      }

      // 6. RETORNAR NO FORMATO ESPECIFICADO
      const response: ApiResponse = {
        success: true,
        data: {
          availability: availability.days,
          recommended_slots: availability.recommendedSlots.map(slot => ({
            date: slot.date,
            time: slot.time,
            reason: slot.reason || 'Disponível'
          })),
          has_availability: hasAvailableSlots,
          waiting_list_suggestion: waitingListSuggestion
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao verificar disponibilidade:', error);

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

  // GET /availability/quick - Verificação rápida de um slot específico
  checkQuickAvailability: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = quickAvailabilitySchema.parse(req.query);

      logger.debug('Verificação rápida de disponibilidade', {
        userId: user.id,
        companyId: user.company_id,
        professionalId: query.professional_id,
        serviceId: query.service_id,
        date: query.date,
        time: query.time
      });

      const available = await availabilityService.checkSlotAvailability({
        company_id: user.company_id,
        professional_id: query.professional_id,
        service_id: query.service_id,
        date: new Date(query.date),
        time: query.time
      });

      const response: ApiResponse = {
        success: true,
        data: {
          available,
          slot: {
            date: query.date,
            time: query.time,
            professional_id: query.professional_id,
            service_id: query.service_id
          },
          reason: available ? 'Horário disponível' : 'Horário já ocupado ou bloqueado'
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro na verificação rápida de disponibilidade:', error);

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

  // GET /availability/professionals - Profissionais disponíveis para um serviço/data
  getAvailableProfessionals: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { service_id, date, time } = req.query;

      if (!service_id || !date || !time) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'service_id, date e time são obrigatórios'
          }
        };
        res.status(400).json(response);
        return;
      }

      // Buscar todos os profissionais da empresa
      const allProfessionals = await integrationService.getProfessionals(user.company_id);
      if (!allProfessionals) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PROFESSIONALS_NOT_FOUND',
            message: 'Nenhum profissional encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      // Verificar disponibilidade para cada profissional
      const availableProfessionals = [];
      
      for (const professional of allProfessionals) {
        const available = await availabilityService.checkSlotAvailability({
          company_id: user.company_id,
          professional_id: professional.id,
          service_id: service_id as string,
          date: new Date(date as string),
          time: time as string
        });

        if (available) {
          availableProfessionals.push({
            ...professional,
            available: true,
            slot: {
              date: date,
              time: time
            }
          });
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          professionals: availableProfessionals,
          total_available: availableProfessionals.length,
          total_professionals: allProfessionals.length
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao buscar profissionais disponíveis:', error);

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