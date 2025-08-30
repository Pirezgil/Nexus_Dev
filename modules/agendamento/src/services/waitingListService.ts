/**
 * Service para gestão de lista de espera
 * Handles waiting list, notificações automáticas e conversão para agendamentos
 */

import { PrismaClient } from '@prisma/client';
import { 
  IWaitingList,
  ICreateWaitingListRequest,
  WaitingListStatus,
  NotificationChannel,
  ErrorCode,
  AppointmentError
} from '../types';
import { logger } from '../utils/logger';
import { appointmentCache } from '../utils/redis';
import { integrationService } from './integrationService';
import { notificationService } from './notificationService';
import { appointmentService } from './appointmentService';
import { availabilityService } from './availabilityService';

const prisma = new PrismaClient();

interface WaitingListQuery {
  company_id: string;
  status?: WaitingListStatus;
  customer_id?: string;
  service_id?: string;
  professional_id?: string;
  priority?: number;
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'priority' | 'preferred_date';
  order?: 'asc' | 'desc';
}

interface CreateWaitingEntryData extends ICreateWaitingListRequest {
  company_id: string;
  created_by: string;
}

interface ContactWaitingEntryData {
  company_id: string;
  contacted_by: string;
  appointment_offer: {
    date: string;
    time: string;
    professional_id?: string;
  };
  contact_method: 'phone' | 'whatsapp' | 'email';
  contact_notes?: string;
  expires_in_hours: number;
}

interface ConvertToAppointmentData {
  company_id: string;
  appointment_date: string;
  appointment_time: string;
  professional_id?: string;
  notes?: string;
  created_by: string;
}

