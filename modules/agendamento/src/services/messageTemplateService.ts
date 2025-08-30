/**
 * Service para gerenciamento de templates de mensagem
 * Handles CRUD de templates para notificações WhatsApp/SMS/Email
 */

import { 
  IMessageTemplate,
  NotificationType,
  NotificationChannel,
  ErrorCode,
  AppointmentError
} from '../types';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import Handlebars from 'handlebars';

interface MessageTemplateQuery {
  company_id: string;
  template_type?: NotificationType;
  channel?: NotificationChannel;
  active?: boolean;
  page?: number;
  limit?: number;
}

interface CreateMessageTemplateData {
  company_id: string;
  template_name: string;
  template_type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  content: string;
  active?: boolean;
  is_default?: boolean;
  created_by: string;
}

interface UpdateMessageTemplateData {
  template_name?: string;
  subject?: string;
  content?: string;
  active?: boolean;
  is_default?: boolean;
  company_id: string;
}

// Templates padrão para inicialização
const DEFAULT_TEMPLATES = {
  whatsapp: {
    confirmation: {
      template_name: 'appointment_confirmation_whatsapp',
      content: 'Olá {{customer_name}}! ✅ Seu agendamento foi confirmado:\n\n📅 Data: {{date}}\n🕒 Horário: {{time}}\n👨‍⚕️ Profissional: {{professional}}\n✨ Serviço: {{service}}\n\nTe esperamos! Qualquer dúvida, entre em contato: {{phone}}'
    },
    reminder: {
      template_name: 'appointment_reminder_whatsapp', 
      content: 'Oi {{customer_name}}! 📅 Lembrando que você tem agendamento amanhã:\n\n📅 {{date}} às {{time}}\n👨‍⚕️ Com {{professional}}\n✨ {{service}}\n\nTe esperamos! 😊'
    },
    cancellation: {
      template_name: 'appointment_cancellation_whatsapp',
      content: 'Olá {{customer_name}}, seu agendamento do dia {{date}} às {{time}} foi cancelado. Para reagendar, entre em contato: {{phone}}'
    },
    reschedule: {
      template_name: 'appointment_reschedule_whatsapp',
      content: 'Oi {{customer_name}}! 📅 Seu agendamento foi reagendado:\n\n📅 Nova data: {{date}}\n🕒 Novo horário: {{time}}\n👨‍⚕️ {{professional}}\n✨ {{service}}\n\nTe esperamos!'
    },
    no_show: {
      template_name: 'appointment_no_show_whatsapp',
      content: 'Olá {{customer_name}}, notamos que você não compareceu ao seu agendamento de {{date}} às {{time}}. Entre em contato para reagendar: {{phone}}'
    }
  },
  sms: {
    confirmation: {
      template_name: 'appointment_confirmation_sms',
      content: 'Agendamento confirmado! {{date}} às {{time}} com {{professional}}. {{service}}. Contato: {{phone}}'
    },
    reminder: {
      template_name: 'appointment_reminder_sms',
      content: 'Lembrete: Agendamento amanhã {{date}} às {{time}} com {{professional}}. Te esperamos!'
    },
    cancellation: {
      template_name: 'appointment_cancellation_sms',
      content: 'Agendamento {{date}} {{time}} cancelado. Para reagendar: {{phone}}'
    },
    reschedule: {
      template_name: 'appointment_reschedule_sms',
      content: 'Agendamento reagendado para {{date}} às {{time}} com {{professional}}. Te esperamos!'
    }
  },
  email: {
    confirmation: {
      template_name: 'appointment_confirmation_email',
      subject: 'Agendamento Confirmado - {{date}}',
      content: 'Olá {{customer_name}},\n\nSeu agendamento foi confirmado com sucesso!\n\nDetalhes:\n- Data: {{date}}\n- Horário: {{time}}\n- Profissional: {{professional}}\n- Serviço: {{service}}\n\nQualquer dúvida, entre em contato conosco.\n\nAtenciosamente,\n{{company_name}}'
    },
    reminder: {
      template_name: 'appointment_reminder_email',
      subject: 'Lembrete: Agendamento Amanhã',
      content: 'Olá {{customer_name}},\n\nLembrando que você tem agendamento amanhã:\n\nData: {{date}} às {{time}}\nProfissional: {{professional}}\nServiço: {{service}}\n\nTe esperamos!\n\nAtenciosamente,\n{{company_name}}'
    },
    cancellation: {
      template_name: 'appointment_cancellation_email',
      subject: 'Agendamento Cancelado',
      content: 'Olá {{customer_name}},\n\nSeu agendamento do dia {{date}} às {{time}} foi cancelado.\n\nPara reagendar, entre em contato conosco.\n\nAtenciosamente,\n{{company_name}}'
    }
  }
};

