/**
 * Controller para gestão de lista de espera
 * Handles waiting list quando horários desejados estão ocupados
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  ApiResponse, 
  AuthRequest, 
  ErrorCode,
  AppointmentError,
  WaitingListStatus
} from '../types';
import { waitingListService } from '../services/waitingListService';
import { availabilityService } from '../services/availabilityService';
import { integrationService } from '../services/integrationService';
import { logger } from '../utils/logger';

// === VALIDATION SCHEMAS ===
const createWaitingListSchema = z.object({
  customer_id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  service_id: z.string().uuid('ID do serviço deve ser um UUID válido'),
  professional_id: z.string().uuid('ID do profissional deve ser um UUID válido').optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  preferred_time_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM').optional(),
  preferred_time_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM').optional(),
  flexible_date: z.boolean().default(true),
  flexible_time: z.boolean().default(true),
  priority: z.number().min(0).max(10).default(0), // 0 = normal, 10 = alta prioridade
  notify_phone: z.boolean().default(true),
  notify_whatsapp: z.boolean().default(true),
  notify_email: z.boolean().default(false),
  notes: z.string().max(500, 'Observações não podem exceder 500 caracteres').optional()
});

const waitingListQuerySchema = z.object({
  status: z.enum(['waiting', 'contacted', 'scheduled', 'expired']).optional(),
  customer_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),
  priority: z.coerce.number().min(0).max(10).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  sort: z.enum(['created_at', 'priority', 'preferred_date']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

const updateWaitingListSchema = z.object({
  status: z.enum(['waiting', 'contacted', 'scheduled', 'expired']).optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred_time_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  preferred_time_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  flexible_date: z.boolean().optional(),
  flexible_time: z.boolean().optional(),
  priority: z.number().min(0).max(10).optional(),
  notes: z.string().max(500).optional(),
  contacted_notes: z.string().max(500).optional()
});

const contactWaitingListSchema = z.object({
  appointment_offer: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    professional_id: z.string().uuid().optional()
  }),
  contact_method: z.enum(['phone', 'whatsapp', 'email']).default('whatsapp'),
  contact_notes: z.string().max(500).optional(),
  expires_in_hours: z.number().min(1).max(72).default(24) // 24h para responder
});

// === CONTROLLER METHODS ===
export const waitingListController = {

  // GET /waiting-list - Lista pessoas na lista de espera
  getWaitingList: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = waitingListQuerySchema.parse(req.query);

      logger.debug('Listando lista de espera', {
        userId: user.id,
        companyId: user.company_id,
        query
      });

      const result = await waitingListService.getWaitingList({
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
      logger.error('Erro ao listar lista de espera:', error);

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

  // POST /waiting-list - Adicionar à lista de espera
  addToWaitingList: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = createWaitingListSchema.parse(req.body);

      logger.debug('Adicionando à lista de espera', {
        userId: user.id,
        companyId: user.company_id,
        customerId: data.customer_id,
        serviceId: data.service_id,
        professionalId: data.professional_id
      });

      // 1. VALIDAR SE CLIENTE, SERVIÇO E PROFISSIONAL EXISTEM
      const [customer, service, professional] = await Promise.all([
        integrationService.getCustomerById(data.customer_id, user.company_id),
        integrationService.getServiceById(data.service_id, user.company_id),
        data.professional_id 
          ? integrationService.getProfessionalById(data.professional_id, user.company_id)
          : null
      ]);

      if (!customer) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.CUSTOMER_NOT_FOUND,
            message: 'Cliente não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.SERVICE_NOT_FOUND,
            message: 'Serviço não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      if (data.professional_id && !professional) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.PROFESSIONAL_NOT_FOUND,
            message: 'Profissional não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }

      // 2. VERIFICAR SE JÁ EXISTE NA LISTA DE ESPERA ATIVA
      const existingWaiting = await waitingListService.findActiveWaitingByCustomer(
        user.company_id,
        data.customer_id,
        data.service_id,
        data.professional_id
      );

      if (existingWaiting) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'ALREADY_IN_WAITING_LIST',
            message: 'Cliente já está na lista de espera para este serviço'
          }
        };
        res.status(400).json(response);
        return;
      }

      // 3. CRIAR ENTRADA NA LISTA DE ESPERA
      const waitingEntry = await waitingListService.createWaitingEntry({
        ...data,
        company_id: user.company_id,
        created_by: user.id
      });

      // 4. BUSCAR IMEDIATAMENTE SE HÁ VAGA DISPONÍVEL
      if (data.preferred_date && data.preferred_time_start) {
        const isAvailable = await availabilityService.checkSlotAvailability({
          company_id: user.company_id,
          professional_id: data.professional_id || waitingEntry.suggested_professional_id,
          service_id: data.service_id,
          date: new Date(data.preferred_date),
          time: data.preferred_time_start
        });

        if (isAvailable) {
          // Se há vaga imediata, notificar automaticamente
          await waitingListService.notifyWaitingListOpportunity(waitingEntry.id, {
            date: data.preferred_date,
            time: data.preferred_time_start,
            professional_id: data.professional_id
          });
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          waiting_entry: waitingEntry,
          customer,
          service,
          professional,
          immediate_availability: data.preferred_date && data.preferred_time_start 
            ? await availabilityService.checkSlotAvailability({
                company_id: user.company_id,
                professional_id: data.professional_id || waitingEntry.suggested_professional_id,
                service_id: data.service_id,
                date: new Date(data.preferred_date),
                time: data.preferred_time_start
              })
            : null
        },
        message: 'Cliente adicionado à lista de espera com sucesso'
      };

      res.status(201).json(response);

    } catch (error) {
      logger.error('Erro ao adicionar à lista de espera:', error);

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

  // PUT /waiting-list/:id - Atualizar entrada da lista de espera
  updateWaitingEntry: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = updateWaitingListSchema.parse(req.body);

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID da entrada é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Atualizando entrada da lista de espera', {
        waitingId: id,
        userId: user.id,
        companyId: user.company_id,
        updates
      });

      const waitingEntry = await waitingListService.updateWaitingEntry(id, {
        ...updates,
        company_id: user.company_id,
        updated_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          waiting_entry: waitingEntry
        },
        message: 'Entrada da lista de espera atualizada com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao atualizar lista de espera:', error);

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

  // POST /waiting-list/:id/contact - Contatar pessoa da lista de espera
  contactWaitingEntry: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = contactWaitingListSchema.parse(req.body);

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID da entrada é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Contatando entrada da lista de espera', {
        waitingId: id,
        userId: user.id,
        companyId: user.company_id,
        appointmentOffer: data.appointment_offer
      });

      // 1. VERIFICAR SE HORÁRIO OFERECIDO ESTÁ DISPONÍVEL
      const isAvailable = await availabilityService.checkSlotAvailability({
        company_id: user.company_id,
        professional_id: data.appointment_offer.professional_id,
        service_id: data.appointment_offer.date, // Precisa buscar service_id da waiting entry
        date: new Date(data.appointment_offer.date),
        time: data.appointment_offer.time
      });

      if (!isAvailable) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SLOT_NOT_AVAILABLE',
            message: 'Horário oferecido não está mais disponível'
          }
        };
        res.status(400).json(response);
        return;
      }

      // 2. CONTATAR CLIENTE E MARCAR COMO CONTATADO
      const result = await waitingListService.contactWaitingEntry(id, {
        company_id: user.company_id,
        contacted_by: user.id,
        appointment_offer: data.appointment_offer,
        contact_method: data.contact_method,
        contact_notes: data.contact_notes,
        expires_in_hours: data.expires_in_hours
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: `Cliente contatado via ${data.contact_method} com sucesso`
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao contatar lista de espera:', error);

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

  // POST /waiting-list/:id/convert - Converter para agendamento
  convertToAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { appointment_date, appointment_time, professional_id, notes } = req.body;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID da entrada é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Convertendo lista de espera para agendamento', {
        waitingId: id,
        userId: user.id,
        companyId: user.company_id,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time
      });

      const result = await waitingListService.convertToAppointment(id, {
        company_id: user.company_id,
        appointment_date,
        appointment_time,
        professional_id,
        notes,
        created_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Lista de espera convertida para agendamento com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao converter lista de espera:', error);

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

  // DELETE /waiting-list/:id - Remover da lista de espera
  removeFromWaitingList: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { reason } = req.body;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID da entrada é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      logger.debug('Removendo da lista de espera', {
        waitingId: id,
        userId: user.id,
        companyId: user.company_id,
        reason
      });

      await waitingListService.removeWaitingEntry(id, user.company_id, reason);

      const response: ApiResponse = {
        success: true,
        message: 'Entrada removida da lista de espera'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao remover da lista de espera:', error);

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

  // GET /waiting-list/stats - Estatísticas da lista de espera
  getWaitingListStats: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;

      const stats = await waitingListService.getWaitingListStats(user.company_id);

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao obter estatísticas da lista de espera:', error);

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