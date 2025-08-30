import { Professional, ProfessionalStatus, Prisma } from '@prisma/client';
import { prisma, withTransaction } from '../utils/database';
import { logger, logBusinessEvent } from '../utils/logger';
import { cacheService } from '../utils/redis';
import {
  ProfessionalInput,
  ProfessionalUpdate,
  ProfessionalFilter,
  PaginationParams,
  ApiResponse,
  NotFoundError,
  ConflictError,
  ValidationError,
  WorkSchedule,
} from '../types';

export class ProfessionalService {
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Create a new professional
   */
  async createProfessional(
    data: ProfessionalInput,
    userId: string
  ): Promise<Professional> {
    try {
      // Check if professional with same userId already exists
      const existingByUserId = await prisma.professional.findUnique({
        where: {
          userId: data.userId,
        },
      });

      if (existingByUserId) {
        throw new ConflictError('Professional with this user ID already exists');
      }

      // Check if professional with same email exists for the company
      const existingByEmail = await prisma.professional.findFirst({
        where: {
          companyId: data.companyId,
          email: data.email,
        },
      });

      if (existingByEmail) {
        throw new ConflictError(`Professional with email "${data.email}" already exists for this company`);
      }

      // Validate work schedule if provided
      if (data.workSchedule) {
        this.validateWorkSchedule(data.workSchedule);
      }

      // Create the professional
      const professional = await prisma.professional.create({
        data: {
          ...data,
          status: ProfessionalStatus.ACTIVE,
        },
      });

      // Clear cache
      await this.clearProfessionalCache(data.companyId);

      logBusinessEvent('Professional created', {
        professionalId: professional.id,
        professionalName: professional.name,
        email: professional.email,
        specialties: professional.specialties,
      }, userId, data.companyId);

      logger.info('Professional created successfully', {
        professionalId: professional.id,
        professionalName: professional.name,
        companyId: data.companyId,
        userId,
      });

      return professional;
    } catch (error) {
      logger.error('Failed to create professional', {
        data: {
          ...data,
          workSchedule: data.workSchedule ? 'provided' : 'not provided',
        },
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get professional by ID
   */
  async getProfessionalById(
    id: string,
    companyId: string,
    useCache: boolean = true
  ): Promise<Professional | null> {
    try {
      // Try cache first
      if (useCache) {
        const cached = await cacheService.getProfessionalCache(id);
        if (cached) {
          logger.debug('Professional retrieved from cache', { professionalId: id });
          return cached;
        }
      }

      const professional = await prisma.professional.findFirst({
        where: {
          id,
          companyId,
        },
        include: {
          appointments: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true,
              totalAmount: true,
              service: {
                select: {
                  name: true,
                },
              },
            },
            take: 10,
            orderBy: {
              startTime: 'desc',
            },
          },
        },
      });

      if (!professional) {
        return null;
      }

      // Cache the result
      if (useCache) {
        await cacheService.setProfessionalCache(id, professional, this.cacheTTL);
      }

      return professional;
    } catch (error) {
      logger.error('Failed to get professional by ID', {
        professionalId: id,
        companyId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get professionals with pagination and filters
   */
  async getProfessionals(
    filter: ProfessionalFilter,
    pagination: PaginationParams
  ): Promise<ApiResponse<Professional[]>> {
    try {
      const where: Prisma.ProfessionalWhereInput = {
        companyId: filter.companyId,
      };

      // Apply filters
      if (filter.status) {
        where.status = filter.status;
      }

      if (filter.specialties && filter.specialties.length > 0) {
        where.specialties = {
          hasSome: filter.specialties,
        };
      }

      if (filter.search) {
        where.OR = [
          {
            name: {
              contains: filter.search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: filter.search,
              mode: 'insensitive',
            },
          },
          {
            specialties: {
              hasSome: [filter.search],
            },
          },
        ];
      }

      // Calculate pagination
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      // Execute queries
      const [professionals, total] = await Promise.all([
        prisma.professional.findMany({
          where,
          skip,
          take,
          orderBy: {
            [pagination.sortBy || 'createdAt']: pagination.sortOrder,
          },
          include: {
            _count: {
              select: {
                appointments: true,
              },
            },
          },
        }),
        prisma.professional.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      logger.debug('Professionals retrieved successfully', {
        count: professionals.length,
        total,
        page: pagination.page,
        companyId: filter.companyId,
      });

      return {
        success: true,
        data: professionals,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get professionals', {
        filter,
        pagination,
        error,
      });
      throw error;
    }
  }

  /**
   * Update professional
   */
  async updateProfessional(
    id: string,
    data: ProfessionalUpdate,
    companyId: string,
    userId: string
  ): Promise<Professional> {
    try {
      // Check if professional exists
      const existingProfessional = await this.getProfessionalById(id, companyId, false);
      if (!existingProfessional) {
        throw new NotFoundError('Professional');
      }

      // Check if email is being changed and if new email conflicts
      if (data.email && data.email !== existingProfessional.email) {
        const emailConflict = await prisma.professional.findFirst({
          where: {
            companyId,
            email: data.email,
            id: {
              not: id,
            },
          },
        });

        if (emailConflict) {
          throw new ConflictError(`Professional with email "${data.email}" already exists for this company`);
        }
      }

      // Validate work schedule if provided
      if (data.workSchedule) {
        this.validateWorkSchedule(data.workSchedule);
      }

      // Update the professional
      const updatedProfessional = await prisma.professional.update({
        where: {
          id,
          companyId,
        },
        data,
      });

      // Clear cache
      await Promise.all([
        this.clearProfessionalCache(companyId),
        cacheService.clearCachePattern(`professional:${id}*`),
      ]);

      logBusinessEvent('Professional updated', {
        professionalId: id,
        changes: data,
        previousValues: {
          name: existingProfessional.name,
          email: existingProfessional.email,
          status: existingProfessional.status,
        },
      }, userId, companyId);

      logger.info('Professional updated successfully', {
        professionalId: id,
        companyId,
        userId,
        changes: Object.keys(data),
      });

      return updatedProfessional;
    } catch (error) {
      logger.error('Failed to update professional', {
        professionalId: id,
        data,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete professional (soft delete by setting status to INACTIVE)
   */
  async deleteProfessional(
    id: string,
    companyId: string,
    userId: string
  ): Promise<void> {
    try {
      return await withTransaction(async (tx) => {
        // Check if professional exists
        const existingProfessional = await tx.professional.findFirst({
          where: {
            id,
            companyId,
          },
          include: {
            _count: {
              select: {
                appointments: true,
              },
            },
          },
        });

        if (!existingProfessional) {
          throw new NotFoundError('Professional');
        }

        // Check if professional has appointments
        if (existingProfessional._count.appointments > 0) {
          // Soft delete - set status to INACTIVE
          await tx.professional.update({
            where: {
              id,
              companyId,
            },
            data: {
              status: ProfessionalStatus.INACTIVE,
            },
          });

          logBusinessEvent('Professional soft deleted (has appointments)', {
            professionalId: id,
            professionalName: existingProfessional.name,
            appointmentCount: existingProfessional._count.appointments,
          }, userId, companyId);
        } else {
          // Hard delete - no appointments exist
          await tx.professional.delete({
            where: {
              id,
              companyId,
            },
          });

          logBusinessEvent('Professional deleted', {
            professionalId: id,
            professionalName: existingProfessional.name,
          }, userId, companyId);
        }

        // Clear cache
        await Promise.all([
          this.clearProfessionalCache(companyId),
          cacheService.clearCachePattern(`professional:${id}*`),
        ]);

        logger.info('Professional deleted successfully', {
          professionalId: id,
          companyId,
          userId,
          professionalName: existingProfessional.name,
          hardDelete: existingProfessional._count.appointments === 0,
        });
      });
    } catch (error) {
      logger.error('Failed to delete professional', {
        professionalId: id,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get professional performance statistics
   */
  async getProfessionalStatistics(
    companyId: string,
    professionalId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalAppointments: number;
    completedAppointments: number;
    totalRevenue: number;
    averageTicket: number;
    efficiency: number;
    topServices: Array<{ serviceName: string; count: number; revenue: number }>;
  }> {
    try {
      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId,
        ...(professionalId && { professionalId }),
        ...(startDate && { startTime: { gte: startDate } }),
        ...(endDate && { endTime: { lte: endDate } }),
      };

      const [appointments, revenue, services] = await Promise.all([
        prisma.appointmentCompleted.groupBy({
          by: ['status'],
          where,
          _count: {
            id: true,
          },
        }),
        prisma.appointmentCompleted.aggregate({
          where: {
            ...where,
            status: 'COMPLETED',
          },
          _sum: {
            totalAmount: true,
          },
          _avg: {
            totalAmount: true,
            actualDuration: true,
          },
        }),
        prisma.appointmentCompleted.groupBy({
          by: ['serviceId'],
          where: {
            ...where,
            status: 'COMPLETED',
          },
          _count: {
            serviceId: true,
          },
          _sum: {
            totalAmount: true,
          },
          orderBy: {
            _count: {
              serviceId: 'desc',
            },
          },
          take: 5,
        }),
      ]);

      const totalAppointments = appointments.reduce((sum, item) => sum + item._count.id, 0);
      const completedAppointments = appointments
        .filter(item => item.status === 'COMPLETED')
        .reduce((sum, item) => sum + item._count.id, 0);

      // Get service names for top services
      const serviceIds = services.map(s => s.serviceId);
      const serviceNames = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      });

      const serviceNameMap = serviceNames.reduce((map, service) => {
        map[service.id] = service.name;
        return map;
      }, {} as Record<string, string>);

      const topServices = services.map(service => ({
        serviceName: serviceNameMap[service.serviceId] || 'Unknown Service',
        count: service._count.serviceId,
        revenue: Number(service._sum.totalAmount || 0),
      }));

      // Calculate efficiency (completed vs total appointments)
      const efficiency = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;

      return {
        totalAppointments,
        completedAppointments,
        totalRevenue: Number(revenue._sum.totalAmount || 0),
        averageTicket: Number(revenue._avg.totalAmount || 0),
        efficiency,
        topServices,
      };
    } catch (error) {
      logger.error('Failed to get professional statistics', {
        companyId,
        professionalId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  /**
   * Get available professionals for a specific time slot
   */
  async getAvailableProfessionals(
    companyId: string,
    startTime: Date,
    endTime: Date,
    serviceId?: string
  ): Promise<Professional[]> {
    try {
      // Get professionals that are not busy during the time slot
      const professionals = await prisma.professional.findMany({
        where: {
          companyId,
          status: ProfessionalStatus.ACTIVE,
          appointments: {
            none: {
              AND: [
                {
                  startTime: {
                    lt: endTime,
                  },
                },
                {
                  endTime: {
                    gt: startTime,
                  },
                },
                {
                  status: {
                    in: ['SCHEDULED', 'IN_PROGRESS'],
                  },
                },
              ],
            },
          },
        },
        include: {
          _count: {
            select: {
              appointments: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // If serviceId is provided, filter by specialties (this would need to be implemented based on business logic)
      // For now, we return all available professionals

      logger.debug('Available professionals retrieved', {
        companyId,
        startTime,
        endTime,
        serviceId,
        count: professionals.length,
      });

      return professionals;
    } catch (error) {
      logger.error('Failed to get available professionals', {
        companyId,
        startTime,
        endTime,
        serviceId,
        error,
      });
      throw error;
    }
  }

  /**
   * Update professional work schedule
   */
  async updateWorkSchedule(
    id: string,
    workSchedule: WorkSchedule,
    companyId: string,
    userId: string
  ): Promise<Professional> {
    try {
      this.validateWorkSchedule(workSchedule);

      const updatedProfessional = await prisma.professional.update({
        where: {
          id,
          companyId,
        },
        data: {
          workSchedule,
        },
      });

      // Clear cache
      await Promise.all([
        this.clearProfessionalCache(companyId),
        cacheService.clearCachePattern(`professional:${id}*`),
      ]);

      logBusinessEvent('Professional work schedule updated', {
        professionalId: id,
        workSchedule,
      }, userId, companyId);

      logger.info('Professional work schedule updated', {
        professionalId: id,
        companyId,
        userId,
      });

      return updatedProfessional;
    } catch (error) {
      logger.error('Failed to update professional work schedule', {
        professionalId: id,
        workSchedule,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Validate work schedule format
   */
  private validateWorkSchedule(workSchedule: WorkSchedule): void {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const day of days) {
      const schedule = workSchedule[day as keyof WorkSchedule];
      
      if (schedule && schedule.enabled) {
        if (!timeRegex.test(schedule.startTime)) {
          throw new ValidationError(`Invalid start time format for ${day}. Use HH:MM format`);
        }
        
        if (!timeRegex.test(schedule.endTime)) {
          throw new ValidationError(`Invalid end time format for ${day}. Use HH:MM format`);
        }

        // Check if start time is before end time
        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (startMinutes >= endMinutes) {
          throw new ValidationError(`End time must be after start time for ${day}`);
        }

        // Validate break times if provided
        if (schedule.breakStart && schedule.breakEnd) {
          if (!timeRegex.test(schedule.breakStart) || !timeRegex.test(schedule.breakEnd)) {
            throw new ValidationError(`Invalid break time format for ${day}. Use HH:MM format`);
          }

          const [breakStartHour, breakStartMin] = schedule.breakStart.split(':').map(Number);
          const [breakEndHour, breakEndMin] = schedule.breakEnd.split(':').map(Number);
          
          const breakStartMinutes = breakStartHour * 60 + breakStartMin;
          const breakEndMinutes = breakEndHour * 60 + breakEndMin;
          
          if (breakStartMinutes >= breakEndMinutes) {
            throw new ValidationError(`Break end time must be after break start time for ${day}`);
          }

          // Break times must be within work hours
          if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
            throw new ValidationError(`Break times must be within work hours for ${day}`);
          }
        }
      }
    }
  }

  /**
   * Clear professional cache
   */
  private async clearProfessionalCache(companyId: string): Promise<void> {
    try {
      await cacheService.clearCachePattern(`professional:*`);
      await cacheService.clearCachePattern(`professionals:${companyId}:*`);
    } catch (error) {
      logger.warn('Failed to clear professional cache', { companyId, error });
    }
  }

  /**
   * Search professionals by text
   */
  async searchProfessionals(
    query: string,
    companyId: string,
    limit: number = 20
  ): Promise<Professional[]> {
    try {
      const professionals = await prisma.professional.findMany({
        where: {
          companyId,
          status: ProfessionalStatus.ACTIVE,
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              specialties: {
                hasSome: [query],
              },
            },
          ],
        },
        orderBy: [
          {
            name: 'asc',
          },
        ],
        take: limit,
      });

      logger.debug('Professionals search completed', {
        query,
        companyId,
        resultCount: professionals.length,
      });

      return professionals;
    } catch (error) {
      logger.error('Failed to search professionals', {
        query,
        companyId,
        error,
      });
      throw error;
    }
  }
}

export const professionalService = new ProfessionalService();