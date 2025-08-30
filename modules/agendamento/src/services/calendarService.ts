/**
 * Service para funcionalidades de calendário
 * Gera dados para visualização do calendário com agendamentos e bloqueios
 */

import { 
  CalendarView, 
  ICalendarData, 
  ICalendarAppointment, 
  ICalendarBlock,
  ErrorCode,
  AppointmentError,
  AppointmentStatus,
  BlockType
} from '../types';
import { db } from '../utils/database';
import { appointmentCache } from '../utils/redis';
import { logger } from '../utils/logger';
import { integrationService } from './integrationService';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfDay, 
  endOfDay,
  format,
  addDays,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarQuery {
  company_id: string;
  view: CalendarView;
  reference_date: Date;
  professional_id?: string;
}

const STATUS_COLORS = {
  scheduled: '#3B82F6', // blue
  confirmed: '#10B981', // green
  completed: '#6B7280', // gray
  cancelled: '#EF4444', // red
  no_show: '#F59E0B', // amber
  rescheduled: '#8B5CF6' // purple
};

const BLOCK_COLORS = {
  holiday: '#EF4444', // red
  vacation: '#F59E0B', // amber
  maintenance: '#6B7280', // gray
  personal: '#8B5CF6', // purple
  break: '#10B981', // green
  lunch: '#3B82F6' // blue
};

