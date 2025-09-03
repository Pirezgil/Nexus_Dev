"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchValidationError = exports.ModuleIntegrator = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");

/**
 * Classe de erro customizada para falhas de validação em lote
 * Fornece informações detalhadas sobre qual validação falhou e por quê
 */
class BatchValidationError extends Error {
    constructor(message, failedValidationKey, originalError, failedValidationType) {
        super(message);
        this.failedValidationKey = failedValidationKey;
        this.originalError = originalError;
        this.failedValidationType = failedValidationType;
        this.name = 'BatchValidationError';
        
        // Mantém o stack trace adequado onde o erro foi lançado (apenas disponível no V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BatchValidationError);
        }
    }
}
exports.BatchValidationError = BatchValidationError;
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
    /**
     * Método auxiliar para executar uma única validação baseada no tipo
     * Método interno para centralizar a lógica de validação
     */
    static async executeValidation(validation) {
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
                throw new Error(`Tipo de validação desconhecido: ${validation.type}`);
        }
    }

    /**
     * Validar múltiplas referências de uma vez (validação em lote)
     * ATÔMICO FAIL-FAST: Se qualquer validação falhar, todo o lote falha imediatamente
     */
    static async validateBatch(validations, options = {}) {
        const { failFast = true, validateReferences = true } = options;
        
        this.logger.info(`Batch validation for ${validations.length} references`);

        if (validations.length === 0) {
            return {};
        }

        const results = {};
        
        // EXECUÇÃO SEQUENCIAL COM COMPORTAMENTO FAIL-FAST
        // Isso garante atomicidade: ou TODAS as validações passam, ou a operação falha imediatamente
        for (const validation of validations) {
            try {
                const result = await this.executeValidation(validation);
                
                // Verificar se a validação falhou (referência não existe ou tem erro)
                // Os métodos individuais de validação retornam { exists: false, error: ... } em caso de falha
                if (validateReferences && (!result.exists || result.error)) {
                    const errorMessage = result.error || `${validation.type} com ID '${validation.id}' não existe`;
                    
                    if (failFast) {
                        // FAIL-FAST: Lançar imediatamente para prevenir validações subsequentes
                        throw new BatchValidationError(
                            `Validação em lote falhou na chave '${validation.key}': ${errorMessage}`,
                            validation.key,
                            result.error || new Error(`Referência não encontrada: ${validation.type}/${validation.id}`),
                            validation.type
                        );
                    } else {
                        // Modo não fail-fast: coletar o erro mas continuar
                        results[validation.key] = result;
                        continue;
                    }
                }
                
                results[validation.key] = result;
                
            } catch (error) {
                // Lidar com erros inesperados (problemas de rede, etc.)
                if (failFast) {
                    // FAIL-FAST: Encapsular erros inesperados em BatchValidationError e lançar
                    if (error instanceof BatchValidationError) {
                        throw error; // Re-lançar nosso erro customizado
                    }
                    
                    throw new BatchValidationError(
                        `Validação em lote falhou na chave '${validation.key}': ${error.message}`,
                        validation.key,
                        error,
                        validation.type
                    );
                } else {
                    // Modo não fail-fast: coletar o erro mas continuar
                    results[validation.key] = {
                        exists: false,
                        error: error.message || 'Validação falhou'
                    };
                }
            }
        }
        
        this.logger.info(`Batch validation completed successfully: ${Object.keys(results).length} results`);
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
    auth: process.env.USER_MANAGEMENT_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    crm: process.env.CRM_SERVICE_URL || 'http://localhost:3002',
    services: process.env.SERVICES_SERVICE_URL || 'http://localhost:3003',
    agendamento: process.env.AGENDAMENTO_SERVICE_URL || 'http://localhost:3004'
};
exports.default = ModuleIntegrator;
//# sourceMappingURL=ModuleIntegrator.js.map