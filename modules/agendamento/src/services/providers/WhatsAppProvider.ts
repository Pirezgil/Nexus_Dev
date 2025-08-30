/**
 * Provider para integração com Evolution API - WhatsApp Business
 * Responsável pelo envio de mensagens WhatsApp e controle de status
 */

import axios from 'axios';
import { logger } from '../../utils/logger';

interface WhatsAppMessage {
  phone: string;
  message: string;
  delay?: number;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppProvider {
  private apiUrl: string;
  private instanceKey: string;
  private token: string;

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://evolution.nexus.com';
    this.instanceKey = process.env.WHATSAPP_INSTANCE_KEY || '';
    this.token = process.env.WHATSAPP_TOKEN || '';

    if (!this.apiUrl || !this.instanceKey || !this.token) {
      logger.warn('WhatsApp Provider: Missing configuration. Check environment variables.');
    }
  }

  /**
   * Enviar mensagem WhatsApp via Evolution API
   */
  async sendMessage({ phone, message, delay }: WhatsAppMessage): Promise<WhatsAppResponse> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'WhatsApp provider não configurado'
        };
      }

      // Formatar telefone (remover caracteres especiais e adicionar formato WhatsApp)
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `55${cleanPhone}@s.whatsapp.net`;

      logger.info('Enviando mensagem WhatsApp', {
        phone: cleanPhone,
        formattedPhone,
        messageLength: message.length,
        delay: delay || 0
      });

      const response = await axios.post(
        `${this.apiUrl}/message/sendText/${this.instanceKey}`,
        {
          number: formattedPhone,
          text: message,
          delay: delay || 0
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.error) {
        logger.error('WhatsApp API retornou erro', {
          error: response.data.message,
          phone: cleanPhone
        });

        return {
          success: false,
          error: response.data.message || 'Erro na API do WhatsApp'
        };
      }

      logger.info('Mensagem WhatsApp enviada com sucesso', {
        phone: cleanPhone,
        messageId: response.data.key?.id || 'unknown'
      });

      return {
        success: true,
        messageId: response.data.key?.id || 'unknown'
      };

    } catch (error: any) {
      logger.error('Erro ao enviar mensagem WhatsApp', {
        error: error.message,
        stack: error.stack,
        phone: phone.replace(/\D/g, '')
      });

      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Obter status da mensagem
   */
  async getMessageStatus(messageId: string): Promise<string> {
    try {
      if (!this.isConfigured()) {
        return 'error';
      }

      const response = await axios.get(
        `${this.apiUrl}/chat/findMessages/${this.instanceKey}`,
        {
          params: { messageId },
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 5000
        }
      );

      return response.data.status || 'unknown';
    } catch (error) {
      logger.error('Erro ao obter status da mensagem WhatsApp', {
        messageId,
        error: error.message
      });
      return 'error';
    }
  }

  /**
   * Validar token do webhook
   */
  validateWebhookToken(token: string): boolean {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
    return expectedToken === token;
  }

  /**
   * Validar assinatura do webhook
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    // Implementar validação de assinatura se necessário
    // Por enquanto, retorna true se houver um token configurado
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookSecret) return true;

    // Aqui seria implementada a validação HMAC SHA256
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', webhookSecret)
    //   .update(payload)
    //   .digest('hex');
    // return signature === `sha256=${expectedSignature}`;

    return true;
  }

  /**
   * Verificar se o provider está configurado corretamente
   */
  private isConfigured(): boolean {
    return !!(this.apiUrl && this.instanceKey && this.token);
  }

  /**
   * Extrair mensagem de erro apropriada
   */
  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Não foi possível conectar com a API do WhatsApp';
    }
    
    if (error.code === 'ETIMEDOUT') {
      return 'Timeout ao enviar mensagem WhatsApp';
    }
    
    return error.message || 'Erro desconhecido ao enviar WhatsApp';
  }

  /**
   * Testar conectividade com a API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'WhatsApp provider não configurado'
        };
      }

      const response = await axios.get(
        `${this.apiUrl}/instance/connectionState/${this.instanceKey}`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` },
          timeout: 5000
        }
      );

      return {
        success: response.data.instance?.state === 'open'
      };

    } catch (error: any) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }
}