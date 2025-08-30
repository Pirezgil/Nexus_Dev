import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

interface EmailTemplateData {
  userName?: string;
  resetUrl?: string;
  verifyUrl?: string;
  companyName?: string;
  supportEmail?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  /**
   * Verificar conexão com servidor SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Enviar email de recuperação de senha
   */
  async sendPasswordReset(email: string, token: string, userName?: string): Promise<void> {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      const templateData: EmailTemplateData = {
        userName: userName || 'Usuário',
        resetUrl,
        companyName: 'Nexus ERP',
        supportEmail: 'suporte@nexuserp.com',
      };

      const html = this.getPasswordResetTemplate(templateData);
      const text = this.getPasswordResetTextTemplate(templateData);

      await this.transporter.sendMail({
        from: `${this.config.fromName} <${this.config.from}>`,
        to: email,
        subject: 'Redefinir senha - Nexus ERP',
        html,
        text,
      });

      logger.info('Password reset email sent successfully', {
        email,
        resetUrl: resetUrl.substring(0, resetUrl.indexOf('?token=') + 8) + '...',
      });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Erro ao enviar email de recuperação de senha');
    }
  }

  /**
   * Enviar email de verificação de endereço
   */
  async sendEmailVerification(email: string, token: string, userName?: string): Promise<void> {
    try {
      const baseUrl = process.env.API_URL || 'http://localhost:5000';
      const verifyUrl = `${baseUrl}/auth/verify-email/${token}`;

      const templateData: EmailTemplateData = {
        userName: userName || 'Usuário',
        verifyUrl,
        companyName: 'Nexus ERP',
        supportEmail: 'suporte@nexuserp.com',
      };

      const html = this.getEmailVerificationTemplate(templateData);
      const text = this.getEmailVerificationTextTemplate(templateData);

      await this.transporter.sendMail({
        from: `${this.config.fromName} <${this.config.from}>`,
        to: email,
        subject: 'Verificar email - Bem-vindo ao Nexus ERP',
        html,
        text,
      });

      logger.info('Email verification sent successfully', {
        email,
        verifyUrl: verifyUrl.substring(0, verifyUrl.lastIndexOf('/') + 1) + '...',
      });
    } catch (error) {
      logger.error('Failed to send email verification', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Erro ao enviar email de verificação');
    }
  }

  /**
   * Template HTML para recuperação de senha
   */
  private getPasswordResetTemplate(data: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir Senha - ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
          .email-card { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563EB; }
          .title { font-size: 20px; color: #1f2937; margin-bottom: 20px; }
          .content { font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .button { display: inline-block; background-color: #2563EB; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; text-align: center; }
          .button:hover { background-color: #1d4ed8; }
          .warning { background-color: #fef3cd; border: 1px solid #fde68a; border-radius: 6px; padding: 15px; margin: 20px 0; color: #92400e; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center; }
          .security-tips { margin-top: 30px; font-size: 14px; color: #6b7280; }
          .security-tips ul { margin: 10px 0; padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-card">
            <div class="header">
              <div class="logo">${data.companyName}</div>
            </div>
            
            <h1 class="title">Redefinir sua senha</h1>
            
            <div class="content">
              <p>Olá, ${data.userName}!</p>
              
              <p>Você solicitou a redefinição de sua senha no ${data.companyName}. Para criar uma nova senha segura, clique no botão abaixo:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${data.resetUrl}" class="button">Redefinir Minha Senha</a>
              </p>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Este link expira em <strong>10 minutos</strong> por questões de segurança</li>
                  <li>Use apenas o link mais recente se você solicitou múltiplas redefinições</li>
                  <li>Se você não solicitou esta alteração, ignore este email</li>
                </ul>
              </div>
              
              <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
              <p style="word-break: break-all; color: #2563EB; font-size: 14px;">${data.resetUrl}</p>
            </div>
            
            <div class="security-tips">
              <h3 style="color: #374151; font-size: 16px;">Dicas de segurança:</h3>
              <ul>
                <li>Use uma senha forte com pelo menos 8 caracteres</li>
                <li>Combine letras maiúsculas, minúsculas, números e símbolos</li>
                <li>Não reutilize senhas de outras contas</li>
                <li>Considere usar um gerenciador de senhas</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>Esta é uma mensagem automática, não responda este email.</p>
              <p>Se você precisar de ajuda, entre em contato conosco em <a href="mailto:${data.supportEmail}" style="color: #2563EB;">${data.supportEmail}</a></p>
              <p>&copy; ${new Date().getFullYear()} ${data.companyName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de texto simples para recuperação de senha
   */
  private getPasswordResetTextTemplate(data: EmailTemplateData): string {
    return `
REDEFINIR SENHA - ${data.companyName?.toUpperCase()}

Olá, ${data.userName}!

Você solicitou a redefinição de sua senha no ${data.companyName}.

Para criar uma nova senha, acesse o link abaixo:
${data.resetUrl}

IMPORTANTE:
- Este link expira em 10 minutos por questões de segurança
- Se você não solicitou esta alteração, ignore este email
- Use apenas o link mais recente se você solicitou múltiplas redefinições

DICAS DE SEGURANÇA:
- Use uma senha forte com pelo menos 8 caracteres
- Combine letras maiúsculas, minúsculas, números e símbolos
- Não reutilize senhas de outras contas

Se você precisar de ajuda, entre em contato: ${data.supportEmail}

© ${new Date().getFullYear()} ${data.companyName}. Todos os direitos reservados.
    `.trim();
  }

  /**
   * Template HTML para verificação de email
   */
  private getEmailVerificationTemplate(data: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
          .email-card { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #16A34A; }
          .title { font-size: 20px; color: #1f2937; margin-bottom: 20px; }
          .content { font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .button { display: inline-block; background-color: #16A34A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; text-align: center; }
          .button:hover { background-color: #15803d; }
          .info-box { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px; margin: 20px 0; color: #1e40af; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center; }
          .welcome-benefits { margin-top: 30px; }
          .benefits-list { background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .benefits-list ul { margin: 0; padding-left: 20px; }
          .benefits-list li { margin-bottom: 8px; color: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-card">
            <div class="header">
              <div class="logo">${data.companyName}</div>
              <p style="color: #16A34A; font-size: 18px; margin-top: 10px;">🎉 Bem-vindo!</p>
            </div>
            
            <h1 class="title">Confirme seu endereço de email</h1>
            
            <div class="content">
              <p>Olá, ${data.userName}!</p>
              
              <p>Bem-vindo ao <strong>${data.companyName}</strong>! Estamos muito felizes em tê-lo conosco.</p>
              
              <p>Para ativar sua conta e começar a usar todos os nossos recursos, precisamos verificar seu endereço de email. Clique no botão abaixo para confirmar:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${data.verifyUrl}" class="button">Verificar Meu Email</a>
              </p>
              
              <div class="info-box">
                <strong>ℹ️ Informações importantes:</strong>
                <ul>
                  <li>Este link expira em <strong>24 horas</strong></li>
                  <li>Após a verificação, você poderá acessar sua conta normalmente</li>
                  <li>Mantenha seus dados de acesso sempre seguros</li>
                </ul>
              </div>
              
              <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
              <p style="word-break: break-all; color: #16A34A; font-size: 14px;">${data.verifyUrl}</p>
            </div>
            
            <div class="welcome-benefits">
              <h3 style="color: #374151; font-size: 18px; margin-bottom: 15px;">O que você pode fazer no ${data.companyName}:</h3>
              <div class="benefits-list">
                <ul>
                  <li><strong>Gestão Financeira Completa:</strong> Controle receitas, despesas e fluxo de caixa</li>
                  <li><strong>Estoque Inteligente:</strong> Monitore produtos e movimentações em tempo real</li>
                  <li><strong>CRM Integrado:</strong> Gerencie clientes e oportunidades de vendas</li>
                  <li><strong>Relatórios Avançados:</strong> Análises detalhadas para tomada de decisão</li>
                  <li><strong>Multi-usuário:</strong> Colabore com sua equipe de forma segura</li>
                </ul>
              </div>
              
              <p>Nossa equipe de suporte está sempre disponível para ajudá-lo. Entre em contato conosco em <a href="mailto:${data.supportEmail}" style="color: #16A34A;">${data.supportEmail}</a></p>
            </div>
            
            <div class="footer">
              <p>Esta é uma mensagem automática, não responda este email.</p>
              <p>Se você não criou uma conta no ${data.companyName}, pode ignorar este email com segurança.</p>
              <p>&copy; ${new Date().getFullYear()} ${data.companyName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de texto simples para verificação de email
   */
  private getEmailVerificationTextTemplate(data: EmailTemplateData): string {
    return `
BEM-VINDO AO ${data.companyName?.toUpperCase()}!

Olá, ${data.userName}!

Bem-vindo ao ${data.companyName}! Estamos muito felizes em tê-lo conosco.

Para ativar sua conta e começar a usar todos os nossos recursos, confirme seu email acessando o link abaixo:

${data.verifyUrl}

INFORMAÇÕES IMPORTANTES:
- Este link expira em 24 horas
- Após a verificação, você poderá acessar sua conta normalmente
- Mantenha seus dados de acesso sempre seguros

O QUE VOCÊ PODE FAZER NO ${data.companyName?.toUpperCase()}:
• Gestão Financeira Completa: Controle receitas, despesas e fluxo de caixa
• Estoque Inteligente: Monitore produtos e movimentações em tempo real
• CRM Integrado: Gerencie clientes e oportunidades de vendas
• Relatórios Avançados: Análises detalhadas para tomada de decisão
• Multi-usuário: Colabore com sua equipe de forma segura

Nossa equipe de suporte está sempre disponível: ${data.supportEmail}

Se você não criou uma conta no ${data.companyName}, pode ignorar este email com segurança.

© ${new Date().getFullYear()} ${data.companyName}. Todos os direitos reservados.
    `.trim();
  }
}

// Factory function para criar instância do EmailService
export const createEmailService = (): EmailService => {
  const emailConfig: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@nexuserp.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Nexus ERP',
  };

  return new EmailService(emailConfig);
};

// Instância global do serviço de email
export const emailService = createEmailService();