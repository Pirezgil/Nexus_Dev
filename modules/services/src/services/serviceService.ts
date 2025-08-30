import { Service, ServiceStatus, Prisma } from '@prisma/client';
import { prisma, withTransaction } from '../utils/database';
import { logger, logBusinessEvent } from '../utils/logger';
import { cacheService } from '../utils/redis';
import {
  ServiceInput,
  ServiceUpdate,
  ServiceFilter,
  PaginationParams,
  ApiResponse,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../types';

export class ServiceService {
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Create a new service
   */
  async createService(
    data: ServiceInput,
    userId: string
  ): Promise<Service> {
    try {
      // Check if service with same name exists for the company
      const existingService = await prisma.service.findFirst({
        where: {
          companyId: data.companyId,
          name: data.name,
        },
      });

      if (existingService) {
        throw new ConflictError(`Service with name "${data.name}" already exists for this company`);
      }

      // Create the service
      const service = await prisma.service.create({
        data: {
          ...data,
          status: ServiceStatus.ACTIVE,
        },
      });

      // Clear cache
      await this.clearServiceCache(data.companyId);

      logBusinessEvent('Service created', {
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        duration: service.duration,
      }, userId, data.companyId);

      logger.info('Service created successfully', {
        serviceId: service.id,
        serviceName: service.name,
        companyId: data.companyId,
        userId,
      });

      return service;
    } catch (error) {
      logger.error('Failed to create service', {
        data,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(
    id: string,
    companyId: string,
    useCache: boolean = true
  ): Promise<Service | null> {
    try {
      // Try cache first
      if (useCache) {
        const cached = await cacheService.getServiceCache(id);
        if (cached) {
          logger.debug('Service retrieved from cache', { serviceId: id });
          return cached;
        }
      }

      const service = await prisma.service.findFirst({
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
            },
            take: 5,
            orderBy: {
              startTime: 'desc',
            },
          },
        },
      });

      if (!service) {
        return null;
      }

      // Cache the result
      if (useCache) {
        await cacheService.setServiceCache(id, service, this.cacheTTL);
      }

      return service;
    } catch (error) {
      logger.error('Failed to get service by ID', {
        serviceId: id,
        companyId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get services with pagination and filters
   */
  async getServices(
    filter: ServiceFilter,
    pagination: PaginationParams
  ): Promise<ApiResponse<Service[]>> {
    try {
      const where: Prisma.ServiceWhereInput = {
        companyId: filter.companyId,
      };

      // Apply filters
      if (filter.status) {
        where.status = filter.status;
      }

      if (filter.category) {
        where.category = {
          contains: filter.category,
          mode: 'insensitive',
        };
      }

      if (filter.minPrice !== undefined) {
        where.price = {
          ...where.price,
          gte: filter.minPrice,
        };
      }

      if (filter.maxPrice !== undefined) {
        where.price = {
          ...where.price,
          lte: filter.maxPrice,
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
            description: {
              contains: filter.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      // Calculate pagination
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      // Execute queries
      const [services, total] = await Promise.all([
        prisma.service.findMany({
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
        prisma.service.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      logger.debug('Services retrieved successfully', {
        count: services.length,
        total,
        page: pagination.page,
        companyId: filter.companyId,
      });

      return {
        success: true,
        data: services,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get services', {
        filter,
        pagination,
        error,
      });
      throw error;
    }
  }

  /**
   * Update service
   */
  async updateService(
    id: string,
    data: ServiceUpdate,
    companyId: string,
    userId: string
  ): Promise<Service> {
    try {
      // Check if service exists
      const existingService = await this.getServiceById(id, companyId, false);
      if (!existingService) {
        throw new NotFoundError('Service');
      }

      // Check if name is being changed and if new name conflicts
      if (data.name && data.name !== existingService.name) {
        const nameConflict = await prisma.service.findFirst({
          where: {
            companyId,
            name: data.name,
            id: {
              not: id,
            },
          },
        });

        if (nameConflict) {
          throw new ConflictError(`Service with name "${data.name}" already exists for this company`);
        }
      }

      // Update the service
      const updatedService = await prisma.service.update({
        where: {
          id,
          companyId,
        },
        data,
      });

      // Clear cache
      await Promise.all([
        this.clearServiceCache(companyId),
        cacheService.clearCachePattern(`service:${id}*`),
      ]);

      logBusinessEvent('Service updated', {
        serviceId: id,
        changes: data,
        previousValues: {
          name: existingService.name,
          price: existingService.price,
          status: existingService.status,
        },
      }, userId, companyId);

      logger.info('Service updated successfully', {
        serviceId: id,
        companyId,
        userId,
        changes: Object.keys(data),
      });

      return updatedService;
    } catch (error) {
      logger.error('Failed to update service', {
        serviceId: id,
        data,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete service (soft delete by setting status to INACTIVE)
   */
  async deleteService(
    id: string,
    companyId: string,
    userId: string
  ): Promise<void> {
    try {
      return await withTransaction(async (tx) => {
        // Check if service exists
        const existingService = await tx.service.findFirst({
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

        if (!existingService) {
          throw new NotFoundError('Service');
        }

        // Check if service has appointments
        if (existingService._count.appointments > 0) {
          // Soft delete - set status to INACTIVE
          await tx.service.update({
            where: {
              id,
              companyId,
            },
            data: {
              status: ServiceStatus.INACTIVE,
            },
          });

          logBusinessEvent('Service soft deleted (has appointments)', {
            serviceId: id,
            serviceName: existingService.name,
            appointmentCount: existingService._count.appointments,
          }, userId, companyId);
        } else {
          // Hard delete - no appointments exist
          await tx.service.delete({
            where: {
              id,
              companyId,
            },
          });

          logBusinessEvent('Service deleted', {
            serviceId: id,
            serviceName: existingService.name,
          }, userId, companyId);
        }

        // Clear cache
        await Promise.all([
          this.clearServiceCache(companyId),
          cacheService.clearCachePattern(`service:${id}*`),
        ]);

        logger.info('Service deleted successfully', {
          serviceId: id,
          companyId,
          userId,
          serviceName: existingService.name,
          hardDelete: existingService._count.appointments === 0,
        });
      });
    } catch (error) {
      logger.error('Failed to delete service', {
        serviceId: id,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStatistics(
    companyId: string,
    serviceId?: string
  ): Promise<{
    totalAppointments: number;
    completedAppointments: number;
    totalRevenue: number;
    averageRating?: number;
    popularityRank?: number;
  }> {
    try {
      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId,
        ...(serviceId && { serviceId }),
      };

      const [appointments, revenue] = await Promise.all([
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
          },
        }),
      ]);

      const totalAppointments = appointments.reduce((sum, item) => sum + item._count.id, 0);
      const completedAppointments = appointments
        .filter(item => item.status === 'COMPLETED')
        .reduce((sum, item) => sum + item._count.id, 0);

      return {
        totalAppointments,
        completedAppointments,
        totalRevenue: Number(revenue._sum.totalAmount || 0),
        // Note: Rating system would need to be implemented in appointments
        // popularityRank would require comparing with other services
      };
    } catch (error) {
      logger.error('Failed to get service statistics', {
        companyId,
        serviceId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get popular services
   */
  async getPopularServices(
    companyId: string,
    limit: number = 10
  ): Promise<Array<Service & { appointmentCount: number; revenue: number }>> {
    try {
      const popularServices = await prisma.service.findMany({
        where: {
          companyId,
          status: ServiceStatus.ACTIVE,
        },
        include: {
          _count: {
            select: {
              appointments: {
                where: {
                  status: 'COMPLETED',
                },
              },
            },
          },
          appointments: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              totalAmount: true,
            },
          },
        },
        orderBy: {
          appointments: {
            _count: 'desc',
          },
        },
        take: limit,
      });

      const result = popularServices.map(service => ({
        ...service,
        appointmentCount: service._count.appointments,
        revenue: service.appointments.reduce((sum, apt) => sum + Number(apt.totalAmount), 0),
        _count: undefined,
        appointments: undefined,
      }));

      return result;
    } catch (error) {
      logger.error('Failed to get popular services', {
        companyId,
        limit,
        error,
      });
      throw error;
    }
  }

  /**
   * Bulk update service prices
   */
  async bulkUpdatePrices(
    companyId: string,
    updates: Array<{ serviceId: string; newPrice: number }>,
    userId: string
  ): Promise<void> {
    try {
      return await withTransaction(async (tx) => {
        const updatePromises = updates.map(({ serviceId, newPrice }) =>
          tx.service.update({
            where: {
              id: serviceId,
              companyId,
            },
            data: {
              price: newPrice,
            },
          })
        );

        await Promise.all(updatePromises);

        // Clear cache
        await this.clearServiceCache(companyId);

        logBusinessEvent('Bulk price update completed', {
          serviceCount: updates.length,
          updates,
        }, userId, companyId);

        logger.info('Bulk price update completed', {
          companyId,
          userId,
          serviceCount: updates.length,
        });
      });
    } catch (error) {
      logger.error('Failed to bulk update prices', {
        companyId,
        updates,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Clear service cache
   */
  private async clearServiceCache(companyId: string): Promise<void> {
    try {
      await cacheService.clearCachePattern(`service:*`);
      await cacheService.clearCachePattern(`services:${companyId}:*`);
    } catch (error) {
      logger.warn('Failed to clear service cache', { companyId, error });
    }
  }

  /**
   * Search services by text
   */
  async searchServices(
    query: string,
    companyId: string,
    limit: number = 20
  ): Promise<Service[]> {
    try {
      const services = await prisma.service.findMany({
        where: {
          companyId,
          status: ServiceStatus.ACTIVE,
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              category: {
                contains: query,
                mode: 'insensitive',
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

      logger.debug('Services search completed', {
        query,
        companyId,
        resultCount: services.length,
      });

      return services;
    } catch (error) {
      logger.error('Failed to search services', {
        query,
        companyId,
        error,
      });
      throw error;
    }
  }
}

export const serviceService = new ServiceService();