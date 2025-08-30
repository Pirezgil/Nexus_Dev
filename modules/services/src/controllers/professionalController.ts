import { Request, Response } from 'express';
import { professionalService } from '../services/professionalService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import {
  ProfessionalInput,
  ProfessionalUpdate,
  ProfessionalFilter,
  PaginationParams,
  ProfessionalCreateSchema,
  ProfessionalUpdateSchema,
  PaginationSchema,
  NotFoundError,
  WorkSchedule,
} from '../types';

export class ProfessionalController {
  /**
   * Create a new professional
   */
  createProfessional = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    
    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body
    const validatedData = ProfessionalCreateSchema.parse({
      ...req.body,
      companyId,
    });

    const professional = await professionalService.createProfessional(validatedData, user.id);

    logger.info('Professional created via API', {
      professionalId: professional.id,
      professionalName: professional.name,
      userId: user.id,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: professional,
      message: 'Professional created successfully',
    });
  });

  /**
   * Get professional by ID
   */
  getProfessionalById = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const professional = await professionalService.getProfessionalById(id, companyId);

    if (!professional) {
      throw new NotFoundError('Professional');
    }

    res.json({
      success: true,
      data: professional,
    });
  });

  /**
   * Get professionals with pagination and filters
   */
  getProfessionals = asyncHandler(async (req: Request, res: Response) => {
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
    const filter: ProfessionalFilter = {
      companyId,
      status: req.query.status as any,
      specialties: req.query.specialties ? 
        (typeof req.query.specialties === 'string' ? 
          req.query.specialties.split(',') : 
          req.query.specialties as string[]
        ) : undefined,
      search: req.query.search as string,
    };

    const result = await professionalService.getProfessionals(filter, pagination);

    res.json(result);
  });

  /**
   * Update professional
   */
  updateProfessional = asyncHandler(async (req: Request, res: Response) => {
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
    const validatedData = ProfessionalUpdateSchema.parse(req.body);

    const professional = await professionalService.updateProfessional(id, validatedData, companyId, user.id);

    logger.info('Professional updated via API', {
      professionalId: id,
      userId: user.id,
      companyId,
      changes: Object.keys(validatedData),
    });

    res.json({
      success: true,
      data: professional,
      message: 'Professional updated successfully',
    });
  });

  /**
   * Delete professional
   */
  deleteProfessional = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    await professionalService.deleteProfessional(id, companyId, user.id);

    logger.info('Professional deleted via API', {
      professionalId: id,
      userId: user.id,
      companyId,
    });

    res.json({
      success: true,
      message: 'Professional deleted successfully',
    });
  });

  /**
   * Get professional statistics
   */
  getProfessionalStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

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

    const statistics = await professionalService.getProfessionalStatistics(
      companyId, 
      id, 
      startDate, 
      endDate
    );

    res.json({
      success: true,
      data: statistics,
      meta: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    });
  });

  /**
   * Get available professionals for a time slot
   */
  getAvailableProfessionals = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { startTime, endTime } = req.query;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required',
        code: 'MISSING_PARAMETERS',
      });
    }

    const startDateTime = new Date(startTime as string);
    const endDateTime = new Date(endTime as string);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        code: 'INVALID_DATE',
      });
    }

    if (startDateTime >= endDateTime) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time',
        code: 'INVALID_TIME_RANGE',
      });
    }

    const serviceId = req.query.serviceId as string;
    const professionals = await professionalService.getAvailableProfessionals(
      companyId,
      startDateTime,
      endDateTime,
      serviceId
    );

    res.json({
      success: true,
      data: professionals,
      meta: {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        serviceId,
        count: professionals.length,
      },
    });
  });

  /**
   * Update professional work schedule
   */
  updateWorkSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { workSchedule } = req.body;

    if (!workSchedule || typeof workSchedule !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Work schedule is required',
        code: 'MISSING_WORK_SCHEDULE',
      });
    }

    const professional = await professionalService.updateWorkSchedule(
      id,
      workSchedule as WorkSchedule,
      companyId,
      user.id
    );

    logger.info('Professional work schedule updated via API', {
      professionalId: id,
      userId: user.id,
      companyId,
    });

    res.json({
      success: true,
      data: professional,
      message: 'Work schedule updated successfully',
    });
  });

  /**
   * Search professionals
   */
  searchProfessionals = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { q: query } = req.query;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
        code: 'MISSING_QUERY',
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const professionals = await professionalService.searchProfessionals(query, companyId, limit);

    res.json({
      success: true,
      data: professionals,
      meta: {
        query,
        count: professionals.length,
      },
    });
  });

  /**
   * Get professional specialties
   */
  getProfessionalSpecialties = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get all professionals to extract unique specialties
    const result = await professionalService.getProfessionals(
      { companyId },
      { page: 1, limit: 1000, sortBy: 'name', sortOrder: 'asc' }
    );

    const specialtiesSet = new Set<string>();
    result.data?.forEach(professional => {
      professional.specialties.forEach(specialty => {
        if (specialty && specialty.trim() !== '') {
          specialtiesSet.add(specialty.trim());
        }
      });
    });

    const uniqueSpecialties = Array.from(specialtiesSet).sort();

    res.json({
      success: true,
      data: uniqueSpecialties,
      meta: {
        count: uniqueSpecialties.length,
      },
    });
  });

  /**
   * Get professional performance summary
   */
  getPerformanceSummary = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get all professionals with basic stats
    const result = await professionalService.getProfessionals(
      { companyId, status: 'ACTIVE' },
      { page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }
    );

    // Get performance data for each professional
    const performanceSummaries = await Promise.all(
      result.data?.map(async (professional) => {
        const stats = await professionalService.getProfessionalStatistics(
          companyId,
          professional.id
        );
        
        return {
          id: professional.id,
          name: professional.name,
          email: professional.email,
          specialties: professional.specialties,
          ...stats,
        };
      }) || []
    );

    // Sort by total revenue (descending)
    performanceSummaries.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      data: performanceSummaries,
      meta: {
        count: performanceSummaries.length,
        totalProfessionals: result.pagination?.total || 0,
      },
    });
  });

  /**
   * Get professional upcoming appointments
   */
  getUpcomingAppointments = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const days = parseInt(req.query.days as string) || 7;

    // This would typically call appointmentService, but for now we'll mock it
    // const appointments = await appointmentService.getUpcomingAppointments(id, companyId, days);

    res.json({
      success: true,
      data: [], // Mock empty data for now
      meta: {
        professionalId: id,
        days,
        count: 0,
      },
      message: 'Feature coming soon - upcoming appointments',
    });
  });
}

export const professionalController = new ProfessionalController();