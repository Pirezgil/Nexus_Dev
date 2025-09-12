import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface NotificationPayload {
  companyId: string;
  userId: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'CRITICAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: string[];
  scheduledFor?: Date;
  expiresAt?: Date;
  requireAction?: boolean;
  actionUrl?: string;
}

export interface SendNotificationResponse {
  success: boolean;
  notificationId?: string;
  error?: string;
}

export class NotificationClient {
  private client: AxiosInstance;
  private isHealthy: boolean = true;

  constructor() {
    const baseURL = process.env.NOTIFICATIONS_URL || 'http://nexus-notifications:5006';
    
    this.client = axios.create({
      baseURL: `${baseURL}/api/notifications`,
      timeout: 10000, // 10 segundos
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para adicionar headers de autenticação inter-serviços
    this.client.interceptors.request.use((config) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const hmacSecret = process.env.GATEWAY_HMAC_SECRET;
      
      if (hmacSecret) {
        const crypto = require('crypto');
        const bodyString = config.data ? JSON.stringify(config.data) : '';
        const dataToSign = `${timestamp}.${config.method?.toUpperCase()}.${config.url}.${bodyString}`;
        const signature = crypto
          .createHmac('sha256', hmacSecret)
          .update(dataToSign, 'utf8')
          .digest('hex');
        
        config.headers['X-Gateway-Timestamp'] = timestamp;
        config.headers['X-Gateway-Signature'] = signature;
        config.headers['X-Gateway-Request-ID'] = Math.random().toString(36).substr(2, 9);
      }
      
      return config;
    });

    // Interceptor para tratar erros
    this.client.interceptors.response.use(
      (response) => {
        this.isHealthy = true;
        return response;
      },
      (error) => {
        logger.error('Notification service error:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        
        if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
          this.isHealthy = false;
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Envia uma notificação
   */
  async sendNotification(payload: NotificationPayload): Promise<SendNotificationResponse> {
    try {
      const response = await this.client.post('/', payload);
      
      logger.info('Notification sent successfully', {
        notificationId: response.data.id,
        title: payload.title,
        companyId: payload.companyId,
        userId: payload.userId
      });

      return {
        success: true,
        notificationId: response.data.id
      };
    } catch (error: any) {
      logger.warn('Failed to send notification', {
        error: error.message,
        payload: { title: payload.title, type: payload.type }
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia notificação de novo cliente criado
   */
  async notifyCustomerCreated(
    companyId: string,
    userId: string,
    customerName: string,
    customerId: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'SUCCESS',
      priority: 'MEDIUM',
      title: 'Novo cliente cadastrado',
      message: `O cliente "${customerName}" foi cadastrado com sucesso no CRM.`,
      data: {
        customerId,
        customerName,
        module: 'CRM',
        action: 'customer_created'
      },
      channels: ['app', 'email'],
      actionUrl: `/crm/${customerId}`
    });
  }

  /**
   * Envia notificação de cliente atualizado
   */
  async notifyCustomerUpdated(
    companyId: string,
    userId: string,
    customerName: string,
    customerId: string,
    changes: string[]
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'INFO',
      priority: 'LOW',
      title: 'Cliente atualizado',
      message: `O cliente "${customerName}" foi atualizado. Campos alterados: ${changes.join(', ')}.`,
      data: {
        customerId,
        customerName,
        changes,
        module: 'CRM',
        action: 'customer_updated'
      },
      channels: ['app'],
      actionUrl: `/crm/${customerId}`
    });
  }

  /**
   * Envia notificação de cliente removido
   */
  async notifyCustomerDeleted(
    companyId: string,
    userId: string,
    customerName: string,
    customerId: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'WARNING',
      priority: 'MEDIUM',
      title: 'Cliente removido',
      message: `O cliente "${customerName}" foi removido do sistema.`,
      data: {
        customerId,
        customerName,
        module: 'CRM',
        action: 'customer_deleted'
      },
      channels: ['app', 'email']
    });
  }

  /**
   * Envia notificação de interação criada
   */
  async notifyInteractionCreated(
    companyId: string,
    userId: string,
    customerName: string,
    customerId: string,
    interactionType: string,
    interactionTitle: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'INFO',
      priority: 'LOW',
      title: 'Nova interação registrada',
      message: `Nova interação "${interactionTitle}" registrada para o cliente "${customerName}".`,
      data: {
        customerId,
        customerName,
        interactionType,
        interactionTitle,
        module: 'CRM',
        action: 'interaction_created'
      },
      channels: ['app'],
      actionUrl: `/crm/${customerId}`
    });
  }

  /**
   * Envia notificação de problema no CRM
   */
  async notifyError(
    companyId: string,
    userId: string,
    operation: string,
    errorMessage: string,
    context?: Record<string, any>
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'ERROR',
      priority: 'HIGH',
      title: 'Erro no CRM',
      message: `Erro durante operação "${operation}": ${errorMessage}`,
      data: {
        operation,
        errorMessage,
        context,
        module: 'CRM',
        action: 'error'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/crm/dashboard'
    });
  }

  /**
   * Envia alerta sobre cliente inativo
   */
  async notifyInactiveCustomer(
    companyId: string,
    userId: string,
    customerName: string,
    customerId: string,
    daysSinceLastInteraction: number
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'WARNING',
      priority: 'MEDIUM',
      title: 'Cliente inativo detectado',
      message: `O cliente "${customerName}" não tem interações há ${daysSinceLastInteraction} dias. Considere fazer um contato.`,
      data: {
        customerId,
        customerName,
        daysSinceLastInteraction,
        module: 'CRM',
        action: 'inactive_customer_alert'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: `/crm/${customerId}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expira em 7 dias
    });
  }

  /**
   * Verifica se o serviço de notificações está saudável
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.get('/health');
      this.isHealthy = true;
      return true;
    } catch (error) {
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Retorna o status de saúde atual
   */
  isServiceHealthy(): boolean {
    return this.isHealthy;
  }
}

// Instância singleton
export const notificationClient = new NotificationClient();