/**
 * Service para verificação de disponibilidade
 * Calcula horários livres baseado em agendamentos, bloqueios e horários comerciais
 */

import { 
  IAvailabilityDay, 
  ITimeSlot, 
  ErrorCode,
  AppointmentError
} from '../types';
import { db } from '../utils/database';
import { appointmentCache } from '../utils/redis';
import { logger } from '../utils/logger';
import { integrationService } from './integrationService';
import { businessHoursService } from './businessHoursService';
import { scheduleBlockService } from './scheduleBlockService';
import { 
  format, 
  addDays, 
  addMinutes, 
  parseISO, 
  isWithinInterval,
  startOfDay,
  isSameDay,
  parse
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AvailabilityQuery {
  company_id: string;
  professional_id: string;
  service_id: string;
  start_date: Date;
  days: number;
}

interface SlotCheck {
  company_id: string;
  professional_id: string;
  service_id: string;
  date: Date;
  time: string; // HH:MM
  exclude_appointment_id?: string;
}

export const availabilityService = {

  // Verificar disponibilidade para múltiplos dias
  checkAvailability: async (query: AvailabilityQuery) => {
    try {
      const { company_id, professional_id, service_id, start_date, days } = query;

      // Verificar se profissional e serviço existem
      const [professional, service] = await Promise.all([
        integrationService.getProfessionalById(professional_id, company_id),
        integrationService.getServiceById(service_id, company_id)
      ]);

      if (!professional) {
        throw new AppointmentError(ErrorCode.PROFESSIONAL_NOT_FOUND, 'Profissional não encontrado');
      }
      if (!service) {
        throw new AppointmentError(ErrorCode.SERVICE_NOT_FOUND, 'Serviço não encontrado');
      }

      // Gerar dias para verificar
      const availabilityDays: IAvailabilityDay[] = [];
      const recommendedSlots: Array<{ date: string; time: string; reason: string }> = [];

      for (let i = 0; i < days; i++) {
        const currentDate = addDays(start_date, i);
        const dateString = format(currentDate, 'yyyy-MM-dd');

        // Verificar cache primeiro
        const cached = await appointmentCache.getAvailability(professional_id, dateString);
        if (cached) {
          availabilityDays.push(cached);
          continue;
        }

        const dayAvailability = await availabilityService.checkDayAvailability(
          company_id,
          professional_id,
          service_id,
          currentDate,
          service.duration_minutes
        );

        availabilityDays.push(dayAvailability);

        // Cache por 30 minutos
        await appointmentCache.setAvailability(professional_id, dateString, dayAvailability, 1800);

        // Adicionar slots recomendados
        const availableSlots = dayAvailability.available_slots.filter(slot => slot.available);
        if (availableSlots.length > 0) {
          // Primeiro horário disponível
          recommendedSlots.push({
            date: dateString,
            time: availableSlots[0].start_time,
            reason: 'Primeiro horário disponível'
          });

          // Horário popular (meio da manhã se disponível)
          const morningSlot = availableSlots.find(slot => 
            slot.start_time >= '09:00' && slot.start_time <= '11:00'
          );
          if (morningSlot && recommendedSlots.length < 5) {
            recommendedSlots.push({
              date: dateString,
              time: morningSlot.start_time,
              reason: 'Horário popular da manhã'
            });
          }
        }
      }

      return {
        days: availabilityDays,
        recommendedSlots: recommendedSlots.slice(0, 5) // Máximo 5 recomendações
      };

    } catch (error) {
      logger.error('Erro ao verificar disponibilidade:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao verificar disponibilidade',
        500,
        error
      );
    }
  },

  // Verificar disponibilidade de um dia específico
  checkDayAvailability: async (
    company_id: string,
    professional_id: string,
    service_id: string,
    date: Date,
    serviceDurationMinutes: number
  ): Promise<IAvailabilityDay> => {
    try {
      const dayOfWeek = date.getDay();
      const dateString = format(date, 'yyyy-MM-dd');
      const dayName = format(date, 'EEEE', { locale: ptBR });

      // Buscar horário comercial para este dia usando businessHoursService
      const workDay = await businessHoursService.getBusinessHoursForDay(company_id, dayOfWeek);

      if (!workDay || !workDay.is_open) {
        return {
          date: dateString,
          day_name: dayName,
          is_business_day: false,
          available_slots: [],
          total_slots: 0,
          available_count: 0
        };
      }

      // Gerar slots baseado no horário comercial
      const slots = availabilityService.generateDaySlots(
        workDay.start_time,
        workDay.end_time,
        workDay.lunch_start,
        workDay.lunch_end,
        workDay.slot_duration_minutes,
        serviceDurationMinutes
      );

      // Buscar agendamentos existentes
      const existingAppointments = await db.appointment.findMany({
        where: {
          company_id,
          professional_id,
          appointment_date: date,
          status: {
            not: 'cancelled'
          }
        }
      });

      // Buscar bloqueios de horário
      const scheduleBlocks = await db.scheduleBlock.findMany({
        where: {
          company_id,
          active: true,
          OR: [
            { professional_id }, // Específico do profissional
            { professional_id: null } // Geral
          ],
          start_date: { lte: date },
          end_date: { gte: date }
        }
      });

      // Marcar slots ocupados
      const availableSlots = slots.map(slot => {
        const slotStart = parse(slot.start_time, 'HH:mm', date);
        const slotEnd = parse(slot.end_time, 'HH:mm', date);

        // Verificar conflito com agendamentos
        const hasAppointmentConflict = existingAppointments.some(appointment => {
          const appointmentStart = parse(
            appointment.appointment_time.toTimeString().substring(0, 5),
            'HH:mm',
            date
          );
          const appointmentEnd = parse(
            appointment.appointment_end_time.toTimeString().substring(0, 5),
            'HH:mm',
            date
          );

          return (
            (slotStart >= appointmentStart && slotStart < appointmentEnd) ||
            (slotEnd > appointmentStart && slotEnd <= appointmentEnd) ||
            (slotStart <= appointmentStart && slotEnd >= appointmentEnd)
          );
        });

        // Verificar conflito com bloqueios
        const hasBlockConflict = scheduleBlocks.some(block => {
          // Se é bloqueio do dia todo
          if (!block.start_time || !block.end_time) {
            return true;
          }

          const blockStart = parse(
            block.start_time.toTimeString().substring(0, 5),
            'HH:mm',
            date
          );
          const blockEnd = parse(
            block.end_time.toTimeString().substring(0, 5),
            'HH:mm',
            date
          );

          return (
            (slotStart >= blockStart && slotStart < blockEnd) ||
            (slotEnd > blockStart && slotEnd <= blockEnd) ||
            (slotStart <= blockStart && slotEnd >= blockEnd)
          );
        });

        let available = !hasAppointmentConflict && !hasBlockConflict;
        let reason: string | undefined;

        if (hasAppointmentConflict) {
          reason = 'Já agendado';
        } else if (hasBlockConflict) {
          const block = scheduleBlocks.find(b => {
            if (!b.start_time || !b.end_time) return true;
            
            const blockStart = parse(b.start_time.toTimeString().substring(0, 5), 'HH:mm', date);
            const blockEnd = parse(b.end_time.toTimeString().substring(0, 5), 'HH:mm', date);
            
            return (slotStart >= blockStart && slotStart < blockEnd);
          });
          
          reason = block ? availabilityService.getBlockReason(block.block_type) : 'Bloqueado';
        }

        return {
          start_time: slot.start_time,
          end_time: slot.end_time,
          available,
          reason,
          appointment_id: hasAppointmentConflict 
            ? existingAppointments.find(apt => {
                const aptStart = parse(apt.appointment_time.toTimeString().substring(0, 5), 'HH:mm', date);
                const aptEnd = parse(apt.appointment_end_time.toTimeString().substring(0, 5), 'HH:mm', date);
                return slotStart >= aptStart && slotStart < aptEnd;
              })?.id
            : undefined
        };
      });

      const availableCount = availableSlots.filter(slot => slot.available).length;

      return {
        date: dateString,
        day_name: dayName,
        is_business_day: true,
        business_hours: {
          start: workDay.start_time,
          end: workDay.end_time,
          lunch_break: workDay.lunch_start && workDay.lunch_end
            ? `${workDay.lunch_start}-${workDay.lunch_end}`
            : undefined
        },
        available_slots: availableSlots,
        total_slots: slots.length,
        available_count: availableCount
      };

    } catch (error) {
      logger.error(`Erro ao verificar disponibilidade do dia ${format(date, 'yyyy-MM-dd')}:`, error);
      
      const dateString = format(date, 'yyyy-MM-dd');
      const dayName = format(date, 'EEEE', { locale: ptBR });
      
      return {
        date: dateString,
        day_name: dayName,
        is_business_day: false,
        available_slots: [],
        total_slots: 0,
        available_count: 0
      };
    }
  },

  // Gerar slots de tempo para um dia
  generateDaySlots: (
    startTime: string,
    endTime: string,
    lunchStart?: string | null,
    lunchEnd?: string | null,
    slotDurationMinutes = 30,
    serviceDurationMinutes = 30
  ): Array<{ start_time: string; end_time: string }> => {
    const slots: Array<{ start_time: string; end_time: string }> = [];
    
    const start = startTime;
    const end = endTime;
    const lunchStartStr = lunchStart;
    const lunchEndStr = lunchEnd;

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const [lunchStartHour, lunchStartMinute] = lunchStartStr ? lunchStartStr.split(':').map(Number) : [0, 0];
    const [lunchEndHour, lunchEndMinute] = lunchEndStr ? lunchEndStr.split(':').map(Number) : [0, 0];

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    const lunchStartTotalMinutes = lunchStartStr ? lunchStartHour * 60 + lunchStartMinute : 0;
    const lunchEndTotalMinutes = lunchEndStr ? lunchEndHour * 60 + lunchEndMinute : 0;

    for (let minutes = startTotalMinutes; minutes < endTotalMinutes; minutes += slotDurationMinutes) {
      const slotEndMinutes = minutes + serviceDurationMinutes;
      
      // Não criar slot se não caber o serviço completo
      if (slotEndMinutes > endTotalMinutes) {
        break;
      }

      // Pular intervalo de almoço
      if (lunchStartStr && lunchEndStr) {
        if (
          (minutes >= lunchStartTotalMinutes && minutes < lunchEndTotalMinutes) ||
          (slotEndMinutes > lunchStartTotalMinutes && slotEndMinutes <= lunchEndTotalMinutes) ||
          (minutes <= lunchStartTotalMinutes && slotEndMinutes >= lunchEndTotalMinutes)
        ) {
          continue;
        }
      }

      const slotStartHour = Math.floor(minutes / 60);
      const slotStartMinute = minutes % 60;
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      const slotEndMinuteRemainder = slotEndMinutes % 60;

      const slotStartTime = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMinute.toString().padStart(2, '0')}`;
      const slotEndTime = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinuteRemainder.toString().padStart(2, '0')}`;

      slots.push({
        start_time: slotStartTime,
        end_time: slotEndTime
      });
    }

    return slots;
  },

  // Verificar disponibilidade de um slot específico
  checkSlotAvailability: async (params: SlotCheck): Promise<boolean> => {
    try {
      const { company_id, professional_id, service_id, date, time, exclude_appointment_id } = params;

      // Buscar serviço para saber a duração
      const service = await integrationService.getServiceById(service_id, company_id);
      if (!service) {
        throw new AppointmentError(ErrorCode.SERVICE_NOT_FOUND, 'Serviço não encontrado');
      }

      const slotStart = parse(time, 'HH:mm', date);
      const slotEnd = addMinutes(slotStart, service.duration_minutes);
      const slotEndTime = format(slotEnd, 'HH:mm');

      // Verificar horário comercial
      const dayOfWeek = date.getDay();
      const businessHour = await db.businessHour.findFirst({
        where: {
          company_id,
          day_of_week: dayOfWeek,
          is_open: true
        }
      });

      if (!businessHour || !businessHour.start_time || !businessHour.end_time) {
        return false; // Não é dia de funcionamento
      }

      const businessStart = businessHour.start_time.toTimeString().substring(0, 5);
      const businessEnd = businessHour.end_time.toTimeString().substring(0, 5);

      // Verificar se está dentro do horário comercial
      if (time < businessStart || slotEndTime > businessEnd) {
        return false;
      }

      // Verificar intervalo de almoço
      if (businessHour.lunch_start && businessHour.lunch_end) {
        const lunchStart = businessHour.lunch_start.toTimeString().substring(0, 5);
        const lunchEnd = businessHour.lunch_end.toTimeString().substring(0, 5);

        if (
          (time >= lunchStart && time < lunchEnd) ||
          (slotEndTime > lunchStart && slotEndTime <= lunchEnd) ||
          (time <= lunchStart && slotEndTime >= lunchEnd)
        ) {
          return false; // Conflita com almoço
        }
      }

      // Verificar agendamentos existentes
      const existingAppointments = await db.appointment.findMany({
        where: {
          company_id,
          professional_id,
          appointment_date: date,
          status: { not: 'cancelled' },
          ...(exclude_appointment_id && { id: { not: exclude_appointment_id } })
        }
      });

      const hasAppointmentConflict = existingAppointments.some(appointment => {
        const appointmentStart = appointment.appointment_time.toTimeString().substring(0, 5);
        const appointmentEnd = appointment.appointment_end_time.toTimeString().substring(0, 5);

        return (
          (time >= appointmentStart && time < appointmentEnd) ||
          (slotEndTime > appointmentStart && slotEndTime <= appointmentEnd) ||
          (time <= appointmentStart && slotEndTime >= appointmentEnd)
        );
      });

      if (hasAppointmentConflict) {
        return false;
      }

      // Verificar bloqueios
      const scheduleBlocks = await db.scheduleBlock.findMany({
        where: {
          company_id,
          active: true,
          OR: [
            { professional_id },
            { professional_id: null }
          ],
          start_date: { lte: date },
          end_date: { gte: date }
        }
      });

      const hasBlockConflict = scheduleBlocks.some(block => {
        if (!block.start_time || !block.end_time) {
          return true; // Bloqueio do dia todo
        }

        const blockStart = block.start_time.toTimeString().substring(0, 5);
        const blockEnd = block.end_time.toTimeString().substring(0, 5);

        return (
          (time >= blockStart && time < blockEnd) ||
          (slotEndTime > blockStart && slotEndTime <= blockEnd) ||
          (time <= blockStart && slotEndTime >= blockEnd)
        );
      });

      return !hasBlockConflict;

    } catch (error) {
      logger.error('Erro ao verificar disponibilidade do slot:', error);
      return false;
    }
  },

  // Obter próximos slots disponíveis
  getNextAvailableSlots: async (
    company_id: string,
    professional_id: string,
    service_id: string,
    afterDate: Date,
    limit = 10
  ) => {
    try {
      const availableSlots: Array<{ date: string; time: string; datetime: Date }> = [];
      let currentDate = afterDate;
      let daysChecked = 0;
      const maxDays = 30; // Não verificar mais que 30 dias

      while (availableSlots.length < limit && daysChecked < maxDays) {
        const dayAvailability = await availabilityService.checkDayAvailability(
          company_id,
          professional_id,
          service_id,
          currentDate,
          60 // Assumir 60 min se não conseguir buscar o serviço
        );

        const daySlots = dayAvailability.available_slots
          .filter(slot => slot.available)
          .map(slot => ({
            date: format(currentDate, 'yyyy-MM-dd'),
            time: slot.start_time,
            datetime: parse(slot.start_time, 'HH:mm', currentDate)
          }));

        availableSlots.push(...daySlots);
        currentDate = addDays(currentDate, 1);
        daysChecked++;
      }

      return availableSlots.slice(0, limit);

    } catch (error) {
      logger.error('Erro ao buscar próximos slots disponíveis:', error);
      return [];
    }
  },

  // Helper para obter descrição do tipo de bloqueio
  getBlockReason: (blockType: string): string => {
    const reasons = {
      holiday: 'Feriado',
      vacation: 'Férias',
      maintenance: 'Manutenção',
      personal: 'Indisponível',
      break: 'Intervalo',
      lunch: 'Almoço'
    };

    return reasons[blockType as keyof typeof reasons] || 'Bloqueado';
  }
};