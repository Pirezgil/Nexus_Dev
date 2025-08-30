/**
 * AppointmentValidator - Validador de Conflitos e Regras de Agendamento
 * 
 * Implementa todas as validações necessárias para agendamentos:
 * - Conflitos de horário
 * - Horários de funcionamento
 * - Disponibilidade de profissionais
 * - Regras de antecedência
 */

import { prisma } from '../utils/database';
import { addMinutes, isWithinInterval, parseISO, format } from 'date-fns';
import { logger } from '../utils/logger';

export interface AppointmentData {
  professional_id: string;
  service_id: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM
  company_id: string;
  estimated_duration?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  conflictingAppointments?: any[];
  details?: any;
}

export class AppointmentValidator {
  
  /**
   * Valida se não há conflitos de horário para um agendamento
   * @param data - Dados do agendamento
   * @param excludeId - ID do agendamento a excluir (para edição)
   * @returns ValidationResult
   */
  static async validateNoConflicts(data: AppointmentData, excludeId?: string): Promise<ValidationResult> {
    try {
      logger.info('Validando conflitos de agendamento', { 
        professional_id: data.professional_id, 
        date: data.appointment_date, 
        time: data.appointment_time 
      });

      const appointmentStart = parseISO(`${data.appointment_date}T${data.appointment_time}`);
      
      // Buscar serviço para obter duração
      const service = await prisma.service.findUnique({
        where: { id: data.service_id },
        select: { duration: true, name: true }
      });
      
      if (!service) {
        return {
          valid: false,
          error: 'Serviço não encontrado'
        };
      }
      
      const duration = service.duration || data.estimated_duration || 60; // Default 60 minutos
      const appointmentEnd = addMinutes(appointmentStart, duration);
      
      // Buscar agendamentos conflitantes para o mesmo profissional
      const conflictingAppointments = await prisma.appointment.findMany({
        where: {
          professional_id: data.professional_id,
          appointment_date: new Date(data.appointment_date),
          status: {
            in: ['scheduled', 'confirmed', 'in_progress']
          },
          ...(excludeId && { id: { not: excludeId } })
        },
        include: {
          service: {
            select: { name: true, duration: true }
          }
        }
      });
      
      // Verificar sobreposição de horários
      const conflicts = [];
      
      for (const existing of conflictingAppointments) {
        const existingStart = parseISO(`${format(existing.appointment_date, 'yyyy-MM-dd')}T${existing.appointment_time}`);
        const existingDuration = existing.service?.duration || 60;
        const existingEnd = addMinutes(existingStart, existingDuration);
        
        // Verificar se há sobreposição
        const hasOverlap = 
          isWithinInterval(appointmentStart, { start: existingStart, end: existingEnd }) ||
          isWithinInterval(appointmentEnd, { start: existingStart, end: existingEnd }) ||
          isWithinInterval(existingStart, { start: appointmentStart, end: appointmentEnd }) ||
          appointmentStart.getTime() === existingStart.getTime();
        
        if (hasOverlap) {
          conflicts.push({
            id: existing.id,
            time: format(existingStart, 'HH:mm'),
            duration: existingDuration,
            service: existing.service?.name || 'Serviço não especificado',
            status: existing.status
          });
        }
      }
      
      if (conflicts.length > 0) {
        logger.warn('Conflitos de agendamento detectados', { 
          professional_id: data.professional_id, 
          conflicts: conflicts.length 
        });

        return {
          valid: false,
          error: `Conflito de horário detectado. O profissional já possui ${conflicts.length} agendamento(s) no mesmo período.`,
          conflictingAppointments: conflicts
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro ao validar conflitos de agendamento', { error });
      return {
        valid: false,
        error: 'Erro interno ao validar conflitos de agendamento'
      };
    }
  }
  
  /**
   * Valida se o agendamento está dentro do horário de funcionamento
   * @param data - Dados do agendamento
   * @returns ValidationResult
   */
  static async validateBusinessHours(data: AppointmentData): Promise<ValidationResult> {
    try {
      logger.info('Validando horário de funcionamento', { 
        company_id: data.company_id, 
        date: data.appointment_date, 
        time: data.appointment_time 
      });

      const appointmentDate = parseISO(data.appointment_date);
      const dayOfWeek = appointmentDate.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      
      // Buscar horário de funcionamento para este dia
      const businessHours = await prisma.businessHour.findFirst({
        where: {
          company_id: data.company_id,
          day_of_week: dayOfWeek
        }
      });
      
      if (!businessHours) {
        return {
          valid: false,
          error: 'Horário de funcionamento não configurado para este dia da semana'
        };
      }
      
      if (!businessHours.is_open) {
        return {
          valid: false,
          error: 'A empresa não funciona neste dia da semana'
        };
      }
      
      const appointmentTime = data.appointment_time;
      const startTime = businessHours.start_time ? format(businessHours.start_time, 'HH:mm') : '08:00';
      const endTime = businessHours.end_time ? format(businessHours.end_time, 'HH:mm') : '18:00';
      
      // Verificar se está dentro do horário de funcionamento
      if (appointmentTime < startTime || appointmentTime > endTime) {
        return {
          valid: false,
          error: `Horário fora do funcionamento. Funcionamos das ${startTime} às ${endTime}.`
        };
      }
      
      // Verificar intervalo de almoço se configurado
      if (businessHours.lunch_start && businessHours.lunch_end) {
        const lunchStart = format(businessHours.lunch_start, 'HH:mm');
        const lunchEnd = format(businessHours.lunch_end, 'HH:mm');
        
        if (appointmentTime >= lunchStart && appointmentTime <= lunchEnd) {
          return {
            valid: false,
            error: `Horário no intervalo de almoço (${lunchStart} às ${lunchEnd})`
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro ao validar horário de funcionamento', { error });
      return {
        valid: false,
        error: 'Erro interno ao validar horário de funcionamento'
      };
    }
  }
  
  /**
   * Valida regras de antecedência para agendamento
   * @param data - Dados do agendamento
   * @returns ValidationResult
   */
  static async validateAdvanceBooking(data: AppointmentData): Promise<ValidationResult> {
    try {
      logger.info('Validando regras de antecedência', { 
        company_id: data.company_id, 
        date: data.appointment_date 
      });

      const config = await prisma.agendamentoConfig.findFirst({
        where: { company_id: data.company_id }
      });
      
      const appointmentDateTime = parseISO(`${data.appointment_date}T${data.appointment_time}`);
      const now = new Date();
      
      // Verificar antecedência mínima
      const minAdvanceHours = config?.min_advance_booking_hours || 2;
      const minAdvanceMs = minAdvanceHours * 60 * 60 * 1000;
      
      if (appointmentDateTime.getTime() - now.getTime() < minAdvanceMs) {
        return {
          valid: false,
          error: `Agendamentos devem ser feitos com pelo menos ${minAdvanceHours} horas de antecedência`
        };
      }
      
      // Verificar antecedência máxima
      const maxAdvanceDays = config?.max_advance_booking_days || 60;
      const maxAdvanceMs = maxAdvanceDays * 24 * 60 * 60 * 1000;
      
      if (appointmentDateTime.getTime() - now.getTime() > maxAdvanceMs) {
        return {
          valid: false,
          error: `Agendamentos podem ser feitos com no máximo ${maxAdvanceDays} dias de antecedência`
        };
      }
      
      // Verificar se permite agendamento no mesmo dia
      const isToday = format(appointmentDateTime, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      if (isToday && !config?.allow_same_day_booking) {
        return {
          valid: false,
          error: 'Agendamentos no mesmo dia não são permitidos'
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro ao validar regras de antecedência', { error });
      return {
        valid: false,
        error: 'Erro interno ao validar regras de antecedência'
      };
    }
  }
  
  /**
   * Valida disponibilidade do profissional
   * @param professionalId - ID do profissional
   * @param date - Data do agendamento
   * @param time - Horário do agendamento
   * @returns ValidationResult
   */
  static async validateProfessionalAvailability(professionalId: string, date: string, time: string): Promise<ValidationResult> {
    try {
      logger.info('Validando disponibilidade do profissional', { 
        professional_id: professionalId, 
        date, 
        time 
      });

      const appointmentDate = parseISO(date);
      
      // Verificar bloqueios de horário (férias, folgas, etc.)
      const blocks = await prisma.scheduleBlock.findMany({
        where: {
          OR: [
            { professional_id: professionalId },
            { professional_id: null } // Bloqueios gerais da empresa
          ],
          active: true,
          start_date: { lte: appointmentDate },
          end_date: { gte: appointmentDate }
        }
      });
      
      // Verificar se algum bloqueio afeta este horário
      const timeBlocks = blocks.filter(block => {
        // Se não tem horário específico, é bloqueio de dia todo
        if (!block.start_time || !block.end_time) return true;
        
        const startTime = format(block.start_time, 'HH:mm');
        const endTime = format(block.end_time, 'HH:mm');
        
        return time >= startTime && time <= endTime;
      });
      
      if (timeBlocks.length > 0) {
        const block = timeBlocks[0];
        return {
          valid: false,
          error: `Profissional não disponível: ${block.title}`,
          details: {
            blockType: block.block_type,
            description: block.description
          }
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro ao validar disponibilidade do profissional', { error });
      return {
        valid: false,
        error: 'Erro interno ao validar disponibilidade do profissional'
      };
    }
  }
  
  /**
   * Valida se o serviço existe e está ativo
   * @param serviceId - ID do serviço
   * @param companyId - ID da empresa
   * @returns ValidationResult
   */
  static async validateService(serviceId: string, companyId: string): Promise<ValidationResult> {
    try {
      const service = await prisma.service.findFirst({
        where: {
          id: serviceId,
          company_id: companyId,
          active: true
        }
      });
      
      if (!service) {
        return {
          valid: false,
          error: 'Serviço não encontrado ou inativo'
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro ao validar serviço', { error });
      return {
        valid: false,
        error: 'Erro interno ao validar serviço'
      };
    }
  }
  
  /**
   * Executa todas as validações de agendamento
   * @param data - Dados do agendamento
   * @param excludeId - ID para excluir da validação (edição)
   * @returns ValidationResult com todas as validações
   */
  static async validateAll(data: AppointmentData, excludeId?: string): Promise<ValidationResult> {
    try {
      // 1. Validar serviço
      const serviceValidation = await this.validateService(data.service_id, data.company_id);
      if (!serviceValidation.valid) return serviceValidation;
      
      // 2. Validar horário de funcionamento
      const businessHoursValidation = await this.validateBusinessHours(data);
      if (!businessHoursValidation.valid) return businessHoursValidation;
      
      // 3. Validar regras de antecedência
      const advanceValidation = await this.validateAdvanceBooking(data);
      if (!advanceValidation.valid) return advanceValidation;
      
      // 4. Validar disponibilidade do profissional
      const availabilityValidation = await this.validateProfessionalAvailability(
        data.professional_id,
        data.appointment_date,
        data.appointment_time
      );
      if (!availabilityValidation.valid) return availabilityValidation;
      
      // 5. Validar conflitos de horário
      const conflictValidation = await this.validateNoConflicts(data, excludeId);
      if (!conflictValidation.valid) return conflictValidation;
      
      logger.info('Todas as validações de agendamento passaram', { 
        professional_id: data.professional_id,
        date: data.appointment_date,
        time: data.appointment_time
      });
      
      return { valid: true };
      
    } catch (error) {
      logger.error('Erro na validação completa de agendamento', { error });
      return {
        valid: false,
        error: 'Erro interno na validação de agendamento'
      };
    }
  }
  
  /**
   * Sugere horários alternativos caso o horário solicitado não esteja disponível
   * @param data - Dados do agendamento original
   * @param suggestionsCount - Número de sugestões (default: 3)
   * @returns Array de horários alternativos
   */
  static async suggestAlternativeTimes(data: AppointmentData, suggestionsCount: number = 3): Promise<string[]> {
    try {
      const suggestions: string[] = [];
      const appointmentDate = parseISO(data.appointment_date);
      const originalTime = parseISO(`${data.appointment_date}T${data.appointment_time}`);
      
      // Buscar horário de funcionamento
      const businessHours = await prisma.businessHour.findFirst({
        where: {
          company_id: data.company_id,
          day_of_week: appointmentDate.getDay()
        }
      });
      
      if (!businessHours || !businessHours.is_open) {
        return suggestions;
      }
      
      const slotDuration = businessHours.slot_duration_minutes || 30;
      const startTime = businessHours.start_time ? 
        parseISO(`${data.appointment_date}T${format(businessHours.start_time, 'HH:mm')}`) :
        parseISO(`${data.appointment_date}T08:00`);
      const endTime = businessHours.end_time ? 
        parseISO(`${data.appointment_date}T${format(businessHours.end_time, 'HH:mm')}`) :
        parseISO(`${data.appointment_date}T18:00`);
      
      // Gerar slots disponíveis
      const timeSlots = [];
      let currentTime = new Date(startTime);
      
      while (currentTime < endTime) {
        timeSlots.push(new Date(currentTime));
        currentTime = addMinutes(currentTime, slotDuration);
      }
      
      // Testar cada slot para disponibilidade
      for (const slot of timeSlots) {
        if (suggestions.length >= suggestionsCount) break;
        
        const testData = {
          ...data,
          appointment_time: format(slot, 'HH:mm')
        };
        
        const validation = await this.validateAll(testData);
        if (validation.valid) {
          suggestions.push(format(slot, 'HH:mm'));
        }
      }
      
      return suggestions;
      
    } catch (error) {
      logger.error('Erro ao sugerir horários alternativos', { error });
      return [];
    }
  }
}