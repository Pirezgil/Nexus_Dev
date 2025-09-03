/**
 * ModuleIntegrator - Cross-module communication and validation service
 * Handles foreign key validation between ERP Nexus modules to ensure referential integrity
 * 
 * This class provides centralized validation methods for cross-module references,
 * preventing orphaned data and ensuring referential consistency.
 */

import axios from 'axios';
import { Logger } from '../utils/logger';
import { HTTP_HEADERS } from '../constants/headers';
import { TIMEOUT_CONFIG } from '../config/timeouts';

/**
 * Custom error class for batch validation failures
 * Provides detailed information about which validation failed and why
 */
export class BatchValidationError extends Error {
  constructor(
    message: string,
    public failedValidationKey: string,
    public originalError: any,
    public failedValidationType: string
  ) {
    super(message);
    this.name = 'BatchValidationError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BatchValidationError);
    }
  }
}

export interface ValidationResult {
  exists: boolean;
  error?: string;
  data?: any;
}

export interface ModuleEndpoints {
  auth: string;
  crm: string;
  services: string;
  agendamento: string;
}

export class ModuleIntegrator {
  private static logger = new Logger('ModuleIntegrator');
  
  // Service endpoints configuration
  private static endpoints: ModuleEndpoints = {
    auth: process.env.USER_MANAGEMENT_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    crm: process.env.CRM_SERVICE_URL || 'http://localhost:3002', 
    services: process.env.SERVICES_SERVICE_URL || 'http://localhost:3003',
    agendamento: process.env.AGENDAMENTO_SERVICE_URL || 'http://localhost:3004'
  };

