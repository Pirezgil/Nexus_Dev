import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

export const agendamentoRoutes = Router();

const AGENDAMENTO_SERVICE_URL = process.env.AGENDAMENTO_URL || 'http://nexus-agendamento:3000';

// Agendamento-specific rate limiting (disabled in development)
const isDevelopment = process.env.NODE_ENV === 'development';

const agendamentoRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 0 : 60, // Unlimited in development, 60 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many scheduling requests, please slow down.',
    code: 'SCHEDULING_RATE_LIMIT'
  },
  keyGenerator: (req: any) => {
    return req.user?.userId || req.ip;
  }
});

// Appointment booking rate limiting (disabled in development)
const bookingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 0 : 10, // Unlimited in development, 10 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many booking attempts. Please wait before booking more appointments.',
    code: 'BOOKING_RATE_LIMIT'
  }
});

// Notification rate limiting (disabled in development)
const notificationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 0 : 20, // Unlimited in development, 20 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many notification requests.',
    code: 'NOTIFICATION_RATE_LIMIT'
  }
});

// Apply rate limiting only in production
if (!isDevelopment) {
  agendamentoRoutes.use(agendamentoRateLimit);
  agendamentoRoutes.use(['/appointments', '/appointments/*/book'], bookingRateLimit);
  agendamentoRoutes.use(['/notifications', '/notifications/send'], notificationRateLimit);
} else {
  console.log('🚀 Agendamento rate limiting disabled in development mode');
}

// Agendamento proxy middleware
const agendamentoProxy = createProxyMiddleware({
  target: AGENDAMENTO_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/agendamento': '/api/agendamento'
  },
  timeout: parseInt(process.env.TIMEOUT_GATEWAY_AGENDAMENTO || '60000', 10), // Configurable timeout for scheduling operations
  
  onProxyReq: (proxyReq, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;

    logger.info('🚨 DEBUG: Proxy onProxyReq executado', {
      requestId,
      hasUser: !!user,
      userDetails: user ? { userId: user.userId, role: user.role } : null,
      path: req.path
    });

    // Add gateway headers
    proxyReq.setHeader('X-Gateway-Request-ID', requestId);
    proxyReq.setHeader('X-Gateway-Source', 'nexus-api-gateway');
    proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
    
    // SEMPRE forwards the Authorization header (authMiddleware já validou)
    const authHeader = req.get('Authorization');
    if (authHeader) {
      proxyReq.setHeader('Authorization', authHeader);
      logger.info('🚨 DEBUG: Authorization header forwarded', { hasAuth: true });
    } else {
      logger.warn('🚨 DEBUG: NO Authorization header found in proxy!');
    }
    
    // Multi-tenancy and user context headers (se user existir após authMiddleware)
    if (user) {
      proxyReq.setHeader('X-Company-ID', user.companyId);
      proxyReq.setHeader('X-User-ID', user.userId);
      proxyReq.setHeader('X-User-Role', user.role || 'user');
    }

    // Client and request information
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Real-IP', req.ip);
    proxyReq.setHeader('X-Original-Host', req.get('Host') || 'unknown');
    proxyReq.setHeader('X-User-Agent', req.get('User-Agent') || 'unknown');
    
    // Special handling for WhatsApp notifications
    if (req.path.includes('/notifications') || req.path.includes('/whatsapp')) {
      proxyReq.setHeader('X-Notification-Source', 'gateway');
      proxyReq.setHeader('X-Client-IP', req.ip);
    }
    
    logger.info('Agendamento request proxied:', {
      requestId,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: AGENDAMENTO_SERVICE_URL,
      ip: req.ip,
      isNotification: req.path.includes('/notifications')
    });
  },

  onProxyRes: (proxyRes, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    
    // Add response headers
    proxyRes.headers['X-Gateway-Processed'] = 'true';
    proxyRes.headers['X-Request-ID'] = requestId;
    proxyRes.headers['X-Service'] = 'agendamento';
    
    // Cache availability data for performance
    if (req.method === 'GET' && req.path.includes('/availability') && proxyRes.statusCode === 200) {
      proxyRes.headers['Cache-Control'] = 'private, max-age=300'; // 5 minutes
    }
    
    // Don't cache appointment data (real-time updates needed)
    if (req.path.includes('/appointments')) {
      proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    
    logger.info('Agendamento response received:', {
      requestId,
      statusCode: proxyRes.statusCode,
      contentLength: proxyRes.headers['content-length'],
      method: req.method,
      path: req.path,
      cached: proxyRes.headers['cache-control']?.includes('max-age')
    });
  },

  onError: (err, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;
    
    logger.error('Agendamento service error:', {
      requestId,
      error: err.message,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: AGENDAMENTO_SERVICE_URL,
      code: (err as NodeJS.ErrnoException).code || 'UNKNOWN'
    });

    if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'Scheduling service is temporarily unavailable',
        code: 'AGENDAMENTO_UNAVAILABLE',
        requestId,
        retryAfter: 60,
        message: 'Please try again in a few moments'
      });
      return;
    }

    if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        error: 'Scheduling operation timeout',
        code: 'AGENDAMENTO_TIMEOUT',
        requestId,
        suggestion: 'The operation is taking longer than expected. Please try again.'
      });
      return;
    }

    // WhatsApp service specific errors
    if (req.path.includes('/whatsapp') || req.path.includes('/notifications')) {
      res.status(502).json({
        success: false,
        error: 'Notification service error',
        code: 'NOTIFICATION_ERROR',
        requestId,
        message: 'Failed to send notification. Please try again or contact support.'
      });
      return;
    }

    res.status(502).json({
      success: false,
      error: 'Scheduling service error',
      code: 'AGENDAMENTO_ERROR',
      requestId
    });
  }
});

// Health check endpoint
agendamentoRoutes.get('/health', async (req: any, res) => {
  try {
    const response = await fetch(`${AGENDAMENTO_SERVICE_URL}/health`, { 
      method: 'GET'
    });
    
    const data = await response.json();
    res.status(response.status).json({
      service: 'agendamento',
      status: response.ok ? 'healthy' : 'unhealthy',
      gateway: 'operational',
      details: data
    });
  } catch (error: any) {
    res.status(503).json({
      service: 'agendamento',
      status: 'unreachable',
      gateway: 'operational',
      error: error.message
    });
  }
});

// === TEMPORARY CALENDAR ENDPOINT ===
// This is a temporary solution while we fix the agendamento service routing
agendamentoRoutes.get('/calendar', authMiddleware, async (req: any, res) => {
  const requestId = req.requestId || 'unknown';
  
  logger.warn('🚨 TEMPORARY: Calendar endpoint called (bypass)', {
    requestId,
    query: req.query,
    user: req.user?.userId
  });
  
  // Return mock calendar data to resolve 404 error
  const mockResponse = {
    success: true,
    data: {
      view: req.query.view || 'week',
      date: req.query.date || new Date().toISOString().split('T')[0],
      appointments: [],
      availability_slots: [],
      blocked_slots: [],
      message: 'TEMPORARY: Mock calendar data - agendamento service routing being fixed'
    },
    message: 'Calendar data retrieved successfully (temporary mock)',
    requestId
  };
  
  res.status(200).json(mockResponse);
});

// Use proxy for all other routes
agendamentoRoutes.use('/', agendamentoProxy);

export default agendamentoRoutes;