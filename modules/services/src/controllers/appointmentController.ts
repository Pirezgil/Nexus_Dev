import { Request, Response } from 'express';
import { appointmentService } from '../services/appointmentService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import {
  AppointmentInput,
  AppointmentUpdate,
  AppointmentFilter,
  PhotoUpload,
  PaginationParams,
  AppointmentCreateSchema,
  AppointmentUpdateSchema,
  PhotoUploadSchema,
  PaginationSchema,
  NotFoundError,
} from '../types';
import { PaymentStatus, PhotoType } from '@prisma/client';

export class AppointmentController {
  /**
   * Create a completed appointment
   */
  createCompletedAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    
    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body
    const validatedData = AppointmentCreateSchema.parse({
      ...req.body,
      companyId,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
    });

    const appointment = await appointmentService.createCompletedAppointment(validatedData, user.id);

    logger.info('Completed appointment created via API', {
      appointmentId: appointment.id,
      serviceId: appointment.serviceId,
      professionalId: appointment.professionalId,
      userId: user.id,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Completed appointment created successfully',
    });
  });

  /**
   * Get appointment by ID
   */
  getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const appointment = await appointmentService.getAppointmentById(id, companyId);

    if (!appointment) {
      throw new NotFoundError('Appointment');
    }

    res.json({
      success: true,
      data: appointment,
    });
  });

  /**
   * Get appointments with pagination and filters
   */
  getAppointments = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate pagination parameters
    const pagination = PaginationSchema.parse({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    });

    // Build filters
    const filter: AppointmentFilter = {
      companyId,
      serviceId: req.query.serviceId as string,
      professionalId: req.query.professionalId as string,
      customerId: req.query.customerId as string,
      status: req.query.status as any,
      paymentStatus: req.query.paymentStatus as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      search: req.query.search as string,
    };

    const result = await appointmentService.getAppointments(filter, pagination);

    res.json(result);
  });

  /**
   * Update appointment
   */
  updateAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body
    const validatedData = AppointmentUpdateSchema.parse(req.body);

    const appointment = await appointmentService.updateAppointment(id, validatedData, companyId, user.id);

    logger.info('Appointment updated via API', {
      appointmentId: id,
      userId: user.id,
      companyId,
      changes: Object.keys(validatedData),
    });

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment updated successfully',
    });
  });

  /**
   * Add photos to appointment
   */
  addPhotosToAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id: appointmentId } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES',
      });
    }

    // Validate photo data for each file
    const photoData: PhotoUpload[] = [];
    
    if (Array.isArray(req.body.photos)) {
      // Multiple photos with individual metadata
      req.body.photos.forEach((photo: any, index: number) => {
        if (index < req.files!.length) {
          photoData.push(PhotoUploadSchema.parse({
            appointmentId,
            companyId,
            type: photo.type || PhotoType.DOCUMENTATION,
            description: photo.description,
          }));
        }
      });
    } else if (req.body.type) {
      // Single photo type for all files
      req.files.forEach(() => {
        photoData.push(PhotoUploadSchema.parse({
          appointmentId,
          companyId,
          type: req.body.type || PhotoType.DOCUMENTATION,
          description: req.body.description,
        }));
      });
    } else {
      // Default type for all files
      req.files.forEach(() => {
        photoData.push(PhotoUploadSchema.parse({
          appointmentId,
          companyId,
          type: PhotoType.DOCUMENTATION,
        }));
      });
    }

    const photos = await appointmentService.addPhotosToAppointment(
      appointmentId,
      req.files as Express.Multer.File[],
      photoData,
      user.id
    );

    logger.info('Photos added to appointment via API', {
      appointmentId,
      photoCount: photos.length,
      userId: user.id,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: photos,
      message: `${photos.length} photos added successfully`,
    });
  });

  /**
   * Get appointment photos
   */
  getAppointmentPhotos = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id: appointmentId } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const type = req.query.type as PhotoType;
    const photos = await appointmentService.getAppointmentPhotos(appointmentId, companyId, type);

    res.json({
      success: true,
      data: photos,
      meta: {
        appointmentId,
        type,
        count: photos.length,
      },
    });
  });

  /**
   * Delete photo
   */
  deletePhoto = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { photoId } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    await appointmentService.deletePhoto(photoId, companyId, user.id);

    logger.info('Photo deleted via API', {
      photoId,
      userId: user.id,
      companyId,
    });

    res.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  });

  /**
   * Get appointment statistics
   */
  getAppointmentStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date filters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const professionalId = req.query.professionalId as string;

    const statistics = await appointmentService.getAppointmentStatistics(
      companyId,
      startDate,
      endDate,
      professionalId
    );

    res.json({
      success: true,
      data: statistics,
      meta: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        professionalId,
      },
    });
  });

  /**
   * Update payment status
   */
  updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id: appointmentId } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { paymentStatus, paymentMethod } = req.body;

    if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Valid payment status is required',
        code: 'INVALID_PAYMENT_STATUS',
      });
    }

    const appointment = await appointmentService.updatePaymentStatus(
      appointmentId,
      paymentStatus,
      paymentMethod,
      companyId,
      user.id
    );

    logger.info('Payment status updated via API', {
      appointmentId,
      paymentStatus,
      paymentMethod,
      userId: user.id,
      companyId,
    });

    res.json({
      success: true,
      data: appointment,
      message: 'Payment status updated successfully',
    });
  });

  /**
   * Get today's appointments
   */
  getTodaysAppointments = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const filter: AppointmentFilter = {
      companyId,
      startDate: startOfDay,
      endDate: endOfDay,
      professionalId: req.query.professionalId as string,
    };

    const pagination: PaginationParams = {
      page: 1,
      limit: 100,
      sortBy: 'startTime',
      sortOrder: 'asc',
    };

    const result = await appointmentService.getAppointments(filter, pagination);

    res.json({
      success: true,
      data: result.data,
      meta: {
        date: today.toISOString().split('T')[0],
        count: result.data?.length || 0,
        professionalId: req.query.professionalId,
      },
    });
  });

  /**
   * Get revenue summary
   */
  getRevenueSummary = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const period = req.query.period as string || 'month'; // day, week, month, year

    let startDate: Date;
    const endDate = new Date();

    switch (period) {
      case 'day':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'month':
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const statistics = await appointmentService.getAppointmentStatistics(
      companyId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalRevenue: statistics.totalRevenue,
          averageTicket: statistics.averageTicket,
          totalAppointments: statistics.totalAppointments,
          completedAppointments: statistics.completedAppointments,
        },
        paymentBreakdown: statistics.paymentStatusBreakdown,
        dailyTrend: statistics.dailyStats,
      },
    });
  });

  /**
   * Export appointments data
   */
  exportAppointments = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date range
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const format = req.query.format as string || 'json';

    const filter: AppointmentFilter = {
      companyId,
      startDate,
      endDate,
      status: req.query.status as any,
      professionalId: req.query.professionalId as string,
    };

    // Get all appointments for export (high limit)
    const result = await appointmentService.getAppointments(filter, {
      page: 1,
      limit: 10000,
      sortBy: 'startTime',
      sortOrder: 'asc',
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'ID,Customer Name,Customer Phone,Service,Professional,Start Time,End Time,Duration,Amount,Payment Status,Status';
      const csvRows = result.data?.map(appointment => [
        appointment.id,
        appointment.customerName,
        appointment.customerPhone || '',
        appointment.service.name,
        appointment.professional.name,
        appointment.startTime.toISOString(),
        appointment.endTime.toISOString(),
        appointment.actualDuration,
        appointment.totalAmount,
        appointment.paymentStatus,
        appointment.status,
      ].join(',')).join('\n') || '';

      const csvContent = `${csvHeader}\n${csvRows}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
      res.send(csvContent);
    } else {
      // Return JSON format
      res.json({
        success: true,
        data: result.data,
        meta: {
          exported: result.data?.length || 0,
          format,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
      });
    }
  });
}

export const appointmentController = new AppointmentController();