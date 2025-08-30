/**
 * Service para gestão de horários de funcionamento da empresa
 * Handles business hours, work schedules e configurações de agendamento
 */

import { PrismaClient } from '@prisma/client';
import { 
  IBusinessHoursConfig,
  IWorkDay,
  ErrorCode,
  AppointmentError
} from '../types';
import { logger } from '../utils/logger';
import { appointmentCache } from '../utils/redis';

const prisma = new PrismaClient();

interface BusinessHoursCreateData {
  company_id: string;
  day_of_week: number; // 0 = domingo, 1 = segunda, ...
  is_open: boolean;
  start_time?: string;
  end_time?: string;
  lunch_start?: string;
  lunch_end?: string;
  slot_duration_minutes?: number;
  advance_booking_days?: number;
  same_day_booking?: boolean;
}

interface BusinessHoursUpdateData {
  company_id: string;
  is_open?: boolean;
  start_time?: string;
  end_time?: string;
  lunch_start?: string;
  lunch_end?: string;
  slot_duration_minutes?: number;
  advance_booking_days?: number;
  same_day_booking?: boolean;
}

export const businessHoursService = {

  // Buscar configurações de horário de funcionamento
  getBusinessHours: async (companyId: string): Promise<IBusinessHoursConfig> => {
    try {
      // Verificar cache primeiro
      const cacheKey = appointmentCache.keys.businessHours(companyId);
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const businessHours = await prisma.business_hours.findMany({
        where: { company_id: companyId },
        orderBy: { day_of_week: 'asc' }
      });

      if (businessHours.length === 0) {
        // Criar horários padrão se não existirem
        logger.info(`Criando horários padrão para empresa ${companyId}`);
        return await businessHoursService.createDefaultBusinessHours(companyId);
      }

      const config: IBusinessHoursConfig = {
        company_id: companyId,
        days: businessHours.map(day => ({
          day_of_week: day.day_of_week,
          day_name: businessHoursService.getDayName(day.day_of_week),
          is_open: day.is_open || false,
          start_time: day.start_time || '09:00',
          end_time: day.end_time || '18:00',
          lunch_start: day.lunch_start || null,
          lunch_end: day.lunch_end || null,
          slot_duration_minutes: day.slot_duration_minutes || 30,
          advance_booking_days: day.advance_booking_days || 60,
          same_day_booking: day.same_day_booking || true
        }))
      };

      // Cache por 1 hora
      await appointmentCache.set(cacheKey, config, 3600);
      
      return config;

    } catch (error) {
      logger.error('Erro ao buscar horários de funcionamento:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao buscar horários de funcionamento',
        500
      );
    }
  },

  // Buscar horário de um dia específico
  getBusinessHoursForDay: async (companyId: string, dayOfWeek: number): Promise<IWorkDay | null> => {
    try {
      const businessHours = await businessHoursService.getBusinessHours(companyId);
      return businessHours.days.find(day => day.day_of_week === dayOfWeek) || null;
    } catch (error) {
      logger.error(`Erro ao buscar horário do dia ${dayOfWeek}:`, error);
      return null;
    }
  },

  // Verificar se empresa está aberta em um dia/horário específico
  isOpenAt: async (companyId: string, date: Date, time: string): Promise<boolean> => {
    try {
      const dayOfWeek = date.getDay();
      const workDay = await businessHoursService.getBusinessHoursForDay(companyId, dayOfWeek);
      
      if (!workDay || !workDay.is_open) {
        return false;
      }

      // Verificar se está dentro do horário de funcionamento
      const [checkHour, checkMin] = time.split(':').map(Number);
      const checkMinutes = checkHour * 60 + checkMin;

      const [startHour, startMin] = workDay.start_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;

      const [endHour, endMin] = workDay.end_time.split(':').map(Number);
      const endMinutes = endHour * 60 + endMin;

      if (checkMinutes < startMinutes || checkMinutes >= endMinutes) {
        return false;
      }

      // Verificar se não está no horário de almoço
      if (workDay.lunch_start && workDay.lunch_end) {
        const [lunchStartHour, lunchStartMin] = workDay.lunch_start.split(':').map(Number);
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMin;

        const [lunchEndHour, lunchEndMin] = workDay.lunch_end.split(':').map(Number);
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMin;

        if (checkMinutes >= lunchStartMinutes && checkMinutes < lunchEndMinutes) {
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Erro ao verificar se está aberto:', error);
      return false;
    }
  },

  // Criar horários padrão para uma empresa
  createDefaultBusinessHours: async (companyId: string): Promise<IBusinessHoursConfig> => {
    try {
      const defaultHours = [
        // Domingo (fechado)
        { day_of_week: 0, is_open: false },
        // Segunda a Sexta (aberto)
        { day_of_week: 1, is_open: true, start_time: '08:00', end_time: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
        { day_of_week: 2, is_open: true, start_time: '08:00', end_time: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
        { day_of_week: 3, is_open: true, start_time: '08:00', end_time: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
        { day_of_week: 4, is_open: true, start_time: '08:00', end_time: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
        { day_of_week: 5, is_open: true, start_time: '08:00', end_time: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
        // Sábado (meio período)
        { day_of_week: 6, is_open: true, start_time: '08:00', end_time: '12:00' }
      ];

      const created = await Promise.all(
        defaultHours.map(day => 
          prisma.business_hours.create({
            data: {
              company_id: companyId,
              day_of_week: day.day_of_week,
              is_open: day.is_open,
              start_time: day.start_time || null,
              end_time: day.end_time || null,
              lunch_start: day.lunch_start || null,
              lunch_end: day.lunch_end || null,
              slot_duration_minutes: 30,
              advance_booking_days: 60,
              same_day_booking: true
            }
          })
        )
      );

      logger.info(`Horários padrão criados para empresa ${companyId}`, { 
        daysCreated: created.length 
      });

      // Invalidar cache
      await appointmentCache.delete(appointmentCache.keys.businessHours(companyId));

      // Retornar configuração criada
      return await businessHoursService.getBusinessHours(companyId);

    } catch (error) {
      logger.error('Erro ao criar horários padrão:', error);
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao criar horários de funcionamento padrão',
        500
      );
    }
  },

  // Atualizar horário de um dia específico
  updateBusinessHours: async (companyId: string, dayOfWeek: number, data: BusinessHoursUpdateData): Promise<IWorkDay> => {
    try {
      // Validações
      if (data.start_time && data.end_time) {
        const startMinutes = businessHoursService.timeToMinutes(data.start_time);
        const endMinutes = businessHoursService.timeToMinutes(data.end_time);
        
        if (endMinutes <= startMinutes) {
          throw new AppointmentError(
            ErrorCode.VALIDATION_ERROR,
            'Horário de encerramento deve ser posterior ao horário de abertura',
            400
          );
        }
      }

      if (data.lunch_start && data.lunch_end) {
        const lunchStartMinutes = businessHoursService.timeToMinutes(data.lunch_start);
        const lunchEndMinutes = businessHoursService.timeToMinutes(data.lunch_end);
        
        if (lunchEndMinutes <= lunchStartMinutes) {
          throw new AppointmentError(
            ErrorCode.VALIDATION_ERROR,
            'Horário de término do almoço deve ser posterior ao horário de início',
            400
          );
        }
      }

      const updated = await prisma.business_hours.upsert({
        where: {
          company_id_day_of_week: {
            company_id: companyId,
            day_of_week: dayOfWeek
          }
        },
        update: {
          ...data,
          updated_at: new Date()
        },
        create: {
          company_id: companyId,
          day_of_week: dayOfWeek,
          ...data,
          slot_duration_minutes: data.slot_duration_minutes || 30,
          advance_booking_days: data.advance_booking_days || 60,
          same_day_booking: data.same_day_booking !== undefined ? data.same_day_booking : true
        }
      });

      // Invalidar cache
      await appointmentCache.delete(appointmentCache.keys.businessHours(companyId));

      logger.info(`Horário atualizado para empresa ${companyId}, dia ${dayOfWeek}`, { 
        data 
      });

      return {
        day_of_week: updated.day_of_week,
        day_name: businessHoursService.getDayName(updated.day_of_week),
        is_open: updated.is_open || false,
        start_time: updated.start_time || '09:00',
        end_time: updated.end_time || '18:00',
        lunch_start: updated.lunch_start,
        lunch_end: updated.lunch_end,
        slot_duration_minutes: updated.slot_duration_minutes || 30,
        advance_booking_days: updated.advance_booking_days || 60,
        same_day_booking: updated.same_day_booking || true
      };

    } catch (error) {
      logger.error('Erro ao atualizar horário:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.DATABASE_ERROR,
        'Erro ao atualizar horário de funcionamento',
        500
      );
    }
  },

  // Gerar slots de tempo para um dia específico
  generateTimeSlots: async (companyId: string, date: Date): Promise<string[]> => {
    try {
      const dayOfWeek = date.getDay();
      const workDay = await businessHoursService.getBusinessHoursForDay(companyId, dayOfWeek);
      
      if (!workDay || !workDay.is_open) {
        return [];
      }

      const slots: string[] = [];
      const slotDuration = workDay.slot_duration_minutes;
      
      const startMinutes = businessHoursService.timeToMinutes(workDay.start_time);
      const endMinutes = businessHoursService.timeToMinutes(workDay.end_time);
      
      const lunchStartMinutes = workDay.lunch_start 
        ? businessHoursService.timeToMinutes(workDay.lunch_start) 
        : null;
      const lunchEndMinutes = workDay.lunch_end 
        ? businessHoursService.timeToMinutes(workDay.lunch_end) 
        : null;

      for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
        // Verificar se o slot não está no horário de almoço
        if (lunchStartMinutes && lunchEndMinutes) {
          if (minutes >= lunchStartMinutes && minutes < lunchEndMinutes) {
            continue;
          }
        }

        slots.push(businessHoursService.minutesToTime(minutes));
      }

      return slots;

    } catch (error) {
      logger.error('Erro ao gerar slots de tempo:', error);
      return [];
    }
  },

  // === UTILITY FUNCTIONS ===

  // Converter horário em string para minutos
  timeToMinutes: (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  // Converter minutos para horário em string
  minutesToTime: (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  // Obter nome do dia da semana
  getDayName: (dayOfWeek: number): string => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayOfWeek] || 'Desconhecido';
  },

  // Obter nome abreviado do dia
  getDayShortName: (dayOfWeek: number): string => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[dayOfWeek] || 'Desconhecido';
  },

  // Verificar se data está dentro do limite de agendamento antecipado
  isWithinBookingLimit: async (companyId: string, date: Date): Promise<boolean> => {
    try {
      const businessHours = await businessHoursService.getBusinessHours(companyId);
      const advanceDays = businessHours.days[0]?.advance_booking_days || 60;
      
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + advanceDays);
      
      return date <= maxDate;

    } catch (error) {
      logger.error('Erro ao verificar limite de agendamento:', error);
      return false;
    }
  },

  // Verificar se permite agendamento no mesmo dia
  allowsSameDayBooking: async (companyId: string): Promise<boolean> => {
    try {
      const businessHours = await businessHoursService.getBusinessHours(companyId);
      return businessHours.days[0]?.same_day_booking || true;
    } catch (error) {
      logger.error('Erro ao verificar agendamento mesmo dia:', error);
      return false;
    }
  }
};