import { Request, Response } from 'express';
import { serviceService } from '../services/serviceService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import {
  ServiceInput,
  ServiceUpdate,
  ServiceFilter,
  PaginationParams,
  ServiceCreateSchema,
  ServiceUpdateSchema,
  PaginationSchema,
  NotFoundError,
} from '../types';

export class ServiceController {
  /**
   * Create a new service
   */
  createService = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    
    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body
    const validatedData = ServiceCreateSchema.parse({
      ...req.body,
      companyId,
    });

    const service = await serviceService.createService(validatedData, user.id);

    logger.info('Service created via API', {
      serviceId: service.id,
      serviceName: service.name,
      userId: user.id,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: service,
      message: 'Service created successfully',
    });
  });

  /**
   * Get service by ID
   */
  getServiceById = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const service = await serviceService.getServiceById(id, companyId);

    if (!service) {
      throw new NotFoundError('Service');
    }

    res.json({
      success: true,
      data: service,
    });
  });

  /**
   * Get services with pagination and filters
   */
  getServices = asyncHandler(async (req: Request, res: Response) => {
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
    const filter: ServiceFilter = {
      companyId,
      status: req.query.status as any,
      category: req.query.category as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      search: req.query.search as string,
    };

    const result = await serviceService.getServices(filter, pagination);

    res.json(result);
  });

  /**
   * Update service
   */
  updateService = asyncHandler(async (req: Request, res: Response) => {
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
    const validatedData = ServiceUpdateSchema.parse(req.body);

    const service = await serviceService.updateService(id, validatedData, companyId, user.id);

    logger.info('Service updated via API', {
      serviceId: id,
      userId: user.id,
      companyId,
      changes: Object.keys(validatedData),
    });

    res.json({
      success: true,
      data: service,
      message: 'Service updated successfully',
    });
  });

  /**
   * Delete service
   */
  deleteService = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    await serviceService.deleteService(id, companyId, user.id);

    logger.info('Service deleted via API', {
      serviceId: id,
      userId: user.id,
      companyId,
    });

    res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  });

  /**
   * Get service statistics
   */
  getServiceStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const statistics = await serviceService.getServiceStatistics(companyId, id);

    res.json({
      success: true,
      data: statistics,
    });
  });

  /**
   * Get popular services
   */
  getPopularServices = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const services = await serviceService.getPopularServices(companyId, limit);

    res.json({
      success: true,
      data: services,
    });
  });

  /**
   * Search services
   */
  searchServices = asyncHandler(async (req: Request, res: Response) => {
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
    const services = await serviceService.searchServices(query, companyId, limit);

    res.json({
      success: true,
      data: services,
      meta: {
        query,
        count: services.length,
      },
    });
  });

  /**
   * Bulk update service prices
   */
  bulkUpdatePrices = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required',
        code: 'INVALID_INPUT',
      });
    }

    // Validate each update
    for (const update of updates) {
      if (!update.serviceId || typeof update.newPrice !== 'number' || update.newPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'Each update must have serviceId and positive newPrice',
          code: 'INVALID_UPDATE',
        });
      }
    }

    await serviceService.bulkUpdatePrices(companyId, updates, user.id);

    logger.info('Bulk service price update completed via API', {
      userId: user.id,
      companyId,
      serviceCount: updates.length,
    });

    res.json({
      success: true,
      message: `Successfully updated prices for ${updates.length} services`,
    });
  });

  /**
   * Get service categories
   */
  getServiceCategories = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get unique categories from services
    const categories = await serviceService.getServices(
      { companyId },
      { page: 1, limit: 1000, sortBy: 'category', sortOrder: 'asc' }
    );

    const uniqueCategories = [
      ...new Set(
        categories.data
          ?.map(service => service.category)
          .filter(category => category && category.trim() !== '')
      ),
    ].sort();

    res.json({
      success: true,
      data: uniqueCategories,
      meta: {
        count: uniqueCategories.length,
      },
    });
  });

  /**
   * Duplicate service
   */
  duplicateService = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Get the original service
    const originalService = await serviceService.getServiceById(id, companyId, false);
    
    if (!originalService) {
      throw new NotFoundError('Service');
    }

    // Create duplicate with modified name
    const duplicateData: ServiceInput = {
      companyId,
      name: `${originalService.name} (Copy)`,
      description: originalService.description || undefined,
      duration: originalService.duration,
      price: originalService.price,
      category: originalService.category || undefined,
      requirements: originalService.requirements || undefined,
      metadata: originalService.metadata || undefined,
    };

    const newService = await serviceService.createService(duplicateData, user.id);

    logger.info('Service duplicated via API', {
      originalServiceId: id,
      newServiceId: newService.id,
      userId: user.id,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: newService,
      message: 'Service duplicated successfully',
    });
  });
}

export const serviceController = new ServiceController();