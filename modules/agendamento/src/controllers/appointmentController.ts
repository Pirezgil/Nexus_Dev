/**
 * Controller para gerenciamento de agendamentos
 * Handles CRUD operations para appointments com validações e integrações
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  ApiResponse, 
  AuthRequest, 
  ICreateAppointmentRequest, 
  IUpdateAppointmentRequest,
  AppointmentStatus,
  ErrorCode,
  AppointmentError
} from '../types';
import { appointmentService } from '../services/appointmentService';
import { notificationService } from '../services/NotificationServiceNew';
import { logger, appointmentLogger } from '../utils/logger';

// === VALIDATION SCHEMAS ===
const createAppointmentSchema = z.object({
  customer_id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  professional_id: z.string().uuid('ID do profissional deve ser um UUID válido'),
  service_id: z.string().uuid('ID do serviço deve ser um UUID válido'),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  appointment_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM'),
  notes: z.string().max(1000, 'Observações não podem exceder 1000 caracteres').optional(),
  send_confirmation: z.boolean().optional(),
  send_reminder: z.boolean().optional(),
  reminder_hours_before: z.number().min(1).max(168).optional() // Max 1 semana
});

const updateAppointmentSchema = z.object({
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  appointment_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM').optional(),
  notes: z.string().max(1000, 'Observações não podem exceder 1000 caracteres').optional(),
  internal_notes: z.string().max(1000, 'Notas internas não podem exceder 1000 caracteres').optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled']).optional(),
  reschedule_reason: z.string().max(255, 'Motivo da remarcação não pode exceder 255 caracteres').optional(),
  send_reschedule_notification: z.boolean().optional()
});

const appointmentQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  professional_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled']).optional(),
  view: z.enum(['day', 'week', 'month']).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional()
});

const confirmAppointmentSchema = z.object({
  confirmed_by: z.enum(['customer', 'staff', 'auto']),
  confirmation_notes: z.string().max(500).optional()
});

// === CONTROLLER METHODS ===
export const appointmentController = {
  
  // GET /appointments - Lista agendamentos com filtros
  getAppointments: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = appointmentQuerySchema.parse(req.query);
      
      logger.debug('Listando agendamentos', { 
        userId: user.id, 
        companyId: user.company_id,
        query 
      });
      
      const result = await appointmentService.getAppointments({
        company_id: user.company_id,
        ...query
      });
      
      const response: ApiResponse = {
        success: true,
        data: result,
        meta: {
          page: query.page || 1,
          limit: query.limit || 50,
          total: result.summary.total_appointments
        }
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao listar agendamentos:', error);
      
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

  // POST /appointments - Criar novo agendamento
  createAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = createAppointmentSchema.parse(req.body);
      
      logger.debug('Criando agendamento', { 
        userId: user.id, 
        companyId: user.company_id,
        data 
      });
      
      const appointment = await appointmentService.createAppointment({
        ...data,
        company_id: user.company_id,
        created_by: user.id
      });
      
      appointmentLogger.created({
        appointmentId: appointment.id,
        customerId: data.customer_id,
        professionalId: data.professional_id,
        serviceId: data.service_id,
        date: data.appointment_date,
        time: data.appointment_time,
        userId: user.id,
        companyId: user.company_id
      });

      // Enviar notificações se solicitado
      const notifications_scheduled = [];
      
      try {
        if (data.send_confirmation !== false) {
          await notificationService.sendConfirmation(
            appointment.id,
            user.company_id,
            ['whatsapp', 'email']
          );
          notifications_scheduled.push({ type: 'confirmation', channels: ['whatsapp', 'email'] });
          logger.info(`Confirmação agendada para appointment ${appointment.id}`);
        }

        if (data.send_reminder !== false) {
          const hoursBeforeAppointment = data.reminder_hours_before || 24;
          await notificationService.scheduleReminder(
            appointment.id,
            user.company_id,
            hoursBeforeAppointment
          );
          notifications_scheduled.push({ 
            type: 'reminder', 
            channels: ['whatsapp', 'sms'],
            hours_before: hoursBeforeAppointment 
          });
          logger.info(`Lembrete agendado para appointment ${appointment.id} (${hoursBeforeAppointment}h antes)`);
        }
      } catch (notificationError: any) {
        logger.warn(`Erro ao agendar notificações para appointment ${appointment.id}:`, notificationError);
        // Não falhar o agendamento por causa das notificações
      }
      
      const response: ApiResponse = {
        success: true,
        data: {
          appointment,
          notifications_scheduled
        },
        message: 'Agendamento criado com sucesso'
      };
      
      res.status(201).json(response);
      
    } catch (error) {
      logger.error('Erro ao criar agendamento:', error);
      
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

  // GET /appointments/:id - Obter agendamento específico
  getAppointmentById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const appointment = await appointmentService.getAppointmentById(id, user.company_id);
      
      if (!appointment) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.APPOINTMENT_NOT_FOUND,
            message: 'Agendamento não encontrado'
          }
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        data: { appointment }
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao obter agendamento:', error);
      
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

  // PUT /appointments/:id - Atualizar agendamento
  updateAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = updateAppointmentSchema.parse(req.body);
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const appointment = await appointmentService.updateAppointment(id, {
        ...updates,
        company_id: user.company_id,
        updated_by: user.id
      });
      
      appointmentLogger.updated({
        appointmentId: id,
        action: 'update',
        userId: user.id,
        companyId: user.company_id
      });

      // Se foi reagendamento (mudança de data/hora), enviar notificação
      const isReschedule = updates.appointment_date || updates.appointment_time;
      if (isReschedule && updates.send_reschedule_notification !== false) {
        try {
          await notificationService.sendReschedule(id, user.company_id);
          logger.info(`Notificação de reagendamento enviada para appointment ${id}`);
        } catch (notificationError: any) {
          logger.warn(`Erro ao enviar notificação de reagendamento para appointment ${id}:`, notificationError);
        }
      }
      
      const response: ApiResponse = {
        success: true,
        data: { appointment },
        message: updates.appointment_date || updates.appointment_time 
          ? 'Agendamento reagendado com sucesso'
          : 'Agendamento atualizado com sucesso'
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao atualizar agendamento:', error);
      
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

  // DELETE /appointments/:id - Cancelar agendamento
  cancelAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { cancellation_reason, send_cancellation_notification, refund_required } = req.body;
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const result = await appointmentService.cancelAppointment(id, {
        company_id: user.company_id,
        cancelled_by: user.id,
        cancellation_reason,
        send_notification: send_cancellation_notification,
        refund_required
      });
      
      appointmentLogger.cancelled({
        appointmentId: id,
        reason: cancellation_reason,
        userId: user.id,
        companyId: user.company_id
      });

      // Enviar notificação de cancelamento se solicitado
      if (send_cancellation_notification !== false) {
        try {
          await notificationService.sendCancellation(id, user.company_id);
          logger.info(`Notificação de cancelamento enviada para appointment ${id}`);
        } catch (notificationError: any) {
          logger.warn(`Erro ao enviar notificação de cancelamento para appointment ${id}:`, notificationError);
        }
      }
      
      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Agendamento cancelado com sucesso'
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao cancelar agendamento:', error);
      
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

  // POST /appointments/:id/confirm - Confirmar agendamento
  confirmAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = confirmAppointmentSchema.parse(req.body);
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const appointment = await appointmentService.confirmAppointment(id, {
        company_id: user.company_id,
        confirmed_by: data.confirmed_by,
        confirmation_notes: data.confirmation_notes,
        staff_user_id: data.confirmed_by === 'staff' ? user.id : undefined
      });
      
      appointmentLogger.confirmed({
        appointmentId: id,
        userId: user.id,
        companyId: user.company_id
      });
      
      const response: ApiResponse = {
        success: true,
        data: { appointment },
        message: 'Agendamento confirmado com sucesso'
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao confirmar agendamento:', error);
      
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

  // POST /appointments/:id/complete - Marcar como concluído
  completeAppointment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { completed_at, completed_appointment_id } = req.body;
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const appointment = await appointmentService.completeAppointment(id, {
        company_id: user.company_id,
        completed_at: completed_at ? new Date(completed_at) : new Date(),
        completed_appointment_id,
        completed_by: user.id
      });
      
      appointmentLogger.completed({
        appointmentId: id,
        userId: user.id,
        companyId: user.company_id
      });
      
      const response: ApiResponse = {
        success: true,
        data: { appointment },
        message: 'Agendamento concluído com sucesso'
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao concluir agendamento:', error);
      
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

  // POST /appointments/:id/no-show - Marcar como falta
  markNoShow: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { notes } = req.body;
      
      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do agendamento é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }
      
      const appointment = await appointmentService.markNoShow(id, {
        company_id: user.company_id,
        notes,
        marked_by: user.id
      });
      
      appointmentLogger.noShow({
        appointmentId: id,
        userId: user.id,
        companyId: user.company_id
      });
      
      const response: ApiResponse = {
        success: true,
        data: { appointment },
        message: 'Agendamento marcado como falta'
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      logger.error('Erro ao marcar como falta:', error);
      
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