  /**
   * Validate if a customer exists in the CRM module
   * @param customerId - UUID of the customer
   * @param companyId - UUID of the company (multi-tenant)
   * @returns Promise<ValidationResult>
   */
  static async validateCustomer(customerId: string, companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating customer ${customerId} for company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.crm}/api/customers/${customerId}/validate`,
        {
          headers: {
            [HTTP_HEADERS.COMPANY_ID]: companyId,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.customer
      };
    } catch (error: any) {
      this.logger.error(`Failed to validate customer ${customerId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `Customer validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate if a professional exists in the Services module
   * @param professionalId - UUID of the professional
   * @param companyId - UUID of the company (multi-tenant)
   * @returns Promise<ValidationResult>
   */
  static async validateProfessional(professionalId: string, companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating professional ${professionalId} for company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.services}/api/professionals/${professionalId}/validate`,
        {
          headers: {
            [HTTP_HEADERS.COMPANY_ID]: companyId,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.professional
      };
    } catch (error: any) {
      this.logger.error(`Failed to validate professional ${professionalId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `Professional validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate if a service exists in the Services module
   * @param serviceId - UUID of the service
   * @param companyId - UUID of the company (multi-tenant)
   * @returns Promise<ValidationResult>
   */
  static async validateService(serviceId: string, companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating service ${serviceId} for company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.services}/api/services/${serviceId}/validate`,
        {
          headers: {
            [HTTP_HEADERS.COMPANY_ID]: companyId,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.service
      };
    } catch (error: any) {
      this.logger.error(`Failed to validate service ${serviceId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `Service validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate if a user exists in the Auth module
   * @param userId - UUID of the user
   * @param companyId - UUID of the company (multi-tenant)
   * @returns Promise<ValidationResult>
   */
  static async validateUser(userId: string, companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating user ${userId} for company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.auth}/api/users/${userId}/validate`,
        {
          headers: {
            [HTTP_HEADERS.COMPANY_ID]: companyId,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.user
      };
    } catch (error: any) {
      this.logger.error(`Failed to validate user ${userId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `User validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate if a company exists in the Auth module
   * @param companyId - UUID of the company
   * @returns Promise<ValidationResult>
   */
  static async validateCompany(companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.auth}/api/companies/${companyId}/validate`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      // Handle both old and new response formats
      if (response.data.success !== undefined) {
        // New format from company validation endpoint
        return {
          exists: response.data.success,
          data: response.data.data
        };
      } else {
        // Legacy format
        return {
          exists: response.data.exists,
          data: response.data.company
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to validate company ${companyId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `Company validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate if an appointment exists in the Agendamento module
   * @param appointmentId - UUID of the appointment
   * @param companyId - UUID of the company (multi-tenant)
   * @returns Promise<ValidationResult>
   */
  static async validateAppointment(appointmentId: string, companyId: string): Promise<ValidationResult> {
    try {
      this.logger.info(`Validating appointment ${appointmentId} for company ${companyId}`);
      
      const response = await axios.get(
        `${this.endpoints.agendamento}/api/appointments/${appointmentId}/validate`,
        {
          headers: {
            [HTTP_HEADERS.COMPANY_ID]: companyId,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.appointment
      };
    } catch (error: any) {
      this.logger.error(`Failed to validate appointment ${appointmentId}:`, error.message);
      
      if (error.response?.status === 404) {
        return { exists: false };
      }
      
      return { 
        exists: false, 
        error: `Appointment validation failed: ${error.message}`
      };
    }
  }

  /**
   * Execute a single validation based on type
   * Internal method to centralize validation logic
   * @param validation - Single validation request
   * @returns Promise<ValidationResult>
   */
  private static async executeValidation(validation: {
    type: 'customer' | 'professional' | 'service' | 'user' | 'company' | 'appointment';
    id: string;
    companyId: string;
    key: string;
  }): Promise<ValidationResult> {
    switch (validation.type) {
      case 'customer':
        return await this.validateCustomer(validation.id, validation.companyId);
      case 'professional':
        return await this.validateProfessional(validation.id, validation.companyId);
      case 'service':
        return await this.validateService(validation.id, validation.companyId);
      case 'user':
        return await this.validateUser(validation.id, validation.companyId);
      case 'company':
        return await this.validateCompany(validation.id);
      case 'appointment':
        return await this.validateAppointment(validation.id, validation.companyId);
      default:
        throw new Error(`Unknown validation type: ${validation.type}`);
    }
  }

  /**
   * Validate multiple references at once (batch validation)
   * ATOMIC FAIL-FAST: If any validation fails, the entire batch fails immediately
   * @param validations - Array of validation requests
   * @param options - Validation options
   * @returns Promise<{[key: string]: ValidationResult}>
   * @throws BatchValidationError - If any validation fails
   */
  static async validateBatch(
    validations: {
      type: 'customer' | 'professional' | 'service' | 'user' | 'company' | 'appointment';
      id: string;
      companyId: string;
      key: string; // Key to identify this validation in the result
    }[],
    options: {
      failFast?: boolean; // Default: true - fail on first error
      validateReferences?: boolean; // Default: true - ensure all references exist
    } = {}
  ): Promise<{[key: string]: ValidationResult}> {
    const { failFast = true, validateReferences = true } = options;
    
    this.logger.info(`Batch validation for ${validations.length} references`);

    if (validations.length === 0) {
      return {};
    }

    const results: {[key: string]: ValidationResult} = {};
    
    // SEQUENTIAL EXECUTION WITH FAIL-FAST BEHAVIOR
    // This ensures atomicity: either ALL validations pass, or the operation fails immediately
    for (const validation of validations) {
      try {
        const result = await this.executeValidation(validation);
        
        // Check if validation failed (reference doesn't exist or has error)
        // The individual validation methods return { exists: false, error: ... } on failure
        if (validateReferences && (!result.exists || result.error)) {
          const errorMessage = result.error || `${validation.type} with ID '${validation.id}' does not exist`;
          
          if (failFast) {
            // FAIL-FAST: Throw immediately to prevent further validations
            throw new BatchValidationError(
              `Batch validation failed at key '${validation.key}': ${errorMessage}`,
              validation.key,
              result.error || new Error(`Reference not found: ${validation.type}/${validation.id}`),
              validation.type
            );
          } else {
            // Non-fail-fast mode: collect the error but continue
            results[validation.key] = result;
            continue;
          }
        }
        
        results[validation.key] = result;
        
      } catch (error: any) {
        // Handle unexpected errors (network issues, etc.)
        if (failFast) {
          // FAIL-FAST: Wrap unexpected errors in BatchValidationError and throw
          if (error instanceof BatchValidationError) {
            throw error; // Re-throw our custom error
          }
          
          throw new BatchValidationError(
            `Batch validation failed at key '${validation.key}': ${error.message}`,
            validation.key,
            error,
            validation.type
          );
        } else {
          // Non-fail-fast mode: collect the error but continue
          results[validation.key] = {
            exists: false,
            error: error.message || 'Validation failed'
          };
        }
      }
    }
    
    this.logger.info(`Batch validation completed successfully: ${Object.keys(results).length} results`);
    return results;
  }

  /**
   * Health check for all modules
   * @returns Promise<{[module: string]: boolean}>
   */
  static async healthCheck(): Promise<{[module: string]: boolean}> {
    const results: {[module: string]: boolean} = {};
    
    const promises = Object.entries(this.endpoints).map(async ([module, url]) => {
      try {
        await axios.get(`${url}/health`, { timeout: TIMEOUT_CONFIG.HEALTH_CHECK });
        results[module] = true;
      } catch (error) {
        this.logger.error(`Health check failed for ${module}:`, error);
        results[module] = false;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Configure module endpoints (useful for testing)
   * @param endpoints - New endpoint configuration
   */
  static configure(endpoints: Partial<ModuleEndpoints>) {
    this.endpoints = { ...this.endpoints, ...endpoints };
    this.logger.info('ModuleIntegrator endpoints configured:', this.endpoints);
  }

  /**
   * Get current endpoints configuration
   * @returns ModuleEndpoints
   */
  static getEndpoints(): ModuleEndpoints {
    return { ...this.endpoints };
  }
}

export default ModuleIntegrator;