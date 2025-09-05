/**
 * Serviço principal de notificações com sistema de filas
 * Integra WhatsApp, SMS e Email providers com processamento assíncrono
 */

import Queue from 'bull';
import { WhatsAppProvider } from './providers/WhatsAppProvider';
import { SMSProvider } from './providers/SMSProvider';
import { EmailProvider } from './providers/EmailProvider';
import { TemplateEngine } from './TemplateEngine';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { 
  NotificationType, 
  NotificationChannel, 
  NotificationStatus,
  INotification,
  INotificationVariables,
  ErrorCode,
  AppointmentError
} from '../types';

interface SendNotificationParams {
  appointment_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  phone?: string;
  email?: string;
  custom_message?: string;
  variables?: INotificationVariables;
  send_immediately?: boolean;
  scheduled_for?: Date;
}

interface BulkNotificationParams {
  company_id: string;
  appointment_ids: string[];
  template_type: NotificationType;
  channel: NotificationChannel;
  custom_message?: string;
  send_immediately: boolean;
  scheduled_for?: Date;
  sent_by: string;
}

interface TestNotificationParams {
  company_id: string;
  template_type: NotificationType;
  channel: NotificationChannel;
  phone?: string;
  email?: string;
  variables: Record<string, any>;
  sent_by: string;
}

// Queue para notificações agendadas
interface NotificationJob {
  id: string;
  appointment_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  scheduled_for: Date;
  variables: INotificationVariables;
  custom_message?: string;
}

const notificationQueue: NotificationJob[] = [];
const processedJobs = new Set<string>();

