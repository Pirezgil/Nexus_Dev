/**
 * Service para gerenciamento de bloqueios de horário
 * Handles CRUD de schedule blocks, feriados, férias e indisponibilidades
 */

import { 
  IScheduleBlock, 
  ICreateScheduleBlockRequest,
  BlockType,
  ErrorCode,
  AppointmentError
} from '../types';
import { db } from '../utils/database';
import { appointmentCache } from '../utils/redis';
import { logger } from '../utils/logger';
import { integrationService } from './integrationService';

interface ScheduleBlockQuery {
  company_id: string;
  professional_id?: string;
  start_date?: string;
  end_date?: string;
  block_type?: BlockType;
  active?: boolean;
  page?: number;
  limit?: number;
}

interface CreateScheduleBlockData extends ICreateScheduleBlockRequest {
  company_id: string;
  created_by: string;
}

interface UpdateScheduleBlockData extends Partial<ICreateScheduleBlockRequest> {
  company_id: string;
}

export const scheduleBlockService = {

  // Listar bloqueios com filtros
  getScheduleBlocks: async (query: ScheduleBlockQuery) => {
    try {
      const {
        company_id,
        professional_id,
        start_date,
        end_date,
        block_type,
        active,
        page = 1,
        limit = 50
      } = query;

      // Construir filtros
      const where: any = {
        company_id,
        ...(professional_id && { professional_id }),
        ...(block_type && { block_type }),
        ...(active !== undefined && { active }),
        ...(start_date && end_date && {
          OR: [
            // Bloqueios que começam no período
            {
              start_date: {
                gte: new Date(start_date),
                lte: new Date(end_date)
              }
            },
            // Bloqueios que terminam no período
            {
              end_date: {
                gte: new Date(start_date),
                lte: new Date(end_date)
              }
            },
            // Bloqueios que englobam todo o período
            {
              start_date: { lte: new Date(start_date) },
              end_date: { gte: new Date(end_date) }
            }
          ]
        })
      };

      const [scheduleBlocks, total] = await Promise.all([
        db.scheduleBlock.findMany({
          where,
          orderBy: [
            { start_date: 'asc' },
            { created_at: 'desc' }
          ],
          skip: (page - 1) * limit,
          take: limit
        }),
        db.scheduleBlock.count({ where })
      ]);

      // Buscar dados dos profissionais se necessário
      const blocksWithDetails = await Promise.all(
        scheduleBlocks.map(async (block) => {
          if (!block.professional_id) {
            return {
              ...block,
              professional: null
            };
          }

          try {
            const professional = await integrationService.getProfessionalById(
              block.professional_id,
              company_id
            );

            return {
              ...block,
              professional
            };
          } catch (error) {
            logger.warn(`Erro ao buscar profissional ${block.professional_id}:`, error);
            
            return {
              ...block,
              professional: {
                id: block.professional_id,
                name: 'Profissional não encontrado'
              }
            };
          }
        })
      );

      return {
        schedule_blocks: blocksWithDetails,
        total,
        page,
        limit
      };

    } catch (error) {
      logger.error('Erro ao listar bloqueios de horário:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao listar bloqueios de horário',
        500,
        error
      );
    }
  },

  // Criar novo bloqueio
  createScheduleBlock: async (data: CreateScheduleBlockData) => {
    try {
      const {
        company_id,
        professional_id,
        start_date,
        end_date,
        start_time,
        end_time,
        block_type,
        title,
        description,
        is_recurring = false,
        recurrence_rule,
        created_by
      } = data;

      // Validar se profissional existe (se especificado)
      if (professional_id) {
        const professional = await integrationService.getProfessionalById(professional_id, company_id);
        if (!professional) {
          throw new AppointmentError(ErrorCode.PROFESSIONAL_NOT_FOUND, 'Profissional não encontrado');
        }
      }

      // Validar datas
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (endDate < startDate) {
        throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Data final deve ser posterior à data inicial');
      }

      // Validar horários se fornecidos
      if (start_time && end_time) {
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          throw new AppointmentError(ErrorCode.VALIDATION_ERROR, 'Horário final deve ser posterior ao inicial');
        }
      }

      // Verificar conflitos com agendamentos existentes se for para profissional específico
      if (professional_id) {
        const conflictingAppointments = await scheduleBlockService.checkAppointmentConflicts(
          company_id,
          professional_id,
          startDate,
          endDate,
          start_time ? new Date(`1970-01-01T${start_time}:00Z`) : null,
          end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null
        );

        if (conflictingAppointments.length > 0) {
          logger.warn(`Bloqueio criado com ${conflictingAppointments.length} agendamentos em conflito`);
          // Não impedir a criação, apenas avisar
        }
      }

      const scheduleBlock = await db.scheduleBlock.create({
        data: {
          company_id,
          professional_id,
          start_date: startDate,
          end_date: endDate,
          start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : null,
          end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null,
          block_type,
          title,
          description,
          is_recurring,
          recurrence_rule,
          active: true,
          created_by
        }
      });

      // Invalidar cache relacionado
      if (professional_id) {
        await appointmentCache.invalidateByProfessional(professional_id);
      } else {
        await appointmentCache.invalidateByCompany(company_id);
      }

      // Invalidar cache de disponibilidade para as datas afetadas
      let currentDate = startDate;
      while (currentDate <= endDate) {
        await appointmentCache.invalidateByDate(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info(`Bloqueio criado: ${scheduleBlock.id} - ${title}`);

      return scheduleBlock;

    } catch (error) {
      logger.error('Erro ao criar bloqueio de horário:', error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao criar bloqueio',
        500,
        error
      );
    }
  },

  // Atualizar bloqueio existente
  updateScheduleBlock: async (id: string, data: UpdateScheduleBlockData) => {
    try {
      const { company_id, ...updates } = data;

      // Verificar se bloqueio existe
      const existingBlock = await db.scheduleBlock.findFirst({
        where: { id, company_id }
      });

      if (!existingBlock) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Bloqueio não encontrado');
      }

      // Preparar dados de atualização
      const updateData: any = { ...updates };

      if (updates.start_date) {
        updateData.start_date = new Date(updates.start_date);
      }
      if (updates.end_date) {
        updateData.end_date = new Date(updates.end_date);
      }
      if (updates.start_time) {
        updateData.start_time = new Date(`1970-01-01T${updates.start_time}:00Z`);
      }
      if (updates.end_time) {
        updateData.end_time = new Date(`1970-01-01T${updates.end_time}:00Z`);
      }

      const updatedBlock = await db.scheduleBlock.update({
        where: { id },
        data: updateData
      });

      // Invalidar caches
      if (existingBlock.professional_id) {
        await appointmentCache.invalidateByProfessional(existingBlock.professional_id);
      } else {
        await appointmentCache.invalidateByCompany(company_id);
      }

      logger.info(`Bloqueio atualizado: ${id}`);

      return updatedBlock;

    } catch (error) {
      logger.error(`Erro ao atualizar bloqueio ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao atualizar bloqueio',
        500,
        error
      );
    }
  },

  // Remover bloqueio
  deleteScheduleBlock: async (id: string, company_id: string) => {
    try {
      const existingBlock = await db.scheduleBlock.findFirst({
        where: { id, company_id }
      });

      if (!existingBlock) {
        throw new AppointmentError(ErrorCode.APPOINTMENT_NOT_FOUND, 'Bloqueio não encontrado');
      }

      await db.scheduleBlock.delete({
        where: { id }
      });

      // Invalidar caches
      if (existingBlock.professional_id) {
        await appointmentCache.invalidateByProfessional(existingBlock.professional_id);
      } else {
        await appointmentCache.invalidateByCompany(company_id);
      }

      logger.info(`Bloqueio removido: ${id}`);

      return true;

    } catch (error) {
      logger.error(`Erro ao remover bloqueio ${id}:`, error);
      
      if (error instanceof AppointmentError) {
        throw error;
      }
      
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro interno ao remover bloqueio',
        500,
        error
      );
    }
  },

  // Verificar conflitos com agendamentos existentes
  checkAppointmentConflicts: async (
    company_id: string,
    professional_id: string,
    start_date: Date,
    end_date: Date,
    start_time: Date | null,
    end_time: Date | null
  ) => {
    try {
      // Se não tem horário específico, é bloqueio do dia todo
      if (!start_time || !end_time) {
        return await db.appointment.findMany({
          where: {
            company_id,
            professional_id,
            appointment_date: {
              gte: start_date,
              lte: end_date
            },
            status: { not: 'cancelled' }
          },
          select: {
            id: true,
            appointment_date: true,
            appointment_time: true,
            customer_id: true
          }
        });
      }

      // Verificar conflitos com horário específico
      const conflicts = [];
      let currentDate = new Date(start_date);

      while (currentDate <= end_date) {
        const dayConflicts = await db.appointment.findMany({
          where: {
            company_id,
            professional_id,
            appointment_date: currentDate,
            status: { not: 'cancelled' },
            OR: [
              // Agendamentos que começam durante o bloqueio
              {
                appointment_time: {
                  gte: start_time,
                  lt: end_time
                }
              },
              // Agendamentos que terminam durante o bloqueio
              {
                appointment_end_time: {
                  gt: start_time,
                  lte: end_time
                }
              },
              // Agendamentos que englobam o bloqueio
              {
                appointment_time: { lte: start_time },
                appointment_end_time: { gte: end_time }
              }
            ]
          },
          select: {
            id: true,
            appointment_date: true,
            appointment_time: true,
            appointment_end_time: true,
            customer_id: true
          }
        });

        conflicts.push(...dayConflicts);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return conflicts;

    } catch (error) {
      logger.error('Erro ao verificar conflitos de agendamento:', error);
      return [];
    }
  },

  // Obter bloqueios ativos para um período específico
  getActiveBlocksForPeriod: async (
    company_id: string,
    start_date: Date,
    end_date: Date,
    professional_id?: string
  ) => {
    try {
      return await db.scheduleBlock.findMany({
        where: {
          company_id,
          active: true,
          OR: [
            { professional_id }, // Específico do profissional
            { professional_id: null } // Geral (todos os profissionais)
          ],
          // Bloqueios que afetam o período
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
          ]
        },
        orderBy: { start_date: 'asc' }
      });

    } catch (error) {
      logger.error('Erro ao buscar bloqueios ativos:', error);
      return [];
    }
  },

  // Criar bloqueios recorrentes (feriados anuais, etc.)
  createRecurringBlocks: async (
    company_id: string,
    base_block: CreateScheduleBlockData,
    recurrence_rules: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval: number;
      count?: number;
      until?: Date;
      days_of_week?: number[]; // Para weekly
      day_of_month?: number; // Para monthly
    }
  ) => {
    try {
      const createdBlocks = [];
      const { frequency, interval, count, until, days_of_week, day_of_month } = recurrence_rules;
      
      let current_date = new Date(base_block.start_date);
      let iterations = 0;
      const max_iterations = count || 365; // Limite de segurança

      while (iterations < max_iterations && (!until || current_date <= until)) {
        // Criar bloqueio para a data atual
        try {
          const block = await scheduleBlockService.createScheduleBlock({
            ...base_block,
            start_date: current_date.toISOString().split('T')[0],
            end_date: current_date.toISOString().split('T')[0], // Mesmo dia
            title: `${base_block.title} - ${current_date.toLocaleDateString('pt-BR')}`,
            is_recurring: true,
            recurrence_rule: recurrence_rules
          });

          createdBlocks.push(block);

        } catch (error) {
          logger.warn(`Erro ao criar bloqueio recorrente para ${current_date.toISOString()}:`, error);
        }

        // Calcular próxima data baseada na frequência
        switch (frequency) {
          case 'daily':
            current_date.setDate(current_date.getDate() + interval);
            break;
            
          case 'weekly':
            if (days_of_week && days_of_week.length > 0) {
              // Avançar para o próximo dia da semana especificado
              let next_day_found = false;
              for (let i = 1; i <= 7 && !next_day_found; i++) {
                const test_date = new Date(current_date);
                test_date.setDate(test_date.getDate() + i);
                if (days_of_week.includes(test_date.getDay())) {
                  current_date = test_date;
                  next_day_found = true;
                }
              }
              if (!next_day_found) {
                current_date.setDate(current_date.getDate() + (7 * interval));
              }
            } else {
              current_date.setDate(current_date.getDate() + (7 * interval));
            }
            break;
            
          case 'monthly':
            if (day_of_month) {
              current_date.setMonth(current_date.getMonth() + interval);
              current_date.setDate(day_of_month);
            } else {
              current_date.setMonth(current_date.getMonth() + interval);
            }
            break;
            
          case 'yearly':
            current_date.setFullYear(current_date.getFullYear() + interval);
            break;
        }

        iterations++;
      }

      logger.info(`${createdBlocks.length} bloqueios recorrentes criados`);

      return createdBlocks;

    } catch (error) {
      logger.error('Erro ao criar bloqueios recorrentes:', error);
      throw new AppointmentError(
        ErrorCode.INTEGRATION_ERROR,
        'Erro ao criar bloqueios recorrentes',
        500,
        error
      );
    }
  },

  // Desativar todos os bloqueios de um profissional (quando sair da empresa)
  deactivateAllProfessionalBlocks: async (company_id: string, professional_id: string) => {
    try {
      const updated = await db.scheduleBlock.updateMany({
        where: {
          company_id,
          professional_id,
          active: true
        },
        data: {
          active: false
        }
      });

      // Invalidar cache
      await appointmentCache.invalidateByProfessional(professional_id);

      logger.info(`${updated.count} bloqueios desativados para profissional ${professional_id}`);

      return updated.count;

    } catch (error) {
      logger.error(`Erro ao desativar bloqueios do profissional ${professional_id}:`, error);
      throw error;
    }
  }
};