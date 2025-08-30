"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaValidationHooks = void 0;
const ModuleIntegrator_1 = require("../integrators/ModuleIntegrator");
const logger_1 = require("../utils/logger");
const logger = new logger_1.Logger('PrismaValidationHooks');
class PrismaValidationHooks {
    static createValidationMiddleware(modelName, config = {}) {
        return async (params, next) => {
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
                const companyId = data[config.companyIdField || 'companyId'] || data[config.companyIdField || 'company_id'];
                if (!companyId) {
                    logger.warn(`No company ID found for ${modelName} validation`);
                    return next(params);
                }
                if (config.customerIdField && data[config.customerIdField]) {
                    validations.push({
                        type: 'customer',
                        id: data[config.customerIdField],
                        companyId,
                        key: 'customer'
                    });
                }
                if (config.professionalIdField && data[config.professionalIdField]) {
                    validations.push({
                        type: 'professional',
                        id: data[config.professionalIdField],
                        companyId,
                        key: 'professional'
                    });
                }
                if (config.serviceIdField && data[config.serviceIdField]) {
                    validations.push({
                        type: 'service',
                        id: data[config.serviceIdField],
                        companyId,
                        key: 'service'
                    });
                }
                if (config.userIdField && data[config.userIdField]) {
                    validations.push({
                        type: 'user',
                        id: data[config.userIdField],
                        companyId,
                        key: 'user'
                    });
                }
                if (config.appointmentIdField && data[config.appointmentIdField]) {
                    validations.push({
                        type: 'appointment',
                        id: data[config.appointmentIdField],
                        companyId,
                        key: 'appointment'
                    });
                }
                if (companyId) {
                    validations.push({
                        type: 'company',
                        id: companyId,
                        companyId,
                        key: 'company'
                    });
                }
                if (validations.length === 0) {
                    return next(params);
                }
                logger.info(`Performing ${validations.length} cross-module validations for ${modelName}`);
                const results = await ModuleIntegrator_1.ModuleIntegrator.validateBatch(validations);
                const failures = [];
                Object.entries(results).forEach(([key, result]) => {
                    if (!result.exists) {
                        const validation = validations.find(v => v.key === key);
                        if (validation) {
                            failures.push({
                                field: config[`${validation.type}IdField`] || `${validation.type}Id`,
                                value: validation.id,
                                error: result.error || `${validation.type} does not exist`,
                                type: validation.type
                            });
                        }
                    }
                });
                if (failures.length > 0) {
                    const errorMessage = `Foreign key validation failed for ${modelName}: ${failures.map(f => `${f.field}=${f.value} (${f.error})`).join(', ')}`;
                    logger.error(errorMessage, { modelName, failures, data });
                    throw new Error(errorMessage);
                }
                logger.info(`Cross-module validation successful for ${modelName}`);
                return next(params);
            }
            catch (error) {
                logger.error(`Prisma validation middleware error for ${modelName}:`, error);
                if (error.message.includes('Foreign key validation failed')) {
                    throw error;
                }
                logger.warn(`Validation error ignored for ${modelName}, allowing operation to proceed:`, error.message);
                return next(params);
            }
        };
    }
    static servicesValidationMiddleware() {
        return this.createValidationMiddleware('AppointmentCompleted', {
            customerIdField: 'customerId',
            professionalIdField: 'professionalId',
            serviceIdField: 'serviceId',
            companyIdField: 'companyId'
        });
    }
    static agendamentoValidationMiddleware() {
        return this.createValidationMiddleware('Appointment', {
            customerIdField: 'customer_id',
            professionalIdField: 'professional_id',
            serviceIdField: 'service_id',
            userIdField: 'created_by',
            companyIdField: 'company_id'
        });
    }
    static crmValidationMiddleware() {
        return this.createValidationMiddleware('CustomerInteraction', {
            serviceIdField: 'relatedServiceId',
            userIdField: 'createdBy',
            companyIdField: 'companyId'
        });
    }
    static createModuleValidationMiddleware(modelConfigs) {
        return async (params, next) => {
            const modelName = params.model;
            if (!modelName || !modelConfigs[modelName]) {
                return next(params);
            }
            const modelMiddleware = this.createValidationMiddleware(modelName, modelConfigs[modelName]);
            return modelMiddleware(params, next);
        };
    }
    static loggingMiddleware() {
        return async (params, next) => {
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
            }
            catch (error) {
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
    static auditMiddleware(moduleName) {
        return async (params, next) => {
            const result = await next(params);
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
                }
                catch (auditError) {
                    logger.warn('Audit logging failed:', auditError);
                }
            }
            return result;
        };
    }
}
exports.PrismaValidationHooks = PrismaValidationHooks;
exports.default = PrismaValidationHooks;
//# sourceMappingURL=prismaValidationHooks.js.map