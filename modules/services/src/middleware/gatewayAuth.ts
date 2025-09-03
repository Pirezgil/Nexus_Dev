import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger, logSecurityEvent } from '../utils/logger';
import { 
  UnauthorizedError, 
  ForbiddenError, 
  ServiceError,
  UserProfile 
} from '../types';
// Inline constants temporarily to resolve module resolution issues
const HTTP_HEADERS = {
  COMPANY_ID: 'x-company-id',
  USER_ID: 'x-user-id',
  USER_ROLE: 'x-user-role',
};

const getHeaderKey = (header: string) => header;

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      companyId?: string;
    }
  }
}

// Configurações de segurança HMAC
const GATEWAY_HMAC_SECRET = process.env.GATEWAY_HMAC_SECRET;
if (!GATEWAY_HMAC_SECRET) {
  throw new Error('GATEWAY_HMAC_SECRET environment variable is required for secure inter-service communication');
}

const HMAC_SIGNATURE_VALIDITY_SECONDS = 60; // 60 segundos para prevenir replay attacks

/**
 * Gateway Authentication Middleware com verificação HMAC criptográfica
 * 
 * SEGURANÇA CRÍTICA: Este middleware agora usa assinaturas HMAC-SHA256 
 * para garantir que as requisições só possam vir do API Gateway autêntico.
 * A verificação insegura baseada no header X-Gateway-Source foi completamente removida.
 */
export const gatewayAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log('🔐 HMAC GATEWAY AUTH MIDDLEWARE STARTED', {
    url: req.originalUrl,
    method: req.method,
    hasTimestamp: !!req.headers['x-gateway-timestamp'],
    hasSignature: !!req.headers['x-gateway-signature']
  });
  
  try {
    // 🔐 VERIFICAÇÃO HMAC CRIPTOGRÁFICA (substitui verificação insegura de header)
    const receivedTimestamp = req.headers['x-gateway-timestamp'] as string;
    const receivedSignature = req.headers['x-gateway-signature'] as string;
    
    const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;
    const userId = req.headers[getHeaderKey(HTTP_HEADERS.USER_ID)] as string;
    const userRole = req.headers[getHeaderKey(HTTP_HEADERS.USER_ROLE)] as string;

    // Verificar se os headers HMAC obrigatórios estão presentes
    if (!receivedTimestamp || !receivedSignature) {
      logSecurityEvent('Missing HMAC authentication headers - potential bypass attempt', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasTimestamp: !!receivedTimestamp,
        hasSignature: !!receivedSignature
      });
      throw new UnauthorizedError('Missing cryptographic authentication headers');
    }

    // 🔐 VERIFICAÇÃO DE TIMESTAMP (proteção contra replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const requestTimestamp = parseInt(receivedTimestamp, 10);
    const requestAge = now - requestTimestamp;

    if (isNaN(requestAge) || requestAge > HMAC_SIGNATURE_VALIDITY_SECONDS || requestAge < -30) {
      logSecurityEvent('HMAC signature expired or invalid timestamp - potential replay attack', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        requestAge,
        timestamp: receivedTimestamp,
        maxAge: HMAC_SIGNATURE_VALIDITY_SECONDS
      });
      throw new UnauthorizedError('Request signature expired or invalid timestamp');
    }

    // 🔐 RECRIAR ASSINATURA HMAC LOCAL PARA VERIFICAÇÃO
    let bodyString = '';
    if (req.body && typeof req.body === 'object') {
      try {
        bodyString = JSON.stringify(req.body);
      } catch (e) {
        bodyString = '';
      }
    } else if (req.body && typeof req.body === 'string') {
      bodyString = req.body;
    }

    // Criar dados para verificação: timestamp.método.path.corpo (mesmo formato do Gateway)
    const dataToVerify = `${receivedTimestamp}.${req.method}.${req.path}.${bodyString}`;
    
    // Gerar assinatura esperada localmente
    const expectedSignature = crypto
      .createHmac('sha256', GATEWAY_HMAC_SECRET!)
      .update(dataToVerify, 'utf8')
      .digest('hex');

    // 🔐 COMPARAÇÃO SEGURA DE ASSINATURA (protege contra timing attacks)
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValidSignature) {
      logSecurityEvent('Invalid HMAC signature - potential attack or misconfiguration', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: receivedTimestamp,
        signatureLength: receivedSignature.length,
        expectedLength: expectedSignature.length
      });
      throw new UnauthorizedError('Invalid cryptographic signature');
    }

    // Verificar headers de usuário após validação HMAC bem-sucedida
    if (!companyId || !userId || !userRole) {
      logSecurityEvent('Missing required user data headers after HMAC validation', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        hasCompanyId: !!companyId,
        hasUserId: !!userId,
        hasUserRole: !!userRole
      });
      throw new UnauthorizedError('Missing user authentication data from gateway');
    }

    // Construir perfil do usuário baseado nos headers do Gateway
    const userProfile: UserProfile = {
      id: userId,
      email: 'gateway.validated@nexus.com', // placeholder - o Gateway já validou
      firstName: 'Gateway',
      lastName: 'User', 
      role: userRole,
      companyId: companyId,
      status: 'ACTIVE' // Se chegou até aqui, o Gateway já validou que está ativo
    };

    // Anexar dados do usuário à requisição
    req.user = userProfile;
    req.companyId = companyId;
    
    console.log('🔐 HMAC AUTH SUCCESS:', {
      userId,
      companyId,
      userRole,
      hmacVerified: true,
      timestampAge: requestAge,
      userProfile,
      url: req.originalUrl,
      method: req.method
    });

    logger.info('HMAC gateway authentication successful', {
      userId,
      companyId,
      role: userRole,
      url: req.originalUrl,
      method: req.method,
      hmacValidated: true,
      timestampAge: requestAge
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
      logger.error('Gateway authentication middleware error', { error });
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
 * (Mantém a mesma lógica de autorização)
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        console.log('🔍 AUTHORIZATION DEBUG:', {
          userRole,
          allowedRoles,
          includes: allowedRoles.includes(userRole),
          userRoleType: typeof userRole,
          allowedRolesType: typeof allowedRoles[0]
        });
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
 * Company access middleware - garante isolamento multi-tenant
 */
export const requireCompanyAccess = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user || !req.companyId) {
      throw new UnauthorizedError('User not authenticated');
    }

    // Verificar se companyId está sendo solicitado na requisição (body, params, query)
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

export default {
  gatewayAuthenticate,
  authorize,
  requireCompanyAccess,
};