/**
 * ModuleIntegrator - Cross-module communication and validation service
 * Handles foreign key validation between ERP Nexus modules to ensure referential integrity
 * 
 * This class provides centralized validation methods for cross-module references,
 * preventing orphaned data and ensuring referential consistency.
 */

import axios from 'axios';
import { Logger } from '../utils/logger';

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
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
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
            'X-Company-Id': companyId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
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
            'X-Company-Id': companyId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
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
            'X-Company-Id': companyId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
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
            'X-Company-Id': companyId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
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
          timeout: 5000
        }
      );

      return {
        exists: response.data.exists,
        data: response.data.company
      };
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
            'X-Company-Id': companyId,
            'Content-Type': 'application/json'
          },
          timeout: 5000
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
   * Validate multiple references at once (batch validation)
   * @param validations - Array of validation requests
   * @returns Promise<{[key: string]: ValidationResult}>
   */
  static async validateBatch(validations: {
    type: 'customer' | 'professional' | 'service' | 'user' | 'company' | 'appointment';
    id: string;
    companyId: string;
    key: string; // Key to identify this validation in the result
  }[]): Promise<{[key: string]: ValidationResult}> {
    this.logger.info(`Batch validation for ${validations.length} references`);

    const results: {[key: string]: ValidationResult} = {};
    
    // Execute all validations in parallel
    const promises = validations.map(async (validation) => {
      let result: ValidationResult;
      
      switch (validation.type) {
        case 'customer':
          result = await this.validateCustomer(validation.id, validation.companyId);
          break;
        case 'professional':
          result = await this.validateProfessional(validation.id, validation.companyId);
          break;
        case 'service':
          result = await this.validateService(validation.id, validation.companyId);
          break;
        case 'user':
          result = await this.validateUser(validation.id, validation.companyId);
          break;
        case 'company':
          result = await this.validateCompany(validation.id);
          break;
        case 'appointment':
          result = await this.validateAppointment(validation.id, validation.companyId);
          break;
        default:
          result = { exists: false, error: 'Unknown validation type' };
      }
      
      results[validation.key] = result;
    });

    await Promise.all(promises);
    
    this.logger.info(`Batch validation completed: ${Object.keys(results).length} results`);
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
        await axios.get(`${url}/health`, { timeout: 3000 });
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