export const messageTemplateService = {

  // Listar templates com filtros
  getMessageTemplates: async (query: MessageTemplateQuery) => {
    try {
      const {
        company_id,
        template_type,
        channel,
        active,
        page = 1,
        limit = 50
      } = query;

      const where: any = {
        company_id,
        ...(template_type && { template_type }),
        ...(channel && { channel }),
        ...(active !== undefined && { active })
      };

      const [templates, total] = await Promise.all([
        db.messageTemplate.findMany({
          where,
          orderBy: [
            { is_default: 'desc' },
            { template_type: 'asc' },
            { channel: 'asc' },
            { created_at: 'desc' }
          ],
          skip: (page - 1) * limit,
          take: limit
        }),
        db.messageTemplate.count({ where })
      ]);

      return {
        templates,
        total,
        page,
        limit
      };

    } catch (error) {
      logger.error('Erro ao listar templates de mensagem:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao listar templates',
        500,
        error
      );
    }
  },

  // Obter template por ID
  getMessageTemplateById: async (id: string, company_id: string): Promise<IMessageTemplate | null> => {
    try {
      const template = await db.messageTemplate.findFirst({
        where: { id, company_id }
      });

      return template;

    } catch (error) {
      logger.error(`Erro ao buscar template ${id}:`, error);
      return null;
    }
  },

  // Obter template padrão para tipo e canal específico
  getDefaultTemplate: async (
    company_id: string,
    template_type: NotificationType,
    channel: NotificationChannel
  ): Promise<IMessageTemplate | null> => {
    try {
      const template = await db.messageTemplate.findFirst({
        where: {
          company_id,
          template_type,
          channel,
          active: true,
          is_default: true
        }
      });

      // Se não encontrou template padrão, buscar qualquer template ativo para o tipo/canal
      if (!template) {
        return await db.messageTemplate.findFirst({
          where: {
            company_id,
            template_type,
            channel,
            active: true
          },
          orderBy: { created_at: 'asc' }
        });
      }

      return template;

    } catch (error) {
      logger.error('Erro ao buscar template padrão:', error);
      return null;
    }
  },

  // Criar novo template
  createMessageTemplate: async (data: CreateMessageTemplateData) => {
    try {
      const {
        company_id,
        template_name,
        template_type,
        channel,
        subject,
        content,
        active = true,
        is_default = false,
        created_by
      } = data;

      // Verificar se já existe template com mesmo nome para a empresa
      const existingTemplate = await db.messageTemplate.findFirst({
        where: {
          company_id,
          template_name,
          channel
        }
      });

      if (existingTemplate) {
        throw new AppointmentError(
          ErrorCode.VALIDATION_ERROR,
          'Já existe um template com este nome para o canal especificado'
        );
      }

      // Validar conteúdo do template
      const validationResult = messageTemplateService.validateTemplate(content, template_type);
      if (!validationResult.valid) {
        throw new AppointmentError(
          ErrorCode.VALIDATION_ERROR,
          `Template inválido: ${validationResult.errors.join(', ')}`
        );
      }

      // Se for definido como padrão, desmarcar outros templates padrão
      if (is_default) {
        await db.messageTemplate.updateMany({
          where: {
            company_id,
            template_type,
            channel,
            is_default: true
          },
          data: {
            is_default: false
          }
        });
      }

      const template = await db.messageTemplate.create({
        data: {
          company_id,
          template_name,
          template_type,
          channel,
          subject: channel === 'email' ? subject : undefined,
          content,
          active,
          is_default,
          created_by
        }
      });

      logger.info(`Template criado: ${template.id} - ${template_name}`);

      return template;

    } catch (error) {
      logger.error('Erro ao criar template:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao criar template',
        500,
        error
      );
    }
  },

  // Atualizar template existente
  updateMessageTemplate: async (id: string, data: UpdateMessageTemplateData) => {
    try {
      const { company_id, ...updates } = data;

      const existingTemplate = await db.messageTemplate.findFirst({
        where: { id, company_id }
      });

      if (!existingTemplate) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Template não encontrado');
      }

      // Validar conteúdo se foi alterado
      if (updates.content) {
        const validationResult = messageTemplateService.validateTemplate(
          updates.content,
          existingTemplate.template_type
        );
        if (!validationResult.valid) {
          throw new AppointmentError(
            ErrorCode.VALIDATION_ERROR,
            `Template inválido: ${validationResult.errors.join(', ')}`
          );
        }
      }

      // Se está sendo definido como padrão, desmarcar outros
      if (updates.is_default === true) {
        await db.messageTemplate.updateMany({
          where: {
            company_id,
            template_type: existingTemplate.template_type,
            channel: existingTemplate.channel,
            is_default: true,
            id: { not: id }
          },
          data: {
            is_default: false
          }
        });
      }

      const updatedTemplate = await db.messageTemplate.update({
        where: { id },
        data: {
          ...updates,
          updated_at: new Date()
        }
      });

      logger.info(`Template atualizado: ${id}`);

      return updatedTemplate;

    } catch (error) {
      logger.error(`Erro ao atualizar template ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao atualizar template',
        500,
        error
      );
    }
  },

  // Remover template
  deleteMessageTemplate: async (id: string, company_id: string) => {
    try {
      const existingTemplate = await db.messageTemplate.findFirst({
        where: { id, company_id }
      });

      if (!existingTemplate) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Template não encontrado');
      }

      // Verificar se há notificações usando este template
      const notificationsCount = await db.appointmentNotification.count({
        where: { message_template: existingTemplate.template_name }
      });

      if (notificationsCount > 0) {
        // Não remover, apenas desativar para preservar histórico
        await db.messageTemplate.update({
          where: { id },
          data: { active: false }
        });

        logger.info(`Template desativado (em uso): ${id}`);
        return true;
      }

      await db.messageTemplate.delete({
        where: { id }
      });

      logger.info(`Template removido: ${id}`);

      return true;

    } catch (error) {
      logger.error(`Erro ao remover template ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao remover template',
        500,
        error
      );
    }
  },

  // Validar template (verificar variáveis obrigatórias)
  validateTemplate: (content: string, template_type: NotificationType) => {
    const errors: string[] = [];
    
    try {
      // Verificar se é um template Handlebars válido
      Handlebars.compile(content);
    } catch (error) {
      errors.push('Sintaxe do template inválida');
      return { valid: false, errors };
    }

    // Variáveis obrigatórias para cada tipo
    const requiredVariables = {
      confirmation: ['customer_name', 'date', 'time', 'professional', 'service'],
      reminder: ['customer_name', 'date', 'time'],
      cancellation: ['customer_name', 'date', 'time'],
      reschedule: ['customer_name', 'date', 'time'],
      no_show: ['customer_name', 'date', 'time']
    };

    const required = requiredVariables[template_type] || [];
    
    for (const variable of required) {
      const pattern = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g');
      if (!pattern.test(content)) {
        errors.push(`Variável obrigatória ausente: {{${variable}}}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Renderizar template com variáveis
  renderTemplate: (templateContent: string, variables: Record<string, any>): string => {
    try {
      const template = Handlebars.compile(templateContent);
      return template(variables);
    } catch (error) {
      logger.error('Erro ao renderizar template:', error);
      return templateContent; // Retorna template sem renderizar em caso de erro
    }
  },

  // Duplicar template (criar cópia)
  duplicateTemplate: async (id: string, company_id: string, new_name: string) => {
    try {
      const originalTemplate = await db.messageTemplate.findFirst({
        where: { id, company_id }
      });

      if (!originalTemplate) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Template não encontrado');
      }

      // Verificar se novo nome já existe
      const existingName = await db.messageTemplate.findFirst({
        where: {
          company_id,
          template_name: new_name,
          channel: originalTemplate.channel
        }
      });

      if (existingName) {
        throw new AppointmentError(
          ErrorCode.VALIDATION_ERROR,
          'Já existe um template com este nome'
        );
      }

      const duplicatedTemplate = await db.messageTemplate.create({
        data: {
          company_id,
          template_name: new_name,
          template_type: originalTemplate.template_type,
          channel: originalTemplate.channel,
          subject: originalTemplate.subject,
          content: originalTemplate.content,
          active: true,
          is_default: false, // Cópia nunca é padrão
          created_by: originalTemplate.created_by
        }
      });

      logger.info(`Template duplicado: ${id} -> ${duplicatedTemplate.id}`);

      return duplicatedTemplate;

    } catch (error) {
      logger.error(`Erro ao duplicar template ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao duplicar template',
        500,
        error
      );
    }
  },

  // Inicializar templates padrão para uma empresa
  initializeDefaultTemplates: async (company_id: string, created_by: string) => {
    try {
      const createdTemplates = [];

      for (const channel of Object.keys(DEFAULT_TEMPLATES) as NotificationChannel[]) {
        const channelTemplates = DEFAULT_TEMPLATES[channel];
        
        for (const type of Object.keys(channelTemplates) as NotificationType[]) {
          const template = channelTemplates[type];
          
          // Verificar se já existe
          const existing = await db.messageTemplate.findFirst({
            where: {
              company_id,
              template_name: template.template_name
            }
          });

          if (!existing) {
            const created = await db.messageTemplate.create({
              data: {
                company_id,
                template_name: template.template_name,
                template_type: type,
                channel: channel as NotificationChannel,
                subject: template.subject,
                content: template.content,
                active: true,
                is_default: true,
                created_by
              }
            });

            createdTemplates.push(created);
          }
        }
      }

      logger.info(`${createdTemplates.length} templates padrão criados para empresa ${company_id}`);

      return createdTemplates;

    } catch (error) {
      logger.error('Erro ao inicializar templates padrão:', error);
      throw error;
    }
  },

  // Obter variáveis disponíveis para templates
  getAvailableVariables: () => {
    return {
      customer: ['customer_name', 'customer_phone', 'customer_email'],
      appointment: ['date', 'time', 'appointment_date', 'appointment_time', 'professional', 'service', 'service_name', 'professional_name'],
      company: ['company_name', 'phone', 'address', 'company_address'],
      extra: ['notes', 'price', 'duration', 'cancellation_reason']
    };
  },

  // Renderizar template com variáveis padrão para agendamento
  renderAppointmentTemplate: async (templateId: string, appointmentData: any, companyData?: any): Promise<string> => {
    try {
      const template = await db.messageTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new Error('Template não encontrado');
      }

      // Preparar variáveis do template
      const variables = {
        customer_name: appointmentData.customer_name || 'Cliente',
        customer_phone: appointmentData.customer_phone || '',
        customer_email: appointmentData.customer_email || '',
        date: appointmentData.appointment_date ? 
          new Date(appointmentData.appointment_date).toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : '',
        time: appointmentData.appointment_time || '',
        appointment_date: appointmentData.appointment_date || '',
        appointment_time: appointmentData.appointment_time || '',
        professional: appointmentData.professional_name || 'Profissional',
        professional_name: appointmentData.professional_name || 'Profissional',
        service: appointmentData.service_name || 'Serviço',
        service_name: appointmentData.service_name || 'Serviço',
        company_name: companyData?.name || 'Nossa Empresa',
        phone: companyData?.phone || '(11) 99999-9999',
        address: companyData?.address || '',
        company_address: companyData?.address || '',
        notes: appointmentData.notes || '',
        cancellation_reason: appointmentData.cancellation_reason || ''
      };

      return messageTemplateService.renderTemplate(template.content, variables);

    } catch (error) {
      logger.error('Erro ao renderizar template para agendamento:', error);
      throw error;
    }
  }
}