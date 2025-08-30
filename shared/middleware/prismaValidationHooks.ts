/**
 * Prisma Validation Hooks
 * Middleware for Prisma that validates cross-module references at the database level
 */

import { Prisma } from '@prisma/client';
import { ModuleIntegrator } from '../integrators/ModuleIntegrator';
import { Logger } from '../utils/logger';

const logger = new Logger('PrismaValidationHooks');

interface ValidationConfig {
  customerIdField?: string;
  professionalIdField?: string;
  serviceIdField?: string;
  userIdField?: string;
  companyIdField?: string;
  appointmentIdField?: string;
}

export class PrismaValidationHooks {
  
  /**
   * Create validation middleware for a specific model
   * @param modelName - Name of the Prisma model
   * @param config - Configuration for which fields to validate
   */
  static createValidationMiddleware(
    modelName: string, 
    config: ValidationConfig = {}
  ) {
    return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
      // Only validate on CREATE and UPDATE operations
      if (!['create', 'update', 'upsert'].includes(params.action)) {
        return next(params);
      }

      try {
        const data = params.action === 'upsert' ? params.args.create || params.args.update : params.args.data;
        
        if (!data) {
          return next(params);
        }

        logger.info(`Validating cross-module references for ${modelName}.${params.action}`);

        const validations = [];

        // Extract company ID for multi-tenant validation
        const companyId = data[config.companyIdField || 'companyId'] || data[config.companyIdField || 'company_id'];
        
        if (!companyId) {
          logger.warn(`No company ID found for ${modelName} validation`);
          // Allow the operation to continue without validation if no company ID
          return next(params);
        }

        // Build validations array
        if (config.customerIdField && data[config.customerIdField]) {
          validations.push({
            type: 'customer' as const,
            id: data[config.customerIdField],
            companyId,
            key: 'customer'
          });
        }

        if (config.professionalIdField && data[config.professionalIdField]) {
          validations.push({
            type: 'professional' as const,
            id: data[config.professionalIdField],
            companyId,
            key: 'professional'
          });
        }

        if (config.serviceIdField && data[config.serviceIdField]) {
          validations.push({
            type: 'service' as const,
            id: data[config.serviceIdField],
            companyId,
            key: 'service'
          });
        }

        if (config.userIdField && data[config.userIdField]) {
          validations.push({
            type: 'user' as const,
            id: data[config.userIdField],
            companyId,
            key: 'user'
          });
        }

        if (config.appointmentIdField && data[config.appointmentIdField]) {
          validations.push({
            type: 'appointment' as const,
            id: data[config.appointmentIdField],
            companyId,
            key: 'appointment'
          });
        }

        // Validate company reference
        if (companyId) {
          validations.push({
            type: 'company' as const,
            id: companyId,
            companyId,
            key: 'company'
          });
        }

        // Skip validation if no references to validate
        if (validations.length === 0) {
          return next(params);
        }

        logger.info(`Performing ${validations.length} cross-module validations for ${modelName}`);

        // Perform batch validation
        const results = await ModuleIntegrator.validateBatch(validations);

        // Check for validation failures
        const failures = [];
        Object.entries(results).forEach(([key, result]) => {
          if (!result.exists) {
            const validation = validations.find(v => v.key === key);
            if (validation) {
              failures.push({
                field: config[`${validation.type}IdField` as keyof ValidationConfig] || `${validation.type}Id`,
                value: validation.id,
                error: result.error || `${validation.type} does not exist`,
                type: validation.type
              });
            }
          }
        });

        if (failures.length > 0) {
          const errorMessage = `Foreign key validation failed for ${modelName}: ${
            failures.map(f => `${f.field}=${f.value} (${f.error})`).join(', ')
          }`;
          
          logger.error(errorMessage, { modelName, failures, data });
          
          throw new Error(errorMessage);
        }

        logger.info(`Cross-module validation successful for ${modelName}`);
        return next(params);

      } catch (error: any) {
        logger.error(`Prisma validation middleware error for ${modelName}:`, error);
        
        // Re-throw validation errors
        if (error.message.includes('Foreign key validation failed')) {
          throw error;
        }

        // For other errors, log but allow operation to continue
        logger.warn(`Validation error ignored for ${modelName}, allowing operation to proceed:`, error.message);
        return next(params);
      }
    };
  }

  /**
   * Services module validation middleware
   */
  static servicesValidationMiddleware() {
    return this.createValidationMiddleware('AppointmentCompleted', {
      customerIdField: 'customerId',
      professionalIdField: 'professionalId',
      serviceIdField: 'serviceId',
      companyIdField: 'companyId'
    });
  }

  /**
   * Agendamento module validation middleware
   */
  static agendamentoValidationMiddleware() {
    return this.createValidationMiddleware('Appointment', {
      customerIdField: 'customer_id',
      professionalIdField: 'professional_id',
      serviceIdField: 'service_id',
      userIdField: 'created_by',
      companyIdField: 'company_id'
    });
  }

  /**
   * CRM module validation middleware
   */
  static crmValidationMiddleware() {
    return this.createValidationMiddleware('CustomerInteraction', {
      serviceIdField: 'relatedServiceId',
      userIdField: 'createdBy',
      companyIdField: 'companyId'
    });
  }

  /**
   * Generic validation middleware factory
   * @param modelConfig - Configuration for each model
   */
  static createModuleValidationMiddleware(modelConfigs: { [modelName: string]: ValidationConfig }) {
    return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
      const modelName = params.model;
      
      if (!modelName || !modelConfigs[modelName]) {
        return next(params);
      }

      const modelMiddleware = this.createValidationMiddleware(modelName, modelConfigs[modelName]);
      return modelMiddleware(params, next);
    };
  }

  /**
   * Logging middleware for debugging validation
   */
  static loggingMiddleware() {
    return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
      const before = Date.now();
      
      logger.debug(`Prisma ${params.model}.${params.action}`, {
        model: params.model,
        action: params.action,
        hasData: !!params.args?.data
      });

      try {
        const result = await next(params);
        const after = Date.now();
        
        logger.debug(`Prisma ${params.model}.${params.action} completed`, {
          model: params.model,
          action: params.action,
          duration: `${after - before}ms`,
          success: true
        });

        return result;
      } catch (error: any) {
        const after = Date.now();
        
        logger.error(`Prisma ${params.model}.${params.action} failed`, {
          model: params.model,
          action: params.action,
          duration: `${after - before}ms`,
          error: error.message
        });

        throw error;
      }
    };
  }

  /**
   * Audit middleware for tracking changes
   */
  static auditMiddleware(moduleName: string) {
    return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
      const result = await next(params);

      // Only audit write operations
      if (['create', 'update', 'delete', 'upsert'].includes(params.action)) {
        try {
          const data = params.args?.data;
          const companyId = data?.companyId || data?.company_id;
          
          if (companyId) {
            logger.info(`Audit: ${moduleName}.${params.model}.${params.action}`, {
              module: moduleName,
              model: params.model,
              action: params.action,
              companyId,
              hasResult: !!result,
              timestamp: new Date().toISOString()
            });
          }
        } catch (auditError) {
          logger.warn('Audit logging failed:', auditError);
        }
      }

      return result;
    };
  }
}

export default PrismaValidationHooks;