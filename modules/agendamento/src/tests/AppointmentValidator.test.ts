/**
 * Testes unitários para AppointmentValidator
 * Valida conflitos de agendamento e regras de negócio
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AppointmentValidator } from '../services/AppointmentValidator';

// Mock do Prisma
const mockPrisma = {
  service: {
    findUnique: jest.fn(),
    findFirst: jest.fn()
  },
  appointment: {
    findMany: jest.fn(),
    findFirst: jest.fn()
  },
  businessHour: {
    findFirst: jest.fn()
  },
  agendamentoConfig: {
    findFirst: jest.fn()
  },
  scheduleBlock: {
    findMany: jest.fn()
  }
};

// Mock do módulo database
jest.mock('../utils/database', () => ({
  prisma: mockPrisma
}));

describe('AppointmentValidator', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(mockPrisma).forEach(model => {
      Object.values(model).forEach(method => {
        (method as jest.Mock).mockReset();
      });
    });
  });

  describe('validateNoConflicts', () => {
    const appointmentData = {
      professional_id: 'prof-123',
      service_id: 'service-123',
      appointment_date: '2024-12-01',
      appointment_time: '14:00',
      company_id: 'company-123'
    };

    it('deve validar agendamento sem conflitos', async () => {
      // Mock service lookup
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-123',
        name: 'Corte de Cabelo',
        duration: 60
      });

      // Mock no conflicting appointments
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await AppointmentValidator.validateNoConflicts(appointmentData);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve detectar conflito de horário', async () => {
      // Mock service lookup
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-123',
        name: 'Corte de Cabelo',
        duration: 60
      });

      // Mock conflicting appointment
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          id: 'existing-appointment',
          appointment_date: new Date('2024-12-01'),
          appointment_time: '14:30', // Overlapping time
          status: 'scheduled',
          service: {
            name: 'Manicure',
            duration: 45
          }
        }
      ]);

      const result = await AppointmentValidator.validateNoConflicts(appointmentData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Conflito de horário detectado');
      expect(result.conflictingAppointments).toHaveLength(1);
    });

    it('deve ignorar agendamentos cancelados/concluídos', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-123',
        name: 'Corte de Cabelo',
        duration: 60
      });

      // Mock appointments with different statuses
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await AppointmentValidator.validateNoConflicts(appointmentData);

      expect(result.valid).toBe(true);
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: ['scheduled', 'confirmed', 'in_progress']
            }
          })
        })
      );
    });

    it('deve excluir agendamento atual durante edição', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-123',
        name: 'Corte de Cabelo',
        duration: 60
      });

      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const excludeId = 'appointment-to-exclude';
      await AppointmentValidator.validateNoConflicts(appointmentData, excludeId);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: excludeId }
          })
        })
      );
    });

    it('deve retornar erro se serviço não encontrado', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const result = await AppointmentValidator.validateNoConflicts(appointmentData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Serviço não encontrado');
    });
  });

  describe('validateBusinessHours', () => {
    const appointmentData = {
      professional_id: 'prof-123',
      service_id: 'service-123',
      appointment_date: '2024-12-02', // Monday
      appointment_time: '14:00',
      company_id: 'company-123'
    };

    it('deve validar horário dentro do funcionamento', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 1, // Monday
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z'),
        lunch_start: null,
        lunch_end: null
      });

      const result = await AppointmentValidator.validateBusinessHours(appointmentData);

      expect(result.valid).toBe(true);
    });

    it('deve rejeitar horário fora do funcionamento', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 1,
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z')
      });

      const lateAppointment = { ...appointmentData, appointment_time: '19:00' };
      const result = await AppointmentValidator.validateBusinessHours(lateAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Horário fora do funcionamento');
    });

    it('deve rejeitar agendamento em dia fechado', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 0, // Sunday
        is_open: false
      });

      const sundayAppointment = { ...appointmentData, appointment_date: '2024-12-01' }; // Sunday
      const result = await AppointmentValidator.validateBusinessHours(sundayAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('A empresa não funciona neste dia da semana');
    });

    it('deve rejeitar horário no intervalo de almoço', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 1,
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z'),
        lunch_start: new Date('1970-01-01T12:00:00Z'),
        lunch_end: new Date('1970-01-01T13:00:00Z')
      });

      const lunchAppointment = { ...appointmentData, appointment_time: '12:30' };
      const result = await AppointmentValidator.validateBusinessHours(lunchAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Horário no intervalo de almoço');
    });

    it('deve retornar erro se horário não configurado', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue(null);

      const result = await AppointmentValidator.validateBusinessHours(appointmentData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Horário de funcionamento não configurado para este dia da semana');
    });
  });

  describe('validateAdvanceBooking', () => {
    const appointmentData = {
      professional_id: 'prof-123',
      service_id: 'service-123',
      appointment_date: '2024-12-31', // Future date
      appointment_time: '14:00',
      company_id: 'company-123'
    };

    beforeEach(() => {
      // Mock current date to a fixed point
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-12-01T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve validar agendamento com antecedência adequada', async () => {
      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue({
        company_id: 'company-123',
        min_advance_booking_hours: 2,
        max_advance_booking_days: 60,
        allow_same_day_booking: true
      });

      const result = await AppointmentValidator.validateAdvanceBooking(appointmentData);

      expect(result.valid).toBe(true);
    });

    it('deve rejeitar agendamento com pouca antecedência', async () => {
      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue({
        min_advance_booking_hours: 24,
        max_advance_booking_days: 60,
        allow_same_day_booking: false
      });

      const nearAppointment = { 
        ...appointmentData, 
        appointment_date: '2024-12-01', 
        appointment_time: '12:00' 
      };
      const result = await AppointmentValidator.validateAdvanceBooking(nearAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('pelo menos 24 horas de antecedência');
    });

    it('deve rejeitar agendamento muito distante', async () => {
      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue({
        min_advance_booking_hours: 2,
        max_advance_booking_days: 30,
        allow_same_day_booking: true
      });

      const distantAppointment = { 
        ...appointmentData, 
        appointment_date: '2025-06-01' 
      };
      const result = await AppointmentValidator.validateAdvanceBooking(distantAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no máximo 30 dias de antecedência');
    });

    it('deve rejeitar agendamento no mesmo dia se não permitido', async () => {
      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue({
        min_advance_booking_hours: 2,
        max_advance_booking_days: 60,
        allow_same_day_booking: false
      });

      const sameDayAppointment = { 
        ...appointmentData, 
        appointment_date: '2024-12-01', 
        appointment_time: '15:00' 
      };
      const result = await AppointmentValidator.validateAdvanceBooking(sameDayAppointment);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Agendamentos no mesmo dia não são permitidos');
    });

    it('deve usar configurações padrão se não encontradas', async () => {
      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue(null);

      const result = await AppointmentValidator.validateAdvanceBooking(appointmentData);

      expect(result.valid).toBe(true); // Should use default values
    });
  });

  describe('validateProfessionalAvailability', () => {
    it('deve validar profissional disponível', async () => {
      mockPrisma.scheduleBlock.findMany.mockResolvedValue([]);

      const result = await AppointmentValidator.validateProfessionalAvailability(
        'prof-123', 
        '2024-12-01', 
        '14:00'
      );

      expect(result.valid).toBe(true);
    });

    it('deve detectar bloqueio de profissional específico', async () => {
      mockPrisma.scheduleBlock.findMany.mockResolvedValue([
        {
          professional_id: 'prof-123',
          active: true,
          start_date: new Date('2024-12-01'),
          end_date: new Date('2024-12-01'),
          start_time: new Date('1970-01-01T13:00:00Z'),
          end_time: new Date('1970-01-01T15:00:00Z'),
          title: 'Consulta médica',
          block_type: 'personal'
        }
      ]);

      const result = await AppointmentValidator.validateProfessionalAvailability(
        'prof-123', 
        '2024-12-01', 
        '14:00'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Profissional não disponível: Consulta médica');
    });

    it('deve detectar bloqueio geral da empresa', async () => {
      mockPrisma.scheduleBlock.findMany.mockResolvedValue([
        {
          professional_id: null, // Company-wide block
          active: true,
          start_date: new Date('2024-12-01'),
          end_date: new Date('2024-12-01'),
          start_time: null, // All day block
          end_time: null,
          title: 'Feriado Nacional',
          block_type: 'holiday'
        }
      ]);

      const result = await AppointmentValidator.validateProfessionalAvailability(
        'prof-123', 
        '2024-12-01', 
        '14:00'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Profissional não disponível: Feriado Nacional');
    });

    it('deve ignorar bloqueios inativos', async () => {
      mockPrisma.scheduleBlock.findMany.mockResolvedValue([]);

      // Mock should filter by active: true
      const result = await AppointmentValidator.validateProfessionalAvailability(
        'prof-123', 
        '2024-12-01', 
        '14:00'
      );

      expect(result.valid).toBe(true);
      expect(mockPrisma.scheduleBlock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true
          })
        })
      );
    });
  });

  describe('validateAll', () => {
    const appointmentData = {
      professional_id: 'prof-123',
      service_id: 'service-123',
      appointment_date: '2024-12-01',
      appointment_time: '14:00',
      company_id: 'company-123'
    };

    it('deve executar todas as validações com sucesso', async () => {
      // Mock all validations to pass
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'service-123',
        company_id: 'company-123',
        active: true
      });

      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 6, // Saturday
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z')
      });

      mockPrisma.agendamentoConfig.findFirst.mockResolvedValue({
        min_advance_booking_hours: 2,
        max_advance_booking_days: 60,
        allow_same_day_booking: true
      });

      mockPrisma.scheduleBlock.findMany.mockResolvedValue([]);

      mockPrisma.service.findUnique.mockResolvedValue({
        duration: 60
      });

      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await AppointmentValidator.validateAll(appointmentData);

      expect(result.valid).toBe(true);
    });

    it('deve falhar na primeira validação que não passar', async () => {
      // Mock service not found
      mockPrisma.service.findFirst.mockResolvedValue(null);

      const result = await AppointmentValidator.validateAll(appointmentData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Serviço não encontrado ou inativo');
    });
  });

  describe('suggestAlternativeTimes', () => {
    it('deve sugerir horários alternativos disponíveis', async () => {
      const appointmentData = {
        professional_id: 'prof-123',
        service_id: 'service-123',
        appointment_date: '2024-12-02', // Monday
        appointment_time: '14:00',
        company_id: 'company-123'
      };

      mockPrisma.businessHour.findFirst.mockResolvedValue({
        company_id: 'company-123',
        day_of_week: 1,
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z'),
        slot_duration_minutes: 30
      });

      // Mock validateAll to pass for certain times
      const mockValidateAll = jest.spyOn(AppointmentValidator, 'validateAll');
      mockValidateAll
        .mockResolvedValueOnce({ valid: false }) // 08:00 - busy
        .mockResolvedValueOnce({ valid: true })  // 08:30 - available
        .mockResolvedValueOnce({ valid: true })  // 09:00 - available
        .mockResolvedValueOnce({ valid: true }); // 09:30 - available

      const suggestions = await AppointmentValidator.suggestAlternativeTimes(appointmentData, 3);

      expect(suggestions).toHaveLength(3);
      expect(suggestions).toEqual(['08:30', '09:00', '09:30']);

      mockValidateAll.mockRestore();
    });

    it('deve retornar array vazio se nenhum horário disponível', async () => {
      mockPrisma.businessHour.findFirst.mockResolvedValue(null);

      const suggestions = await AppointmentValidator.suggestAlternativeTimes({
        professional_id: 'prof-123',
        service_id: 'service-123',
        appointment_date: '2024-12-01',
        appointment_time: '14:00',
        company_id: 'company-123'
      });

      expect(suggestions).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('deve lidar com erro de banco de dados', async () => {
      mockPrisma.service.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const result = await AppointmentValidator.validateNoConflicts({
        professional_id: 'prof-123',
        service_id: 'service-123',
        appointment_date: '2024-12-01',
        appointment_time: '14:00',
        company_id: 'company-123'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Erro interno ao validar conflitos de agendamento');
    });
  });
});