export const calendarService = {

  // Obter dados completos do calendário
  getCalendarData: async (query: CalendarQuery): Promise<ICalendarData> => {
    try {
      const { company_id, view, reference_date, professional_id } = query;

      // Verificar cache primeiro
      const cacheKey = appointmentCache.keys.calendarData(
        company_id, 
        view, 
        format(reference_date, 'yyyy-MM-dd'),
        professional_id
      );
      
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Calcular período baseado na visualização
      const period = calendarService.calculatePeriod(view, reference_date);
      
      // Buscar dados em paralelo
      const [businessHours, professionals, appointments, scheduleBlocks] = await Promise.all([
        calendarService.getBusinessHours(company_id),
        integrationService.getProfessionals(company_id, professional_id),
        calendarService.getCalendarAppointments(company_id, period.start_date, period.end_date, professional_id),
        calendarService.getCalendarBlocks(company_id, period.start_date, period.end_date, professional_id)
      ]);

      const calendarData: ICalendarData = {
        view,
        period: {
          start_date: format(period.start_date, 'yyyy-MM-dd'),
          end_date: format(period.end_date, 'yyyy-MM-dd')
        },
        business_hours: businessHours,
        professionals: professionals || [],
        appointments: appointments || [],
        schedule_blocks: scheduleBlocks || []
      };

      // Cache por 5 minutos
      await appointmentCache.set(cacheKey, calendarData, 300);

      return calendarData;

    } catch (error) {
      logger.error('Erro ao obter dados do calendário:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao carregar dados do calendário',
        500,
        error
      );
    }
  },

  // Calcular período baseado na visualização
  calculatePeriod: (view: CalendarView, referenceDate: Date) => {
    switch (view) {
      case CalendarView.DAY:
        return {
          start_date: startOfDay(referenceDate),
          end_date: endOfDay(referenceDate)
        };
      
      case CalendarView.WEEK:
        return {
          start_date: startOfWeek(referenceDate, { weekStartsOn: 1 }), // Segunda-feira
          end_date: endOfWeek(referenceDate, { weekStartsOn: 1 }) // Domingo
        };
      
      case CalendarView.MONTH:
        const monthStart = startOfMonth(referenceDate);
        const monthEnd = endOfMonth(referenceDate);
        
        // Incluir dias da semana anterior/posterior para completar o grid
        return {
          start_date: startOfWeek(monthStart, { weekStartsOn: 1 }),
          end_date: endOfWeek(monthEnd, { weekStartsOn: 1 })
        };
      
      default:
        throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Visualização inválida');
    }
  },

  // Obter horários de funcionamento
  getBusinessHours: async (company_id: string): Promise<Record<string, { start: string; end: string }>> => {
    try {
      // Verificar cache
      const cached = await appointmentCache.getBusinessHours(company_id);
      if (cached) {
        return cached;
      }

      const businessHours = await db.businessHour.findMany({
        where: { company_id, is_open: true },
        orderBy: { day_of_week: 'asc' }
      });

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      const result = businessHours.reduce((acc, hour) => {
        if (hour.start_time && hour.end_time) {
          acc[dayNames[hour.day_of_week]] = {
            start: hour.start_time.toTimeString().substring(0, 5),
            end: hour.end_time.toTimeString().substring(0, 5)
          };
        }
        return acc;
      }, {} as Record<string, { start: string; end: string }>);

      // Cache por 1 hora
      await appointmentCache.setBusinessHours(company_id, result, 3600);

      return result;

    } catch (error) {
      logger.error('Erro ao buscar horários de funcionamento:', error);
      return {}; // Retornar vazio em caso de erro
    }
  },

  // Obter agendamentos para o calendário
  getCalendarAppointments: async (
    company_id: string, 
    start_date: Date, 
    end_date: Date,
    professional_id?: string
  ): Promise<ICalendarAppointment[]> => {
    try {
      const appointments = await db.appointment.findMany({
        where: {
          company_id,
          appointment_date: {
            gte: start_date,
            lte: end_date
          },
          ...(professional_id && { professional_id }),
          status: {
            not: 'cancelled' // Não mostrar cancelados no calendário
          }
        },
        orderBy: [
          { appointment_date: 'asc' },
          { appointment_time: 'asc' }
        ]
      });

      // Buscar dados dos clientes, profissionais e serviços
      const appointmentsWithDetails = await Promise.all(
        appointments.map(async (appointment) => {
          try {
            const [customer, professional, service] = await Promise.all([
              integrationService.getCustomerById(appointment.customer_id, company_id),
              integrationService.getProfessionalById(appointment.professional_id, company_id),
              integrationService.getServiceById(appointment.service_id, company_id)
            ]);

            // Construir datetime ISO para início e fim
            const appointmentDate = appointment.appointment_date.toISOString().split('T')[0];
            const startTime = appointment.appointment_time.toTimeString().substring(0, 5);
            const endTime = appointment.appointment_end_time.toTimeString().substring(0, 5);

            const calendarAppointment: ICalendarAppointment = {
              id: appointment.id,
              professional_id: appointment.professional_id,
              customer_name: customer?.name || 'Cliente não encontrado',
              service_name: service?.name || 'Serviço não encontrado',
              start: `${appointmentDate}T${startTime}:00`,
              end: `${appointmentDate}T${endTime}:00`,
              status: appointment.status as AppointmentStatus,
              color: STATUS_COLORS[appointment.status as AppointmentStatus] || STATUS_COLORS.scheduled,
              phone: customer?.phone,
              notes: appointment.notes || undefined
            };

            return calendarAppointment;

          } catch (error) {
            logger.error(`Erro ao buscar dados para agendamento ${appointment.id}:`, error);
            
            // Retornar dados básicos mesmo com erro
            const appointmentDate = appointment.appointment_date.toISOString().split('T')[0];
            const startTime = appointment.appointment_time.toTimeString().substring(0, 5);
            const endTime = appointment.appointment_end_time.toTimeString().substring(0, 5);

            return {
              id: appointment.id,
              professional_id: appointment.professional_id,
              customer_name: 'Erro ao carregar',
              service_name: 'Erro ao carregar',
              start: `${appointmentDate}T${startTime}:00`,
              end: `${appointmentDate}T${endTime}:00`,
              status: appointment.status as AppointmentStatus,
              color: STATUS_COLORS[appointment.status as AppointmentStatus] || STATUS_COLORS.scheduled,
              notes: appointment.notes || undefined
            };
          }
        })
      );

      return appointmentsWithDetails;

    } catch (error) {
      logger.error('Erro ao buscar agendamentos do calendário:', error);
      return [];
    }
  },

  // Obter bloqueios de horário para o calendário
  getCalendarBlocks: async (
    company_id: string, 
    start_date: Date, 
    end_date: Date,
    professional_id?: string
  ): Promise<ICalendarBlock[]> => {
    try {
      const blocks = await db.scheduleBlock.findMany({
        where: {
          company_id,
          active: true,
          OR: [
            // Bloqueios que começam no período
            {
              start_date: {
                gte: start_date,
                lte: end_date
              }
            },
            // Bloqueios que terminam no período
            {
              end_date: {
                gte: start_date,
                lte: end_date
              }
            },
            // Bloqueios que englobam todo o período
            {
              start_date: { lte: start_date },
              end_date: { gte: end_date }
            }
          ],
          ...(professional_id && { 
            OR: [
              { professional_id },
              { professional_id: null } // Bloqueios gerais
            ]
          })
        },
        orderBy: { start_date: 'asc' }
      });

      const calendarBlocks: ICalendarBlock[] = blocks.map(block => {
        // Se não tem horário específico, é o dia todo
        if (!block.start_time || !block.end_time) {
          return {
            id: block.id,
            professional_id: block.professional_id || undefined,
            title: block.title,
            start: `${block.start_date.toISOString().split('T')[0]}T00:00:00`,
            end: `${block.end_date.toISOString().split('T')[0]}T23:59:59`,
            type: block.block_type as BlockType,
            color: BLOCK_COLORS[block.block_type as BlockType] || BLOCK_COLORS.personal,
            description: block.description || undefined
          };
        } else {
          // Com horário específico
          const startTime = block.start_time.toTimeString().substring(0, 5);
          const endTime = block.end_time.toTimeString().substring(0, 5);
          
          return {
            id: block.id,
            professional_id: block.professional_id || undefined,
            title: block.title,
            start: `${block.start_date.toISOString().split('T')[0]}T${startTime}:00`,
            end: `${block.end_date.toISOString().split('T')[0]}T${endTime}:00`,
            type: block.block_type as BlockType,
            color: BLOCK_COLORS[block.block_type as BlockType] || BLOCK_COLORS.personal,
            description: block.description || undefined
          };
        }
      });

      return calendarBlocks;

    } catch (error) {
      logger.error('Erro ao buscar bloqueios do calendário:', error);
      return [];
    }
  },

  // Obter visualização semanal específica
  getWeekView: async (company_id: string, date: Date, professional_id?: string) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    return calendarService.getCalendarData({
      company_id,
      view: CalendarView.WEEK,
      reference_date: date,
      professional_id
    });
  },

  // Obter visualização mensal específica
  getMonthView: async (company_id: string, date: Date, professional_id?: string) => {
    return calendarService.getCalendarData({
      company_id,
      view: CalendarView.MONTH,
      reference_date: date,
      professional_id
    });
  },

  // Obter visualização diária específica
  getDayView: async (company_id: string, date: Date, professional_id?: string) => {
    return calendarService.getCalendarData({
      company_id,
      view: CalendarView.DAY,
      reference_date: date,
      professional_id
    });
  },

  // Gerar slots de tempo para visualização
  generateTimeSlots: (startHour = 8, endHour = 18, intervalMinutes = 30): string[] => {
    const slots: string[] = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    
    return slots;
  },

  // Obter estatísticas do calendário para um período
  getCalendarStats: async (company_id: string, start_date: Date, end_date: Date) => {
    try {
      const stats = await db.appointment.groupBy({
        by: ['status', 'professional_id'],
        where: {
          company_id,
          appointment_date: {
            gte: start_date,
            lte: end_date
          }
        },
        _count: { status: true },
        _sum: { estimated_price: true }
      });

      const totalAppointments = stats.reduce((sum, stat) => sum + stat._count.status, 0);
      const totalRevenue = stats.reduce((sum, stat) => sum + (Number(stat._sum.estimated_price) || 0), 0);
      
      const byStatus = stats.reduce((acc, stat) => {
        acc[stat.status] = (acc[stat.status] || 0) + stat._count.status;
        return acc;
      }, {} as Record<string, number>);

      const byProfessional = stats.reduce((acc, stat) => {
        const key = stat.professional_id;
        if (!acc[key]) {
          acc[key] = { appointments: 0, revenue: 0 };
        }
        acc[key].appointments += stat._count.status;
        acc[key].revenue += Number(stat._sum.estimated_price) || 0;
        return acc;
      }, {} as Record<string, { appointments: number; revenue: number }>);

      return {
        period: {
          start_date: format(start_date, 'yyyy-MM-dd'),
          end_date: format(end_date, 'yyyy-MM-dd')
        },
        totals: {
          appointments: totalAppointments,
          revenue: totalRevenue
        },
        by_status: byStatus,
        by_professional: byProfessional
      };

    } catch (error) {
      logger.error('Erro ao buscar estatísticas do calendário:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao obter estatísticas do calendário',
        500,
        error
      );
    }
  },

  // Gerar cor consistente para um profissional baseado no ID
  generateProfessionalColor: (professionalId: string): string => {
    // Paleta de cores para profissionais
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#8B5CF6', // purple
      '#EF4444', // red
      '#06B6D4', // cyan
      '#84CC16', // lime
      '#F97316', // orange
      '#EC4899', // pink
      '#6366F1', // indigo
      '#14B8A6', // teal
      '#F43F5E'  // rose
    ];

    // Gerar hash simples do ID para consistência
    let hash = 0;
    for (let i = 0; i < professionalId.length; i++) {
      const char = professionalId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Usar valor absoluto do hash para indexar as cores
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  },

  // Obter cor para status de agendamento
  getStatusColor: (status: AppointmentStatus): string => {
    return STATUS_COLORS[status] || STATUS_COLORS.scheduled;
  },

  // Obter cor para tipo de bloqueio
  getBlockColor: (blockType: BlockType): string => {
    return BLOCK_COLORS[blockType] || BLOCK_COLORS.personal;
  }
};