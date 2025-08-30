/**
 * PermissionValidation Middleware - Sistema granular de permissões
 * 
 * Implementa controle de acesso baseado em:
 * - Módulos (CRM, AGENDAMENTO, SERVICES, etc.)
 * - Ações (read, write, delete, admin)
 * - Recursos específicos (ownership validation)
 * - Níveis hierárquicos (ADMIN > MANAGER > USER)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        companyId: string;
        userId: string;
        role: string;
        permissions?: Record<string, string[]>;
      };
    }
  }
}

interface Permission {
  module: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  resource?: string;
}

interface ResourceOwnership {
  companyId: string;
  createdBy?: string;
  userId?: string;
}

/**
 * Hierarquia de roles do sistema
 */
const ROLE_HIERARCHY = {
  'OWNER': 100,
  'ADMIN': 90,
  'MANAGER': 80,
  'SUPERVISOR': 70,
  'USER': 60,
  'VIEWER': 50,
  'GUEST': 10
};

/**
 * Middleware principal para validação de permissões
 * @param permission - Permissão necessária
 */
export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req;
      
      if (!user) {
        logger.warn('Tentativa de acesso sem autenticação', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
      }
      
      logger.debug('Validando permissão', {
        userId: user.userId,
        role: user.role,
        requiredPermission: permission,
        userPermissions: user.permissions
      });
      
      // OWNER e ADMIN sempre têm acesso total
      if (user.role === 'OWNER' || user.role === 'ADMIN') {
        logger.debug('Acesso liberado por role administrativo', { 
          userId: user.userId, 
          role: user.role 
        });
        return next();
      }
      
      // Verificar permissões do módulo
      const modulePermissions = user.permissions?.[permission.module.toLowerCase()] || [];
      
      // Verificar se possui a ação específica ou admin do módulo
      const hasPermission = 
        modulePermissions.includes(permission.action) ||
        modulePermissions.includes('admin') ||
        (permission.action === 'read' && modulePermissions.includes('write')); // Write implica Read
      
      if (!hasPermission) {
        logger.warn('Acesso negado por falta de permissão', {
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
      
      // Validação adicional de recurso específico se necessário
      if (permission.resource) {
        const resourceValidation = await validateResourceAccess(
          user,
          permission.module,
          permission.resource,
          req.params.id || req.body.id,
          req
        );
        
        if (!resourceValidation.valid) {
          logger.warn('Acesso negado ao recurso específico', {
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
      
      logger.debug('Permissão validada com sucesso', {
        userId: user.userId,
        permission
      });
      
      next();
      
    } catch (error) {
      logger.error('Erro na validação de permissões', { 
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

/**
 * Middleware para validação de ownership (propriedade) de recursos
 * @param modelName - Nome do modelo no banco
 * @param prismaClient - Cliente Prisma (injetado)
 */
export const validateOwnership = (modelName: string, prismaClient: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      if (!user || !id) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros inválidos para validação de propriedade'
        });
      }
      
      // OWNER e ADMIN sempre têm acesso
      if (user.role === 'OWNER' || user.role === 'ADMIN') {
        return next();
      }
      
      logger.debug('Validando propriedade do recurso', {
        userId: user.userId,
        modelName,
        resourceId: id
      });
      
      // Buscar o registro
      const record = await prismaClient[modelName].findUnique({
        where: { id },
        select: { 
          companyId: true,
          company_id: true, // Alguns models usam snake_case
          createdBy: true,
          created_by: true, // Alguns models usam snake_case
          userId: true,
          user_id: true // Alguns models usam snake_case
        }
      });
      
      if (!record) {
        logger.warn('Recurso não encontrado para validação de propriedade', {
          userId: user.userId,
          modelName,
          resourceId: id
        });
        
        return res.status(404).json({
          success: false,
          error: 'Registro não encontrado'
        });
      }
      
      // Verificar se pertence à mesma empresa
      const recordCompanyId = record.companyId || record.company_id;
      if (recordCompanyId !== user.companyId) {
        logger.warn('Tentativa de acesso cross-company negada', {
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
      
      // Para roles hierárquicos, verificar ownership
      const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
      
      // MANAGER e acima podem acessar recursos da empresa
      if (userRoleLevel >= ROLE_HIERARCHY.MANAGER) {
        return next();
      }
      
      // Para USER e abaixo, verificar se é proprietário
      const recordOwnerId = record.createdBy || record.created_by || record.userId || record.user_id;
      
      if (recordOwnerId !== user.userId) {
        logger.warn('Acesso negado por falta de propriedade', {
          userId: user.userId,
          recordOwnerId,
          resourceId: id
        });
        
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Você não é proprietário deste registro'
        });
      }
      
      logger.debug('Validação de propriedade bem-sucedida', {
        userId: user.userId,
        resourceId: id
      });
      
      next();
      
    } catch (error) {
      logger.error('Erro na validação de propriedade', { 
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

/**
 * Middleware para validação de role mínimo necessário
 * @param minimumRole - Role mínimo necessário
 */
export const requireMinimumRole = (minimumRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
        logger.warn('Acesso negado por role insuficiente', {
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
      
    } catch (error) {
      logger.error('Erro na validação de role mínimo', { error });
      
      return res.status(500).json({
        success: false,
        error: 'Erro interno na validação de role'
      });
    }
  };
};

/**
 * Função auxiliar para validação de acesso a recursos específicos
 */
async function validateResourceAccess(
  user: any,
  module: string,
  resource: string,
  resourceId: string,
  req: Request
): Promise<{ valid: boolean; error?: string; reason?: string }> {
  try {
    // Implementar validações específicas por módulo/recurso
    switch (module.toUpperCase()) {
      case 'CRM':
        return await validateCRMResourceAccess(user, resource, resourceId);
      
      case 'AGENDAMENTO':
        return await validateAgendamentoResourceAccess(user, resource, resourceId);
      
      case 'SERVICES':
        return await validateServicesResourceAccess(user, resource, resourceId);
      
      default:
        // Para módulos não especificados, permitir acesso se passou pelas outras validações
        return { valid: true };
    }
    
  } catch (error) {
    logger.error('Erro na validação de acesso a recurso', { error, module, resource, resourceId });
    return { 
      valid: false, 
      error: 'Erro interno na validação de recurso',
      reason: 'internal_error'
    };
  }
}

/**
 * Validações específicas do módulo CRM
 */
async function validateCRMResourceAccess(
  user: any,
  resource: string,
  resourceId: string
): Promise<{ valid: boolean; error?: string; reason?: string }> {
  // Implementar validações específicas do CRM
  // Por exemplo, verificar se o customer pertence à empresa do usuário
  return { valid: true }; // Implementar conforme necessário
}

/**
 * Validações específicas do módulo Agendamento
 */
async function validateAgendamentoResourceAccess(
  user: any,
  resource: string,
  resourceId: string
): Promise<{ valid: boolean; error?: string; reason?: string }> {
  // Implementar validações específicas de agendamento
  // Por exemplo, verificar se pode acessar agendamentos de outros profissionais
  return { valid: true }; // Implementar conforme necessário
}

/**
 * Validações específicas do módulo Services
 */
async function validateServicesResourceAccess(
  user: any,
  resource: string,
  resourceId: string
): Promise<{ valid: boolean; error?: string; reason?: string }> {
  // Implementar validações específicas de services
  return { valid: true }; // Implementar conforme necessário
}

/**
 * Middleware para logging de acessos
 */
export const logAccess = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.info('Acesso registrado', {
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