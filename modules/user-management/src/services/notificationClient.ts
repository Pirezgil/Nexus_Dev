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
   * Envia notificação de login bem-sucedido
   */
  async notifySuccessfulLogin(
    companyId: string,
    userId: string,
    userEmail: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'SUCCESS',
      priority: 'LOW',
      title: 'Login realizado',
      message: `Login realizado com sucesso em ${new Date().toLocaleString('pt-BR')}.`,
      data: {
        userEmail,
        ipAddress,
        userAgent,
        module: 'USER_MANAGEMENT',
        action: 'login_success'
      },
      channels: ['app']
    });
  }

  /**
   * Envia alerta de tentativa de login suspeita
   */
  async notifyFailedLogin(
    companyId: string,
    userId: string | null,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId: userId || 'system',
      type: 'WARNING',
      priority: 'HIGH',
      title: 'Tentativa de login suspeita',
      message: `Tentativa de login falhada para ${email} em ${new Date().toLocaleString('pt-BR')}.`,
      data: {
        email,
        ipAddress,
        userAgent,
        module: 'USER_MANAGEMENT',
        action: 'failed_login'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/users/security'
    });
  }

  /**
   * Envia notificação de novo usuário criado
   */
  async notifyUserCreated(
    companyId: string,
    adminUserId: string,
    newUserEmail: string,
    newUserName: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId: adminUserId,
      type: 'SUCCESS',
      priority: 'MEDIUM',
      title: 'Novo usuário cadastrado',
      message: `O usuário "${newUserName}" (${newUserEmail}) foi cadastrado no sistema.`,
      data: {
        newUserEmail,
        newUserName,
        module: 'USER_MANAGEMENT',
        action: 'user_created'
      },
      channels: ['app', 'email'],
      actionUrl: '/users/management'
    });
  }

  /**
   * Envia notificação de alteração de permissões
   */
  async notifyPermissionChanged(
    companyId: string,
    adminUserId: string,
    targetUserEmail: string,
    targetUserName: string,
    changedPermissions: string[]
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId: adminUserId,
      type: 'INFO',
      priority: 'MEDIUM',
      title: 'Permissões alteradas',
      message: `As permissões do usuário "${targetUserName}" foram alteradas. Permissões: ${changedPermissions.join(', ')}.`,
      data: {
        targetUserEmail,
        targetUserName,
        changedPermissions,
        module: 'USER_MANAGEMENT',
        action: 'permissions_changed'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/users/management'
    });
  }

  /**
   * Envia notificação de senha redefinida
   */
  async notifyPasswordReset(
    companyId: string,
    userId: string,
    userEmail: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'WARNING',
      priority: 'HIGH',
      title: 'Senha redefinida',
      message: `Sua senha foi redefinida com sucesso em ${new Date().toLocaleString('pt-BR')}.`,
      data: {
        userEmail,
        module: 'USER_MANAGEMENT',
        action: 'password_reset'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/profile/security'
    });
  }

  /**
   * Envia alerta de múltiplas tentativas de login
   */
  async notifyMultipleFailedLogins(
    companyId: string,
    email: string,
    attemptCount: number,
    ipAddress?: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId: 'system',
      type: 'CRITICAL',
      priority: 'CRITICAL',
      title: 'Múltiplas tentativas de login detectadas',
      message: `Foram detectadas ${attemptCount} tentativas de login falhadas para ${email} nos últimos minutos.`,
      data: {
        email,
        attemptCount,
        ipAddress,
        module: 'USER_MANAGEMENT',
        action: 'multiple_failed_logins'
      },
      channels: ['app', 'email', 'sms'],
      requireAction: true,
      actionUrl: '/users/security',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expira em 24 horas
    });
  }

  /**
   * Envia notificação de conta bloqueada
   */
  async notifyAccountLocked(
    companyId: string,
    userId: string,
    userEmail: string,
    reason: string
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'CRITICAL',
      priority: 'CRITICAL',
      title: 'Conta bloqueada',
      message: `Sua conta foi bloqueada por motivos de segurança: ${reason}.`,
      data: {
        userEmail,
        reason,
        module: 'USER_MANAGEMENT',
        action: 'account_locked'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/auth/unlock'
    });
  }

  /**
   * Envia notificação de alteração de perfil
   */
  async notifyProfileUpdated(
    companyId: string,
    userId: string,
    userEmail: string,
    changedFields: string[]
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId,
      type: 'INFO',
      priority: 'LOW',
      title: 'Perfil atualizado',
      message: `Seu perfil foi atualizado. Campos alterados: ${changedFields.join(', ')}.`,
      data: {
        userEmail,
        changedFields,
        module: 'USER_MANAGEMENT',
        action: 'profile_updated'
      },
      channels: ['app'],
      actionUrl: '/profile'
    });
  }

  /**
   * Envia notificação de erro no sistema de autenticação
   */
  async notifyAuthSystemError(
    companyId: string,
    errorType: string,
    errorMessage: string,
    context?: Record<string, any>
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      companyId,
      userId: 'system',
      type: 'ERROR',
      priority: 'HIGH',
      title: 'Erro no sistema de autenticação',
      message: `Erro detectado no sistema de autenticação: ${errorType} - ${errorMessage}`,
      data: {
        errorType,
        errorMessage,
        context,
        module: 'USER_MANAGEMENT',
        action: 'auth_system_error'
      },
      channels: ['app', 'email'],
      requireAction: true,
      actionUrl: '/admin/system-status'
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