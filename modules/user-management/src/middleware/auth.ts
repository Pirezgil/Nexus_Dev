import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { JwtPayload, UnauthorizedError, ForbiddenError } from '../types';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';
import { secureJwtManager } from '../utils/secureJwt';
import { sessionSecurityManager } from '../utils/sessionSecurity';
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
 * Enhanced authentication middleware with comprehensive security checks
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  try {
    // Extract and validate authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', {
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw new UnauthorizedError('Token de acesso requerido');
    }

    const token = authHeader.substring(7);
    
    if (!token || token.trim() === '') {
      throw new UnauthorizedError('Token vazio');
    }

    // Get client information for security checks
    const clientInfo = {
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: '' // Will be extracted from token
    };

    // Verify JWT token with enhanced security
    const decoded = secureJwtManager.verifyAccessToken(token, clientInfo);
    clientInfo.sessionId = decoded.sessionId;

    // Validate session with comprehensive security checks
    const sessionInfo = await sessionSecurityManager.validateSession(
      decoded.sessionId,
      token,
      clientInfo.userAgent,
      clientInfo.ipAddress
    );

    if (!sessionInfo) {
      logger.warn('Session validation failed', {
        requestId,
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        ip: clientInfo.ipAddress
      });
      throw new UnauthorizedError('Sessão inválida ou expirada');
    }

    // Verify user is still active and has permissions
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        companyId: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      logger.warn('User not found or inactive', {
        requestId,
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });
      throw new UnauthorizedError('Usuário inativo ou não encontrado');
    }

    // Check for account lockout or suspicious activity
    const lockoutKey = `lockout:${user.id}`;
    const lockoutData = await redisClient.get(lockoutKey);
    
    if (lockoutData) {
      const lockout = JSON.parse(lockoutData);
      if (lockout.until > Date.now()) {
        logger.warn('Account temporarily locked', {
          requestId,
          userId: user.id,
          lockoutUntil: new Date(lockout.until)
        });
        throw new UnauthorizedError('Conta temporariamente bloqueada por segurança');
      }
    }

    // Update user activity with security tracking
    const activityKey = `activity:${user.id}`;
    const activityData = {
      lastAccess: Date.now(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      sessionId: decoded.sessionId,
      endpoint: req.path,
      method: req.method
    };

    await redisClient.setEx(activityKey, 1800, JSON.stringify(activityData)); // 30 minutes

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Add enhanced user info to request
    req.user = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      sessionId: decoded.sessionId,
      permissions: decoded.permissions || []
    };

    const authTime = Date.now() - startTime;
    
    logger.debug('Authentication successful', {
      requestId,
      userId: user.id,
      sessionId: decoded.sessionId,
      authTime,
      endpoint: req.path,
      method: req.method
    });

    // Add performance header
    res.setHeader('X-Auth-Time', `${authTime}ms`);

    next();
  } catch (error) {
    const authTime = Date.now() - startTime;
    
    // Enhanced error logging with security context
    logger.error('Authentication failed', {
      requestId,
      error: (error as Error).message,
      authTime,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Track authentication failures for security monitoring
    const clientIp = req.ip;
    if (clientIp) {
      const failureKey = `auth_failures:${clientIp}`;
      const failures = await redisClient.incr(failureKey);
      await redisClient.expire(failureKey, 3600); // 1 hour
      
      // Implement progressive delays and blocking for repeated failures
      if (failures > 10) {
        const blockKey = `blocked:${clientIp}`;
        await redisClient.setEx(blockKey, 3600, '1'); // Block for 1 hour
        
        logger.warn('IP address blocked due to repeated authentication failures', {
          ip: clientIp,
          failures
        });
      }
    }

    // Add security headers even on failure
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Return appropriate error without sensitive information
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else {
      // Generic error to prevent information leakage
      next(new UnauthorizedError('Falha na autenticação'));
    }
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