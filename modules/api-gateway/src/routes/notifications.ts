import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { HTTP_HEADERS } from '../../shared/constants/headers';

export const notificationsRoutes = Router();

// Apply authentication middleware FIRST, before proxy
notificationsRoutes.use(authMiddleware);

const NOTIFICATIONS_SERVICE_URL = process.env.NOTIFICATIONS_URL || 'http://nexus-notifications:3000';

// HMAC Secret para autenticação criptográfica entre Gateway e Notificações
const GATEWAY_HMAC_SECRET = process.env.GATEWAY_HMAC_SECRET;
if (!GATEWAY_HMAC_SECRET) {
  throw new Error('GATEWAY_HMAC_SECRET environment variable is required for secure inter-service communication');
}

const HMAC_SIGNATURE_VALIDITY_SECONDS = 60; // 60 segundos para prevenir replay attacks

// Notifications-specific rate limiting (disabled in development)
const isDevelopment = process.env.NODE_ENV === 'development';

const notificationsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 0 : 200, // Unlimited in development, 200 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many notification requests, please slow down.',
    code: 'NOTIFICATIONS_RATE_LIMIT'
  },
  keyGenerator: (req: any) => {
    // Rate limit by user if authenticated, otherwise by IP
    return req.user?.userId || req.ip;
  }
});

// Bulk operations rate limiting (disabled in development)
const bulkRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 0 : 10, // Unlimited in development, 10 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many bulk notification requests, please wait.',
    code: 'BULK_NOTIFICATIONS_RATE_LIMIT'
  }
});

// Analytics rate limiting (disabled in development)
const analyticsRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: isDevelopment ? 0 : 30, // Unlimited in development, 30 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many analytics requests, please wait.',
    code: 'ANALYTICS_RATE_LIMIT'
  }
});

// Apply rate limiting only in production
if (!isDevelopment) {
  notificationsRoutes.use(notificationsRateLimit);
  notificationsRoutes.use('/bulk', bulkRateLimit);
  notificationsRoutes.use('/analytics', analyticsRateLimit);
} else {
  console.log('🔔 Notifications rate limiting disabled in development mode');
}

