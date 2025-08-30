import { Request, Response } from 'express';
import { integrationService } from '../services/integrationService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import { NotFoundError } from '../types';

export class IntegrationController {
  /**
   * Get customer from CRM
   */
  getCustomer = asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;

    const customer = await integrationService.getCustomerFromCRM(customerId);

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    res.json({
      success: true,
      data: customer,
      source: 'crm',
    });
  });

  /**
   * Search customers in CRM
   */
  searchCustomers = asyncHandler(async (req: Request, res: Response) => {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
        code: 'MISSING_QUERY',
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 50',
        code: 'INVALID_LIMIT',
      });
    }

    const customers = await integrationService.searchCustomersInCRM(query, limit);

    res.json({
      success: true,
      data: customers,
      source: 'crm',
      meta: {
        query,
        count: customers.length,
        limit,
      },
    });
  });

  /**
   * Create note for customer in CRM
   */
  createCustomerNote = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { customerId } = req.params;
    const { content, type, metadata } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Note content is required',
        code: 'MISSING_CONTENT',
      });
    }

    const validTypes = ['general', 'service', 'appointment', 'payment'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid note type. Valid types: ${validTypes.join(', ')}`,
        code: 'INVALID_TYPE',
      });
    }

    const note = {
      customerId,
      content: content.trim(),
      type: type || 'general',
      metadata: metadata || {},
    };

    const success = await integrationService.createNoteInCRM(customerId, note);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create note in CRM',
        code: 'CRM_ERROR',
      });
    }

    logger.info('Customer note created via API', {
      customerId,
      noteType: note.type,
      userId: user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Note created successfully in CRM',
      data: {
        customerId,
        type: note.type,
        createdAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get user profile from User Management
   */
  getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const userProfile = await integrationService.getUserProfile(userId);

    if (!userProfile) {
      throw new NotFoundError('User');
    }

    res.json({
      success: true,
      data: userProfile,
      source: 'user-management',
    });
  });

  /**
   * Sync professional data with User Management
   */
  syncProfessionalData = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { professionalId } = req.params;
    const { userId, name, email, phone, specialties } = req.body;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!userId || !name || !email) {
      return res.status(400).json({
        success: false,
        error: 'userId, name, and email are required',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const professionalData = {
      name,
      email,
      phone,
      specialties: specialties || [],
    };

    const success = await integrationService.syncProfessionalWithUserManagement(
      professionalId,
      userId,
      professionalData
    );

    logger.info('Professional data synced via API', {
      professionalId,
      userId,
      syncSuccess: success,
      requestedBy: user.id,
    });

    res.json({
      success: true,
      message: success 
        ? 'Professional data synced successfully'
        : 'Professional data sync completed with warnings',
      data: {
        professionalId,
        userId,
        syncedAt: new Date().toISOString(),
        status: success ? 'success' : 'partial',
      },
    });
  });

  /**
   * Notify CRM about service completion
   */
  notifyServiceCompletion = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { customerId } = req.params;
    const { 
      appointmentId, 
      serviceName, 
      professionalName, 
      totalAmount, 
      completionDate, 
      notes 
    } = req.body;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!appointmentId || !serviceName || !professionalName || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'appointmentId, serviceName, professionalName, and totalAmount are required',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const appointmentData = {
      appointmentId,
      serviceName,
      professionalName,
      totalAmount: parseFloat(totalAmount.toString()),
      completionDate: completionDate ? new Date(completionDate) : new Date(),
      notes: notes || undefined,
    };

    const success = await integrationService.notifyCRMServiceCompleted(customerId, appointmentData);

    logger.info('Service completion notified via API', {
      customerId,
      appointmentId,
      notificationSuccess: success,
      userId: user.id,
    });

    res.json({
      success: true,
      message: success 
        ? 'CRM notified successfully about service completion'
        : 'CRM notification attempt completed',
      data: {
        customerId,
        appointmentId,
        notifiedAt: new Date().toISOString(),
        status: success ? 'success' : 'failed',
      },
    });
  });

  /**
   * Batch update customer data in CRM
   */
  batchUpdateCustomerData = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { updates } = req.body;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required and cannot be empty',
        code: 'MISSING_UPDATES',
      });
    }

    // Validate each update
    for (const update of updates) {
      if (!update.customerId || !update.appointmentData) {
        return res.status(400).json({
          success: false,
          error: 'Each update must have customerId and appointmentData',
          code: 'INVALID_UPDATE_FORMAT',
        });
      }
    }

    if (updates.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 updates allowed per batch',
        code: 'BATCH_SIZE_LIMIT',
      });
    }

    const result = await integrationService.batchUpdateCustomerData(updates);

    logger.info('Batch customer data update completed via API', {
      total: updates.length,
      success: result.success,
      failed: result.failed,
      userId: user.id,
    });

    res.json({
      success: true,
      message: `Batch update completed: ${result.success} successful, ${result.failed} failed`,
      data: {
        total: updates.length,
        successful: result.success,
        failed: result.failed,
        processedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get module health status
   */
  getModuleHealth = asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = await integrationService.getModuleHealthStatus();

    const overallHealthy = Object.values(healthStatus).every(module => module.status === 'healthy');

    res.json({
      success: true,
      data: {
        overall: overallHealthy ? 'healthy' : 'degraded',
        modules: healthStatus,
        checkedAt: new Date().toISOString(),
      },
      meta: {
        checkType: 'module-health',
        modulesChecked: Object.keys(healthStatus).length,
      },
    });
  });

  /**
   * Clear integration caches
   */
  clearCaches = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const pattern = req.query.pattern as string;
    const clearedCount = await integrationService.clearIntegrationCaches(pattern);

    logger.info('Integration caches cleared via API', {
      pattern,
      clearedCount,
      userId: user.id,
    });

    res.json({
      success: true,
      message: `${clearedCount} cache entries cleared`,
      data: {
        pattern,
        clearedCount,
        clearedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Test integration connectivity
   */
  testConnectivity = asyncHandler(async (req: Request, res: Response) => {
    const { module } = req.params;
    const validModules = ['crm', 'user-management', 'all'];

    if (!validModules.includes(module)) {
      return res.status(400).json({
        success: false,
        error: `Invalid module. Valid options: ${validModules.join(', ')}`,
        code: 'INVALID_MODULE',
      });
    }

    let testResults: any = {};

    if (module === 'all') {
      testResults = await integrationService.getModuleHealthStatus();
    } else {
      // Test specific module
      const healthStatus = await integrationService.getModuleHealthStatus();
      
      if (module === 'crm') {
        testResults.crm = healthStatus.crm;
      } else if (module === 'user-management') {
        testResults.userManagement = healthStatus.userManagement;
      }
    }

    // Additional connectivity tests
    const connectivityTests = {
      ...testResults,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: connectivityTests,
      meta: {
        testType: 'connectivity',
        testedModule: module,
      },
    });
  });

  // ========================================
  // CRITICAL INTEGRATION APIS FOR AGENDAMENTO
  // ========================================

  /**
   * Get services list for Agendamento module
   * Endpoint: GET /api/integrations/services/list
   */
  getServicesList = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      // Get active services only for agendamento
      const services = await integrationService.getServicesForAgendamento(companyId);

      res.json({
        success: true,
        data: services,
        source: 'services',
        meta: {
          count: services.length,
          companyId,
          retrievedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get services list for Agendamento', {
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve services list',
        code: 'SERVICES_RETRIEVAL_ERROR',
      });
    }
  });

  /**
   * Get professionals list for Agendamento module
   * Endpoint: GET /api/integrations/professionals/list
   */
  getProfessionalsList = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { service_id } = req.query;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      const professionals = await integrationService.getProfessionalsForAgendamento(
        companyId,
        service_id as string
      );

      res.json({
        success: true,
        data: professionals,
        source: 'services',
        meta: {
          count: professionals.length,
          companyId,
          serviceId: service_id || null,
          retrievedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get professionals list for Agendamento', {
        companyId,
        serviceId: service_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve professionals list',
        code: 'PROFESSIONALS_RETRIEVAL_ERROR',
      });
    }
  });

  /**
   * Check professional availability for Agendamento module
   * Endpoint: GET /api/integrations/professionals/:id/availability
   */
  getProfessionalAvailability = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate query parameters using Zod schema
    try {
      const { ProfessionalAvailabilityQuerySchema } = await import('../types');
      const validatedQuery = ProfessionalAvailabilityQuerySchema.parse({
        date: req.query.date,
        service_id: req.query.service_id,
      });

      const { date, service_id } = validatedQuery;

      try {
        const availability = await integrationService.getProfessionalAvailability(
          id,
          companyId,
          date,
          service_id
        );

        res.json({
          success: true,
          data: availability,
          meta: {
            professionalId: id,
            date,
            serviceId: service_id,
            companyId,
            checkedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Failed to check professional availability', {
          professionalId: id,
          companyId,
          date,
          serviceId: service_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
          success: false,
          error: 'Failed to check professional availability',
          code: 'AVAILABILITY_CHECK_ERROR',
        });
      }
    } catch (validationError: any) {
      logger.warn('Professional availability query validation failed', {
        professionalId: id,
        companyId,
        query: req.query,
        error: validationError.message,
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: validationError.errors || validationError.message,
      });
    }
  });

  /**
   * Complete appointment - callback from Agendamento module
   * Endpoint: POST /api/integrations/appointments/:id/complete
   */
  completeAppointment = asyncHandler(async (req: Request, res: Response) => {
    const { user, companyId } = req;
    const { id } = req.params;

    if (!user || !companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body using Zod schema
    try {
      const { CompleteAppointmentBodySchema } = await import('../types');
      const validatedData = CompleteAppointmentBodySchema.parse(req.body);

      const {
        customer_id,
        professional_id,
        service_id,
        completed_at,
        notes,
        photos,
        payment_status,
        payment_amount,
        payment_method,
      } = validatedData;

      try {
        const completedAppointment = await integrationService.completeAppointmentFromAgendamento({
          appointmentId: id,
          companyId,
          customerId: customer_id,
          professionalId: professional_id,
          serviceId: service_id,
          completedAt: new Date(completed_at),
          notes: notes || undefined,
          photos: photos || [],
          paymentStatus: payment_status || 'PENDING',
          paymentAmount: payment_amount,
          paymentMethod: payment_method || undefined,
          completedByUserId: user.id,
        });

        // Update CRM with visit information
        try {
          await integrationService.notifyCRMServiceCompleted(customer_id, {
            appointmentId: id,
            serviceName: completedAppointment.serviceName,
            professionalName: completedAppointment.professionalName,
            totalAmount: completedAppointment.totalAmount,
            completionDate: new Date(completed_at),
            notes,
          });
        } catch (crmError) {
          logger.warn('Failed to notify CRM about completed appointment', {
            appointmentId: id,
            customerId: customer_id,
            error: crmError instanceof Error ? crmError.message : 'Unknown error',
          });
        }

        logger.info('Appointment completed via Agendamento integration', {
          appointmentId: id,
          completedAppointmentId: completedAppointment.id,
          customerId: customer_id,
          professionalId: professional_id,
          serviceId: service_id,
          amount: payment_amount,
          userId: user.id,
          companyId,
        });

        res.status(201).json({
          success: true,
          data: {
            completedAppointmentId: completedAppointment.id,
            appointmentId: id,
            customerId: customer_id,
            professionalId: professional_id,
            serviceId: service_id,
            totalAmount: completedAppointment.totalAmount,
            paymentStatus: completedAppointment.paymentStatus,
            completedAt: completedAppointment.completedAt.toISOString(),
            createdAt: completedAppointment.createdAt.toISOString(),
          },
          message: 'Appointment marked as completed successfully',
        });
      } catch (error) {
        logger.error('Failed to complete appointment from Agendamento', {
          appointmentId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id,
          companyId,
        });

        return res.status(500).json({
          success: false,
          error: 'Failed to complete appointment',
          code: 'APPOINTMENT_COMPLETION_ERROR',
        });
      }
    } catch (validationError: any) {
      logger.warn('Complete appointment body validation failed', {
        appointmentId: id,
        companyId,
        userId: user.id,
        body: req.body,
        error: validationError.message,
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: validationError.errors || validationError.message,
      });
    }
  });

  /**
   * Get integration statistics
   */
  getIntegrationStats = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // This would typically aggregate statistics about integration usage
    // For now, we'll return mock statistics
    const stats = {
      crmIntegration: {
        customersQueried: 0, // Would be tracked in Redis or database
        notesCreated: 0,
        lastSync: null,
        status: 'active',
      },
      userManagementIntegration: {
        validationsPerformed: 0,
        profilesQueried: 0,
        lastSync: null,
        status: 'active',
      },
      overallHealth: {
        uptime: process.uptime(),
        lastHealthCheck: new Date().toISOString(),
        errorRate: 0, // Would be calculated from logs
      },
    };

    res.json({
      success: true,
      data: stats,
      meta: {
        companyId,
        reportType: 'integration-statistics',
        generatedAt: new Date().toISOString(),
      },
    });
  });
}

export const integrationController = new IntegrationController();