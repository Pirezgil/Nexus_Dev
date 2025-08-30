/**
 * Controller para gerenciamento de notificações
 * Handles envio, histórico e templates de notificações WhatsApp/SMS/Email
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  ApiResponse, 
  AuthRequest, 
  NotificationType,
  NotificationChannel,
  ErrorCode,
  AppointmentError,
  ISendNotificationRequest
} from '../types';
import { notificationService } from '../services/notificationService';
import { messageTemplateService } from '../services/messageTemplateService';
import { logger, notificationLogger } from '../utils/logger';

// === VALIDATION SCHEMAS ===
const sendNotificationSchema = z.object({
  template_type: z.enum(['confirmation', 'reminder', 'cancellation', 'reschedule', 'no_show']),
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  variables: z.record(z.any())
});

const notificationsQuerySchema = z.object({
  appointment_id: z.string().uuid().optional(),
  notification_type: z.enum(['confirmation', 'reminder', 'cancellation', 'reschedule', 'no_show']).optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']).optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'read']).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional()
});

const messageTemplateSchema = z.object({
  template_name: z.string().min(1).max(100, 'Nome do template deve ter no máximo 100 caracteres'),
  template_type: z.enum(['confirmation', 'reminder', 'cancellation', 'reschedule', 'no_show']),
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']),
  subject: z.string().max(255, 'Assunto deve ter no máximo 255 caracteres').optional(),
  content: z.string().min(1, 'Conteúdo é obrigatório').max(2000, 'Conteúdo deve ter no máximo 2000 caracteres'),
  active: z.boolean().default(true),
  is_default: z.boolean().default(false)
});

const templatesQuerySchema = z.object({
  template_type: z.enum(['confirmation', 'reminder', 'cancellation', 'reschedule', 'no_show']).optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional()
});

const bulkNotificationSchema = z.object({
  appointment_ids: z.array(z.string().uuid()).min(1).max(100),
  template_type: z.enum(['confirmation', 'reminder', 'cancellation', 'reschedule', 'no_show']),
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']),
  custom_message: z.string().max(2000).optional(),
  send_immediately: z.boolean().default(false),
  scheduled_for: z.string().optional() // ISO datetime
});

// === CONTROLLER METHODS ===
export const notificationController = {

  // GET /notifications - Lista histórico de notificações
  getNotifications: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = notificationsQuerySchema.parse(req.query);

      logger.debug('Listando notificações', {
        userId: user.id,
        companyId: user.company_id,
        query
      });

      const result = await notificationService.getNotifications({
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
      logger.error('Erro ao listar notificações:', error);

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

  // POST /notifications/test - Testar envio de notificação
  testNotification: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = sendNotificationSchema.parse(req.body);

      // Validar se o canal corresponde ao destinatário
      if (data.channel === 'whatsapp' || data.channel === 'sms') {
        if (!data.phone) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Telefone é obrigatório para WhatsApp/SMS'
            }
          };
          res.status(400).json(response);
          return;
        }
      } else if (data.channel === 'email') {
        if (!data.email) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Email é obrigatório para notificações por email'
            }
          };
          res.status(400).json(response);
          return;
        }
      }

      logger.debug('Testando envio de notificação', {
        userId: user.id,
        companyId: user.company_id,
        type: data.template_type,
        channel: data.channel
      });

      const result = await notificationService.sendTestNotification({
        company_id: user.company_id,
        template_type: data.template_type as NotificationType,
        channel: data.channel as NotificationChannel,
        phone: data.phone,
        email: data.email,
        variables: data.variables,
        sent_by: user.id
      });

      notificationLogger.sent({
        type: data.template_type,
        channel: data.channel,
        recipient: data.phone || data.email,
        status: result.success ? 'sent' : 'failed'
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.success 
          ? 'Notificação de teste enviada com sucesso' 
          : 'Falha no envio da notificação de teste'
      };

      res.status(result.success ? 200 : 400).json(response);

    } catch (error) {
      logger.error('Erro ao testar notificação:', error);

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

  // POST /notifications/bulk - Enviar notificações em lote
  sendBulkNotifications: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = bulkNotificationSchema.parse(req.body);

      logger.debug('Enviando notificações em lote', {
        userId: user.id,
        companyId: user.company_id,
        appointmentCount: data.appointment_ids.length,
        type: data.template_type,
        channel: data.channel
      });

      const result = await notificationService.sendBulkNotifications({
        company_id: user.company_id,
        appointment_ids: data.appointment_ids,
        template_type: data.template_type as NotificationType,
        channel: data.channel as NotificationChannel,
        custom_message: data.custom_message,
        send_immediately: data.send_immediately,
        scheduled_for: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
        sent_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: `Processamento iniciado para ${data.appointment_ids.length} notificações`
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao enviar notificações em lote:', error);

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

  // POST /appointments/:id/reminder - Enviar lembrete manual
  sendReminder: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { channel, custom_message } = req.body;

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

      logger.debug('Enviando lembrete manual', {
        appointmentId: id,
        userId: user.id,
        companyId: user.company_id,
        channel: channel || 'default'
      });

      const result = await notificationService.sendAppointmentReminder({
        appointment_id: id,
        company_id: user.company_id,
        channel: channel as NotificationChannel || NotificationChannel.WHATSAPP,
        custom_message,
        sent_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Lembrete enviado com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao enviar lembrete:', error);

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

  // GET /message-templates - Lista templates de mensagem
  getMessageTemplates: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const query = templatesQuerySchema.parse(req.query);

      logger.debug('Listando templates de mensagem', {
        userId: user.id,
        companyId: user.company_id,
        query
      });

      const result = await messageTemplateService.getMessageTemplates({
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
      logger.error('Erro ao listar templates:', error);

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

  // POST /message-templates - Criar template de mensagem
  createMessageTemplate: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const data = messageTemplateSchema.parse(req.body);

      logger.debug('Criando template de mensagem', {
        userId: user.id,
        companyId: user.company_id,
        templateName: data.template_name,
        type: data.template_type,
        channel: data.channel
      });

      const template = await messageTemplateService.createMessageTemplate({
        ...data,
        company_id: user.company_id,
        created_by: user.id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          message_template: template
        },
        message: 'Template de mensagem criado com sucesso'
      };

      res.status(201).json(response);

    } catch (error) {
      logger.error('Erro ao criar template:', error);

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

  // PUT /message-templates/:id - Atualizar template
  updateMessageTemplate: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = messageTemplateSchema.partial().parse(req.body);

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do template é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      const template = await messageTemplateService.updateMessageTemplate(id, {
        ...updates,
        company_id: user.company_id
      });

      const response: ApiResponse = {
        success: true,
        data: {
          message_template: template
        },
        message: 'Template atualizado com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao atualizar template:', error);

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

  // DELETE /message-templates/:id - Remover template
  deleteMessageTemplate: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { id } = req.params;

      if (!id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'ID do template é obrigatório'
          }
        };
        res.status(400).json(response);
        return;
      }

      await messageTemplateService.deleteMessageTemplate(id, user.company_id);

      const response: ApiResponse = {
        success: true,
        message: 'Template removido com sucesso'
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao remover template:', error);

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

  // GET /notifications/stats - Estatísticas de notificações
  getNotificationStats: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { date_from, date_to } = req.query;

      const stats = await notificationService.getNotificationStats({
        company_id: user.company_id,
        date_from: date_from ? new Date(date_from as string) : undefined,
        date_to: date_to ? new Date(date_to as string) : undefined
      });

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao obter estatísticas de notificações:', error);

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