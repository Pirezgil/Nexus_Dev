import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../utils/config';
import { logger, logSecurityEvent } from '../utils/logger';
import { cacheService } from '../utils/redis';
import { 
  UnauthorizedError, 
  ForbiddenError, 
  ServiceError,
  UserProfile 
} from '../types';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      companyId?: string;
    }
  }
}

interface JWTPayload {
  userId: string;
  companyId: string;
  role: string;
  sessionId: string;
  permissions: string[];
  iat: number;
  exp: number;
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
      logSecurityEvent('Missing or invalid authorization header', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      throw new UnauthorizedError('Missing or invalid authorization token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      logSecurityEvent('Empty token provided', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
      throw new UnauthorizedError('Empty token provided');
    }

    // Try to get user info from cache first
    const cacheKey = `user_session:${token}`;
    let userProfile = await cacheService.getUserSession<UserProfile>(cacheKey);

    if (!userProfile) {
      // Verify JWT token locally first
      let decoded: JWTPayload;
      try {
        decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
      } catch (jwtError) {
        logSecurityEvent('Invalid JWT token', {
          error: jwtError,
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
        });
        throw new UnauthorizedError('Invalid token');
      }

      // Validate with User Management service
      try {
        const response = await axios.get(`${config.userManagementUrl}/api/auth/validate`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 second timeout
        });

        if (response.data.success && response.data.data) {
          userProfile = response.data.data;
          
          // Cache user session for 30 minutes
          await cacheService.setUserSession(cacheKey, userProfile, 1800);
        } else {
          throw new UnauthorizedError('Token validation failed');
        }
      } catch (axiosError: any) {
        logger.error('User Management service validation failed', {
          error: axiosError.message,
          status: axiosError.response?.status,
          url: req.originalUrl,
          method: req.method,
        });

        // If User Management is down but JWT is valid, use JWT data
        if (decoded) {
          userProfile = {
            id: decoded.userId,
            email: 'jwt.fallback@nexus.com',  // placeholder
            firstName: 'JWT',
            lastName: 'User',
            role: decoded.role,
            companyId: decoded.companyId,
            status: 'ACTIVE',  // assume active if JWT is valid
          };
          
          logger.warn('Using JWT fallback for authentication', {
            userId: userProfile.id,
            role: userProfile.role,
            companyId: userProfile.companyId,
          });
        } else {
          throw new UnauthorizedError('Unable to validate token');
        }
      }
    }

    // Check if user is active
    if (!userProfile || userProfile.status !== 'ACTIVE') {
      logSecurityEvent('Inactive user attempted access', {
        userId: userProfile?.id,
        status: userProfile?.status,
        url: req.originalUrl,
        method: req.method,
      });
      throw new UnauthorizedError('User account is not active');
    }

    // Attach user information to request
    req.user = userProfile;
    req.companyId = userProfile.companyId;

    logger.debug('User authenticated successfully', {
      userId: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
      companyId: userProfile.companyId,
      url: req.originalUrl,
      method: req.method,
    });

    next();
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Authentication middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error during authentication',
        code: 'AUTH_ERROR',
      });
    }
  }
};

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        logSecurityEvent('Insufficient permissions', {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          url: req.originalUrl,
          method: req.method,
        });
        throw new ForbiddenError('Insufficient permissions for this action');
      }

      logger.debug('User authorized successfully', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        url: req.originalUrl,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else {
        logger.error('Authorization middleware error', { error });
        res.status(500).json({
          success: false,
          error: 'Internal server error during authorization',
          code: 'AUTH_ERROR',
        });
      }
    }
  };
};

/**
 * Company access middleware - ensures user can only access their company data
 */
export const requireCompanyAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user || !req.companyId) {
      throw new UnauthorizedError('User not authenticated');
    }

    // Check if companyId is provided in request (body, params, or query)
    const requestCompanyId = req.body?.companyId || req.params?.companyId || req.query?.companyId;
    
    if (requestCompanyId && requestCompanyId !== req.companyId) {
      logSecurityEvent('Unauthorized company access attempted', {
        userId: req.user.id,
        userCompanyId: req.companyId,
        requestedCompanyId: requestCompanyId,
        url: req.originalUrl,
        method: req.method,
      });
      throw new ForbiddenError('Access denied: Invalid company access');
    }

    next();
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Company access middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error during company access check',
        code: 'AUTH_ERROR',
      });
    }
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
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

    // Try to authenticate, but don't fail if it doesn't work
    await authenticate(req, res, () => {
      next();
    });
  } catch (error) {
    // Log the error but continue without authentication
    logger.warn('Optional authentication failed', { error });
    next();
  }
};

/**
 * Service account authentication middleware - for inter-service communication
 */
export const authenticateServiceAccount = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const serviceKey = req.headers['x-service-key'] as string;
    
    if (!serviceKey) {
      throw new UnauthorizedError('Service key required');
    }

    // In a real implementation, you'd validate this against a secure service registry
    // For now, we'll use a simple validation
    const expectedServiceKey = process.env.INTERNAL_SERVICE_KEY;
    
    if (!expectedServiceKey || serviceKey !== expectedServiceKey) {
      logSecurityEvent('Invalid service key provided', {
        providedKey: serviceKey.substring(0, 8) + '...',
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
      });
      throw new UnauthorizedError('Invalid service key');
    }

    logger.debug('Service account authenticated', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    next();
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Service authentication middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error during service authentication',
        code: 'AUTH_ERROR',
      });
    }
  }
};

/**
 * Rate limiting by user
 */
export const rateLimitByUser = (maxRequests: number = 100, windowSeconds: number = 60) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const key = `user:${userId}`;
      
      const result = await cacheService.incrementRateLimit(key, windowSeconds, maxRequests);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });

      if (!result.allowed) {
        logSecurityEvent('User rate limit exceeded', {
          userId,
          limit: maxRequests,
          window: windowSeconds,
          url: req.originalUrl,
          method: req.method,
        });
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error', { error });
      // Continue on error to avoid blocking legitimate requests
      next();
    }
  };
};

export default {
  authenticate,
  authorize,
  requireCompanyAccess,
  optionalAuth,
  authenticateServiceAccount,
  rateLimitByUser,
};