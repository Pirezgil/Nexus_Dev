/**
 * Sistema de Queue Redis para mensagens WhatsApp
 * Suporta prioridades, retry automático, agendamento e processamento em lote
 */

import Redis from 'ioredis';
import { whatsappService } from '../integrations/whatsappService';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface QueuedMessage {
  id: string;
  phoneNumber: string;
  templateName?: string;
  parameters?: string[];
  textMessage?: string;
  appointmentId?: string;
  companyId: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  scheduledAt?: Date;
  createdAt: Date;
  messageType: 'template' | 'text';
}

interface ProcessingStats {
  processed: number;
  successful: number;
  failed: number;
  retried: number;
  startTime: Date;
}

export class MessageQueue {
  private redis: Redis;
  private isProcessing = false;
  private processingStats: ProcessingStats;
  private readonly QUEUE_KEYS = {
    high: 'notifications:high',
    normal: 'notifications:normal', 
    low: 'notifications:low',
    scheduled: 'notifications:scheduled',
    failed: 'notifications:failed',
    processing: 'notifications:processing'
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '3'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    this.processingStats = this.resetStats();

    // Event listeners para Redis
    this.redis.on('connect', () => {
      logger.info('Redis conectado - Message Queue pronto');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    // Iniciar processamento quando conectado
    this.redis.on('ready', () => {
      this.startProcessing();
    });
  }

  /**
   * Adicionar mensagem à queue
   */
  async enqueueMessage(message: Omit<QueuedMessage, 'id' | 'retryCount' | 'createdAt'>): Promise<string> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const queuedMessage: QueuedMessage = {
      ...message,
      id: messageId,
      retryCount: 0,
      createdAt: new Date()
    };

    try {
      if (message.scheduledAt) {
        // Mensagem agendada - usar sorted set com timestamp
        const scheduleTime = message.scheduledAt.getTime();
        await this.redis.zadd(
          this.QUEUE_KEYS.scheduled,
          scheduleTime,
          JSON.stringify(queuedMessage)
        );
        
        logger.info(`Mensagem agendada: ${messageId} para ${message.scheduledAt.toISOString()}`, {
          appointmentId: message.appointmentId,
          priority: message.priority
        });
      } else {
        // Mensagem imediata - adicionar à queue por prioridade
        const queueKey = this.QUEUE_KEYS[message.priority];
        await this.redis.lpush(queueKey, JSON.stringify(queuedMessage));
        
        logger.info(`Mensagem enfileirada: ${messageId} (${message.priority})`, {
          appointmentId: message.appointmentId,
          messageType: message.messageType
        });
      }

      return messageId;
    } catch (error) {
      logger.error('Erro ao enfileirar mensagem:', error);
      throw error;
    }
  }

  /**
   * Processar mensagem de confirmação
   */
  async enqueueConfirmation(appointmentData: any): Promise<string> {
    return this.enqueueMessage({
      phoneNumber: appointmentData.customer_phone,
      textMessage: this.buildConfirmationMessage(appointmentData),
      appointmentId: appointmentData.id,
      companyId: appointmentData.company_id,
      priority: 'high',
      maxRetries: 3,
      messageType: 'text'
    });
  }

  /**
   * Processar mensagem de lembrete (agendada)
   */
  async enqueueReminder(appointmentData: any, hoursBeforeDefault = 24): Promise<string> {
    const appointmentDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
    const reminderDateTime = new Date(appointmentDateTime.getTime() - (hoursBeforeDefault * 60 * 60 * 1000));

    // Verificar se reminder é no futuro
    if (reminderDateTime <= new Date()) {
      throw new Error('Horário do lembrete já passou');
    }

    return this.enqueueMessage({
      phoneNumber: appointmentData.customer_phone,
      textMessage: this.buildReminderMessage(appointmentData),
      appointmentId: appointmentData.id,
      companyId: appointmentData.company_id,
      priority: 'normal',
      maxRetries: 3,
      messageType: 'text',
      scheduledAt: reminderDateTime
    });
  }

  /**
   * Processar mensagem de cancelamento
   */
  async enqueueCancellation(appointmentData: any, cancellationReason?: string): Promise<string> {
    return this.enqueueMessage({
      phoneNumber: appointmentData.customer_phone,
      textMessage: this.buildCancellationMessage(appointmentData, cancellationReason),
      appointmentId: appointmentData.id,
      companyId: appointmentData.company_id,
      priority: 'high',
      maxRetries: 3,
      messageType: 'text'
    });
  }

  /**
   * Iniciar processamento automático
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingStats = this.resetStats();
    
    logger.info('Iniciando processamento da message queue');

    // Processar mensagens agendadas a cada 30s
    const scheduledProcessor = setInterval(() => {
      this.processScheduledMessages().catch(error => {
        logger.error('Erro no processamento de mensagens agendadas:', error);
      });
    }, 30000);

    // Loop principal de processamento
    while (this.isProcessing) {
      try {
        // Processar por ordem de prioridade
        const processed = await this.processQueue(this.QUEUE_KEYS.high, 'high') ||
                         await this.processQueue(this.QUEUE_KEYS.normal, 'normal') ||
                         await this.processQueue(this.QUEUE_KEYS.low, 'low');

        if (!processed) {
          // Sem mensagens para processar - aguardar um pouco
          await this.sleep(2000);
        }

      } catch (error) {
        logger.error('Erro no loop de processamento:', error);
        await this.sleep(5000); // Aguardar mais tempo em caso de erro
      }
    }

    // Limpar interval quando parar
    clearInterval(scheduledProcessor);
  }

  /**
   * Processar uma queue específica
   */
  private async processQueue(queueKey: string, priority: string): Promise<boolean> {
    const messageData = await this.redis.rpop(queueKey);
    if (!messageData) return false;

    try {
      const message: QueuedMessage = JSON.parse(messageData);
      
      // Marcar como sendo processada
      await this.redis.setex(`${this.QUEUE_KEYS.processing}:${message.id}`, 300, messageData); // 5min TTL
      
      await this.processMessage(message);
      
      // Remover do processing
      await this.redis.del(`${this.QUEUE_KEYS.processing}:${message.id}`);
      
      return true;
    } catch (error) {
      logger.error(`Erro ao processar mensagem da queue ${priority}:`, error);
      return false;
    }
  }

  /**
   * Processar mensagens agendadas que chegaram na hora
   */
  private async processScheduledMessages() {
    const now = Date.now();
    
    // Buscar mensagens cujo tempo chegou (até 10 por vez)
    const messages = await this.redis.zrangebyscore(
      this.QUEUE_KEYS.scheduled,
      '-inf',
      now.toString(),
      'LIMIT', '0', '10'
    );

    for (const messageData of messages) {
      try {
        const message: QueuedMessage = JSON.parse(messageData);
        
        // Remover da scheduled queue
        await this.redis.zrem(this.QUEUE_KEYS.scheduled, messageData);
        
        // Adicionar à queue de prioridade apropriada para processamento imediato
        const queueKey = this.QUEUE_KEYS[message.priority];
        await this.redis.lpush(queueKey, messageData);
        
        logger.info(`Mensagem agendada movida para processamento: ${message.id}`);
      } catch (error) {
        logger.error('Erro ao processar mensagem agendada:', error);
        // Remover mensagem corrompida
        await this.redis.zrem(this.QUEUE_KEYS.scheduled, messageData);
      }
    }
  }

  /**
   * Processar uma mensagem individual
   */
  private async processMessage(message: QueuedMessage) {
    this.processingStats.processed++;
    
    try {
      logger.info(`Processando mensagem ${message.id} (tentativa ${message.retryCount + 1})`, {
        appointmentId: message.appointmentId,
        messageType: message.messageType
      });

      let result;

      if (message.messageType === 'template' && message.templateName && message.parameters) {
        result = await whatsappService.sendTemplateMessage(
          message.phoneNumber,
          message.templateName,
          message.parameters
        );
      } else if (message.messageType === 'text' && message.textMessage) {
        result = await whatsappService.sendTextMessage(
          message.phoneNumber,
          message.textMessage
        );
      } else {
        throw new Error('Tipo de mensagem inválido ou dados incompletos');
      }

      if (result.success) {
        this.processingStats.successful++;
        await this.saveMessageLog(message, 'sent', result.messageId);
        
        logger.info(`Mensagem ${message.id} enviada com sucesso`, {
          whatsappId: result.messageId,
          appointmentId: message.appointmentId
        });
      } else {
        throw new Error(result.error || 'Erro desconhecido do WhatsApp');
      }

    } catch (error: any) {
      await this.handleMessageError(message, error);
    }
  }

  /**
   * Lidar com erro no processamento
   */
  private async handleMessageError(message: QueuedMessage, error: Error) {
    logger.error(`Falha ao processar mensagem ${message.id}:`, error);
    
    if (message.retryCount < message.maxRetries) {
      // Retry com backoff exponencial
      message.retryCount++;
      this.processingStats.retried++;
      
      const delayMinutes = Math.pow(2, message.retryCount); // 2, 4, 8 minutos
      const retryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
      
      // Reagendar para retry
      await this.redis.zadd(
        this.QUEUE_KEYS.scheduled,
        retryTime.getTime(),
        JSON.stringify(message)
      );
      
      logger.info(`Mensagem ${message.id} reagendada para retry em ${delayMinutes} minutos`, {
        retryCount: message.retryCount,
        maxRetries: message.maxRetries
      });
      
    } else {
      // Max retries excedido - marcar como falhada
      this.processingStats.failed++;
      
      await this.redis.lpush(this.QUEUE_KEYS.failed, JSON.stringify({
        ...message,
        failedAt: new Date(),
        lastError: error.message
      }));
      
      await this.saveMessageLog(message, 'failed', undefined, error.message);
      
      logger.error(`Mensagem ${message.id} falhou definitivamente após ${message.maxRetries} tentativas`);
    }
  }

  /**
   * Salvar log da mensagem no banco
   */
  private async saveMessageLog(
    message: QueuedMessage,
    status: 'sent' | 'failed' | 'pending',
    externalMessageId?: string,
    errorMessage?: string
  ) {
    try {
      if (!message.appointmentId) return; // Skip se não for relacionado a appointment

      await db.appointmentNotification.upsert({
        where: {
          appointment_id_notification_type_channel: {
            appointment_id: message.appointmentId,
            notification_type: this.getNotificationTypeFromMessage(message),
            channel: 'whatsapp'
          }
        },
        update: {
          status,
          external_message_id: externalMessageId,
          sent_at: status === 'sent' ? new Date() : undefined,
          failure_reason: errorMessage
        },
        create: {
          appointment_id: message.appointmentId,
          notification_type: this.getNotificationTypeFromMessage(message),
          channel: 'whatsapp',
          recipient_phone: message.phoneNumber,
          message_content: message.textMessage || `Template: ${message.templateName}`,
          status,
          external_message_id: externalMessageId,
          sent_at: status === 'sent' ? new Date() : undefined,
          failure_reason: errorMessage
        }
      });

    } catch (error) {
      logger.error('Erro ao salvar log da mensagem:', error);
    }
  }

  /**
   * Obter estatísticas da queue
   */
  async getQueueStats() {
    try {
      const [highCount, normalCount, lowCount, scheduledCount, failedCount, processingCount] = await Promise.all([
        this.redis.llen(this.QUEUE_KEYS.high),
        this.redis.llen(this.QUEUE_KEYS.normal),
        this.redis.llen(this.QUEUE_KEYS.low),
        this.redis.zcard(this.QUEUE_KEYS.scheduled),
        this.redis.llen(this.QUEUE_KEYS.failed),
        this.redis.keys(`${this.QUEUE_KEYS.processing}:*`).then(keys => keys.length)
      ]);

      const uptime = Date.now() - this.processingStats.startTime.getTime();

      return {
        queues: {
          high: highCount,
          normal: normalCount,
          low: lowCount,
          scheduled: scheduledCount,
          failed: failedCount,
          processing: processingCount
        },
        processing: {
          isActive: this.isProcessing,
          uptime: Math.floor(uptime / 1000), // seconds
          ...this.processingStats
        }
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas da queue:', error);
      return null;
    }
  }

  /**
   * Parar processamento gracefully
   */
  async stopProcessing() {
    logger.info('Parando processamento da message queue...');
    this.isProcessing = false;
    
    // Aguardar um pouco para terminar processamento atual
    await this.sleep(2000);
    
    await this.redis.disconnect();
    logger.info('Message queue parada');
  }

  // === PRIVATE HELPER METHODS ===

  private resetStats(): ProcessingStats {
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      startTime: new Date()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getNotificationTypeFromMessage(message: QueuedMessage): string {
    if (message.textMessage?.includes('Confirmado')) return 'confirmation';
    if (message.textMessage?.includes('Lembrete')) return 'reminder';
    if (message.textMessage?.includes('Cancelado')) return 'cancellation';
    return 'notification';
  }

  private buildConfirmationMessage(appointmentData: any): string {
    return `✅ *Agendamento Confirmado!*

Olá ${appointmentData.customer_name}, seu agendamento foi confirmado:

📅 *Data:* ${new Date(appointmentData.appointment_date).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${appointmentData.appointment_time}
👨‍⚕️ *Profissional:* ${appointmentData.professional_name}
💼 *Serviço:* ${appointmentData.service_name}

Em caso de dúvidas, entre em contato conosco.

Obrigado pela preferência! 😊`;
  }

  private buildReminderMessage(appointmentData: any): string {
    return `⏰ *Lembrete de Agendamento*

Olá ${appointmentData.customer_name}, lembrando que você tem um agendamento:

📅 *Data:* ${new Date(appointmentData.appointment_date).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${appointmentData.appointment_time}
👨‍⚕️ *Profissional:* ${appointmentData.professional_name}
💼 *Serviço:* ${appointmentData.service_name}

Caso precise remarcar, entre em contato conosco com antecedência.

Te esperamos! 😊`;
  }

  private buildCancellationMessage(appointmentData: any, cancellationReason?: string): string {
    return `❌ *Agendamento Cancelado*

Olá ${appointmentData.customer_name}, informamos que seu agendamento foi cancelado:

📅 *Data:* ${new Date(appointmentData.appointment_date).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${appointmentData.appointment_time}
👨‍⚕️ *Profissional:* ${appointmentData.professional_name}

${cancellationReason ? `*Motivo:* ${cancellationReason}` : ''}

Para reagendar, entre em contato conosco.

Obrigado pela compreensão! 🙏`;
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();