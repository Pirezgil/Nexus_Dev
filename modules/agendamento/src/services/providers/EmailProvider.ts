/**
 * Provider para Email usando NodeMailer
 * Responsável pelo envio de emails e controle de status
 */

import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM || '';
    this.initializeTransporter();
  }

  /**
   * Inicializar transporter do NodeMailer
   */
  private async initializeTransporter() {
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASSWORD;
      const smtpSecure = process.env.SMTP_SECURE === 'true';

      if (!smtpHost || !smtpUser || !smtpPassword || !this.fromEmail) {
        logger.warn('Email Provider: Configurações SMTP incompletas');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true para 465, false para outros
        auth: {
          user: smtpUser,
          pass: smtpPassword
        },
        pool: true, // Usar pool de conexões
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000, // 1 segundo entre mensagens
        rateLimit: 5 // máximo 5 emails por segundo
      });

      // Verificar conexão
      await this.transporter.verify();
      this.isConfigured = true;
      
      logger.info('Email Provider configurado com sucesso', {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        from: this.fromEmail
      });

    } catch (error: any) {
      logger.error('Erro ao configurar Email Provider', {
        error: error.message,
        code: error.code
      });
    }
  }

  /**
   * Enviar email
   */
  async sendMessage(
    email: string,
    subject: string,
    message: string,
    isHtml: boolean = true
  ): Promise<EmailResponse> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          success: false,
          error: 'Email provider não configurado'
        };
      }

      if (!this.validateEmail(email)) {
        return {
          success: false,
          error: 'Endereço de email inválido'
        };
      }

      logger.info('Enviando email', {
        to: email,
        subject: subject.substring(0, 50) + (subject.length > 50 ? '...' : ''),
        messageLength: message.length,
        isHtml
      });

      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: subject,
        [isHtml ? 'html' : 'text']: message,
        // Adicionar headers para melhor deliverability
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Nexus ERP Agendamento',
          'X-Auto-Response-Suppress': 'All'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email enviado com sucesso', {
        to: email,
        messageId: result.messageId,
        accepted: result.accepted.length,
        rejected: result.rejected.length
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error: any) {
      logger.error('Erro ao enviar email', {
        error: error.message,
        code: error.code,
        to: email,
        subject: subject
      });

      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Enviar email com template HTML completo
   */
  async sendHTMLMessage(
    email: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<EmailResponse> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          success: false,
          error: 'Email provider não configurado'
        };
      }

      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: subject,
        html: htmlContent,
        text: textContent || this.htmlToText(htmlContent),
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Nexus ERP Agendamento'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email HTML enviado com sucesso', {
        to: email,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error: any) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Validar endereço de email
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Converter HTML básico para texto
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Extrair mensagem de erro apropriada
   */
  private getErrorMessage(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 'EAUTH':
          return 'Erro de autenticação SMTP';
        case 'ECONNECTION':
          return 'Erro de conexão com servidor SMTP';
        case 'ETIMEDOUT':
          return 'Timeout na conexão SMTP';
        case 'EMESSAGE':
          return 'Erro na estrutura da mensagem';
        default:
          return `Erro SMTP ${error.code}: ${error.message}`;
      }
    }

    return error.message || 'Erro desconhecido ao enviar email';
  }

  /**
   * Testar conectividade SMTP
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return {
          success: false,
          error: 'Email provider não configurado'
        };
      }

      await this.transporter.verify();
      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Obter informações da configuração
   */
  getConfiguration(): {
    isConfigured: boolean;
    host?: string;
    port?: number;
    from?: string;
  } {
    return {
      isConfigured: this.isConfigured,
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      from: this.fromEmail
    };
  }

  /**
   * Fechar conexões do pool
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      logger.info('Email Provider: Conexões fechadas');
    }
  }
}