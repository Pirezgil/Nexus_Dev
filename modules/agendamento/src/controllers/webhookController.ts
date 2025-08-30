/**
 * Controller para webhooks do WhatsApp Business API
 * Processa status updates, mensagens recebidas e confirmações de entrega
 */

import { Request, Response } from 'express';
import { whatsappService } from '../integrations/whatsappService';
import { WhatsAppProvider } from '../services/providers/WhatsAppProvider';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

export class WebhookController {
  
  /**
   * Verificar webhook (GET) - WhatsApp Challenge
   */
  verifyWebhook = (req: Request, res: Response) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      logger.info('WhatsApp webhook verification attempt', {
        mode,
        tokenPresent: !!token,
        challengePresent: !!challenge
      });

      if (mode && token) {
        if (mode === 'subscribe' && whatsappService.validateWebhookToken(token as string)) {
          logger.info('WhatsApp webhook verificado com sucesso');
          res.status(200).send(challenge);
          return;
        } else {
          logger.warn('WhatsApp webhook verification failed: invalid token');
          res.sendStatus(403);
          return;
        }
      }

      logger.warn('WhatsApp webhook verification failed: missing parameters');
      res.sendStatus(400);

    } catch (error) {
      logger.error('Erro na verificação do webhook:', error);
      res.sendStatus(500);
    }
  };

  /**
   * Processar webhook events (POST)
   */
  handleWebhook = async (req: Request, res: Response) => {
    try {
      const body = req.body;
      
      logger.debug('Webhook WhatsApp recebido', {
        object: body.object,
        entryCount: body.entry?.length || 0
      });

      // Verificar signature se configurada
      const signature = req.get('X-Hub-Signature-256');
      if (signature) {
        const payload = JSON.stringify(body);
        if (!whatsappService.validateWebhookSignature(payload, signature)) {
          logger.warn('Webhook signature validation failed');
          res.sendStatus(403);
          return;
        }
      }

      // Processar apenas eventos WhatsApp Business Account
      if (body.object === 'whatsapp_business_account') {
        await this.processWhatsAppEvents(body);
      }

      // Sempre responder 200 para confirmar recebimento
      res.sendStatus(200);

    } catch (error) {
      logger.error('Erro ao processar webhook WhatsApp:', error);
      res.sendStatus(500);
    }
  };

  /**
   * Processar eventos do WhatsApp
   */
  private async processWhatsAppEvents(webhookData: any) {
    try {
      if (!webhookData.entry) return;

      for (const entry of webhookData.entry) {
        if (!entry.changes) continue;

        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.processMessageEvents(change.value);
          }
        }
      }
    } catch (error) {
      logger.error('Erro ao processar eventos WhatsApp:', error);
    }
  }

  /**
   * Processar eventos de mensagens
   */
  private async processMessageEvents(messageData: any) {
    try {
      // Processar status updates de mensagens enviadas
      if (messageData.statuses) {
        for (const status of messageData.statuses) {
          await this.updateMessageStatus(
            status.id,
            status.status,
            status.timestamp,
            status.recipient_id,
            status.errors
          );
        }
      }

      // Processar mensagens recebidas (para futuras funcionalidades)
      if (messageData.messages) {
        for (const message of messageData.messages) {
          await this.handleIncomingMessage(message);
        }
      }

    } catch (error) {
      logger.error('Erro ao processar eventos de mensagem:', error);
    }
  }

  /**
   * Atualizar status da mensagem no banco
   */
  private async updateMessageStatus(
    externalMessageId: string, 
    status: string, 
    timestamp: string,
    recipientId?: string,
    errors?: any[]
  ) {
    try {
      const statusMap = {
        'sent': 'sent',
        'delivered': 'delivered',
        'read': 'read',
        'failed': 'failed'
      };

      const mappedStatus = statusMap[status] || status;
      const statusTime = new Date(parseInt(timestamp) * 1000);

      logger.info(`Atualizando status da mensagem ${externalMessageId}`, {
        status: mappedStatus,
        timestamp: statusTime.toISOString(),
        recipientId
      });

      // Atualizar notificação no banco
      const updateData: any = {
        status: mappedStatus
      };

      // Adicionar timestamps específicos baseado no status
      switch (mappedStatus) {
        case 'sent':
          updateData.sent_at = statusTime;
          break;
        case 'delivered':
          updateData.delivered_at = statusTime;
          break;
        case 'read':
          updateData.read_at = statusTime;
          break;
        case 'failed':
          updateData.failure_reason = errors?.length > 0 ? JSON.stringify(errors) : 'Falha não especificada';
          break;
      }

      const updatedCount = await db.appointmentNotification.updateMany({
        where: {
          external_message_id: externalMessageId
        },
        data: updateData
      });

      if (updatedCount.count > 0) {
        logger.info(`Status atualizado para ${updatedCount.count} notificação(ões)`, {
          messageId: externalMessageId,
          newStatus: mappedStatus
        });
      } else {
        logger.warn(`Nenhuma notificação encontrada para message ID: ${externalMessageId}`);
      }

    } catch (error) {
      logger.error('Erro ao atualizar status da mensagem:', error);
    }
  }

  /**
   * Processar mensagem recebida (com funcionalidades de resposta automática)
   */
  private async handleIncomingMessage(message: any) {
    try {
      const messageInfo = {
        from: message.from,
        type: message.type,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        content: message.text?.body?.toLowerCase() || '[não-texto]'
      };

      logger.info('Mensagem recebida', messageInfo);

      // Processar apenas mensagens de texto
      if (message.type === 'text' && message.text?.body) {
        const body = message.text.body.toLowerCase().trim();
        const phone = this.extractPhoneNumber(message.from);

        // Comandos de cancelamento
        if (body.includes('cancelar') || body.includes('cancel')) {
          await this.handleCancellationRequest(phone, message.from);
        }
        // Comandos de confirmação
        else if (body.includes('sim') || body.includes('confirmar') || body.includes('ok')) {
          await this.handleConfirmationResponse(phone, message.from);
        }
        // Comandos de reagendamento
        else if (body.includes('reagendar') || body.includes('remarcar')) {
          await this.handleRescheduleRequest(phone, message.from);
        }
        // Menu de ajuda
        else if (body.includes('ajuda') || body.includes('help') || body === 'menu') {
          await this.sendHelpMenu(message.from);
        }
      }
      
    } catch (error) {
      logger.error('Erro ao processar mensagem recebida:', error);
    }
  }

  /**
   * Obter estatísticas dos webhooks processados
   */
  getWebhookStats = async (req: Request, res: Response) => {
    try {
      const { company_id } = req.params;
      const { date_from, date_to } = req.query;

      // Construir filtros
      const where: any = {
        appointment: {
          company_id
        },
        external_message_id: {
          not: null // Apenas mensagens que foram enviadas e têm ID externo
        }
      };

      if (date_from && date_to) {
        where.created_at = {
          gte: new Date(date_from as string),
          lte: new Date(date_to as string)
        };
      }

      // Estatísticas por status
      const statusStats = await db.appointmentNotification.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      });

      // Estatísticas por tipo
      const typeStats = await db.appointmentNotification.groupBy({
        by: ['notification_type'],
        where,
        _count: { notification_type: true }
      });

      // Mensagens com status de entrega
      const deliveryStats = await db.appointmentNotification.findMany({
        where: {
          ...where,
          status: { in: ['sent', 'delivered', 'read'] }
        },
        select: {
          status: true,
          sent_at: true,
          delivered_at: true,
          read_at: true,
          notification_type: true
        }
      });

      // Calcular métricas de entrega
      const sentCount = deliveryStats.filter(n => n.sent_at).length;
      const deliveredCount = deliveryStats.filter(n => n.delivered_at).length;
      const readCount = deliveryStats.filter(n => n.read_at).length;

      const stats = {
        total_messages: statusStats.reduce((sum, s) => sum + s._count.status, 0),
        by_status: statusStats.reduce((acc, s) => ({
          ...acc,
          [s.status]: s._count.status
        }), {}),
        by_type: typeStats.reduce((acc, t) => ({
          ...acc,
          [t.notification_type]: t._count.notification_type
        }), {}),
        delivery_metrics: {
          sent: sentCount,
          delivered: deliveredCount,
          read: readCount,
          delivery_rate: sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0,
          read_rate: deliveredCount > 0 ? Math.round((readCount / deliveredCount) * 100) : 0
        }
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Erro ao obter estatísticas de webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno ao obter estatísticas'
      });
    }
  };

  /**
   * Listar mensagens com status tracking
   */
  getMessageTracking = async (req: Request, res: Response) => {
    try {
      const { company_id } = req.params;
      const { 
        appointment_id, 
        notification_type, 
        status,
        page = 1, 
        limit = 20 
      } = req.query;

      const where: any = {
        appointment: {
          company_id
        },
        external_message_id: {
          not: null
        }
      };

      if (appointment_id) where.appointment_id = appointment_id;
      if (notification_type) where.notification_type = notification_type;
      if (status) where.status = status;

      const [notifications, total] = await Promise.all([
        db.appointmentNotification.findMany({
          where,
          include: {
            appointment: {
              select: {
                id: true,
                appointment_date: true,
                appointment_time: true,
                customer_id: true,
                professional_id: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        db.appointmentNotification.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Erro ao listar tracking de mensagens:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar mensagens'
      });
    }
  };

  /**
   * Extrair número de telefone do ID WhatsApp
   */
  private extractPhoneNumber(whatsappId: string): string {
    // Remover @s.whatsapp.net e extrair apenas os números
    return whatsappId.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  }

  /**
   * Processar solicitação de cancelamento
   */
  private async handleCancellationRequest(phone: string, whatsappId: string) {
    try {
      // Buscar agendamentos próximos deste telefone
      const upcomingAppointments = await db.appointment.findMany({
        where: {
          // Assumindo que temos o telefone armazenado de alguma forma
          // Esta parte precisará ser ajustada conforme a integração com CRM
          status: 'scheduled',
          appointment_date: {
            gte: new Date()
          }
        },
        orderBy: {
          appointment_date: 'asc'
        },
        take: 1
      });

      const whatsappProvider = new WhatsAppProvider();

      if (upcomingAppointments.length > 0) {
        const appointment = upcomingAppointments[0];
        
        // Cancelar o agendamento
        await db.appointment.update({
          where: { id: appointment.id },
          data: { 
            status: 'cancelled',
            reschedule_reason: 'Cancelado pelo cliente via WhatsApp'
          }
        });

        // Enviar confirmação de cancelamento
        await whatsappProvider.sendMessage({
          phone: phone,
          message: `✅ *Cancelamento Confirmado*\n\nSeu agendamento do dia ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')} às ${appointment.appointment_time.toISOString().slice(11,16)} foi cancelado com sucesso.\n\nPara reagendar, entre em contato conosco ou responda *REAGENDAR*.`
        });

        logger.info('Agendamento cancelado via WhatsApp', {
          appointmentId: appointment.id,
          phone,
          whatsappId
        });
      } else {
        // Não encontrou agendamentos
        await whatsappProvider.sendMessage({
          phone: phone,
          message: `❌ *Nenhum agendamento encontrado*\n\nNão encontramos agendamentos próximos para cancelar.\n\nSe precisar de ajuda, entre em contato conosco pelo telefone ou responda *AJUDA*.`
        });
      }

    } catch (error) {
      logger.error('Erro ao processar cancelamento via WhatsApp', {
        phone,
        whatsappId,
        error: error.message
      });
    }
  }

  /**
   * Processar confirmação de presença
   */
  private async handleConfirmationResponse(phone: string, whatsappId: string) {
    try {
      // Buscar agendamentos não confirmados nas próximas 48 horas
      const upcomingAppointments = await db.appointment.findMany({
        where: {
          status: 'scheduled',
          confirmed_at: null,
          appointment_date: {
            gte: new Date(),
            lte: new Date(Date.now() + 48 * 60 * 60 * 1000) // próximas 48h
          }
        },
        orderBy: {
          appointment_date: 'asc'
        },
        take: 1
      });

      const whatsappProvider = new WhatsAppProvider();

      if (upcomingAppointments.length > 0) {
        const appointment = upcomingAppointments[0];
        
        // Confirmar o agendamento
        await db.appointment.update({
          where: { id: appointment.id },
          data: { 
            confirmed_at: new Date(),
            confirmed_by: 'customer'
          }
        });

        // Enviar confirmação
        await whatsappProvider.sendMessage({
          phone: phone,
          message: `✅ *Presença Confirmada!*\n\nObrigado! Sua presença foi confirmada para:\n📅 ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')}\n🕐 ${appointment.appointment_time.toISOString().slice(11,16)}\n\nEstaremos te esperando! 😊`
        });

        logger.info('Presença confirmada via WhatsApp', {
          appointmentId: appointment.id,
          phone,
          whatsappId
        });
      } else {
        // Não encontrou agendamentos para confirmar
        await whatsappProvider.sendMessage({
          phone: phone,
          message: `ℹ️ *Obrigado!*\n\nNão encontramos agendamentos pendentes de confirmação no momento.\n\nSe precisar de ajuda, responda *AJUDA*.`
        });
      }

    } catch (error) {
      logger.error('Erro ao processar confirmação via WhatsApp', {
        phone,
        whatsappId,
        error: error.message
      });
    }
  }

  /**
   * Processar solicitação de reagendamento
   */
  private async handleRescheduleRequest(phone: string, whatsappId: string) {
    try {
      const whatsappProvider = new WhatsAppProvider();

      // Por enquanto, apenas direcionar para contato humano
      await whatsappProvider.sendMessage({
        phone: phone,
        message: `📅 *Reagendamento*\n\nPara reagendar seu compromisso, entre em contato conosco:\n\n📞 Telefone: (11) 3333-4444\n💬 WhatsApp: (11) 99999-9999\n\nNosso horário de atendimento:\nSegunda a Sexta: 08:00 às 18:00\nSábado: 08:00 às 12:00`
      });

      logger.info('Solicitação de reagendamento via WhatsApp', {
        phone,
        whatsappId
      });

    } catch (error) {
      logger.error('Erro ao processar reagendamento via WhatsApp', {
        phone,
        whatsappId,
        error: error.message
      });
    }
  }

  /**
   * Enviar menu de ajuda
   */
  private async sendHelpMenu(whatsappId: string) {
    try {
      const phone = this.extractPhoneNumber(whatsappId);
      const whatsappProvider = new WhatsAppProvider();

      await whatsappProvider.sendMessage({
        phone: phone,
        message: `🤖 *Menu de Comandos*\n\nVocê pode usar os seguintes comandos:\n\n✅ *SIM* ou *CONFIRMAR* - Confirmar presença\n❌ *CANCELAR* - Cancelar agendamento\n📅 *REAGENDAR* - Solicitar reagendamento\n🆘 *AJUDA* - Mostrar este menu\n\n📞 Para atendimento humano:\n(11) 3333-4444\n\nHorário: Seg-Sex 08h às 18h`
      });

      logger.info('Menu de ajuda enviado via WhatsApp', { whatsappId, phone });

    } catch (error) {
      logger.error('Erro ao enviar menu de ajuda via WhatsApp', {
        whatsappId,
        error: error.message
      });
    }
  }
}