/**
 * Cross-Module Validation Middleware
 * Provides middleware functions for validating foreign key references across modules
 */

import { Request, Response, NextFunction } from 'express';
import { ModuleIntegrator, ValidationResult } from '../integrators/ModuleIntegrator';
import { Logger } from '../utils/logger';

const logger = new Logger('CrossModuleValidation');

interface ValidationError {
  field: string;
  value: string;
  message: string;
  module: string;
}

export class CrossModuleValidationMiddleware {

  /**
   * Validate customer reference exists in CRM module
   */
  static validateCustomerReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.body.customerId || req.body.customer_id;
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!customerId) {
        return next(); // Skip validation if no customer ID provided
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for customer validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating customer reference: ${customerId} for company ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateCustomer(customerId, companyId);

      if (!validation.exists) {
        logger.warn(`Customer validation failed: ${customerId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'Customer not found or validation failed',
          details: {
            field: 'customerId',
            value: customerId,
            message: validation.error || 'Customer does not exist in CRM module',
            module: 'crm'
          },
          code: 'INVALID_CUSTOMER_REFERENCE'
        });
      }

      // Store customer data in request for potential use
      req.validatedCustomer = validation.data;
      logger.info(`Customer validation successful: ${customerId}`);
      next();

    } catch (error: any) {
      logger.error('Customer validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during customer validation',
        code: 'CUSTOMER_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate professional reference exists in Services module
   */
  static validateProfessionalReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const professionalId = req.body.professionalId || req.body.professional_id;
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!professionalId) {
        return next(); // Skip validation if no professional ID provided
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for professional validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating professional reference: ${professionalId} for company ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateProfessional(professionalId, companyId);

      if (!validation.exists) {
        logger.warn(`Professional validation failed: ${professionalId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'Professional not found or validation failed',
          details: {
            field: 'professionalId',
            value: professionalId,
            message: validation.error || 'Professional does not exist in Services module',
            module: 'services'
          },
          code: 'INVALID_PROFESSIONAL_REFERENCE'
        });
      }

      // Store professional data in request for potential use
      req.validatedProfessional = validation.data;
      logger.info(`Professional validation successful: ${professionalId}`);
      next();

    } catch (error: any) {
      logger.error('Professional validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during professional validation',
        code: 'PROFESSIONAL_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate service reference exists in Services module
   */
  static validateServiceReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceId = req.body.serviceId || req.body.service_id;
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!serviceId) {
        return next(); // Skip validation if no service ID provided
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for service validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating service reference: ${serviceId} for company ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateService(serviceId, companyId);

      if (!validation.exists) {
        logger.warn(`Service validation failed: ${serviceId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'Service not found or validation failed',
          details: {
            field: 'serviceId',
            value: serviceId,
            message: validation.error || 'Service does not exist in Services module',
            module: 'services'
          },
          code: 'INVALID_SERVICE_REFERENCE'
        });
      }

      // Store service data in request for potential use
      req.validatedService = validation.data;
      logger.info(`Service validation successful: ${serviceId}`);
      next();

    } catch (error: any) {
      logger.error('Service validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during service validation',
        code: 'SERVICE_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate user reference exists in Auth module
   */
  static validateUserReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.userId || req.body.user_id || req.body.created_by || req.body.updated_by;
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!userId) {
        return next(); // Skip validation if no user ID provided
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for user validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating user reference: ${userId} for company ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateUser(userId, companyId);

      if (!validation.exists) {
        logger.warn(`User validation failed: ${userId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'User not found or validation failed',
          details: {
            field: 'userId',
            value: userId,
            message: validation.error || 'User does not exist in Auth module',
            module: 'user-management'
          },
          code: 'INVALID_USER_REFERENCE'
        });
      }

      // Store user data in request for potential use
      req.validatedUser = validation.data;
      logger.info(`User validation successful: ${userId}`);
      next();

    } catch (error: any) {
      logger.error('User validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during user validation',
        code: 'USER_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate company reference exists in Auth module
   */
  static validateCompanyReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating company reference: ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateCompany(companyId);

      if (!validation.exists) {
        logger.warn(`Company validation failed: ${companyId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'Company not found or validation failed',
          details: {
            field: 'companyId',
            value: companyId,
            message: validation.error || 'Company does not exist in Auth module',
            module: 'user-management'
          },
          code: 'INVALID_COMPANY_REFERENCE'
        });
      }

      // Store company data in request for potential use
      req.validatedCompany = validation.data;
      logger.info(`Company validation successful: ${companyId}`);
      next();

    } catch (error: any) {
      logger.error('Company validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during company validation',
        code: 'COMPANY_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Validate appointment reference exists in Agendamento module
   */
  static validateAppointmentReference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointmentId = req.body.appointmentId || req.body.appointment_id;
      const companyId = req.headers['x-company-id'] as string || req.body.companyId || req.body.company_id;

      if (!appointmentId) {
        return next(); // Skip validation if no appointment ID provided
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for appointment validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      logger.info(`Validating appointment reference: ${appointmentId} for company ${companyId}`);

      const validation: ValidationResult = await ModuleIntegrator.validateAppointment(appointmentId, companyId);

      if (!validation.exists) {
        logger.warn(`Appointment validation failed: ${appointmentId}`, validation.error);
        
        return res.status(400).json({
          success: false,
          error: 'Appointment not found or validation failed',
          details: {
            field: 'appointmentId',
            value: appointmentId,
            message: validation.error || 'Appointment does not exist in Agendamento module',
            module: 'agendamento'
          },
          code: 'INVALID_APPOINTMENT_REFERENCE'
        });
      }

      // Store appointment data in request for potential use
      req.validatedAppointment = validation.data;
      logger.info(`Appointment validation successful: ${appointmentId}`);
      next();

    } catch (error: any) {
      logger.error('Appointment validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during appointment validation',
        code: 'APPOINTMENT_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Composite middleware for appointment creation (validates customer, professional, and service)
   */
  static validateAppointmentReferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customer_id, professional_id, service_id, company_id } = req.body;
      const companyId = req.headers['x-company-id'] as string || company_id;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company ID is required for appointment validation',
          code: 'COMPANY_ID_REQUIRED'
        });
      }

      const validations = [];

      // Validate customer
      if (customer_id) {
        validations.push({
          type: 'customer' as const,
          id: customer_id,
          companyId,
          key: 'customer'
        });
      }

      // Validate professional
      if (professional_id) {
        validations.push({
          type: 'professional' as const,
          id: professional_id,
          companyId,
          key: 'professional'
        });
      }

      // Validate service
      if (service_id) {
        validations.push({
          type: 'service' as const,
          id: service_id,
          companyId,
          key: 'service'
        });
      }

      if (validations.length === 0) {
        return next(); // No validations needed
      }

      logger.info(`Batch validating ${validations.length} references for appointment`);

      const results = await ModuleIntegrator.validateBatch(validations);

      const errors: ValidationError[] = [];

      // Check results
      Object.entries(results).forEach(([key, result]) => {
        if (!result.exists) {
          const validation = validations.find(v => v.key === key);
          if (validation) {
            errors.push({
              field: `${validation.type}Id`,
              value: validation.id,
              message: result.error || `${validation.type} does not exist`,
              module: validation.type === 'customer' ? 'crm' : 
                      validation.type === 'professional' || validation.type === 'service' ? 'services' : 
                      validation.type === 'user' ? 'user-management' : 'agendamento'
            });
          }
        }
      });

      if (errors.length > 0) {
        logger.warn(`Appointment validation failed with ${errors.length} errors`, errors);
        
        return res.status(400).json({
          success: false,
          error: 'One or more references are invalid',
          details: errors,
          code: 'INVALID_APPOINTMENT_REFERENCES'
        });
      }

      // Store validated data in request
      Object.entries(results).forEach(([key, result]) => {
        if (result.exists && result.data) {
          req[`validated${key.charAt(0).toUpperCase()}${key.slice(1)}`] = result.data;
        }
      });

      logger.info('All appointment references validated successfully');
      next();

    } catch (error: any) {
      logger.error('Appointment references validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal error during appointment validation',
        code: 'APPOINTMENT_VALIDATION_ERROR'
      });
    }
  };

  /**
   * Health check middleware
   */
  static healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const moduleHealth = await ModuleIntegrator.healthCheck();
      
      req.crossModuleHealth = moduleHealth;
      next();
    } catch (error: any) {
      logger.error('Cross-module health check failed:', error);
      req.crossModuleHealth = { error: error.message };
      next();
    }
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      validatedCustomer?: any;
      validatedProfessional?: any;
      validatedService?: any;
      validatedUser?: any;
      validatedCompany?: any;
      validatedAppointment?: any;
      crossModuleHealth?: { [module: string]: boolean } | { error: string };
    }
  }
}

export default CrossModuleValidationMiddleware;