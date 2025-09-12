import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { JwtPayload, UnauthorizedError, ForbiddenError } from '../types';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';
import { config } from '../utils/config';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware - validates JWT token via User Management service
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acesso requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Try to validate token via User Management service first
    try {
      const response = await axios.get(
        `${config.userManagementUrl}/auth/validate`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 second timeout
        }
      );

      if (response.data.success && response.data.data.user) {
        const userData = response.data.data.user;
        
        // Add user info to request
        req.user = {
          userId: userData.userId,
          companyId: userData.companyId,
          role: userData.role,
          sessionId: userData.sessionId,
          permissions: userData.permissions,
        };

        // Cache user data in Redis for faster subsequent requests
        await redis.setex(
          `crm:user_cache:${userData.userId}`,
          300, // 5 minutes
          JSON.stringify(req.user)
        );

        // Update last activity
        await redis.set(
          `crm:user_activity:${userData.userId}`,
          Date.now().toString(),
          { EX: 300 } // 5 minutes
        );

        return next();
      } else {
        throw new UnauthorizedError('Token inválido');
      }
    } catch (error) {
      // If User Management service is unavailable, try to decode JWT locally
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.response?.status >= 500)) {
        logger.warn('User Management service unavailable, attempting local token validation');
        
        try {
          // Get JWT secret from environment or use a fallback
          const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
          const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

          // Check if we have cached user data
          const cachedUser = await redis.get(`crm:user_cache:${decoded.userId}`);
          if (cachedUser) {
            req.user = JSON.parse(cachedUser);
            return next();
          }

          // Add basic user info from JWT
          req.user = {
            userId: decoded.userId,
            companyId: decoded.companyId,
            role: decoded.role,
            sessionId: decoded.sessionId,
            permissions: decoded.permissions,
          };

          return next();
        } catch (jwtError) {
          if (jwtError instanceof jwt.JsonWebTokenError) {
            logger.warn('Invalid JWT token', { error: jwtError.message });
            throw new UnauthorizedError('Token inválido');
          }
          
          if (jwtError instanceof jwt.TokenExpiredError) {
            logger.warn('Expired JWT token', { error: jwtError.message });
            throw new UnauthorizedError('Token expirado');
          }

          throw new UnauthorizedError('Falha na validação do token');
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return next(error);
    }

    logger.error('Authentication error', { error });
    next(new UnauthorizedError('Falha na autenticação'));
  }
};

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuário não autenticado');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError('Permissões insuficientes');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - doesn't throw error if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Try to validate with User Management service
    try {
      const response = await axios.get(
        `${config.userManagementUrl}/auth/validate`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (response.data.success && response.data.data.user) {
        const userData = response.data.data.user;
        req.user = {
          userId: userData.userId,
          companyId: userData.companyId,
          role: userData.role,
          sessionId: userData.sessionId,
          permissions: userData.permissions,
        };
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional auth failed', { error });
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

/**
 * Company isolation middleware - ensures users can only access their company data
 */
export const enforceCompanyAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    // For routes with companyId parameter, ensure it matches user's company
    const routeCompanyId = req.params.companyId;
    if (routeCompanyId && routeCompanyId !== req.user.companyId) {
      throw new ForbiddenError('Acesso negado a dados de outra empresa');
    }

    // For POST/PUT requests with body data, ensure companyId matches or is set
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
      if (req.body.companyId && req.body.companyId !== req.user.companyId) {
        throw new ForbiddenError('Não é possível modificar dados de outra empresa');
      }
      
      // Automatically set companyId for new resources
      if (!req.body.companyId) {
        req.body.companyId = req.user.companyId;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting middleware
 */
export const createRateLimit = (windowMs: number, max: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const requestData = requests.get(key);
    
    if (!requestData || now > requestData.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (requestData.count >= max) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Muitas tentativas. Tente novamente mais tarde.',
        retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
      });
      return;
    }
    
    requestData.count++;
    requests.set(key, requestData);
    next();
  };
};

/**
 * Admin only middleware
 */
export const adminOnly = authorize(['ADMIN']);

/**
 * Admin or Manager middleware
 */
export const adminOrManager = authorize(['ADMIN', 'MANAGER']);

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (module: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Usuário não autenticado');
      }

      const requiredPermission = `${module}:${action}`;
      
      // If user has permissions array, check it
      if (req.user.permissions && req.user.permissions.length > 0) {
        const hasPermission = req.user.permissions.includes(requiredPermission);
        if (!hasPermission) {
          logger.warn(`Permission denied: User ${req.user.userId} lacks ${requiredPermission}`, {
            userId: req.user.userId,
            role: req.user.role,
            requiredPermission,
            userPermissions: req.user.permissions,
          });
          throw new ForbiddenError(`Permissão insuficiente: ${requiredPermission}`);
        }
      } else {
        // Fallback: if no permissions array, use role-based auth
        // ADMIN has all permissions by default
        if (req.user.role === 'ADMIN') {
          return next();
        }
        
        // For other roles, check basic read permissions
        if (action === 'read' && ['MANAGER', 'USER', 'VIEWER'].includes(req.user.role)) {
          return next();
        }
        
        // For write permissions, only ADMIN and MANAGER
        if (action === 'write' && ['ADMIN', 'MANAGER'].includes(req.user.role)) {
          return next();
        }
        
        logger.warn(`Permission denied: User ${req.user.userId} lacks ${requiredPermission} (role-based)`, {
          userId: req.user.userId,
          role: req.user.role,
          requiredPermission,
        });
        throw new ForbiddenError(`Permissão insuficiente: ${requiredPermission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Audit log middleware - logs important operations
 */
export const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Log successful operations
      if (body && body.success !== false && req.user) {
        logger.info(`Audit: ${action}`, {
          userId: req.user.userId,
          companyId: req.user.companyId,
          action,
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Export alias for compatibility with indexExpanded.ts
export const authMiddleware = authenticate;
