import { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: string;
  email?: string | undefined;
  name?: string | undefined;
}

interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}

interface AuthResponse {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  code?: string;
}

/**
 * Centralized authentication middleware for API Gateway
 * Validates JWT tokens by calling the User Management service
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  const startTime = Date.now();
  
  logger.info('🚨 DEBUG: authMiddleware iniciado', {
    requestId,
    path: req.path,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization
  });
  
  try {
    // Extract authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Missing authorization header:', {
        requestId,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER',
        requestId
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Invalid authorization header format:', {
        requestId,
        path: req.path,
        method: req.method,
        ip: req.ip,
        authHeader: authHeader.substring(0, 20) + '...'
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid authorization header format. Expected: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT',
        requestId
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token || token.trim() === '') {
      res.status(401).json({
        success: false,
        error: 'Empty authentication token',
        code: 'EMPTY_TOKEN',
        requestId
      });
      return;
    }

    // Validate token with User Management service
    const userManagementUrl = process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000';
    const validationUrl = `${userManagementUrl}/auth/validate`;
    
    logger.info('🚨 DEBUG: Validating token with User Management service:', {
      requestId,
      validationUrl,
      tokenLength: token.length
    });

    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Gateway-Request-ID': requestId,
        'X-Gateway-Source': 'nexus-api-gateway',
        'X-Forwarded-For': req.ip || 'unknown',
        'X-Original-Host': req.get('Host') || 'unknown'
      } as Record<string, string>
    });

    const authTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as AuthResponse;
      
      logger.warn('Token validation failed:', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
        code: errorData.code,
        authTime,
        ip: req.ip
      });

      const statusCode = response.status === 401 ? 401 : 403;
      const errorMessage = response.status === 401 
        ? 'Invalid or expired token'
        : 'Authentication service error';
      const errorCode = response.status === 401 ? 'INVALID_TOKEN' : 'AUTH_SERVICE_ERROR';

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode,
        requestId,
        details: errorData.error
      });
      return;
    }

    const userData = await response.json() as any;
    
    // Handle different response structures from auth service
    let user: AuthenticatedUser;
    if (userData.success && userData.data) {
      // New format: { success: true, data: { userId, companyId, ... } }
      user = userData.data;
    } else if (userData.success && userData.user) {
      // Old format: { success: true, user: { userId, companyId, ... } }
      user = userData.user;
    } else {
      logger.error('Invalid response from auth service:', {
        requestId,
        userData,
        authTime
      });
      
      res.status(503).json({
        success: false,
        error: 'Authentication service returned invalid response',
        code: 'AUTH_SERVICE_INVALID_RESPONSE',
        requestId
      });
      return;
    }
    if (!user.userId || !user.companyId) {
      logger.error('Incomplete user data from auth service:', {
        requestId,
        hasUserId: !!user.userId,
        hasCompanyId: !!user.companyId,
        userData: { ...user, userId: user.userId ? '[PRESENT]' : '[MISSING]' }
      });
      
      res.status(503).json({
        success: false,
        error: 'Authentication service returned incomplete user data',
        code: 'INCOMPLETE_USER_DATA',
        requestId
      });
      return;
    }

    // Attach user data to request
    req.user = {
      userId: user.userId,
      companyId: user.companyId,
      role: user.role || 'user',
      email: user.email,
      name: user.name
    };

    logger.info('Authentication successful:', {
      requestId,
      userId: user.userId,
      companyId: user.companyId,
      role: user.role,
      authTime,
      path: req.path,
      method: req.method
    });

    // Add performance header
    res.setHeader('X-Auth-Time', `${authTime}ms`);
    
    next();
    
  } catch (error: any) {
    const authTime = Date.now() - startTime;
    
    logger.error('Authentication middleware error:', {
      requestId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      authTime,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Handle network/connection errors
    if (error.code === 'ECONNREFUSED' || error.name === 'FetchError') {
      res.status(503).json({
        success: false,
        error: 'Authentication service unavailable',
        code: 'AUTH_SERVICE_UNAVAILABLE',
        requestId,
        retryAfter: 30
      });
      return;
    }

    // Handle timeout errors
    if (error.code === 'ETIMEDOUT' || error.name === 'AbortError') {
      res.status(504).json({
        success: false,
        error: 'Authentication timeout',
        code: 'AUTH_TIMEOUT',
        requestId
      });
      return;
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR',
      requestId
    });
  }
};

/**
 * Optional middleware to check for specific roles
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    const requestId = req.requestId || 'unknown';
    
    if (!user) {
      logger.error('Role check called before authentication:', { requestId });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'ROLE_CHECK_ERROR',
        requestId
      });
      return;
    }

    const userRole = user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient role:', {
        requestId,
        userId: user.userId,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path
      });
      
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE',
        requestId,
        required: allowedRoles,
        current: userRole
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user belongs to specific company (additional security layer)
 */
export const requireCompanyAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const user = req.user;
  const requestId = req.requestId || 'unknown';
  const requestedCompanyId = req.params.companyId || req.body.companyId || req.query.companyId;
  
  if (!user) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'COMPANY_CHECK_ERROR',
      requestId
    });
    return;
  }

  // If no specific company is requested, allow access to user's own company
  if (!requestedCompanyId) {
    next();
    return;
  }

  if (user.companyId !== requestedCompanyId) {
    logger.warn('Access denied - company mismatch:', {
      requestId,
      userId: user.userId,
      userCompanyId: user.companyId,
      requestedCompanyId,
      path: req.path
    });
    
    res.status(403).json({
      success: false,
      error: 'Access denied - company mismatch',
      code: 'COMPANY_ACCESS_DENIED',
      requestId
    });
    return;
  }

  next();
};

export default authMiddleware;