export const waitingListService = {

  // Buscar lista de espera com filtros
  getWaitingList: async (query: WaitingListQuery) => {
    try {
      const { 
        company_id, 
        status,
        customer_id,
        service_id,
        professional_id,
        priority,
        page = 1, 
        limit = 50,
        sort = 'created_at',
        order = 'desc'
      } = query;

      const offset = (page - 1) * limit;

      // Construir filtros
      const where: any = {
        company_id,
        ...(status && { status }),
        ...(customer_id && { customer_id }),
        ...(service_id && { service_id }),
        ...(professional_id && { professional_id }),
        ...(priority !== undefined && { priority: { gte: priority } })
      };

      // Buscar entradas da lista de espera
      const [waitingEntries, total] = await Promise.all([
        prisma.waiting_list.findMany({
          where,
          include: {
            // Incluir dados relacionados se existirem no schema
          },
          orderBy: { [sort]: order },
          skip: offset,
          take: limit
        }),
        prisma.waiting_list.count({ where })
      ]);

      // Enriquecer com dados dos módulos externos
      const enrichedEntries = await Promise.all(
        waitingEntries.map(async (entry) => {
          const [customer, service, professional] = await Promise.all([
            integrationService.getCustomerById(entry.customer_id, company_id),
            integrationService.getServiceById(entry.service_id, company_id),
            entry.professional_id 
              ? integrationService.getProfessionalById(entry.professional_id, company_id)
              : null
          ]);

          return {
            ...entry,
            customer,
            service,
            professional,
            waiting_time_hours: entry.created_at 
              ? Math.floor((Date.now() - entry.created_at.getTime()) / (1000 * 60 * 60))
              : 0,
            expires_in_hours: entry.expires_at
              ? Math.floor((entry.expires_at.getTime() - Date.now()) / (1000 * 60 * 60))
              : null
          };
        })
      );

      return {
        waiting_entries: enrichedEntries,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };

    } catch (error) {
      logger.error('Erro ao buscar lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao buscar lista de espera',
        500
      );
    }
  },

  // Criar entrada na lista de espera
  createWaitingEntry: async (data: CreateWaitingEntryData) => {
    try {
      const {
        company_id,
        customer_id,
        service_id,
        professional_id,
        preferred_date,
        preferred_time_start,
        preferred_time_end,
        flexible_date = true,
        flexible_time = true,
        priority = 0,
        notify_phone = true,
        notify_whatsapp = true,
        notify_email = false,
        notes,
        created_by
      } = data;

      // Se não especificou profissional, sugerir um baseado no serviço
      let suggestedProfessionalId = professional_id;
      
      if (!suggestedProfessionalId) {
        const availableProfessionals = await integrationService.getProfessionals(company_id);
        if (availableProfessionals && availableProfessionals.length > 0) {
          // Selecionar profissional que oferece o serviço (simplificado)
          const serviceProvider = availableProfessionals.find(prof => 
            prof.services?.includes(service_id)
          ) || availableProfessionals[0];
          
          suggestedProfessionalId = serviceProvider.id;
        }
      }

      // Calcular data de expiração padrão (30 dias)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const waitingEntry = await prisma.waiting_list.create({
        data: {
          company_id,
          customer_id,
          service_id,
          professional_id: suggestedProfessionalId,
          preferred_date: preferred_date ? new Date(preferred_date) : null,
          preferred_time_start: preferred_time_start ? new Date(`1970-01-01T${preferred_time_start}:00`) : null,
          preferred_time_end: preferred_time_end ? new Date(`1970-01-01T${preferred_time_end}:00`) : null,
          flexible_date,
          flexible_time,
          status: WaitingListStatus.WAITING,
          priority,
          notify_phone,
          notify_whatsapp,
          notify_email,
          notes,
          expires_at: expiresAt,
          created_by
        }
      });

      // Invalidar cache relacionado
      await appointmentCache.delete(`waiting-list:${company_id}:*`);

      logger.info('Entrada criada na lista de espera', {
        waitingId: waitingEntry.id,
        customerId: customer_id,
        serviceId: service_id,
        professionalId: suggestedProfessionalId,
        companyId: company_id
      });

      return {
        ...waitingEntry,
        suggested_professional_id: suggestedProfessionalId
      };

    } catch (error) {
      logger.error('Erro ao criar entrada na lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao adicionar à lista de espera',
        500
      );
    }
  },

  // Buscar entrada ativa por cliente
  findActiveWaitingByCustomer: async (
    companyId: string, 
    customerId: string, 
    serviceId: string, 
    professionalId?: string
  ) => {
    try {
      const where: any = {
        company_id: companyId,
        customer_id: customerId,
        service_id: serviceId,
        status: {
          in: [WaitingListStatus.WAITING, WaitingListStatus.CONTACTED]
        }
      };

      if (professionalId) {
        where.professional_id = professionalId;
      }

      return await prisma.waiting_list.findFirst({ where });

    } catch (error) {
      logger.error('Erro ao buscar entrada ativa:', error);
      return null;
    }
  },

  // Atualizar entrada da lista de espera
  updateWaitingEntry: async (waitingId: string, updates: any) => {
    try {
      const waitingEntry = await prisma.waiting_list.findFirst({
        where: {
          id: waitingId,
          company_id: updates.company_id
        }
      });

      if (!waitingEntry) {
        throw new AppointmentError(
          ErrorCode.APPOINTMENT_NOT_FOUND,
          'Entrada da lista de espera não encontrada'
        );
      }

      const updated = await prisma.waiting_list.update({
        where: { id: waitingId },
        data: {
          ...updates,
          updated_at: new Date()
        }
      });

      // Invalidar cache
      await appointmentCache.delete(`waiting-list:${updates.company_id}:*`);

      return updated;

    } catch (error) {
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      logger.error('Erro ao atualizar entrada da lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao atualizar lista de espera',
        500
      );
    }
  },

  // Contatar entrada da lista de espera
  contactWaitingEntry: async (waitingId: string, data: ContactWaitingEntryData) => {
    try {
      const { company_id, contacted_by, appointment_offer, contact_method, contact_notes, expires_in_hours } = data;

      // Buscar entrada
      const waitingEntry = await prisma.waiting_list.findFirst({
        where: {
          id: waitingId,
          company_id
        }
      });

      if (!waitingEntry) {
        throw new AppointmentError(
          ErrorCode.APPOINTMENT_NOT_FOUND,
          'Entrada da lista de espera não encontrada'
        );
      }

      if (waitingEntry.status !== WaitingListStatus.WAITING) {
        throw new AppointmentError(
          'INVALID_STATUS',
          'Entrada já foi contatada ou processada'
        );
      }

      // Buscar dados do cliente para contato
      const customer = await integrationService.getCustomerById(waitingEntry.customer_id, company_id);
      const service = await integrationService.getServiceById(waitingEntry.service_id, company_id);
      const professional = appointment_offer.professional_id
        ? await integrationService.getProfessionalById(appointment_offer.professional_id, company_id)
        : null;

      if (!customer) {
        throw new AppointmentError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Cliente não encontrado'
        );
      }

      // Calcular expiração da oferta
      const offerExpiresAt = new Date();
      offerExpiresAt.setHours(offerExpiresAt.getHours() + expires_in_hours);

      // Atualizar status para CONTACTED
      const updated = await prisma.waiting_list.update({
        where: { id: waitingId },
        data: {
          status: WaitingListStatus.CONTACTED,
          contacted_at: new Date(),
          contacted_by,
          expires_at: offerExpiresAt,
          contact_notes
        }
      });

      // Enviar notificação de oportunidade
      const notificationChannel = contact_method === 'phone' ? NotificationChannel.SMS :
                                 contact_method === 'whatsapp' ? NotificationChannel.WHATSAPP :
                                 NotificationChannel.EMAIL;

      const message = `🎉 Boa notícia! Temos uma vaga disponível para ${service?.name || 'seu serviço'}!
📅 Data: ${new Date(appointment_offer.date).toLocaleDateString('pt-BR')}
⏰ Horário: ${appointment_offer.time}
${professional ? `👨‍⚕️ Com: ${professional.name}` : ''}

Para confirmar este agendamento, responda até ${offerExpiresAt.toLocaleString('pt-BR')}.

Deseja confirmar este horário?`;

      if (contact_method === 'whatsapp' && customer.phone) {
        await integrationService.sendWhatsAppMessage(customer.phone, message);
      }

      // Log da ação
      logger.info('Cliente contatado da lista de espera', {
        waitingId,
        customerId: customer.id,
        customerName: customer.name,
        contactMethod: contact_method,
        appointmentOffer: appointment_offer,
        expiresAt: offerExpiresAt
      });

      return {
        waiting_entry: updated,
        contact_sent: true,
        contact_method,
        appointment_offer,
        expires_at: offerExpiresAt,
        message_sent: contact_method === 'whatsapp' && customer.phone
      };

    } catch (error) {
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      logger.error('Erro ao contatar lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao contatar cliente da lista de espera',
        500
      );
    }
  },

  // Converter entrada para agendamento
  convertToAppointment: async (waitingId: string, data: ConvertToAppointmentData) => {
    try {
      const { company_id, appointment_date, appointment_time, professional_id, notes, created_by } = data;

      // Buscar entrada
      const waitingEntry = await prisma.waiting_list.findFirst({
        where: {
          id: waitingId,
          company_id
        }
      });

      if (!waitingEntry) {
        throw new AppointmentError(
          ErrorCode.APPOINTMENT_NOT_FOUND,
          'Entrada da lista de espera não encontrada'
        );
      }

      // Verificar se ainda está disponível
      const finalProfessionalId = professional_id || waitingEntry.professional_id;
      const isAvailable = await availabilityService.checkSlotAvailability({
        company_id,
        professional_id: finalProfessionalId,
        service_id: waitingEntry.service_id,
        date: new Date(appointment_date),
        time: appointment_time
      });

      if (!isAvailable) {
        throw new AppointmentError(
          'SLOT_NOT_AVAILABLE',
          'Horário não está mais disponível'
        );
      }

      // Criar agendamento
      const appointment = await appointmentService.createAppointment({
        customer_id: waitingEntry.customer_id,
        professional_id: finalProfessionalId,
        service_id: waitingEntry.service_id,
        appointment_date,
        appointment_time,
        notes: notes || waitingEntry.notes,
        send_confirmation: waitingEntry.notify_whatsapp || waitingEntry.notify_phone,
        send_reminder: true,
        reminder_hours_before: 24
      }, company_id, created_by);

      // Atualizar status da lista de espera para SCHEDULED
      await prisma.waiting_list.update({
        where: { id: waitingId },
        data: {
          status: WaitingListStatus.SCHEDULED,
          appointment_id: appointment.appointment.id,
          updated_at: new Date()
        }
      });

      // Invalidar cache
      await appointmentCache.delete(`waiting-list:${company_id}:*`);

      logger.info('Lista de espera convertida para agendamento', {
        waitingId,
        appointmentId: appointment.appointment.id,
        customerId: waitingEntry.customer_id,
        serviceId: waitingEntry.service_id,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time
      });

      return {
        appointment: appointment.appointment,
        waiting_entry: await prisma.waiting_list.findUnique({ where: { id: waitingId } }),
        conversion_successful: true
      };

    } catch (error) {
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      logger.error('Erro ao converter lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao converter lista de espera para agendamento',
        500
      );
    }
  },

  // Remover entrada da lista de espera
  removeWaitingEntry: async (waitingId: string, companyId: string, reason?: string) => {
    try {
      const waitingEntry = await prisma.waiting_list.findFirst({
        where: {
          id: waitingId,
          company_id: companyId
        }
      });

      if (!waitingEntry) {
        throw new AppointmentError(
          ErrorCode.APPOINTMENT_NOT_FOUND,
          'Entrada da lista de espera não encontrada'
        );
      }

      await prisma.waiting_list.delete({
        where: { id: waitingId }
      });

      // Invalidar cache
      await appointmentCache.delete(`waiting-list:${companyId}:*`);

      logger.info('Entrada removida da lista de espera', {
        waitingId,
        reason,
        customerId: waitingEntry.customer_id
      });

      return true;

    } catch (error) {
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      logger.error('Erro ao remover da lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao remover da lista de espera',
        500
      );
    }
  },

  // Notificar oportunidade de agendamento
  notifyWaitingListOpportunity: async (waitingId: string, opportunity: { date: string; time: string; professional_id?: string }) => {
    try {
      const waitingEntry = await prisma.waiting_list.findUnique({
        where: { id: waitingId }
      });

      if (!waitingEntry || waitingEntry.status !== WaitingListStatus.WAITING) {
        return false;
      }

      // Auto-contatar se configurado
      if (waitingEntry.notify_whatsapp) {
        await waitingListService.contactWaitingEntry(waitingId, {
          company_id: waitingEntry.company_id,
          contacted_by: 'system',
          appointment_offer: opportunity,
          contact_method: 'whatsapp',
          contact_notes: 'Oportunidade detectada automaticamente',
          expires_in_hours: 24
        });
      }

      return true;

    } catch (error) {
      logger.error('Erro ao notificar oportunidade:', error);
      return false;
    }
  },

  // Estatísticas da lista de espera
  getWaitingListStats: async (companyId: string) => {
    try {
      const [totalWaiting, byStatus, byService, byPriority, conversionRate] = await Promise.all([
        // Total na lista de espera
        prisma.waiting_list.count({
          where: {
            company_id: companyId,
            status: {
              in: [WaitingListStatus.WAITING, WaitingListStatus.CONTACTED]
            }
          }
        }),

        // Por status
        prisma.waiting_list.groupBy({
          by: ['status'],
          where: { company_id: companyId },
          _count: { status: true }
        }),

        // Por serviço
        prisma.waiting_list.groupBy({
          by: ['service_id'],
          where: {
            company_id: companyId,
            status: {
              in: [WaitingListStatus.WAITING, WaitingListStatus.CONTACTED]
            }
          },
          _count: { service_id: true },
          orderBy: { _count: { service_id: 'desc' } },
          take: 5
        }),

        // Por prioridade
        prisma.waiting_list.groupBy({
          by: ['priority'],
          where: {
            company_id: companyId,
            status: {
              in: [WaitingListStatus.WAITING, WaitingListStatus.CONTACTED]
            }
          },
          _count: { priority: true },
          orderBy: { priority: 'desc' }
        }),

        // Taxa de conversão (últimos 30 dias)
        prisma.waiting_list.aggregate({
          where: {
            company_id: companyId,
            created_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          _count: { id: true }
        }).then(async (total) => {
          const converted = await prisma.waiting_list.count({
            where: {
              company_id: companyId,
              status: WaitingListStatus.SCHEDULED,
              created_at: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          });

          return {
            total: total._count.id,
            converted,
            rate: total._count.id > 0 ? Math.round((converted / total._count.id) * 100) : 0
          };
        })
      ]);

      const statusStats = byStatus.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);

      return {
        total_waiting: totalWaiting,
        by_status: statusStats,
        top_services: byService.map(service => ({
          service_id: service.service_id,
          count: service._count.service_id
        })),
        by_priority: byPriority.map(p => ({
          priority: p.priority,
          count: p._count.priority
        })),
        conversion_rate: conversionRate,
        average_waiting_time: await waitingListService.calculateAverageWaitingTime(companyId)
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas da lista de espera:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao obter estatísticas da lista de espera',
        500
      );
    }
  },

  // Calcular tempo médio de espera
  calculateAverageWaitingTime: async (companyId: string): Promise<number> => {
    try {
      const scheduledEntries = await prisma.waiting_list.findMany({
        where: {
          company_id: companyId,
          status: WaitingListStatus.SCHEDULED
        },
        select: {
          created_at: true,
          updated_at: true
        }
      });

      if (scheduledEntries.length === 0) {
        return 0;
      }

      const totalWaitingTime = scheduledEntries.reduce((sum, entry) => {
        const waitingTime = entry.updated_at.getTime() - entry.created_at.getTime();
        return sum + waitingTime;
      }, 0);

      // Retornar em horas
      return Math.round(totalWaitingTime / (scheduledEntries.length * 1000 * 60 * 60));

    } catch (error) {
      logger.error('Erro ao calcular tempo médio de espera:', error);
      return 0;
    }
  },

  // Processar entradas expiradas
  processExpiredEntries: async (companyId?: string) => {
    try {
      const where: any = {
        expires_at: { lt: new Date() },
        status: {
          in: [WaitingListStatus.WAITING, WaitingListStatus.CONTACTED]
        }
      };

      if (companyId) {
        where.company_id = companyId;
      }

      const expiredCount = await prisma.waiting_list.updateMany({
        where,
        data: {
          status: WaitingListStatus.EXPIRED,
          updated_at: new Date()
        }
      });

      logger.info('Entradas expiradas processadas', {
        count: expiredCount.count,
        companyId
      });

      return expiredCount.count;

    } catch (error) {
      logger.error('Erro ao processar entradas expiradas:', error);
      return 0;
    }
  }
};