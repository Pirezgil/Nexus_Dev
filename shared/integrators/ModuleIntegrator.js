"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleIntegrator = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class ModuleIntegrator {
    static async validateCustomer(customerId, companyId) {
        try {
            this.logger.info(`Validating customer ${customerId} for company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.crm}/api/customers/${customerId}/validate`, {
                headers: {
                    'X-Company-Id': companyId,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.customer
            };
        }
        catch (error) {
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
    static async validateProfessional(professionalId, companyId) {
        try {
            this.logger.info(`Validating professional ${professionalId} for company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.services}/api/professionals/${professionalId}/validate`, {
                headers: {
                    'X-Company-Id': companyId,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.professional
            };
        }
        catch (error) {
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
    static async validateService(serviceId, companyId) {
        try {
            this.logger.info(`Validating service ${serviceId} for company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.services}/api/services/${serviceId}/validate`, {
                headers: {
                    'X-Company-Id': companyId,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.service
            };
        }
        catch (error) {
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
    static async validateUser(userId, companyId) {
        try {
            this.logger.info(`Validating user ${userId} for company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.auth}/api/users/${userId}/validate`, {
                headers: {
                    'X-Company-Id': companyId,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.user
            };
        }
        catch (error) {
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
    static async validateCompany(companyId) {
        try {
            this.logger.info(`Validating company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.auth}/api/companies/${companyId}/validate`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.company
            };
        }
        catch (error) {
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
    static async validateAppointment(appointmentId, companyId) {
        try {
            this.logger.info(`Validating appointment ${appointmentId} for company ${companyId}`);
            const response = await axios_1.default.get(`${this.endpoints.agendamento}/api/appointments/${appointmentId}/validate`, {
                headers: {
                    'X-Company-Id': companyId,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            return {
                exists: response.data.exists,
                data: response.data.appointment
            };
        }
        catch (error) {
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
    static async validateBatch(validations) {
        this.logger.info(`Batch validation for ${validations.length} references`);
        const results = {};
        const promises = validations.map(async (validation) => {
            let result;
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
    static async healthCheck() {
        const results = {};
        const promises = Object.entries(this.endpoints).map(async ([module, url]) => {
            try {
                await axios_1.default.get(`${url}/health`, { timeout: 3000 });
                results[module] = true;
            }
            catch (error) {
                this.logger.error(`Health check failed for ${module}:`, error);
                results[module] = false;
            }
        });
        await Promise.all(promises);
        return results;
    }
    static configure(endpoints) {
        this.endpoints = { ...this.endpoints, ...endpoints };
        this.logger.info('ModuleIntegrator endpoints configured:', this.endpoints);
    }
    static getEndpoints() {
        return { ...this.endpoints };
    }
}
exports.ModuleIntegrator = ModuleIntegrator;
ModuleIntegrator.logger = new logger_1.Logger('ModuleIntegrator');
ModuleIntegrator.endpoints = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    crm: process.env.CRM_SERVICE_URL || 'http://localhost:3002',
    services: process.env.SERVICES_SERVICE_URL || 'http://localhost:3003',
    agendamento: process.env.AGENDAMENTO_SERVICE_URL || 'http://localhost:3004'
};
exports.default = ModuleIntegrator;
//# sourceMappingURL=ModuleIntegrator.js.map