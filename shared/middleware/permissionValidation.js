"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAccess = exports.requireMinimumRole = exports.validateOwnership = exports.requirePermission = void 0;
const logger_1 = require("../utils/logger");
const ROLE_HIERARCHY = {
    'OWNER': 100,
    'ADMIN': 90,
    'MANAGER': 80,
    'SUPERVISOR': 70,
    'USER': 60,
    'VIEWER': 50,
    'GUEST': 10
};
const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            const { user } = req;
            if (!user) {
                logger_1.logger.warn('Tentativa de acesso sem autenticação', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }
            logger_1.logger.debug('Validando permissão', {
                userId: user.userId,
                role: user.role,
                requiredPermission: permission,
                userPermissions: user.permissions
            });
            if (user.role === 'OWNER' || user.role === 'ADMIN') {
                logger_1.logger.debug('Acesso liberado por role administrativo', {
                    userId: user.userId,
                    role: user.role
                });
                return next();
            }
            const modulePermissions = user.permissions?.[permission.module.toLowerCase()] || [];
            const hasPermission = modulePermissions.includes(permission.action) ||
                modulePermissions.includes('admin') ||
                (permission.action === 'read' && modulePermissions.includes('write'));
            if (!hasPermission) {
                logger_1.logger.warn('Acesso negado por falta de permissão', {
                    userId: user.userId,
                    role: user.role,
                    requiredModule: permission.module,
                    requiredAction: permission.action,
                    userModulePermissions: modulePermissions
                });
                return res.status(403).json({
                    success: false,
                    error: `Acesso negado. Permissão necessária: ${permission.module}:${permission.action}`,
                    requiredPermission: {
                        module: permission.module,
                        action: permission.action
                    }
                });
            }
            if (permission.resource) {
                const resourceValidation = await validateResourceAccess(user, permission.module, permission.resource, req.params.id || req.body.id, req);
                if (!resourceValidation.valid) {
                    logger_1.logger.warn('Acesso negado ao recurso específico', {
                        userId: user.userId,
                        module: permission.module,
                        resource: permission.resource,
                        resourceId: req.params.id || req.body.id,
                        reason: resourceValidation.reason
                    });
                    return res.status(403).json({
                        success: false,
                        error: resourceValidation.error || 'Acesso negado ao recurso específico'
                    });
                }
            }
            logger_1.logger.debug('Permissão validada com sucesso', {
                userId: user.userId,
                permission
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Erro na validação de permissões', {
                error,
                userId: req.user?.userId,
                permission
            });
            return res.status(500).json({
                success: false,
                error: 'Erro interno na validação de permissões'
            });
        }
    };
};
exports.requirePermission = requirePermission;
const validateOwnership = (modelName, prismaClient) => {
    return async (req, res, next) => {
        try {
            const { user } = req;
            const { id } = req.params;
            if (!user || !id) {
                return res.status(400).json({
                    success: false,
                    error: 'Parâmetros inválidos para validação de propriedade'
                });
            }
            if (user.role === 'OWNER' || user.role === 'ADMIN') {
                return next();
            }
            logger_1.logger.debug('Validando propriedade do recurso', {
                userId: user.userId,
                modelName,
                resourceId: id
            });
            const record = await prismaClient[modelName].findUnique({
                where: { id },
                select: {
                    companyId: true,
                    company_id: true,
                    createdBy: true,
                    created_by: true,
                    userId: true,
                    user_id: true
                }
            });
            if (!record) {
                logger_1.logger.warn('Recurso não encontrado para validação de propriedade', {
                    userId: user.userId,
                    modelName,
                    resourceId: id
                });
                return res.status(404).json({
                    success: false,
                    error: 'Registro não encontrado'
                });
            }
            const recordCompanyId = record.companyId || record.company_id;
            if (recordCompanyId !== user.companyId) {
                logger_1.logger.warn('Tentativa de acesso cross-company negada', {
                    userId: user.userId,
                    userCompanyId: user.companyId,
                    recordCompanyId,
                    resourceId: id
                });
                return res.status(403).json({
                    success: false,
                    error: 'Acesso negado. Registro pertence a outra empresa'
                });
            }
            const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
            if (userRoleLevel >= ROLE_HIERARCHY.MANAGER) {
                return next();
            }
            const recordOwnerId = record.createdBy || record.created_by || record.userId || record.user_id;
            if (recordOwnerId !== user.userId) {
                logger_1.logger.warn('Acesso negado por falta de propriedade', {
                    userId: user.userId,
                    recordOwnerId,
                    resourceId: id
                });
                return res.status(403).json({
                    success: false,
                    error: 'Acesso negado. Você não é proprietário deste registro'
                });
            }
            logger_1.logger.debug('Validação de propriedade bem-sucedida', {
                userId: user.userId,
                resourceId: id
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Erro na validação de propriedade', {
                error,
                userId: req.user?.userId,
                modelName,
                resourceId: req.params.id
            });
            return res.status(500).json({
                success: false,
                error: 'Erro interno na validação de propriedade'
            });
        }
    };
};
exports.validateOwnership = validateOwnership;
const requireMinimumRole = (minimumRole) => {
    return (req, res, next) => {
        try {
            const { user } = req;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }
            const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
            const minimumRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
            if (userRoleLevel < minimumRoleLevel) {
                logger_1.logger.warn('Acesso negado por role insuficiente', {
                    userId: user.userId,
                    userRole: user.role,
                    userRoleLevel,
                    minimumRole,
                    minimumRoleLevel
                });
                return res.status(403).json({
                    success: false,
                    error: `Acesso negado. Role mínimo necessário: ${minimumRole}`,
                    userRole: user.role,
                    minimumRole
                });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Erro na validação de role mínimo', { error });
            return res.status(500).json({
                success: false,
                error: 'Erro interno na validação de role'
            });
        }
    };
};
exports.requireMinimumRole = requireMinimumRole;
async function validateResourceAccess(user, module, resource, resourceId, req) {
    try {
        switch (module.toUpperCase()) {
            case 'CRM':
                return await validateCRMResourceAccess(user, resource, resourceId);
            case 'AGENDAMENTO':
                return await validateAgendamentoResourceAccess(user, resource, resourceId);
            case 'SERVICES':
                return await validateServicesResourceAccess(user, resource, resourceId);
            default:
                return { valid: true };
        }
    }
    catch (error) {
        logger_1.logger.error('Erro na validação de acesso a recurso', { error, module, resource, resourceId });
        return {
            valid: false,
            error: 'Erro interno na validação de recurso',
            reason: 'internal_error'
        };
    }
}
async function validateCRMResourceAccess(user, resource, resourceId) {
    return { valid: true };
}
async function validateAgendamentoResourceAccess(user, resource, resourceId) {
    return { valid: true };
}
async function validateServicesResourceAccess(user, resource, resourceId) {
    return { valid: true };
}
const logAccess = (action) => {
    return (req, res, next) => {
        logger_1.logger.info('Acesso registrado', {
            action,
            userId: req.user?.userId,
            companyId: req.user?.companyId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method
        });
        next();
    };
};
exports.logAccess = logAccess;
//# sourceMappingURL=permissionValidation.js.map