// Notifications proxy middleware
const notificationsProxy = createProxyMiddleware({
  target: NOTIFICATIONS_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/notifications': '/api/notifications',
    '^/api/templates': '/api/templates',
    '^/api/preferences': '/api/preferences',
    '^/api/analytics': '/api/analytics'
  },
  timeout: parseInt(process.env.TIMEOUT_GATEWAY_NOTIFICATIONS || '60000', 10), // Configurable timeout for notifications
  
  onProxyReq: (proxyReq, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;

    // 🔐 GERAÇÃO DE ASSINATURA HMAC CRIPTOGRÁFICA
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Capturar corpo da requisição para incluir na assinatura
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

    // Criar dados para assinatura: timestamp.método.path.corpo
    const dataToSign = `${timestamp}.${req.method}.${req.path}.${bodyString}`;
    
    // Gerar assinatura HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', GATEWAY_HMAC_SECRET!)
      .update(dataToSign, 'utf8')
      .digest('hex');

    // Headers de autenticação criptográfica
    proxyReq.setHeader('X-Gateway-Timestamp', timestamp);
    proxyReq.setHeader('X-Gateway-Signature', signature);
    proxyReq.setHeader('X-Gateway-Request-ID', requestId);
    
    // Multi-tenancy headers for company/user isolation
    if (user) {
      proxyReq.setHeader(HTTP_HEADERS.COMPANY_ID, user.companyId);
      proxyReq.setHeader(HTTP_HEADERS.USER_ID, user.userId);
      proxyReq.setHeader(HTTP_HEADERS.USER_ROLE, user.role || 'user');
      
      // Forward auth token for service-level validation
      const authHeader = req.get('Authorization');
      if (authHeader) {
        proxyReq.setHeader('Authorization', authHeader);
      }
    }

    // Client information
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Real-IP', req.ip);
    proxyReq.setHeader('X-Original-Host', req.get('Host') || 'unknown');
    
    // Content-Type preservation
    const contentType = req.get('Content-Type');
    if (contentType) {
      proxyReq.setHeader('Content-Type', contentType);
    }
    
    logger.info('Notifications request proxied with HMAC signature:', {
      requestId,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      contentType: contentType,
      target: NOTIFICATIONS_SERVICE_URL,
      ip: req.ip,
      timestampGenerated: timestamp,
      signatureLength: signature.length,
      hasHMACAuth: true
    });
  },

  onProxyRes: (proxyRes, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    
    // Add response headers
    proxyRes.headers['X-Gateway-Processed'] = 'true';
    proxyRes.headers['X-Request-ID'] = requestId;
    proxyRes.headers['X-Service'] = 'notifications';
    
    // Cache notification preferences and templates
    if (req.method === 'GET' && proxyRes.statusCode === 200) {
      if (req.path.includes('/preferences')) {
        proxyRes.headers['Cache-Control'] = 'private, max-age=300'; // 5 minutes
      } else if (req.path.includes('/templates')) {
        proxyRes.headers['Cache-Control'] = 'private, max-age=1800'; // 30 minutes
      } else if (req.path.includes('/stats') || req.path.includes('/analytics')) {
        proxyRes.headers['Cache-Control'] = 'private, max-age=60'; // 1 minute
      } else {
        // Default for notifications list
        proxyRes.headers['Cache-Control'] = 'private, no-cache';
      }
    }

    logger.info('Notifications response received:', {
      requestId,
      statusCode: proxyRes.statusCode,
      contentType: proxyRes.headers['content-type'],
      contentLength: proxyRes.headers['content-length'],
      method: req.method,
      path: req.path
    });
  },

  onError: (err, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;
    
    logger.error('Notifications service error:', {
      requestId,
      error: err.message,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: NOTIFICATIONS_SERVICE_URL,
      code: (err as any).code
    });

    if ((err as any).code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'Notification service is temporarily unavailable',
        code: 'NOTIFICATIONS_UNAVAILABLE',
        requestId,
        retryAfter: 30
      });
      return;
    }

    if ((err as any).code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        error: 'Notification operation timeout',
        code: 'NOTIFICATIONS_TIMEOUT',
        requestId,
        suggestion: 'Please retry your request'
      });
      return;
    }

    // Handle socket hang up / connection reset
    if ((err as any).code === 'ECONNRESET') {
      res.status(502).json({
        success: false,
        error: 'Connection reset by notifications service',
        code: 'CONNECTION_RESET',
        requestId,
        suggestion: 'Please retry your request'
      });
      return;
    }

    // WebSocket upgrade errors
    if (err.message?.includes('websocket') || err.message?.includes('Upgrade')) {
      res.status(426).json({
        success: false,
        error: 'WebSocket connection failed',
        code: 'WEBSOCKET_ERROR',
        requestId,
        suggestion: 'Real-time notifications may not work'
      });
      return;
    }

    res.status(502).json({
      success: false,
      error: 'Notification service error',
      code: 'NOTIFICATIONS_ERROR',
      requestId
    });
  }
});

// Health check endpoint
notificationsRoutes.get('/health', async (req: any, res) => {
  try {
    const response = await fetch(`${NOTIFICATIONS_SERVICE_URL}/health`, { 
      method: 'GET'
    } as any);
    
    const data = await response.json();
    res.status(response.status).json({
      service: 'notifications',
      status: response.ok ? 'healthy' : 'unhealthy',
      gateway: 'operational',
      details: data,
      websocket: data.websocket || 'unknown',
      queue: data.queue || 'unknown'
    });
  } catch (error: any) {
    res.status(503).json({
      service: 'notifications',
      status: 'unreachable',
      gateway: 'operational',
      error: error.message
    });
  }
});

// WebSocket upgrade handling (if needed)
notificationsRoutes.get('/ws', (req: any, res) => {
  res.status(426).json({
    success: false,
    error: 'WebSocket connection should be made directly to notification service',
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:5006',
    code: 'WEBSOCKET_REDIRECT'
  });
});

// Use proxy for all other routes
notificationsRoutes.use('/', notificationsProxy);

export default notificationsRoutes;