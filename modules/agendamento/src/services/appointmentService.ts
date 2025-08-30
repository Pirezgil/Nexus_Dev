/**
 * Service para gerenciamento de agendamentos
 * Lógica de negócio para CRUD de appointments com validações e integrações
 */

import { Prisma } from '@prisma/client';
import { 
  IAppointment, 
  IAppointmentWithDetails, 
  ICreateAppointmentRequest, 
  IUpdateAppointmentRequest,
  AppointmentStatus,
  ErrorCode,
  AppointmentError,
  IAppointmentReport
} from '../types';
import { db } from '../utils/database';
import { appointmentCache } from '../utils/redis';
import { logger, appointmentLogger } from '../utils/logger';
import { integrationService } from './integrationService';
import { availabilityService } from './availabilityService';
import { notificationService } from './notificationService';
import { waitingListService } from './waitingListService';
import { addMinutes, parseISO, formatISO, startOfDay, endOfDay } from 'date-fns';

interface AppointmentQuery {
  company_id: string;
  date_from?: string;
  date_to?: string;
  professional_id?: string;
  customer_id?: string;
  status?: AppointmentStatus;
  view?: string;
  page?: number;
  limit?: number;
}

interface CreateAppointmentData extends ICreateAppointmentRequest {
  company_id: string;
  created_by: string;
}

interface UpdateAppointmentData extends IUpdateAppointmentRequest {
  company_id: string;
  updated_by: string;
}

