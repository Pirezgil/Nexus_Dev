/**
 * Integração completa com WhatsApp Business API
 * Suporta mensagens de texto, templates, webhooks e retry automático
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { 
  NotificationType, 
  NotificationStatus, 
  INotificationVariables,
  AppointmentError,
  ErrorCode
} from '../types';
import config from '../utils/config';
import { logger, integrationLogger } from '../utils/logger';

interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface WhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: any;
  };
}

interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  errors?: any[];
}

export class WhatsAppService {
  private client: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly webhookVerifyToken: string;
  private readonly appSecret: string;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = config.whatsapp.enabled;
    this.phoneNumberId = config.whatsapp.phoneNumberId || '';
    this.accessToken = config.whatsapp.accessToken || '';
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
    this.appSecret = process.env.WHATSAPP_APP_SECRET || '';

    if (this.enabled && (!this.phoneNumberId || !this.accessToken)) {
      logger.warn('WhatsApp está habilitado mas credenciais não foram fornecidas');
    }

    this.client = axios.create({
      baseURL: `${config.whatsapp.apiUrl}/${this.phoneNumberId}`,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Interceptors para logging
    this.client.interceptors.request.use((config) => {
      integrationLogger.whatsapp('request', undefined, undefined, true);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        integrationLogger.whatsapp('response', response.data.messages?.[0]?.id, undefined, true);
        return response;
      },
      (error) => {
        integrationLogger.whatsapp('error', undefined, undefined, false, error.message);
        return Promise.reject(error);
      }
    );

    if (this.enabled) {
      logger.info('WhatsApp Business API inicializado', {
        phoneNumberId: this.phoneNumberId ? this.phoneNumberId.substring(0, 8) + '...' : 'N/A',
        hasWebhookToken: !!this.webhookVerifyToken,
        hasAppSecret: !!this.appSecret
      });
    }
  }

  /**
   * Verificar se WhatsApp está configurado e ativo
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enviar mensagem de texto simples
   */
  async sendTextMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'WhatsApp não está habilitado' };
    }

    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      if (!this.validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Número de telefone inválido' };
      }

      const whatsAppMessage: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await this.client.post<WhatsAppResponse>('/messages', whatsAppMessage);
      
      const messageId = response.data.messages?.[0]?.id;
      
      logger.info('Mensagem WhatsApp enviada com sucesso', {
        messageId,
        phone: this.maskPhone(phone),
        messageLength: message.length
      });

      return { success: true, messageId };

    } catch (error) {
      logger.error('Erro ao enviar mensagem WhatsApp:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        const whatsAppError = error.response.data as WhatsAppError;
        return { 
          success: false, 
          error: whatsAppError.error?.message || 'Erro desconhecido da API WhatsApp' 
        };
      }

      return { success: false, error: 'Erro de conexão com WhatsApp' };
    }
  }

  /**
   * Enviar mensagem usando template pré-aprovado
   */
  async sendTemplateMessage(
    phone: string, 
    templateName: string, 
    languageCode: string = 'pt_BR',
    variables: string[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'WhatsApp não está habilitado' };
    }

    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      if (!this.validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Número de telefone inválido' };
      }

      const whatsAppMessage: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: variables.length > 0 ? [{
            type: 'body',
            parameters: variables.map(variable => ({
              type: 'text',
              text: variable
            }))
          }] : undefined
        }
      };

      const response = await this.client.post<WhatsAppResponse>('/messages', whatsAppMessage);
      
      const messageId = response.data.messages?.[0]?.id;
      
      logger.info('Template WhatsApp enviado com sucesso', {
        messageId,
        phone: this.maskPhone(phone),
        template: templateName,
        variables: variables.length
      });

      return { success: true, messageId };

    } catch (error) {
      logger.error('Erro ao enviar template WhatsApp:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        const whatsAppError = error.response.data as WhatsAppError;
        return { 
          success: false, 
          error: whatsAppError.error?.message || 'Erro desconhecido da API WhatsApp' 
        };
      }

      return { success: false, error: 'Erro de conexão com WhatsApp' };
    }
  }

  /**
   * Processar webhook de status de mensagem
   */
  async processWebhook(webhookData: any): Promise<MessageStatus[]> {
    try {
      const statuses: MessageStatus[] = [];
      
      if (webhookData.entry) {
        for (const entry of webhookData.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'messages' && change.value.statuses) {
                for (const status of change.value.statuses) {
                  statuses.push({
                    id: status.id,
                    status: this.mapWhatsAppStatus(status.status),
                    timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
                    recipient_id: status.recipient_id,
                    errors: status.errors
                  });
                }
              }
            }
          }
        }
      }

      logger.info('Webhook WhatsApp processado', { statusCount: statuses.length });
      return statuses;

    } catch (error) {
      logger.error('Erro ao processar webhook WhatsApp:', error);
      return [];
    }
  }

  /**
   * Verificar status de uma mensagem específica
   */
  async getMessageStatus(messageId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await this.client.get(`/messages/${messageId}`);
      
      return {
        success: true,
        status: response.data.status
      };

    } catch (error) {
      logger.error('Erro ao verificar status da mensagem:', error);
      return { success: false, error: 'Erro ao verificar status' };
    }
  }

  /**
   * Verificar saúde da API WhatsApp
   */
  async checkHealth(): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'WhatsApp não está habilitado' };
    }

    try {
      const startTime = Date.now();
      
      await this.client.get('/');
      
      const responseTime = Date.now() - startTime;
      
      return { success: true, responseTime };

    } catch (error) {
      logger.error('Health check WhatsApp falhou:', error);
      return { success: false, error: 'API WhatsApp indisponível' };
    }
  }

  /**
   * Obter templates disponíveis
   */
  async getMessageTemplates(): Promise<{ success: boolean; templates?: any[]; error?: string }> {
    try {
      const response = await this.client.get('/message_templates');
      
      return {
        success: true,
        templates: response.data.data
      };

    } catch (error) {
      logger.error('Erro ao buscar templates WhatsApp:', error);
      return { success: false, error: 'Erro ao buscar templates' };
    }
  }

  /**
   * Validar e verificar número de WhatsApp
   */
  async validatePhoneOnWhatsApp(phone: string): Promise<{ success: boolean; exists?: boolean; error?: string }> {
    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      
      // Este endpoint pode não estar disponível em todas as versões da API
      const response = await this.client.post('/contacts', {
        messaging_product: 'whatsapp',
        contacts: [cleanPhone]
      });

      const exists = response.data.contacts?.[0]?.status === 'valid';
      
      return { success: true, exists };

    } catch (error) {
      logger.warn('Erro ao validar número no WhatsApp (pode não estar disponível):', error);
      return { success: false, error: 'Validação não disponível' };
    }
  }

  /**
   * Enviar mensagem de teste
   */
  async sendTestMessage(phoneNumber: string, companyId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const testMessage = `🧪 *Teste WhatsApp - ERP Nexus*

Esta é uma mensagem de teste para verificar se a integração WhatsApp está funcionando corretamente.

Data/Hora: ${new Date().toLocaleString('pt-BR')}
Company ID: ${companyId}

Se você recebeu esta mensagem, a configuração está correta! ✅`;

    return this.sendTextMessage(phoneNumber, testMessage);
  }

  /**
   * Validar webhook token
   */
  validateWebhookToken(token: string): boolean {
    return token === this.webhookVerifyToken;
  }

  /**
   * Validar signature do webhook
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.appSecret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Formatar número para display
   */
  formatPhoneForDisplay(phone: string): string {
    const clean = this.cleanPhoneNumber(phone);
    if (clean.startsWith('55') && clean.length === 13) {
      // Formato brasileiro: +55 (11) 99999-9999
      return `+${clean.substring(0, 2)} (${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
    }
    return phone;
  }

  /**
   * Obter informações da configuração (sem expor credenciais)
   */
  getConfigInfo() {
    return {
      enabled: this.enabled,
      phoneNumberId: this.phoneNumberId ? this.phoneNumberId.substring(0, 8) + '...' : 'N/A',
      hasAccessToken: !!this.accessToken,
      hasWebhookToken: !!this.webhookVerifyToken,
      hasAppSecret: !!this.appSecret,
      apiUrl: config.whatsapp.apiUrl
    };
  }

  // === PRIVATE METHODS ===

  private cleanPhoneNumber(phone: string): string {
    // Remove todos os caracteres não numéricos
    let clean = phone.replace(/\D/g, '');
    
    // Se começar com 0, remove (formato nacional antigo)
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    
    // Adicionar código do país Brasil (55) se não tiver
    if (clean.length === 11 || clean.length === 10) {
      // Número brasileiro sem código do país
      clean = '55' + clean;
    } else if (clean.length === 12 && clean.startsWith('55')) {
      // Número brasileiro com código mas sem 9º dígito
      const areaCode = clean.substring(2, 4);
      const number = clean.substring(4);
      if (number.length === 8 && ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28'].includes(areaCode)) {
        // Adicionar 9º dígito para celulares
        clean = '55' + areaCode + '9' + number;
      }
    }
    
    return clean;
  }

  private validatePhoneNumber(phone: string): boolean {
    // Validar formato básico (deve ter entre 10 e 15 dígitos)
    if (!/^\d{10,15}$/.test(phone)) {
      return false;
    }
    
    // Se for número brasileiro (55), validar formato
    if (phone.startsWith('55') && phone.length === 13) {
      const areaCode = phone.substring(2, 4);
      const number = phone.substring(4);
      
      // Validar código de área brasileiro
      const validAreaCodes = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', 
                             '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49',
                             '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69',
                             '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89',
                             '91', '92', '93', '94', '95', '96', '97', '98', '99'];
      
      if (!validAreaCodes.includes(areaCode)) {
        logger.warn(`Código de área inválido: ${areaCode}`);
        return false;
      }
      
      // Validar se número de celular tem 9 dígitos
      if (number.length !== 9 || !number.startsWith('9')) {
        logger.warn(`Formato de celular inválido: ${number}`);
        return false;
      }
    }
    
    return true;
  }

  private maskPhone(phone: string): string {
    if (phone.length > 4) {
      return phone.substring(0, 2) + '***' + phone.substring(phone.length - 4);
    }
    return '***';
  }

  private mapWhatsAppStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' {
    switch (status) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return 'sent';
    }
  }
}

// Instância singleton
export const whatsappService = new WhatsAppService();