export const notificationService = {

  // === NOVOS MÉTODOS INTEGRADOS ===

  /**
   * Enviar confirmação de agendamento (integrado com queue)
   */
  sendAppointmentConfirmation: async (appointmentData: any): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      if (!appointmentData.customer_phone) {
        logger.warn(`Agendamento ${appointmentData.id}: Cliente sem telefone para confirmação`);
        return { success: false, error: 'Cliente sem telefone' };
      }

      // Buscar dados completos se necessário
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(appointmentData.customer_id, appointmentData.company_id),
        integrationService.getProfessionalById(appointmentData.professional_id, appointmentData.company_id),
        integrationService.getServiceById(appointmentData.service_id, appointmentData.company_id)
      ]);

      const enrichedData = {
        ...appointmentData,
        customer_name: customer?.name || appointmentData.customer_name,
        customer_phone: customer?.phone || appointmentData.customer_phone,
        professional_name: professional?.name || appointmentData.professional_name,
        service_name: service?.name || appointmentData.service_name
      };

      // Enfileirar mensagem de confirmação
      const messageId = await messageQueue.enqueueConfirmation(enrichedData);

      // Salvar log inicial
      await notificationService.saveNotificationLog(
        appointmentData.id,
        'confirmation',
        'whatsapp',
        enrichedData.customer_phone,
        null,
        'Mensagem de confirmação enfileirada',
        'pending'
      );

      return { success: true, messageId };

    } catch (error: any) {
      logger.error(`Erro ao enviar confirmação para agendamento ${appointmentData.id}:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Agendar lembrete de agendamento (integrado com queue)
   */
  scheduleAppointmentReminder: async (appointmentData: any, hoursBeforeDefault = 24): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      if (!appointmentData.customer_phone) {
        logger.warn(`Agendamento ${appointmentData.id}: Cliente sem telefone para lembrete`);
        return { success: false, error: 'Cliente sem telefone' };
      }

      // Verificar se horário do lembrete já passou
      const appointmentDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
      const reminderDateTime = new Date(appointmentDateTime.getTime() - (hoursBeforeDefault * 60 * 60 * 1000));

      if (reminderDateTime <= new Date()) {
        logger.warn(`Agendamento ${appointmentData.id}: Horário do lembrete já passou`);
        return { success: false, error: 'Horário do lembrete já passou' };
      }

      // Buscar dados completos se necessário
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(appointmentData.customer_id, appointmentData.company_id),
        integrationService.getProfessionalById(appointmentData.professional_id, appointmentData.company_id),
        integrationService.getServiceById(appointmentData.service_id, appointmentData.company_id)
      ]);

      const enrichedData = {
        ...appointmentData,
        customer_name: customer?.name || appointmentData.customer_name,
        customer_phone: customer?.phone || appointmentData.customer_phone,
        professional_name: professional?.name || appointmentData.professional_name,
        service_name: service?.name || appointmentData.service_name
      };

      // Enfileirar lembrete agendado
      const messageId = await messageQueue.enqueueReminder(enrichedData, hoursBeforeDefault);

      // Salvar log inicial
      await notificationService.saveNotificationLog(
        appointmentData.id,
        'reminder',
        'whatsapp',
        enrichedData.customer_phone,
        null,
        `Lembrete agendado para ${reminderDateTime.toISOString()}`,
        'scheduled'
      );

      return { success: true, messageId };

    } catch (error: any) {
      logger.error(`Erro ao agendar lembrete para agendamento ${appointmentData.id}:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Enviar notificação de cancelamento (integrado com queue)
   */
  sendAppointmentCancellation: async (appointmentData: any, cancellationReason?: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      if (!appointmentData.customer_phone) {
        logger.warn(`Agendamento ${appointmentData.id}: Cliente sem telefone para cancelamento`);
        return { success: false, error: 'Cliente sem telefone' };
      }

      // Buscar dados completos se necessário
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(appointmentData.customer_id, appointmentData.company_id),
        integrationService.getProfessionalById(appointmentData.professional_id, appointmentData.company_id),
        integrationService.getServiceById(appointmentData.service_id, appointmentData.company_id)
      ]);

      const enrichedData = {
        ...appointmentData,
        customer_name: customer?.name || appointmentData.customer_name,
        customer_phone: customer?.phone || appointmentData.customer_phone,
        professional_name: professional?.name || appointmentData.professional_name,
        service_name: service?.name || appointmentData.service_name,
        cancellation_reason: cancellationReason
      };

      // Enfileirar mensagem de cancelamento
      const messageId = await messageQueue.enqueueCancellation(enrichedData, cancellationReason);

      // Salvar log inicial
      await notificationService.saveNotificationLog(
        appointmentData.id,
        'cancellation',
        'whatsapp',
        enrichedData.customer_phone,
        null,
        'Mensagem de cancelamento enfileirada',
        'pending'
      );

      return { success: true, messageId };

    } catch (error: any) {
      logger.error(`Erro ao enviar cancelamento para agendamento ${appointmentData.id}:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Enviar mensagem de teste
   */
  sendTestMessage: async (phoneNumber: string, companyId: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      return await whatsappService.sendTestMessage(phoneNumber, companyId);
    } catch (error: any) {
      logger.error('Erro ao enviar mensagem de teste:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Salvar log de notificação (método privado melhorado)
   */
  saveNotificationLog: async (
    appointmentId: string,
    notificationType: string,
    channel: string,
    recipientPhone: string,
    templateId: string | null,
    messageContent: string,
    status: string,
    externalMessageId?: string,
    errorMessage?: string
  ) => {
    try {
      await db.appointmentNotification.create({
        data: {
          appointment_id: appointmentId,
          notification_type: notificationType,
          channel,
          recipient_phone: recipientPhone,
          message_template: templateId,
          message_content: messageContent,
          status,
          external_message_id: externalMessageId,
          sent_at: status === 'sent' ? new Date() : undefined,
          failure_reason: errorMessage,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Erro ao salvar log de notificação:', error);
    }
  },

  /**
   * Obter status da integração WhatsApp
   */
  getWhatsAppStatus: async (): Promise<{ configured: boolean; healthy: boolean; info?: any; error?: string }> => {
    try {
      const configInfo = whatsappService.getConfigInfo();
      
      if (!configInfo.enabled) {
        return {
          configured: false,
          healthy: false,
          error: 'WhatsApp não configurado'
        };
      }

      const healthCheck = await whatsappService.checkHealth();
      
      return {
        configured: healthCheck.configured,
        healthy: healthCheck.configured,
        info: {
          ...configInfo,
          phoneNumber: healthCheck.phoneNumber
        },
        error: healthCheck.error
      };
    } catch (error: any) {
      return {
        configured: false,
        healthy: false,
        error: error.message
      };
    }
  },

  // Agendar notificação de agendamento
  scheduleAppointmentNotification: async (params: {
    appointment_id: string;
    notification_type: NotificationType;
    send_immediately?: boolean;
    scheduled_for?: Date;
    custom_message?: string;
  }) => {
    try {
      const { appointment_id, notification_type, send_immediately = false, scheduled_for, custom_message } = params;

      // Buscar dados do agendamento
      const appointment = await db.appointment.findUnique({
        where: { id: appointment_id },
        include: {
          notifications: {
            where: { 
              notification_type,
              status: { in: ['sent', 'delivered'] }
            }
          }
        }
      });

      if (!appointment) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
      }

      // Verificar se já foi enviada notificação deste tipo
      if (appointment.notifications.length > 0 && notification_type !== 'reminder') {
        logger.info(`Notificação ${notification_type} já foi enviada para agendamento ${appointment_id}`);
        return { success: true, message: 'Notificação já enviada' };
      }

      // Buscar dados externos
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(appointment.customer_id, appointment.company_id),
        integrationService.getProfessionalById(appointment.professional_id, appointment.company_id),
        integrationService.getServiceById(appointment.service_id, appointment.company_id)
      ]);

      if (!customer || !professional || !service) {
        throw new AppointmentError(ErrorCode.INTEGRATION_ERROR, 'Erro ao buscar dados do agendamento');
      }

      // Preparar variáveis para o template
      const variables: INotificationVariables = {
        customer_name: customer.name,
        date: format(appointment.appointment_date, 'dd/MM/yyyy', { locale: ptBR }),
        time: appointment.appointment_time.toTimeString().substring(0, 5),
        professional: professional.name,
        service: service.name,
        company_name: 'Sua Empresa', // TODO: Buscar do config
        phone: '(11) 99999-9999' // TODO: Buscar do config
      };

      if (send_immediately) {
        return await notificationService.sendNotification({
          appointment_id,
          notification_type,
          channel: NotificationChannel.WHATSAPP, // Default
          phone: customer.phone,
          email: customer.email,
          custom_message,
          variables,
          send_immediately: true
        });
      } else if (scheduled_for) {
        // Adicionar à queue
        const job: NotificationJob = {
          id: `${appointment_id}-${notification_type}-${Date.now()}`,
          appointment_id,
          notification_type,
          channel: NotificationChannel.WHATSAPP,
          scheduled_for,
          variables,
          custom_message
        };

        notificationQueue.push(job);
        
        logger.info(`Notificação agendada: ${job.id} para ${format(scheduled_for, 'dd/MM/yyyy HH:mm')}`);
        
        return { 
          success: true, 
          message: 'Notificação agendada com sucesso',
          scheduled_for: scheduled_for.toISOString()
        };
      }

    } catch (error) {
      logger.error('Erro ao agendar notificação:', error);
      throw error;
    }
  },

  // Enviar notificação
  sendNotification: async (params: SendNotificationParams) => {
    try {
      const {
        appointment_id,
        notification_type,
        channel,
        phone,
        email,
        custom_message,
        variables,
        send_immediately = true
      } = params;

      // Buscar template de mensagem
      const appointment = await db.appointment.findUnique({
        where: { id: appointment_id }
      });

      if (!appointment) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
      }

      let messageContent = custom_message;
      let templateUsed: string | null = null;

      if (!custom_message) {
        const template = await db.messageTemplate.findFirst({
          where: {
            company_id: appointment.company_id,
            template_type: notification_type,
            channel,
            active: true
          },
          orderBy: { is_default: 'desc' }
        });

        if (!template) {
          throw new AppointmentError(ErrorCode.NOTIFICATION_FAILED, 'Template de mensagem não encontrado');
        }

        // Renderizar template com variáveis
        const compiledTemplate = Handlebars.compile(template.content);
        messageContent = compiledTemplate(variables || {});
        templateUsed = template.template_name;
      }

      // Criar registro de notificação
      const notification = await db.appointmentNotification.create({
        data: {
          appointment_id,
          notification_type,
          channel,
          recipient_phone: phone,
          recipient_email: email,
          message_template: templateUsed,
          message_content: messageContent,
          status: 'pending'
        }
      });

      let sendResult: any = null;

      // Enviar via canal apropriado
      switch (channel) {
        case NotificationChannel.WHATSAPP:
          if (!phone) {
            throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Telefone é obrigatório para WhatsApp');
          }
          sendResult = await integrationService.sendWhatsAppMessage(phone, messageContent!);
          break;

        case NotificationChannel.SMS:
          if (!phone) {
            throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Telefone é obrigatório para SMS');
          }
          sendResult = await notificationService.sendSMSMessage(phone, messageContent!);
          break;

        case NotificationChannel.EMAIL:
          if (!email) {
            throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Email é obrigatório para email');
          }
          sendResult = await notificationService.sendEmailMessage(email, messageContent!, notification_type);
          break;

        default:
          throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Canal de notificação não suportado');
      }

      // Atualizar status da notificação
      const updatedNotification = await db.appointmentNotification.update({
        where: { id: notification.id },
        data: {
          status: sendResult.success ? 'sent' : 'failed',
          sent_at: sendResult.success ? new Date() : null,
          failure_reason: sendResult.success ? null : sendResult.error,
          external_message_id: sendResult.data?.messages?.[0]?.id,
          provider_response: sendResult.data
        }
      });

      // Log da notificação
      if (sendResult.success) {
        notificationLogger.sent({
          notificationId: notification.id,
          appointmentId: appointment_id,
          type: notification_type,
          channel,
          recipient: phone || email,
          status: 'sent'
        });
      } else {
        notificationLogger.failed({
          notificationId: notification.id,
          appointmentId: appointment_id,
          type: notification_type,
          channel,
          recipient: phone || email,
          error: sendResult.error
        });
      }

      return {
        success: sendResult.success,
        notification_id: notification.id,
        message_sent: sendResult.success,
        error: sendResult.success ? null : sendResult.error,
        provider_response: sendResult.data
      };

    } catch (error) {
      logger.error('Erro ao enviar notificação:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.NOTIFICATION_FAILED,
        'Erro interno ao enviar notificação',
        500,
        error
      );
    }
  },

  // Enviar notificações em lote
  sendBulkNotifications: async (params: BulkNotificationParams) => {
    try {
      const {
        company_id,
        appointment_ids,
        template_type,
        channel,
        custom_message,
        send_immediately,
        scheduled_for,
        sent_by
      } = params;

      const results = {
        total: appointment_ids.length,
        success: 0,
        failed: 0,
        scheduled: 0,
        details: [] as any[]
      };

      for (const appointment_id of appointment_ids) {
        try {
          const result = await notificationService.scheduleAppointmentNotification({
            appointment_id,
            notification_type: template_type,
            send_immediately,
            scheduled_for,
            custom_message
          });

          if (result.success) {
            if (send_immediately) {
              results.success++;
            } else {
              results.scheduled++;
            }
          } else {
            results.failed++;
          }

          results.details.push({
            appointment_id,
            success: result.success,
            message: result.message
          });

        } catch (error) {
          results.failed++;
          results.details.push({
            appointment_id,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      logger.info(`Notificações em lote processadas: ${results.success} sucessos, ${results.failed} falhas, ${results.scheduled} agendadas`);

      return results;

    } catch (error) {
      logger.error('Erro ao processar notificações em lote:', error);
      throw new AppointmentError(
        ErrorCode.NOTIFICATION_FAILED,
        'Erro ao processar notificações em lote',
        500,
        error
      );
    }
  },

  // Enviar lembrete para agendamento específico
  sendAppointmentReminder: async (params: {
    appointment_id: string;
    company_id: string;
    channel: NotificationChannel;
    custom_message?: string;
    sent_by: string;
  }) => {
    try {
      const { appointment_id, channel, custom_message } = params;

      return await notificationService.scheduleAppointmentNotification({
        appointment_id,
        notification_type: NotificationType.REMINDER,
        send_immediately: true,
        custom_message
      });

    } catch (error) {
      logger.error(`Erro ao enviar lembrete para agendamento ${params.appointment_id}:`, error);
      throw error;
    }
  },

  // Enviar notificação de teste
  sendTestNotification: async (params: TestNotificationParams) => {
    try {
      const { company_id, template_type, channel, phone, email, variables, sent_by } = params;

      // Buscar template
      const template = await db.messageTemplate.findFirst({
        where: {
          company_id,
          template_type,
          channel,
          active: true
        },
        orderBy: { is_default: 'desc' }
      });

      if (!template) {
        throw new AppointmentError(ErrorCode.NOTIFICATION_FAILED, 'Template não encontrado');
      }

      // Renderizar template
      const compiledTemplate = Handlebars.compile(template.content);
      const messageContent = compiledTemplate(variables);

      let sendResult: any = null;

      // Enviar via canal apropriado
      switch (channel) {
        case NotificationChannel.WHATSAPP:
          sendResult = await integrationService.sendWhatsAppMessage(phone!, messageContent);
          break;

        case NotificationChannel.SMS:
          sendResult = await notificationService.sendSMSMessage(phone!, messageContent);
          break;

        case NotificationChannel.EMAIL:
          sendResult = await notificationService.sendEmailMessage(email!, messageContent, template_type);
          break;

        default:
          throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Canal não suportado');
      }

      logger.info(`Notificação de teste enviada via ${channel} para ${phone || email}`);

      return {
        success: sendResult.success,
        template_used: template.template_name,
        message_content: messageContent,
        channel,
        recipient: phone || email,
        provider_response: sendResult.data,
        error: sendResult.error
      };

    } catch (error) {
      logger.error('Erro ao enviar notificação de teste:', error);
      throw error;
    }
  },

  // Listar histórico de notificações
  getNotifications: async (params: {
    company_id: string;
    appointment_id?: string;
    notification_type?: NotificationType;
    channel?: NotificationChannel;
    status?: NotificationStatus;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      const {
        company_id,
        appointment_id,
        notification_type,
        channel,
        status,
        date_from,
        date_to,
        page = 1,
        limit = 50
      } = params;

      // Construir filtros
      const where: any = {
        appointment: {
          company_id
        },
        ...(appointment_id && { appointment_id }),
        ...(notification_type && { notification_type }),
        ...(channel && { channel }),
        ...(status && { status }),
        ...(date_from && date_to && {
          created_at: {
            gte: new Date(date_from),
            lte: new Date(date_to)
          }
        })
      };

      const [notifications, total] = await Promise.all([
        db.appointmentNotification.findMany({
          where,
          include: {
            appointment: {
              select: {
                id: true,
                appointment_date: true,
                appointment_time: true,
                customer_id: true,
                professional_id: true,
                service_id: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        db.appointmentNotification.count({ where })
      ]);

      return {
        notifications,
        total,
        page,
        limit
      };

    } catch (error) {
      logger.error('Erro ao listar notificações:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao listar notificações',
        500,
        error
      );
    }
  },

  // Obter estatísticas de notificações
  getNotificationStats: async (params: {
    company_id: string;
    date_from?: Date;
    date_to?: Date;
  }) => {
    try {
      const { company_id, date_from, date_to } = params;

      const where: any = {
        appointment: { company_id },
        ...(date_from && date_to && {
          created_at: {
            gte: date_from,
            lte: date_to
          }
        })
      };

      // Estatísticas por status
      const byStatus = await db.appointmentNotification.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      });

      // Estatísticas por canal
      const byChannel = await db.appointmentNotification.groupBy({
        by: ['channel'],
        where,
        _count: { channel: true }
      });

      // Estatísticas por tipo
      const byType = await db.appointmentNotification.groupBy({
        by: ['notification_type'],
        where,
        _count: { notification_type: true }
      });

      const total = byStatus.reduce((sum, item) => sum + item._count.status, 0);
      const successful = byStatus.find(item => item.status === 'sent')?._count.status || 0;
      const failed = byStatus.find(item => item.status === 'failed')?._count.status || 0;

      return {
        total,
        successful,
        failed,
        success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
        by_status: byStatus.reduce((acc, item) => ({
          ...acc,
          [item.status]: item._count.status
        }), {}),
        by_channel: byChannel.reduce((acc, item) => ({
          ...acc,
          [item.channel]: item._count.channel
        }), {}),
        by_type: byType.reduce((acc, item) => ({
          ...acc,
          [item.notification_type]: item._count.notification_type
        }), {})
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas de notificações:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao obter estatísticas',
        500,
        error
      );
    }
  },

  // === PRIVATE METHODS ===

  // Enviar SMS (placeholder para integração futura)
  sendSMSMessage: async (phone: string, message: string) => {
    // TODO: Implementar integração com provedor SMS (Twilio, etc)
    logger.info(`SMS seria enviado para ${phone}: ${message}`);
    
    return {
      success: false,
      error: 'SMS não implementado ainda'
    };
  },

  // Enviar Email (placeholder para integração futura)
  sendEmailMessage: async (email: string, message: string, type: NotificationType) => {
    // TODO: Implementar integração SMTP
    logger.info(`Email seria enviado para ${email}: ${message}`);
    
    return {
      success: false,
      error: 'Email não implementado ainda'
    };
  }
};

// Processar queue de notificações agendadas (executar a cada minuto)
// TEMPORARIAMENTE DESABILITADO - cron não importado
/* 
cron.schedule('* * * * *', async () => {
  const now = new Date();
  
  const jobsToProcess = notificationQueue.filter(
    job => job.scheduled_for <= now && !processedJobs.has(job.id)
  );

  for (const job of jobsToProcess) {
    try {
      await notificationService.sendNotification({
        appointment_id: job.appointment_id,
        notification_type: job.notification_type,
        channel: job.channel,
        variables: job.variables,
        custom_message: job.custom_message,
        send_immediately: true
      });

      processedJobs.add(job.id);
      logger.info(`Job processado: ${job.id}`);

    } catch (error) {
      logger.error(`Erro ao processar job ${job.id}:`, error);
      processedJobs.add(job.id); // Marcar como processado mesmo com erro
    }
  }

  // Limpar jobs antigos da queue
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24); // Remover jobs de mais de 24h

  const beforeLength = notificationQueue.length;
  notificationQueue.splice(0, notificationQueue.length, 
    ...notificationQueue.filter(job => job.scheduled_for > cutoff)
  );

  if (beforeLength !== notificationQueue.length) {
    logger.info(`${beforeLength - notificationQueue.length} jobs antigos removidos da queue`);
  }
});
*/

logger.info('Sistema de notificações inicializado');