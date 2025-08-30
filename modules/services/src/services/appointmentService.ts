import { AppointmentCompleted, AppointmentStatus, PaymentStatus, ServicePhoto, PhotoType, Prisma } from '@prisma/client';
import { prisma, withTransaction } from '../utils/database';
import { logger, logBusinessEvent } from '../utils/logger';
import { cacheService } from '../utils/redis';
import {
  AppointmentInput,
  AppointmentUpdate,
  AppointmentFilter,
  PhotoUpload,
  PaginationParams,
  ApiResponse,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../types';

export class AppointmentService {
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Create a completed appointment
   */
  async createCompletedAppointment(
    data: AppointmentInput,
    userId: string
  ): Promise<AppointmentCompleted> {
    try {
      return await withTransaction(async (tx) => {
        // Validate service and professional exist
        const [service, professional] = await Promise.all([
          tx.service.findFirst({
            where: {
              id: data.serviceId,
              companyId: data.companyId,
              status: 'ACTIVE',
            },
          }),
          tx.professional.findFirst({
            where: {
              id: data.professionalId,
              companyId: data.companyId,
              status: 'ACTIVE',
            },
          }),
        ]);

        if (!service) {
          throw new NotFoundError('Active service');
        }

        if (!professional) {
          throw new NotFoundError('Active professional');
        }

        // Calculate actual duration
        const actualDuration = Math.floor((data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60));
        
        // Calculate total amount
        const discount = data.discount || 0;
        const totalAmount = data.servicePrice - discount;

        if (totalAmount < 0) {
          throw new ValidationError('Total amount cannot be negative');
        }

        // Create the appointment
        const appointment = await tx.appointmentCompleted.create({
          data: {
            ...data,
            actualDuration,
            totalAmount,
            status: AppointmentStatus.COMPLETED,
            paymentStatus: PaymentStatus.PENDING,
          },
        });

        // Clear cache
        await this.clearAppointmentCache(data.companyId);

        logBusinessEvent('Appointment completed', {
          appointmentId: appointment.id,
          serviceName: service.name,
          professionalName: professional.name,
          totalAmount: appointment.totalAmount,
          duration: actualDuration,
        }, userId, data.companyId);

        logger.info('Completed appointment created successfully', {
          appointmentId: appointment.id,
          serviceId: data.serviceId,
          professionalId: data.professionalId,
          companyId: data.companyId,
          userId,
        });

        return appointment;
      });
    } catch (error) {
      logger.error('Failed to create completed appointment', {
        data,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(
    id: string,
    companyId: string,
    useCache: boolean = true
  ): Promise<(AppointmentCompleted & {
    service: { id: string; name: string; category?: string };
    professional: { id: string; name: string; specialties: string[] };
    photos: ServicePhoto[];
  }) | null> {
    try {
      // Try cache first
      if (useCache) {
        const cached = await cacheService.getAppointmentCache(id);
        if (cached) {
          logger.debug('Appointment retrieved from cache', { appointmentId: id });
          return cached;
        }
      }

      const appointment = await prisma.appointmentCompleted.findFirst({
        where: {
          id,
          companyId,
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          professional: {
            select: {
              id: true,
              name: true,
              specialties: true,
            },
          },
          photos: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!appointment) {
        return null;
      }

      // Cache the result
      if (useCache) {
        await cacheService.setAppointmentCache(id, appointment, this.cacheTTL);
      }

      return appointment;
    } catch (error) {
      logger.error('Failed to get appointment by ID', {
        appointmentId: id,
        companyId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointments with pagination and filters
   */
  async getAppointments(
    filter: AppointmentFilter,
    pagination: PaginationParams
  ): Promise<ApiResponse<AppointmentCompleted[]>> {
    try {
      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId: filter.companyId,
      };

      // Apply filters
      if (filter.serviceId) {
        where.serviceId = filter.serviceId;
      }

      if (filter.professionalId) {
        where.professionalId = filter.professionalId;
      }

      if (filter.customerId) {
        where.customerId = filter.customerId;
      }

      if (filter.status) {
        where.status = filter.status;
      }

      if (filter.paymentStatus) {
        where.paymentStatus = filter.paymentStatus;
      }

      if (filter.startDate) {
        where.startTime = {
          ...where.startTime,
          gte: filter.startDate,
        };
      }

      if (filter.endDate) {
        where.endTime = {
          ...where.endTime,
          lte: filter.endDate,
        };
      }

      if (filter.search) {
        where.OR = [
          {
            customerName: {
              contains: filter.search,
              mode: 'insensitive',
            },
          },
          {
            customerPhone: {
              contains: filter.search,
              mode: 'insensitive',
            },
          },
          {
            notes: {
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
      const [appointments, total] = await Promise.all([
        prisma.appointmentCompleted.findMany({
          where,
          skip,
          take,
          orderBy: {
            [pagination.sortBy || 'startTime']: pagination.sortOrder,
          },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            professional: {
              select: {
                id: true,
                name: true,
                specialties: true,
              },
            },
            _count: {
              select: {
                photos: true,
              },
            },
          },
        }),
        prisma.appointmentCompleted.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      logger.debug('Appointments retrieved successfully', {
        count: appointments.length,
        total,
        page: pagination.page,
        companyId: filter.companyId,
      });

      return {
        success: true,
        data: appointments,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get appointments', {
        filter,
        pagination,
        error,
      });
      throw error;
    }
  }

  /**
   * Update appointment
   */
  async updateAppointment(
    id: string,
    data: AppointmentUpdate,
    companyId: string,
    userId: string
  ): Promise<AppointmentCompleted> {
    try {
      // Check if appointment exists
      const existingAppointment = await this.getAppointmentById(id, companyId, false);
      if (!existingAppointment) {
        throw new NotFoundError('Appointment');
      }

      // Recalculate total amount if discount is being updated
      let updateData: any = { ...data };
      if (data.discount !== undefined) {
        const servicePrice = existingAppointment.servicePrice;
        updateData.totalAmount = servicePrice - data.discount;
        
        if (updateData.totalAmount < 0) {
          throw new ValidationError('Total amount cannot be negative');
        }
      }

      // Update the appointment
      const updatedAppointment = await prisma.appointmentCompleted.update({
        where: {
          id,
          companyId,
        },
        data: updateData,
      });

      // Clear cache
      await Promise.all([
        this.clearAppointmentCache(companyId),
        cacheService.clearCachePattern(`appointment:${id}*`),
      ]);

      logBusinessEvent('Appointment updated', {
        appointmentId: id,
        changes: data,
        previousValues: {
          status: existingAppointment.status,
          paymentStatus: existingAppointment.paymentStatus,
          totalAmount: existingAppointment.totalAmount,
        },
      }, userId, companyId);

      logger.info('Appointment updated successfully', {
        appointmentId: id,
        companyId,
        userId,
        changes: Object.keys(data),
      });

      return updatedAppointment;
    } catch (error) {
      logger.error('Failed to update appointment', {
        appointmentId: id,
        data,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Add photos to appointment
   */
  async addPhotosToAppointment(
    appointmentId: string,
    files: Express.Multer.File[],
    photoData: PhotoUpload[],
    userId: string
  ): Promise<ServicePhoto[]> {
    try {
      return await withTransaction(async (tx) => {
        // Check if appointment exists
        const appointment = await tx.appointmentCompleted.findFirst({
          where: {
            id: appointmentId,
            companyId: photoData[0]?.companyId,
          },
        });

        if (!appointment) {
          throw new NotFoundError('Appointment');
        }

        // Create photo records
        const photos = await Promise.all(
          files.map(async (file, index) => {
            const data = photoData[index];
            
            const photo = await tx.servicePhoto.create({
              data: {
                appointmentId,
                companyId: data.companyId,
                type: data.type,
                filename: file.filename,
                originalName: file.originalname,
                filepath: file.path,
                filesize: file.size,
                mimeType: file.mimetype,
                width: (file as any).width,
                height: (file as any).height,
                description: data.description,
              },
            });

            return photo;
          })
        );

        // Clear cache
        await Promise.all([
          this.clearAppointmentCache(appointment.companyId),
          cacheService.clearCachePattern(`appointment:${appointmentId}*`),
        ]);

        logBusinessEvent('Photos added to appointment', {
          appointmentId,
          photoCount: photos.length,
          photoTypes: photos.map(p => p.type),
        }, userId, appointment.companyId);

        logger.info('Photos added to appointment successfully', {
          appointmentId,
          photoCount: photos.length,
          userId,
        });

        return photos;
      });
    } catch (error) {
      logger.error('Failed to add photos to appointment', {
        appointmentId,
        photoCount: files.length,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointment photos
   */
  async getAppointmentPhotos(
    appointmentId: string,
    companyId: string,
    type?: PhotoType
  ): Promise<ServicePhoto[]> {
    try {
      const where: Prisma.ServicePhotoWhereInput = {
        appointmentId,
        companyId,
      };

      if (type) {
        where.type = type;
      }

      const photos = await prisma.servicePhoto.findMany({
        where,
        orderBy: [
          {
            type: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
      });

      logger.debug('Appointment photos retrieved', {
        appointmentId,
        companyId,
        type,
        count: photos.length,
      });

      return photos;
    } catch (error) {
      logger.error('Failed to get appointment photos', {
        appointmentId,
        companyId,
        type,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete photo
   */
  async deletePhoto(
    photoId: string,
    companyId: string,
    userId: string
  ): Promise<void> {
    try {
      const photo = await prisma.servicePhoto.findFirst({
        where: {
          id: photoId,
          companyId,
        },
      });

      if (!photo) {
        throw new NotFoundError('Photo');
      }

      // Delete from database
      await prisma.servicePhoto.delete({
        where: {
          id: photoId,
        },
      });

      // Clear cache
      await Promise.all([
        this.clearAppointmentCache(companyId),
        cacheService.clearCachePattern(`appointment:${photo.appointmentId}*`),
      ]);

      logBusinessEvent('Photo deleted from appointment', {
        photoId,
        appointmentId: photo.appointmentId,
        filename: photo.filename,
      }, userId, companyId);

      logger.info('Photo deleted successfully', {
        photoId,
        appointmentId: photo.appointmentId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to delete photo', {
        photoId,
        companyId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointment statistics for a time period
   */
  async getAppointmentStatistics(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    professionalId?: string
  ): Promise<{
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    totalRevenue: number;
    averageTicket: number;
    paymentStatusBreakdown: Array<{ status: string; count: number; amount: number }>;
    dailyStats: Array<{ date: string; appointments: number; revenue: number }>;
  }> {
    try {
      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId,
        ...(professionalId && { professionalId }),
        ...(startDate && { startTime: { gte: startDate } }),
        ...(endDate && { endTime: { lte: endDate } }),
      };

      const [statusStats, paymentStats, dailyStats] = await Promise.all([
        // Status breakdown
        prisma.appointmentCompleted.groupBy({
          by: ['status'],
          where,
          _count: {
            id: true,
          },
          _sum: {
            totalAmount: true,
          },
        }),

        // Payment status breakdown
        prisma.appointmentCompleted.groupBy({
          by: ['paymentStatus'],
          where,
          _count: {
            id: true,
          },
          _sum: {
            totalAmount: true,
          },
        }),

        // Daily stats (last 30 days or within date range)
        prisma.$queryRaw<Array<{ date: string; appointments: bigint; revenue: number }>>`
          SELECT 
            DATE(start_time) as date,
            COUNT(*) as appointments,
            COALESCE(SUM(total_amount), 0) as revenue
          FROM appointments_completed 
          WHERE company_id = ${companyId}
            ${professionalId ? Prisma.sql`AND professional_id = ${professionalId}` : Prisma.empty}
            ${startDate ? Prisma.sql`AND start_time >= ${startDate}` : Prisma.empty}
            ${endDate ? Prisma.sql`AND end_time <= ${endDate}` : Prisma.empty}
          GROUP BY DATE(start_time)
          ORDER BY date DESC
          LIMIT 30
        `,
      ]);

      const totalAppointments = statusStats.reduce((sum, item) => sum + item._count.id, 0);
      const completedAppointments = statusStats
        .filter(item => item.status === 'COMPLETED')
        .reduce((sum, item) => sum + item._count.id, 0);
      const cancelledAppointments = statusStats
        .filter(item => item.status === 'CANCELLED')
        .reduce((sum, item) => sum + item._count.id, 0);

      const totalRevenue = statusStats
        .filter(item => item.status === 'COMPLETED')
        .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);

      const averageTicket = completedAppointments > 0 ? totalRevenue / completedAppointments : 0;

      const paymentStatusBreakdown = paymentStats.map(item => ({
        status: item.paymentStatus,
        count: item._count.id,
        amount: Number(item._sum.totalAmount || 0),
      }));

      const dailyStatsFormatted = dailyStats.map(item => ({
        date: item.date,
        appointments: Number(item.appointments),
        revenue: Number(item.revenue),
      }));

      return {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        totalRevenue,
        averageTicket,
        paymentStatusBreakdown,
        dailyStats: dailyStatsFormatted,
      };
    } catch (error) {
      logger.error('Failed to get appointment statistics', {
        companyId,
        startDate,
        endDate,
        professionalId,
        error,
      });
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    appointmentId: string,
    paymentStatus: PaymentStatus,
    paymentMethod?: string,
    companyId?: string,
    userId?: string
  ): Promise<AppointmentCompleted> {
    try {
      const appointment = await prisma.appointmentCompleted.update({
        where: {
          id: appointmentId,
          ...(companyId && { companyId }),
        },
        data: {
          paymentStatus,
          ...(paymentMethod && { paymentMethod }),
        },
      });

      // Clear cache
      if (companyId) {
        await Promise.all([
          this.clearAppointmentCache(companyId),
          cacheService.clearCachePattern(`appointment:${appointmentId}*`),
        ]);
      }

      if (userId && companyId) {
        logBusinessEvent('Payment status updated', {
          appointmentId,
          paymentStatus,
          paymentMethod,
        }, userId, companyId);
      }

      logger.info('Payment status updated successfully', {
        appointmentId,
        paymentStatus,
        paymentMethod,
        userId,
      });

      return appointment;
    } catch (error) {
      logger.error('Failed to update payment status', {
        appointmentId,
        paymentStatus,
        paymentMethod,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Clear appointment cache
   */
  private async clearAppointmentCache(companyId: string): Promise<void> {
    try {
      await cacheService.clearCachePattern(`appointment:*`);
      await cacheService.clearCachePattern(`appointments:${companyId}:*`);
    } catch (error) {
      logger.warn('Failed to clear appointment cache', { companyId, error });
    }
  }

  /**
   * Get upcoming appointments for a professional
   */
  async getUpcomingAppointments(
    professionalId: string,
    companyId: string,
    days: number = 7
  ): Promise<AppointmentCompleted[]> {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const appointments = await prisma.appointmentCompleted.findMany({
        where: {
          professionalId,
          companyId,
          startTime: {
            gte: new Date(),
            lte: endDate,
          },
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS'],
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              duration: true,
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      logger.debug('Upcoming appointments retrieved', {
        professionalId,
        companyId,
        days,
        count: appointments.length,
      });

      return appointments;
    } catch (error) {
      logger.error('Failed to get upcoming appointments', {
        professionalId,
        companyId,
        days,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointments completed (alias for getAppointments with filter)
   * Used by integration service for availability checking
   */
  async getAppointmentsCompleted(
    filter: AppointmentFilter,
    pagination: PaginationParams
  ): Promise<ApiResponse<AppointmentCompleted[]>> {
    return this.getAppointments(filter, pagination);
  }

  /**
   * Create appointment completed from integration data
   * Specialized method for integration callbacks
   */
  async createAppointmentCompleted(
    data: AppointmentInput,
    userId: string
  ): Promise<AppointmentCompleted> {
    return this.createCompletedAppointment(data, userId);
  }
}

export const appointmentService = new AppointmentService();