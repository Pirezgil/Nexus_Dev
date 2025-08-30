/**
 * Middleware de autenticação JWT
 * Valida tokens JWT e extrai dados do usuário
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser, AuthRequest, ApiResponse, ErrorCode } from '../types';
import config from '../utils/config';
import { logger } from '../utils/logger';
import { integrationService } from '../services/integrationService';
import { cache } from '../utils/redis';

interface JWTPayload {
  userId: string;
  companyId: string;
  role: string;
  permissions: string[];
  sessionId?: string;
  iat?: number;
  exp?: number;
}

// Cache para tokens válidos (5 minutos)
const TOKEN_CACHE_TTL = 300;

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Token de autorização não fornecido'
        }
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verificar cache primeiro
    const cacheKey = `auth:${token}`;
    let user = await cache.get<IUser>(cacheKey);

    if (!user) {
      // Verificar token JWT
      let payload: JWTPayload;
      
      try {
        payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
      } catch (jwtError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Token inválido ou expirado'
          }
        };
        return res.status(401).json(response);
      }

      // Validar token com o User Management (opcional, para tokens revogados)
      if (config.isDevelopment) {
        try {
          const validationResult = await integrationService.validateToken(token);
          if (!validationResult.success) {
            const response: ApiResponse = {
              success: false,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: 'Token não autorizado pelo sistema de usuários'
              }
            };
            return res.status(401).json(response);
          }
        } catch (error) {
          // Se falhar a validação externa, continuar com validação local
          logger.warn('Falha na validação externa do token, continuando com validação local');
        }
      }

      // Construir objeto do usuário com base no payload JWT
      user = {
        id: payload.userId,
        name: 'User', // Nome genérico - será obtido do token se necessário
        email: 'user@domain.com', // Email genérico - será obtido do token se necessário  
        role: payload.role,
        company_id: payload.companyId,
        permissions: payload.permissions || []
      };

      // Cachear usuário por 5 minutos
      await cache.set(cacheKey, user, TOKEN_CACHE_TTL);
    }

    // Anexar usuário à requisição
    req.user = user;

    // Log da requisição autenticada
    logger.debug('Usuário autenticado', {
      userId: user.id,
      companyId: user.company_id,
      route: req.path,
      method: req.method
    });

    next();

  } catch (error) {
    logger.error('Erro no middleware de autenticação:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno de autenticação'
      }
    };
    return res.status(500).json(response);
  }
};

// Middleware para verificar permissões específicas
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Usuário não autenticado'
        }
      };
      return res.status(401).json(response);
    }

    // Admin sempre tem acesso
    if (user.role === 'ADMIN' || user.role === 'OWNER') {
      return next();
    }

    // CORREÇÃO: Verificar se usuário tem a permissão necessária no formato correto
    // Formato das permissões: ['AGENDAMENTO:read', 'AGENDAMENTO:write', 'SERVICES:read']
    if (!user.permissions.includes(permission)) {
      logger.warn('Acesso negado por falta de permissão', {
        userId: user.id,
        requiredPermission: permission,
        userPermissions: user.permissions,
        userRole: user.role
      });

      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Permissão insuficiente. Necessário: ${permission}`
        }
      };
      return res.status(403).json(response);
    }

    next();
  };
};

// Middleware para verificar role mínimo
export const requireRole = (minimumRole: string) => {
  const roleHierarchy = {
    'USER': 1,
    'STAFF': 2,
    'MANAGER': 3,
    'ADMIN': 4,
    'SUPER_ADMIN': 5
  };

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Usuário não autenticado'
        }
      };
      return res.status(401).json(response);
    }

    const userRoleLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[minimumRole as keyof typeof roleHierarchy] || 999;

    if (userRoleLevel < requiredRoleLevel) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Role insuficiente para esta operação'
        }
      };
      return res.status(403).json(response);
    }

    next();
  };
};

// Middleware opcional - não falha se não houver token
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const cacheKey = `auth:${token}`;
    let user = await cache.get<IUser>(cacheKey);

    if (!user) {
      try {
        const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
        user = {
          id: payload.userId,
          name: payload.email,
          email: payload.email,
          role: payload.role,
          company_id: payload.companyId,
          permissions: payload.permissions || []
        };
        
        await cache.set(cacheKey, user, TOKEN_CACHE_TTL);
      } catch (jwtError) {
        // Token inválido, mas não falhar
        logger.warn('Token inválido em autenticação opcional:', jwtError);
        return next();
      }
    }

    req.user = user;
    next();

  } catch (error) {
    logger.error('Erro no middleware de autenticação opcional:', error);
    next(); // Continuar mesmo com erro
  }
};