/**
 * Engine de Templates para renderização de mensagens
 * Suporta substituição de variáveis e templates padrão por canal
 */

import { logger } from '../utils/logger';

interface TemplateVariables {
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  professional_name: string;
  company_name: string;
  company_phone: string;
  company_address: string;
  cancellation_link?: string;
  reschedule_link?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

interface DefaultTemplates {
  whatsapp: {
    [key: string]: string;
  };
  sms: {
    [key: string]: string;
  };
  email: {
    [key: string]: EmailTemplate;
  };
}

export class TemplateEngine {
  /**
   * Renderizar template substituindo variáveis
   */
  static render(template: string, variables: TemplateVariables): string {
    let rendered = template;

    // Substituir todas as variáveis definidas
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
    });

    // Limpar variáveis não substituídas (opcional)
    rendered = rendered.replace(/{{.*?}}/g, '');

    return rendered.trim();
  }

  /**
   * Renderizar template de email (com subject e html)
   */
  static renderEmail(
    template: EmailTemplate, 
    variables: TemplateVariables
  ): EmailTemplate {
    return {
      subject: this.render(template.subject, variables),
      html: this.render(template.html, variables)
    };
  }

  /**
   * Obter templates padrão do sistema
   */
  static getDefaultTemplates(): DefaultTemplates {
    return {
      whatsapp: {
        confirmation: `🔔 *Confirmação de Agendamento*

Olá *{{customer_name}}*!

Seu agendamento foi confirmado:
📅 Data: {{appointment_date}}
🕐 Horário: {{appointment_time}}
💼 Serviço: {{service_name}}
👨‍⚕️ Profissional: {{professional_name}}

📍 {{company_name}}
📞 {{company_phone}}

_Para cancelar, responda CANCELAR_
_Para confirmar presença, responda SIM_`,

        reminder: `⏰ *Lembrete de Consulta*

Olá {{customer_name}}!

Lembrando que você tem uma consulta agendada:
📅 Amanhã - {{appointment_date}}
🕐 {{appointment_time}}
💼 {{service_name}}
👨‍⚕️ {{professional_name}}

📍 {{company_name}}
{{company_address}}

_Confirme sua presença respondendo SIM_
_Para cancelar, responda CANCELAR_`,

        cancellation: `❌ *Agendamento Cancelado*

Olá {{customer_name}},

Seu agendamento foi cancelado:
📅 {{appointment_date}} às {{appointment_time}}
💼 {{service_name}}

Para reagendar, entre em contato:
📞 {{company_phone}}

Atenciosamente,
{{company_name}}`,

        reschedule: `🔄 *Reagendamento Confirmado*

Olá {{customer_name}}!

Seu agendamento foi reagendado:

*Novo horário:*
📅 {{appointment_date}}
🕐 {{appointment_time}}
💼 {{service_name}}
👨‍⚕️ {{professional_name}}

📍 {{company_name}}
📞 {{company_phone}}

_Para cancelar, responda CANCELAR_`
      },

      sms: {
        confirmation: `Agendamento confirmado! {{customer_name}} - {{appointment_date}} {{appointment_time}} - {{service_name}} com {{professional_name}} - {{company_name}}. Para cancelar, ligue {{company_phone}}`,
        
        reminder: `LEMBRETE: Consulta amanhã {{appointment_date}} {{appointment_time}} - {{professional_name}} - {{company_name}} - {{company_phone}}`,
        
        cancellation: `Agendamento CANCELADO: {{appointment_date}} {{appointment_time}} - {{service_name}} - {{company_name}}. Para reagendar: {{company_phone}}`,

        reschedule: `REAGENDADO: Novo horário {{appointment_date}} {{appointment_time}} - {{service_name}} com {{professional_name}} - {{company_name}}`
      },

      email: {
        confirmation: {
          subject: 'Agendamento Confirmado - {{company_name}}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #2563EB; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Agendamento Confirmado ✓</h1>
              </div>
              
              <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333;">Olá <strong>{{customer_name}}</strong>,</p>
                
                <p style="font-size: 16px; color: #333; line-height: 1.5;">
                  Seu agendamento foi confirmado com sucesso! Seguem os detalhes:
                </p>
                
                <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563EB;">
                  <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">📋 Detalhes do Agendamento</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 120px;">📅 Data:</td>
                      <td style="padding: 8px 0; color: #1f2937;">{{appointment_date}}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #374151;">🕐 Horário:</td>
                      <td style="padding: 8px 0; color: #1f2937;">{{appointment_time}}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #374151;">💼 Serviço:</td>
                      <td style="padding: 8px 0; color: #1f2937;">{{service_name}}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #374151;">👨‍⚕️ Profissional:</td>
                      <td style="padding: 8px 0; color: #1f2937;">{{professional_name}}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 25px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #92400e;">📍 Local do Atendimento</h4>
                  <p style="margin: 0; font-weight: bold; color: #1f2937;">{{company_name}}</p>
                  <p style="margin: 5px 0; color: #1f2937;">{{company_address}}</p>
                  <p style="margin: 5px 0; color: #1f2937;">📞 {{company_phone}}</p>
                </div>

                <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 25px 0;">
                  <p style="margin: 0; color: #065f46; font-weight: 500;">
                    💡 <strong>Dica:</strong> Chegue 15 minutos antes do horário agendado.
                  </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <p style="color: #6b7280; font-size: 14px;">
                    Precisa cancelar ou reagendar? Entre em contato conosco:<br>
                    📞 {{company_phone}}
                  </p>
                </div>
              </div>
              
              <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  Esta mensagem foi enviada automaticamente pelo sistema {{company_name}}.
                </p>
              </div>
            </div>
          `
        },

        reminder: {
          subject: 'Lembrete: Consulta Amanhã - {{company_name}}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">⏰ Lembrete de Consulta</h1>
              </div>
              
              <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333;">Olá <strong>{{customer_name}}</strong>,</p>
                
                <p style="font-size: 16px; color: #333; line-height: 1.5;">
                  Este é um lembrete da sua consulta agendada para <strong>amanhã</strong>:
                </p>
                
                <div style="background-color: #fff7ed; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="margin: 0 0 15px 0; color: #9a3412;">📋 Detalhes da Consulta</h3>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>📅 Data:</strong> {{appointment_date}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>🕐 Horário:</strong> {{appointment_time}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>💼 Serviço:</strong> {{service_name}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>👨‍⚕️ Profissional:</strong> {{professional_name}}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <p style="font-size: 16px; color: #1f2937; margin-bottom: 15px;">
                    📍 <strong>{{company_name}}</strong><br>
                    {{company_address}}<br>
                    📞 {{company_phone}}
                  </p>
                </div>

                <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                  <p style="margin: 0; color: #991b1b; font-weight: 500;">
                    ⚠️ <strong>Importante:</strong> Se não puder comparecer, entre em contato para reagendar.
                  </p>
                </div>
              </div>
            </div>
          `
        },

        cancellation: {
          subject: 'Agendamento Cancelado - {{company_name}}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">❌ Agendamento Cancelado</h1>
              </div>
              
              <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333;">Olá <strong>{{customer_name}}</strong>,</p>
                
                <p style="font-size: 16px; color: #333; line-height: 1.5;">
                  Informamos que seu agendamento foi cancelado:
                </p>
                
                <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444;">
                  <h3 style="margin: 0 0 15px 0; color: #991b1b;">📋 Agendamento Cancelado</h3>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>📅 Data:</strong> {{appointment_date}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>🕐 Horário:</strong> {{appointment_time}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>💼 Serviço:</strong> {{service_name}}</p>
                </div>
                
                <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 25px 0; text-align: center;">
                  <h4 style="margin: 0 0 10px 0; color: #065f46;">💚 Deseja reagendar?</h4>
                  <p style="margin: 0; color: #1f2937;">
                    Entre em contato conosco:<br>
                    📞 {{company_phone}}
                  </p>
                </div>
              </div>
            </div>
          `
        },

        reschedule: {
          subject: 'Reagendamento Confirmado - {{company_name}}',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">🔄 Reagendamento Confirmado</h1>
              </div>
              
              <div style="padding: 30px;">
                <p style="font-size: 16px; color: #333;">Olá <strong>{{customer_name}}</strong>,</p>
                
                <p style="font-size: 16px; color: #333; line-height: 1.5;">
                  Seu agendamento foi reagendado com sucesso para o novo horário:
                </p>
                
                <div style="background-color: #ecfdf5; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
                  <h3 style="margin: 0 0 15px 0; color: #065f46;">📋 Novo Horário</h3>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>📅 Data:</strong> {{appointment_date}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>🕐 Horário:</strong> {{appointment_time}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>💼 Serviço:</strong> {{service_name}}</p>
                  <p style="margin: 8px 0; color: #1f2937;"><strong>👨‍⚕️ Profissional:</strong> {{professional_name}}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <p style="font-size: 16px; color: #1f2937;">
                    📍 {{company_name}}<br>
                    {{company_address}}<br>
                    📞 {{company_phone}}
                  </p>
                </div>
              </div>
            </div>
          `
        }
      }
    };
  }

  /**
   * Validar se todas as variáveis obrigatórias estão presentes
   */
  static validateVariables(variables: Partial<TemplateVariables>): {
    valid: boolean;
    missing: string[];
  } {
    const required = [
      'customer_name',
      'appointment_date',
      'appointment_time',
      'service_name',
      'company_name'
    ];

    const missing = required.filter(key => 
      !variables[key as keyof TemplateVariables] || 
      variables[key as keyof TemplateVariables]?.trim() === ''
    );

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Formatar data para exibição
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatar hora para exibição  
   */
  static formatTime(time: string): string {
    // Assumindo formato HH:mm
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  }

  /**
   * Extrair variáveis de um template
   */
  static extractVariables(template: string): string[] {
    const regex = /{{(\s*\w+\s*)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Preview de template com dados de exemplo
   */
  static previewTemplate(
    template: string, 
    templateType: string = 'text'
  ): string {
    const sampleVariables: TemplateVariables = {
      customer_name: 'João Silva',
      customer_phone: '(11) 99999-9999',
      appointment_date: '15 de dezembro de 2024',
      appointment_time: '14:30',
      service_name: 'Consulta Médica',
      professional_name: 'Dr. Ana Costa',
      company_name: 'Clínica Nexus',
      company_phone: '(11) 3333-4444',
      company_address: 'Rua das Flores, 123 - São Paulo, SP',
      cancellation_link: 'https://nexus.com/cancel/abc123',
      reschedule_link: 'https://nexus.com/reschedule/abc123'
    };

    try {
      return this.render(template, sampleVariables);
    } catch (error) {
      logger.error('Erro ao gerar preview do template', { error });
      return 'Erro no template';
    }
  }
}