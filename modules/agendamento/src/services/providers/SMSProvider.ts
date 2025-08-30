/**
 * Provider para SMS usando Twilio
 * Responsável pelo envio de mensagens SMS e controle de status
 */

import twilio from 'twilio';
import { logger } from '../../utils/logger';

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSProvider {
  private client: twilio.Twilio | null = null;
  private fromPhone: string;
  private isConfigured: boolean = false;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromPhone = process.env.TWILIO_PHONE_NUMBER || '';

    if (accountSid && authToken && this.fromPhone) {
      try {
        this.client = twilio(accountSid, authToken);
        this.isConfigured = true;
        logger.info('SMS Provider (Twilio) configurado com sucesso');
      } catch (error: any) {
        logger.error('Erro ao configurar Twilio client', {
          error: error.message
        });
      }
    } else {
      logger.warn('SMS Provider: Credenciais Twilio não configuradas');
    }
  }

  /**
   * Enviar mensagem SMS
   */
  async sendMessage(phone: string, message: string): Promise<SMSResponse> {
    try {
      if (!this.isConfigured || !this.client) {
        return {
          success: false,
          error: 'SMS provider não configurado'
        };
      }

      // Formatar telefone para padrão internacional
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `+55${cleanPhone}`;

      logger.info('Enviando SMS', {
        phone: cleanPhone,
        messageLength: message.length,
        from: this.fromPhone
      });

      const result = await this.client.messages.create({
        body: message,
        from: this.fromPhone,
        to: formattedPhone
      });

      logger.info('SMS enviado com sucesso', {
        phone: cleanPhone,
        messageId: result.sid,
        status: result.status
      });

      return {
        success: true,
        messageId: result.sid
      };

    } catch (error: any) {
      logger.error('Erro ao enviar SMS', {
        error: error.message,
        code: error.code,
        phone: phone.replace(/\D/g, ''),
        moreInfo: error.moreInfo
      });

      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Obter status da mensagem SMS
   */
  async getMessageStatus(messageId: string): Promise<string> {
    try {
      if (!this.isConfigured || !this.client) {
        return 'error';
      }

      const message = await this.client.messages(messageId).fetch();
      
      logger.debug('Status SMS obtido', {
        messageId,
        status: message.status
      });

      return this.mapTwilioStatus(message.status);

    } catch (error: any) {
      logger.error('Erro ao obter status SMS', {
        messageId,
        error: error.message
      });
      return 'error';
    }
  }

  /**
   * Mapear status do Twilio para nosso padrão
   */
  private mapTwilioStatus(twilioStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'queued': 'pending',
      'sent': 'sent',
      'received': 'delivered',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed'
    };

    return statusMap[twilioStatus] || twilioStatus;
  }

  /**
   * Extrair mensagem de erro apropriada
   */
  private getErrorMessage(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 21211:
          return 'Número de telefone inválido';
        case 21608:
          return 'Número não pode receber SMS';
        case 21614:
          return 'Número não é um celular válido';
        case 30007:
          return 'Falha na entrega da mensagem';
        default:
          return `Erro Twilio ${error.code}: ${error.message}`;
      }
    }

    return error.message || 'Erro desconhecido ao enviar SMS';
  }

  /**
   * Testar conectividade com Twilio
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured || !this.client) {
        return {
          success: false,
          error: 'SMS provider não configurado'
        };
      }

      // Testar fazendo uma consulta simples à conta
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      
      return {
        success: account.status === 'active'
      };

    } catch (error: any) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Obter saldo da conta (se disponível)
   */
  async getAccountBalance(): Promise<{ balance?: string; currency?: string; error?: string }> {
    try {
      if (!this.isConfigured || !this.client) {
        return {
          error: 'SMS provider não configurado'
        };
      }

      const balance = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).balance.fetch();
      
      return {
        balance: balance.balance,
        currency: balance.currency
      };

    } catch (error: any) {
      return {
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Validar número de telefone
   */
  validatePhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validar formato brasileiro (10-11 dígitos após código do país)
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return false;
    }

    // Verificar se começa com 9 para celulares (obrigatório no Brasil)
    if (cleanPhone.length === 11 && !cleanPhone.startsWith('9', 2)) {
      return false;
    }

    return true;
  }
}