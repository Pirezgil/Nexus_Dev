import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';
import { JwtPayload, UnauthorizedError, ForbiddenError } from '../types';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';
import { config } from '../utils/config';

const prisma = new PrismaClient();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware - validates JWT token
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

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Check if session is still valid in database
    const session = await prisma.session.findFirst({
      where: {
        id: decoded.sessionId,
        accessToken: token,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            companyId: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedError('Token inválido ou expirado');
    }

    // Check if user is still active
    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Usuário inativo');
    }

    // Update last activity
    await redisClient.set(
      `user_activity:${session.user.id}`,
      Date.now().toString(),
      { EX: 300 } // 5 minutes
    );

    // Add user info to request
    req.user = {
      userId: session.user.id,
      companyId: session.user.companyId,
      role: session.user.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message });
      return next(new UnauthorizedError('Token inválido'));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', { error: error.message });
      return next(new UnauthorizedError('Token expirado'));
    }

    logger.error('Authentication error', { error });
    next(error);
  }
};

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (allowedRoles: UserRole[]) => {
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
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Check session validity
    const session = await prisma.session.findFirst({
      where: {
        id: decoded.sessionId,
        accessToken: token,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            companyId: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (session && session.user.status === 'ACTIVE') {
      req.user = {
        userId: session.user.id,
        companyId: session.user.companyId,
        role: session.user.role,
        sessionId: decoded.sessionId,
      };
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

    // For POST/PUT requests with body data, ensure companyId matches
    if ((req.method === 'POST' || req.method === 'PUT') && req.body.companyId) {
      if (req.body.companyId !== req.user.companyId) {
        throw new ForbiddenError('Não é possível modificar dados de outra empresa');
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
export const adminOnly = authorize([UserRole.ADMIN]);

/**
 * Admin or Manager middleware
 */
export const adminOrManager = authorize([UserRole.ADMIN, UserRole.MANAGER]);