export const appointmentService = {

  // Listar agendamentos com filtros e paginação
  getAppointments: async (query: AppointmentQuery) => {
    try {
      const {
        company_id,
        date_from,
        date_to,
        professional_id,
        customer_id,
        status,
        page = 1,
        limit = 50
      } = query;

      // Construir filtros
      const where: Prisma.AppointmentWhereInput = {
        company_id,
        ...(professional_id && { professional_id }),
        ...(customer_id && { customer_id }),
        ...(status && { status }),
        ...(date_from && date_to && {
          appointment_date: {
            gte: new Date(date_from),
            lte: new Date(date_to)
          }
        })
      };

      // Executar queries em paralelo
      const [appointments, totalCount] = await Promise.all([
        db.appointment.findMany({
          where,
          orderBy: [
            { appointment_date: 'asc' },
            { appointment_time: 'asc' }
          ],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            notifications: {
              where: { status: 'sent' },
              orderBy: { created_at: 'desc' },
              take: 1
            }
          }
        }),
        db.appointment.count({ where })
      ]);

      // Buscar dados externos (customers, professionals, services)
      const appointmentsWithDetails = await Promise.all(
        appointments.map(async (appointment) => {
          try {
            const [customer, professional, service] = await Promise.all([
              integrationService.getCustomerById(appointment.customer_id, company_id),
              integrationService.getProfessionalById(appointment.professional_id, company_id),
              integrationService.getServiceById(appointment.service_id, company_id)
            ]);

            return {
              id: appointment.id,
              company_id: appointment.company_id,
              customer,
              professional,
              service,
              appointment_date: appointment.appointment_date.toISOString().split('T')[0],
              appointment_time: appointment.appointment_time.toTimeString().substring(0, 5),
              appointment_end_time: appointment.appointment_end_time.toTimeString().substring(0, 5),
              status: appointment.status,
              notes: appointment.notes,
              estimated_price: appointment.estimated_price ? Number(appointment.estimated_price) : null,
              confirmed_at: appointment.confirmed_at,
              confirmed_by: appointment.confirmed_by,
              created_at: appointment.created_at,
              updated_at: appointment.updated_at,
              last_notification: appointment.notifications[0] || null
            };
          } catch (error) {
            logger.error(`Erro ao buscar detalhes do agendamento ${appointment.id}:`, error);
            
            // Retornar dados básicos mesmo com erro nas integrações
            return {
              id: appointment.id,
              company_id: appointment.company_id,
              customer: { id: appointment.customer_id, name: 'Cliente não encontrado' },
              professional: { id: appointment.professional_id, name: 'Profissional não encontrado' },
              service: { id: appointment.service_id, name: 'Serviço não encontrado', duration_minutes: 60, price: 0 },
              appointment_date: appointment.appointment_date.toISOString().split('T')[0],
              appointment_time: appointment.appointment_time.toTimeString().substring(0, 5),
              appointment_end_time: appointment.appointment_end_time.toTimeString().substring(0, 5),
              status: appointment.status,
              notes: appointment.notes,
              estimated_price: appointment.estimated_price ? Number(appointment.estimated_price) : null,
              confirmed_at: appointment.confirmed_at,
              confirmed_by: appointment.confirmed_by,
              created_at: appointment.created_at,
              updated_at: appointment.updated_at,
              integration_error: true
            };
          }
        })
      );

      // Calcular estatísticas
      const statusCounts = await db.appointment.groupBy({
        by: ['status'],
        where: {
          company_id,
          ...(date_from && date_to && {
            appointment_date: {
              gte: new Date(date_from),
              lte: new Date(date_to)
            }
          })
        },
        _count: { status: true }
      });

      const summary = {
        total_appointments: totalCount,
        by_status: statusCounts.reduce((acc, item) => ({
          ...acc,
          [item.status]: item._count.status
        }), {} as Record<string, number>),
        total_estimated_revenue: appointmentsWithDetails
          .filter(apt => apt.estimated_price && apt.status !== 'cancelled')
          .reduce((sum, apt) => sum + (apt.estimated_price || 0), 0)
      };

      return {
        appointments: appointmentsWithDetails,
        summary,
        total: totalCount,
        page,
        limit
      };

    } catch (error) {
      logger.error('Erro ao listar agendamentos:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao listar agendamentos',
        500,
        error
      );
    }
  },

  // Obter agendamento específico por ID
  getAppointmentById: async (id: string, company_id: string): Promise<IAppointmentWithDetails | null> => {
    try {
      // Verificar cache primeiro
      const cached = await appointmentCache.getAppointmentDetails(id);
      if (cached) {
        return cached;
      }

      const appointment = await db.appointment.findFirst({
        where: { id, company_id },
        include: {
          notifications: {
            orderBy: { created_at: 'desc' },
            take: 5
          }
        }
      });

      if (!appointment) {
        return null;
      }

      // Buscar dados externos
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(appointment.customer_id, company_id),
        integrationService.getProfessionalById(appointment.professional_id, company_id),
        integrationService.getServiceById(appointment.service_id, company_id)
      ]);

      const appointmentWithDetails: IAppointmentWithDetails = {
        id: appointment.id,
        company_id: appointment.company_id,
        customer_id: appointment.customer_id,
        professional_id: appointment.professional_id,
        service_id: appointment.service_id,
        customer,
        professional,
        service,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        appointment_end_time: appointment.appointment_end_time,
        timezone: appointment.timezone,
        status: appointment.status as AppointmentStatus,
        notes: appointment.notes,
        internal_notes: appointment.internal_notes,
        estimated_price: appointment.estimated_price ? Number(appointment.estimated_price) : undefined,
        send_confirmation: appointment.send_confirmation,
        send_reminder: appointment.send_reminder,
        reminder_hours_before: appointment.reminder_hours_before,
        confirmed_at: appointment.confirmed_at,
        confirmed_by: appointment.confirmed_by,
        original_appointment_id: appointment.original_appointment_id,
        rescheduled_from_date: appointment.rescheduled_from_date,
        rescheduled_from_time: appointment.rescheduled_from_time,
        reschedule_reason: appointment.reschedule_reason,
        completed_at: appointment.completed_at,
        completed_appointment_id: appointment.completed_appointment_id,
        created_by: appointment.created_by,
        updated_by: appointment.updated_by,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at
      };

      // Cache o resultado
      await appointmentCache.setAppointmentDetails(id, appointmentWithDetails);

      return appointmentWithDetails;

    } catch (error) {
      logger.error(`Erro ao buscar agendamento ${id}:`, error);
      throw new AppointmentError(
        ErrorCode.APPOINTMENT_NOT_FOUND,
        'Erro ao buscar agendamento',
        500,
        error
      );
    }
  },

  // Criar novo agendamento
  createAppointment: async (data: CreateAppointmentData) => {
    try {
      const {
        company_id,
        customer_id,
        professional_id,
        service_id,
        appointment_date,
        appointment_time,
        notes,
        send_confirmation = true,
        send_reminder = true,
        reminder_hours_before = 24,
        created_by
      } = data;

      // Validar se cliente, profissional e serviço existem
      const [customer, professional, service] = await Promise.all([
        integrationService.getCustomerById(customer_id, company_id),
        integrationService.getProfessionalById(professional_id, company_id),
        integrationService.getServiceById(service_id, company_id)
      ]);

      if (!customer) {
        throw new AppointmentError(ErrorCode.CUSTOMER_NOT_FOUND, 'Cliente não encontrado');
      }
      if (!professional) {
        throw new AppointmentError(ErrorCode.PROFESSIONAL_NOT_FOUND, 'Profissional não encontrado');
      }
      if (!service) {
        throw new AppointmentError(ErrorCode.SERVICE_NOT_FOUND, 'Serviço não encontrado');
      }

      // Validar horário de funcionamento
      const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}:00`);
      
      // Calcular horário de término baseado na duração do serviço
      const endTime = addMinutes(appointmentDateTime, service.duration_minutes);

      // Verificar disponibilidade
      const isAvailable = await availabilityService.checkSlotAvailability({
        company_id,
        professional_id,
        service_id,
        date: new Date(appointment_date),
        time: appointment_time
      });

      if (!isAvailable) {
        throw new AppointmentError(
          ErrorCode.SCHEDULE_CONFLICT,
          'Horário não disponível para agendamento'
        );
      }

      // Criar agendamento na transação
      const appointment = await db.appointment.create({
        data: {
          company_id,
          customer_id,
          professional_id,
          service_id,
          appointment_date: new Date(appointment_date),
          appointment_time: new Date(`1970-01-01T${appointment_time}:00Z`),
          appointment_end_time: new Date(`1970-01-01T${endTime.toTimeString().substring(0, 5)}:00Z`),
          status: 'scheduled',
          notes,
          estimated_price: service.price,
          send_confirmation,
          send_reminder,
          reminder_hours_before,
          created_by
        }
      });

      // Invalidar cache relacionado
      await Promise.all([
        appointmentCache.invalidateByProfessional(professional_id),
        appointmentCache.invalidateByDate(appointment_date)
      ]);

      // Preparar dados para retorno
      const appointmentWithDetails = {
        ...appointment,
        customer,
        professional,
        service,
        appointment_date: appointment_date,
        appointment_time: appointment_time,
        appointment_end_time: endTime.toTimeString().substring(0, 5),
        estimated_price: Number(appointment.estimated_price)
      };

      // Agendar notificações se solicitado
      const notificationsScheduled = [];
      
      if (send_confirmation) {
        try {
          const result = await notificationService.sendAppointmentConfirmation({
            id: appointment.id,
            customer_id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            professional_name: professional.name,
            service_name: service.name,
            appointment_date,
            appointment_time,
            company_id
          });

          if (result.success) {
            notificationsScheduled.push({
              type: 'confirmation',
              channel: 'whatsapp',
              scheduled_for: 'immediately',
              message_id: result.messageId
            });
          }
        } catch (error) {
          logger.warn('Falha ao enviar notificação de confirmação:', error);
        }
      }

      if (send_reminder && reminder_hours_before > 0) {
        try {
          const result = await notificationService.scheduleAppointmentReminder({
            id: appointment.id,
            customer_id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            professional_name: professional.name,
            service_name: service.name,
            appointment_date,
            appointment_time,
            company_id
          }, reminder_hours_before);

          if (result.success) {
            const reminderDateTime = new Date(appointmentDateTime);
            reminderDateTime.setHours(reminderDateTime.getHours() - reminder_hours_before);

            notificationsScheduled.push({
              type: 'reminder',
              channel: 'whatsapp',
              scheduled_for: reminderDateTime.toISOString(),
              message_id: result.messageId
            });
          }
        } catch (error) {
          logger.warn('Falha ao agendar lembrete:', error);
        }
      }

      return {
        ...appointmentWithDetails,
        notifications_scheduled: notificationsScheduled
      };

    } catch (error) {
      logger.error('Erro ao criar agendamento:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao criar agendamento',
        500,
        error
      );
    }
  },

  // Atualizar agendamento
  updateAppointment: async (id: string, data: UpdateAppointmentData) => {
    try {
      const { company_id, updated_by, ...updates } = data;

      // Verificar se agendamento existe
      const existingAppointment = await db.appointment.findFirst({
        where: { id, company_id }
      });

      if (!existingAppointment) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
      }

      // Se é reagendamento (mudança de data/hora)
      const isReschedule = updates.appointment_date || updates.appointment_time;
      let endTime: Date | undefined;
      let rescheduleData = {};

      if (isReschedule) {
        // Buscar dados do serviço para calcular nova duração
        const service = await integrationService.getServiceById(existingAppointment.service_id, company_id);
        if (!service) {
          throw new AppointmentError(ErrorCode.SERVICE_NOT_FOUND, 'Serviço não encontrado');
        }

        const newDate = updates.appointment_date || existingAppointment.appointment_date.toISOString().split('T')[0];
        const newTime = updates.appointment_time || existingAppointment.appointment_time.toTimeString().substring(0, 5);
        
        // Verificar disponibilidade para novo horário
        const isAvailable = await availabilityService.checkSlotAvailability({
          company_id,
          professional_id: existingAppointment.professional_id,
          service_id: existingAppointment.service_id,
          date: new Date(newDate),
          time: newTime,
          exclude_appointment_id: id // Excluir o próprio agendamento da verificação
        });

        if (!isAvailable) {
          throw new AppointmentError(
            ErrorCode.SCHEDULE_CONFLICT,
            'Novo horário não disponível'
          );
        }

        const newDateTime = new Date(`${newDate}T${newTime}:00`);
        endTime = addMinutes(newDateTime, service.duration_minutes);

        rescheduleData = {
          original_appointment_id: existingAppointment.original_appointment_id || existingAppointment.id,
          rescheduled_from_date: existingAppointment.appointment_date,
          rescheduled_from_time: existingAppointment.appointment_time,
          reschedule_reason: updates.reschedule_reason,
          status: 'rescheduled'
        };
      }

      // Atualizar agendamento
      const appointment = await db.appointment.update({
        where: { id },
        data: {
          ...updates,
          ...(updates.appointment_date && { appointment_date: new Date(updates.appointment_date) }),
          ...(updates.appointment_time && { appointment_time: new Date(`1970-01-01T${updates.appointment_time}:00Z`) }),
          ...(endTime && { appointment_end_time: new Date(`1970-01-01T${endTime.toTimeString().substring(0, 5)}:00Z`) }),
          ...rescheduleData,
          updated_by,
          updated_at: new Date()
        }
      });

      // Invalidar caches relacionados
      await Promise.all([
        appointmentCache.del(appointmentCache.keys.appointmentDetails(id)),
        appointmentCache.invalidateByProfessional(existingAppointment.professional_id),
        appointmentCache.invalidateByDate(existingAppointment.appointment_date.toISOString().split('T')[0])
      ]);

      // Se foi reagendamento, enviar notificação
      if (isReschedule && data.send_reschedule_notification) {
        try {
          await notificationService.scheduleAppointmentNotification({
            appointment_id: id,
            notification_type: 'reschedule',
            send_immediately: true
          });
        } catch (error) {
          logger.warn('Falha ao enviar notificação de reagendamento:', error);
        }
      }

      return appointment;

    } catch (error) {
      logger.error(`Erro ao atualizar agendamento ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao atualizar agendamento',
        500,
        error
      );
    }
  },

  // Cancelar agendamento
  cancelAppointment: async (id: string, options: {
    company_id: string;
    cancelled_by: string;
    cancellation_reason?: string;
    send_notification?: boolean;
    refund_required?: boolean;
  }) => {
    try {
      const { company_id, cancelled_by, cancellation_reason, send_notification = true } = options;

      // Verificar se agendamento existe e pode ser cancelado
      const existingAppointment = await db.appointment.findFirst({
        where: { id, company_id }
      });

      if (!existingAppointment) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
      }

      if (existingAppointment.status === 'cancelled') {
        throw new AppointmentError(ErrorCode.INVALID_APPOINTMENT_STATUS, 'Agendamento já está cancelado');
      }

      if (existingAppointment.status === 'completed') {
        throw new AppointmentError(ErrorCode.INVALID_APPOINTMENT_STATUS, 'Não é possível cancelar agendamento já concluído');
      }

      // Atualizar status para cancelado
      const appointment = await db.appointment.update({
        where: { id },
        data: {
          status: 'cancelled',
          internal_notes: cancellation_reason 
            ? `${existingAppointment.internal_notes || ''}\nCancelado: ${cancellation_reason}`.trim()
            : existingAppointment.internal_notes,
          updated_by: cancelled_by,
          updated_at: new Date()
        }
      });

      // Invalidar caches
      await Promise.all([
        appointmentCache.del(appointmentCache.keys.appointmentDetails(id)),
        appointmentCache.invalidateByProfessional(existingAppointment.professional_id),
        appointmentCache.invalidateByDate(existingAppointment.appointment_date.toISOString().split('T')[0])
      ]);

      // Enviar notificação de cancelamento se solicitado
      let cancellationNotificationSent = false;
      if (send_notification) {
        try {
          // Buscar dados do cliente
          const customer = await integrationService.getCustomerById(existingAppointment.customer_id, company_id);
          const professional = await integrationService.getProfessionalById(existingAppointment.professional_id, company_id);
          const service = await integrationService.getServiceById(existingAppointment.service_id, company_id);

          const result = await notificationService.sendAppointmentCancellation({
            id,
            customer_id: existingAppointment.customer_id,
            customer_name: customer?.name || 'Cliente',
            customer_phone: customer?.phone || '',
            professional_name: professional?.name || 'Profissional',
            service_name: service?.name || 'Serviço',
            appointment_date: existingAppointment.appointment_date.toISOString().split('T')[0],
            appointment_time: existingAppointment.appointment_time.toTimeString().substring(0, 5),
            company_id
          }, cancellation_reason);

          cancellationNotificationSent = result.success;
        } catch (error) {
          logger.warn('Falha ao enviar notificação de cancelamento:', error);
        }
      }

      // NOVO: Notificar lista de espera sobre vaga que abriu
      try {
        await appointmentService.notifyWaitingListOnCancellation({
          company_id,
          professional_id: existingAppointment.professional_id,
          service_id: existingAppointment.service_id,
          date: existingAppointment.appointment_date.toISOString().split('T')[0],
          time: existingAppointment.appointment_time.toTimeString().substring(0, 5)
        });
      } catch (error) {
        logger.warn('Erro ao notificar lista de espera sobre cancelamento:', error);
      }

      return {
        appointment,
        cancellation_reason,
        notification_sent: cancellationNotificationSent,
        waiting_list_notified: true
      };

    } catch (error) {
      logger.error(`Erro ao cancelar agendamento ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao cancelar agendamento',
        500,
        error
      );
    }
  },

  // Confirmar agendamento
  confirmAppointment: async (id: string, options: {
    company_id: string;
    confirmed_by: 'customer' | 'staff' | 'auto';
    confirmation_notes?: string;
    staff_user_id?: string;
  }) => {
    try {
      const { company_id, confirmed_by, confirmation_notes, staff_user_id } = options;

      const appointment = await db.appointment.update({
        where: { id, company_id },
        data: {
          status: 'confirmed',
          confirmed_at: new Date(),
          confirmed_by,
          ...(confirmation_notes && {
            internal_notes: confirmation_notes
          }),
          ...(staff_user_id && {
            updated_by: staff_user_id
          }),
          updated_at: new Date()
        }
      });

      // Invalidar cache
      await appointmentCache.del(appointmentCache.keys.appointmentDetails(id));

      return appointment;

    } catch (error) {
      logger.error(`Erro ao confirmar agendamento ${id}:`, error);
      throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
    }
  },

  // Marcar agendamento como concluído
  completeAppointment: async (id: string, options: {
    company_id: string;
    completed_at: Date;
    completed_appointment_id?: string;
    completed_by: string;
  }) => {
    try {
      const { company_id, completed_at, completed_appointment_id, completed_by } = options;

      const appointment = await db.appointment.update({
        where: { id, company_id },
        data: {
          status: 'completed',
          completed_at,
          completed_appointment_id,
          updated_by: completed_by,
          updated_at: new Date()
        }
      });

      // Invalidar cache
      await appointmentCache.del(appointmentCache.keys.appointmentDetails(id));

      return appointment;

    } catch (error) {
      logger.error(`Erro ao concluir agendamento ${id}:`, error);
      throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
    }
  },

  // Marcar como falta (no-show)
  markNoShow: async (id: string, options: {
    company_id: string;
    notes?: string;
    marked_by: string;
  }) => {
    try {
      const { company_id, notes, marked_by } = options;

      const appointment = await db.appointment.update({
        where: { id, company_id },
        data: {
          status: 'no_show',
          ...(notes && {
            internal_notes: notes
          }),
          updated_by: marked_by,
          updated_at: new Date()
        }
      });

      // Invalidar cache
      await appointmentCache.del(appointmentCache.keys.appointmentDetails(id));

      return appointment;

    } catch (error) {
      logger.error(`Erro ao marcar como falta ${id}:`, error);
      throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
    }
  },

  // NOVO: Notificar lista de espera quando agendamento é cancelado/reagendado
  notifyWaitingListOnCancellation: async (params: {
    company_id: string;
    professional_id: string;
    service_id: string;
    date: string;
    time: string;
  }) => {
    try {
      const { company_id, professional_id, service_id, date, time } = params;

      logger.debug('Notificando lista de espera sobre vaga disponível', {
        professionalId: professional_id,
        serviceId: service_id,
        date,
        time
      });

      // 1. Buscar pessoas na lista de espera compatíveis
      const waitingList = await waitingListService.getWaitingList({
        company_id,
        status: 'waiting',
        service_id,
        professional_id,
        sort: 'priority',
        order: 'desc',
        limit: 10 // Top 10 por prioridade
      });

      if (!waitingList.waiting_entries || waitingList.waiting_entries.length === 0) {
        logger.debug('Nenhuma entrada na lista de espera para notificar');
        return { notified: 0 };
      }

      let notifiedCount = 0;

      // 2. Para cada pessoa na lista, verificar compatibilidade e notificar
      for (const waitingEntry of waitingList.waiting_entries) {
        try {
          // Verificar se a data/horário é compatível com as preferências
          const isCompatible = appointmentService.isSlotCompatibleWithPreferences(
            waitingEntry,
            date,
            time
          );

          if (isCompatible) {
            // Notificar automaticamente sobre a oportunidade
            await waitingListService.notifyWaitingListOpportunity(waitingEntry.id, {
              date,
              time,
              professional_id
            });

            notifiedCount++;
            
            // Notificar apenas os 3 primeiros por prioridade para evitar spam
            if (notifiedCount >= 3) {
              break;
            }
          }
        } catch (error) {
          logger.warn(`Erro ao notificar waiting entry ${waitingEntry.id}:`, error);
          // Continuar para próximo entry
        }
      }

      logger.info(`Lista de espera notificada sobre cancelamento`, {
        professionalId: professional_id,
        serviceId: service_id,
        date,
        time,
        notifiedCount
      });

      return { notified: notifiedCount };

    } catch (error) {
      logger.error('Erro ao notificar lista de espera:', error);
      return { notified: 0, error: error.message };
    }
  },

  // Verificar se slot é compatível com preferências da waiting list
  isSlotCompatibleWithPreferences: (waitingEntry: any, date: string, time: string): boolean => {
    try {
      // Se tem data preferida e não é flexível, verificar se é a mesma data
      if (waitingEntry.preferred_date && !waitingEntry.flexible_date) {
        const preferredDateStr = waitingEntry.preferred_date.toISOString().split('T')[0];
        if (preferredDateStr !== date) {
          return false;
        }
      }

      // Se tem horário preferido e não é flexível, verificar se está no range
      if (waitingEntry.preferred_time_start && waitingEntry.preferred_time_end && !waitingEntry.flexible_time) {
        const slotTime = time.replace(':', '');
        const startTime = waitingEntry.preferred_time_start.toTimeString().substring(0, 5).replace(':', '');
        const endTime = waitingEntry.preferred_time_end.toTimeString().substring(0, 5).replace(':', '');
        
        if (slotTime < startTime || slotTime > endTime) {
          return false;
        }
      }

      // Se chegou até aqui, é compatível
      return true;

    } catch (error) {
      logger.warn('Erro ao verificar compatibilidade de slot:', error);
      return false;
    }
  }
};