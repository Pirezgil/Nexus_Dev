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

interface NotificationJob {
  appointmentId: string;
  type: 'confirmation' | 'reminder' | 'cancellation' | 'reschedule';
  channels: ('whatsapp' | 'sms' | 'email')[];
  delay?: number; // em minutos
  companyId: string;
}

interface AppointmentData {
  id: string;
  company_id: string;
  customer_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: Date;
  appointment_time: string;
  status: string;
  // Dados desnormalizados para evitar joins complexos
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceName?: string;
  professionalName?: string;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
}

export class NotificationService {
  private whatsappProvider: WhatsAppProvider;
  private smsProvider: SMSProvider;
  private emailProvider: EmailProvider;
  private notificationQueue: Queue.Queue;

  constructor() {
    this.whatsappProvider = new WhatsAppProvider();
    this.smsProvider = new SMSProvider();
    this.emailProvider = new EmailProvider();
    
    // Inicializar fila Redis
    this.notificationQueue = new Queue('notifications', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Manter 100 jobs completos
        removeOnFail: 50, // Manter 50 jobs com falha
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupQueueProcessor();
    this.setupQueueEventHandlers();

    logger.info('NotificationService inicializado com sucesso');
  }

  /**
   * Agendar notificação na fila
   */
  async scheduleNotification(job: NotificationJob): Promise<void> {
    try {
      const delay = job.delay ? job.delay * 60 * 1000 : 0; // Converter minutos para ms
      
      const queueJob = await this.notificationQueue.add(
        'send-notification',
        job,
        {
          delay,
          jobId: `${job.appointmentId}-${job.type}-${Date.now()}`, // ID único
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );

      logger.info('Notificação agendada na fila', {
        jobId: queueJob.id,
        appointmentId: job.appointmentId,
        type: job.type,
        channels: job.channels,
        delay: job.delay
      });

    } catch (error: any) {
      logger.error('Erro ao agendar notificação', {
        appointmentId: job.appointmentId,
        type: job.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Configurar processador da fila
   */
  private setupQueueProcessor() {
    this.notificationQueue.process('send-notification', async (job) => {
      const { appointmentId, type, channels, companyId } = job.data;

      try {
        logger.info('Processando job de notificação', {
          jobId: job.id,
          appointmentId,
          type,
          channels
        });

        // Buscar dados do agendamento
        const appointment = await this.getAppointmentData(appointmentId);
        if (!appointment) {
          throw new Error(`Agendamento ${appointmentId} não encontrado`);
        }

        // Obter templates para a empresa
        const templates = await this.getTemplates(companyId, type);

        // Preparar variáveis do template
        const variables = {
          customer_name: appointment.customerName || 'Cliente',
          customer_phone: appointment.customerPhone || '',
          appointment_date: TemplateEngine.formatDate(appointment.appointment_date),
          appointment_time: TemplateEngine.formatTime(appointment.appointment_time),
          service_name: appointment.serviceName || 'Serviço',
          professional_name: appointment.professionalName || 'Profissional',
          company_name: appointment.companyName || 'Empresa',
          company_phone: appointment.companyPhone || '',
          company_address: appointment.companyAddress || ''
        };

        // Validar variáveis obrigatórias
        const validation = TemplateEngine.validateVariables(variables);
        if (!validation.valid) {
          logger.warn('Variáveis de template faltando', {
            appointmentId,
            missing: validation.missing
          });
        }

        // Enviar notificações por cada canal
        const results = [];
        for (const channel of channels) {
          try {
            const result = await this.sendNotification(
              appointment,
              channel,
              type,
              templates[channel],
              variables
            );
            results.push({ channel, success: result.success, error: result.error });
          } catch (error: any) {
            logger.error(`Erro no canal ${channel}`, {
              appointmentId,
              channel,
              error: error.message
            });
            results.push({ channel, success: false, error: error.message });
          }
        }

        // Log do resultado final
        const successCount = results.filter(r => r.success).length;
        logger.info('Job de notificação processado', {
          jobId: job.id,
          appointmentId,
          type,
          totalChannels: channels.length,
          successCount,
          results
        });

        return results;

      } catch (error: any) {
        logger.error('Erro ao processar job de notificação', {
          jobId: job.id,
          appointmentId,
          error: error.message,
          stack: error.stack
        });
        throw error; // Re-throw para trigger retry
      }
    });
  }

  /**
   * Configurar event handlers da fila
   */
  private setupQueueEventHandlers() {
    this.notificationQueue.on('completed', (job, result) => {
      logger.info('Job de notificação completado', {
        jobId: job.id,
        appointmentId: job.data.appointmentId,
        type: job.data.type,
        result
      });
    });

    this.notificationQueue.on('failed', (job, err) => {
      logger.error('Job de notificação falhou', {
        jobId: job.id,
        appointmentId: job.data.appointmentId,
        type: job.data.type,
        error: err.message,
        attempts: job.attemptsMade
      });
    });

    this.notificationQueue.on('stalled', (job) => {
      logger.warn('Job de notificação travado', {
        jobId: job.id,
        appointmentId: job.data.appointmentId
      });
    });
  }

  /**
   * Buscar dados do agendamento com informações relacionadas
   */
  private async getAppointmentData(appointmentId: string): Promise<AppointmentData | null> {
    try {
      // Por enquanto, buscar apenas do banco local
      // Em implementação futura, pode integrar com outros módulos via API
      const appointment = await db.appointment.findUnique({
        where: { id: appointmentId }
      });

      if (!appointment) {
        return null;
      }

      // TODO: Integrar com outros módulos para buscar dados relacionados
      // Por enquanto, usar dados mock ou desnormalizados
      return {
        id: appointment.id,
        company_id: appointment.company_id,
        customer_id: appointment.customer_id,
        professional_id: appointment.professional_id,
        service_id: appointment.service_id,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time.toISOString().slice(11, 16), // HH:MM
        status: appointment.status,
        // Dados que deveriam vir de outros módulos
        customerName: 'Cliente Exemplo', // TODO: Buscar do módulo CRM
        customerPhone: '11999999999', // TODO: Buscar do módulo CRM
        customerEmail: 'cliente@exemplo.com', // TODO: Buscar do módulo CRM
        serviceName: 'Consulta Médica', // TODO: Buscar do módulo Services
        professionalName: 'Dr. João Silva', // TODO: Buscar do módulo Services
        companyName: 'Clínica Exemplo',
        companyPhone: '1133334444',
        companyAddress: 'Rua das Flores, 123 - São Paulo, SP'
      };

    } catch (error: any) {
      logger.error('Erro ao buscar dados do agendamento', {
        appointmentId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Obter templates para a empresa e tipo de notificação
   */
  private async getTemplates(companyId: string, type: string) {
    try {
      // Buscar templates customizados da empresa
      const customTemplates = await db.messageTemplate.findMany({
        where: {
          company_id: companyId,
          template_type: type,
          active: true
        }
      });

      const defaults = TemplateEngine.getDefaultTemplates();
      const result: any = {};

      // Para cada canal, usar template customizado se existir, senão usar padrão
      const channels = ['whatsapp', 'sms', 'email'];
      
      for (const channel of channels) {
        const custom = customTemplates.find(t => t.channel === channel);
        if (custom) {
          result[channel] = channel === 'email' ? 
            { subject: custom.subject, html: custom.content } : 
            custom.content;
        } else {
          result[channel] = defaults[channel][type];
        }
      }

      return result;

    } catch (error: any) {
      logger.error('Erro ao buscar templates', {
        companyId,
        type,
        error: error.message
      });
      
      // Fallback para templates padrão
      const defaults = TemplateEngine.getDefaultTemplates();
      return {
        whatsapp: defaults.whatsapp[type],
        sms: defaults.sms[type],
        email: defaults.email[type]
      };
    }
  }

  /**
   * Enviar notificação por um canal específico
   */
  private async sendNotification(
    appointment: AppointmentData,
    channel: string,
    type: string,
    template: any,
    variables: any
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Criar registro de notificação
    const notificationRecord = await db.appointmentNotification.create({
      data: {
        appointment_id: appointment.id,
        notification_type: type,
        channel: channel,
        recipient_phone: appointment.customerPhone,
        recipient_email: appointment.customerEmail,
        message_template: `${type}_${channel}`,
        status: 'pending'
      }
    });

    try {
      let result: any = { success: false };
      let messageContent = '';

      switch (channel) {
        case 'whatsapp':
          if (!appointment.customerPhone) {
            throw new Error('Telefone do cliente não informado');
          }
          messageContent = TemplateEngine.render(template, variables);
          result = await this.whatsappProvider.sendMessage({
            phone: appointment.customerPhone,
            message: messageContent
          });
          break;

        case 'sms':
          if (!appointment.customerPhone) {
            throw new Error('Telefone do cliente não informado');
          }
          messageContent = TemplateEngine.render(template, variables);
          result = await this.smsProvider.sendMessage(
            appointment.customerPhone,
            messageContent
          );
          break;

        case 'email':
          if (!appointment.customerEmail) {
            throw new Error('Email do cliente não informado');
          }
          const emailTemplate = TemplateEngine.renderEmail(template, variables);
          result = await this.emailProvider.sendHTMLMessage(
            appointment.customerEmail,
            emailTemplate.subject,
            emailTemplate.html
          );
          messageContent = emailTemplate.html;
          break;

        default:
          throw new Error(`Canal não suportado: ${channel}`);
      }

      // Atualizar registro de notificação
      await db.appointmentNotification.update({
        where: { id: notificationRecord.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          message_content: messageContent,
          external_message_id: result.messageId,
          sent_at: result.success ? new Date() : null,
          failure_reason: result.error
        }
      });

      logger.info(`Notificação ${channel} processada`, {
        appointmentId: appointment.id,
        channel,
        success: result.success,
        messageId: result.messageId
      });

      return result;

    } catch (error: any) {
      await db.appointmentNotification.update({
        where: { id: notificationRecord.id },
        data: {
          status: 'failed',
          failure_reason: error.message
        }
      });

      logger.error(`Erro na notificação ${channel}`, {
        appointmentId: appointment.id,
        channel,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Métodos públicos para diferentes tipos de notificação

  /**
   * Enviar confirmação de agendamento
   */
  async sendConfirmation(
    appointmentId: string,
    companyId: string,
    channels: string[] = ['whatsapp', 'email']
  ): Promise<void> {
    await this.scheduleNotification({
      appointmentId,
      companyId,
      type: 'confirmation',
      channels: channels as any,
      delay: 0 // Enviar imediatamente
    });
  }

  /**
   * Agendar lembrete
   */
  async scheduleReminder(
    appointmentId: string,
    companyId: string,
    hoursBeforeAppointment: number = 24
  ): Promise<void> {
    await this.scheduleNotification({
      appointmentId,
      companyId,
      type: 'reminder',
      channels: ['whatsapp', 'sms'],
      delay: hoursBeforeAppointment * 60 // Converter horas para minutos
    });
  }

  /**
   * Enviar cancelamento
   */
  async sendCancellation(
    appointmentId: string,
    companyId: string
  ): Promise<void> {
    await this.scheduleNotification({
      appointmentId,
      companyId,
      type: 'cancellation',
      channels: ['whatsapp', 'email'],
      delay: 0
    });
  }

  /**
   * Enviar confirmação de reagendamento
   */
  async sendReschedule(
    appointmentId: string,
    companyId: string
  ): Promise<void> {
    await this.scheduleNotification({
      appointmentId,
      companyId,
      type: 'reschedule',
      channels: ['whatsapp', 'email'],
      delay: 0
    });
  }

  /**
   * Obter estatísticas da fila
   */
  async getQueueStats(): Promise<any> {
    const waiting = await this.notificationQueue.getWaiting();
    const active = await this.notificationQueue.getActive();
    const completed = await this.notificationQueue.getCompleted();
    const failed = await this.notificationQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  }

  /**
   * Limpar jobs antigos da fila
   */
  async cleanQueue(graceMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.notificationQueue.clean(graceMs, 'completed');
    await this.notificationQueue.clean(graceMs, 'failed');
    logger.info('Fila de notificações limpa', { graceMs });
  }

  /**
   * Pausar processamento da fila
   */
  async pauseQueue(): Promise<void> {
    await this.notificationQueue.pause();
    logger.info('Fila de notificações pausada');
  }

  /**
   * Retomar processamento da fila
   */
  async resumeQueue(): Promise<void> {
    await this.notificationQueue.resume();
    logger.info('Fila de notificações retomada');
  }

  /**
   * Fechar conexões (para shutdown graceful)
   */
  async close(): Promise<void> {
    await this.notificationQueue.close();
    await this.emailProvider.close();
    logger.info('NotificationService finalizado');
  }
}

// Instância singleton do serviço
export const notificationService = new NotificationService();