import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const crmRoutes = Router();

const CRM_SERVICE_URL = process.env.CRM_URL || 'http://nexus-crm:3000';

// CRM-specific rate limiting (disabled in development)
const isDevelopment = process.env.NODE_ENV === 'development';

const crmRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 0 : 100, // Unlimited in development, 100 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many CRM requests, please slow down.',
    code: 'CRM_RATE_LIMIT'
  },
  keyGenerator: (req: any) => {
    // Rate limit by user if authenticated, otherwise by IP
    return req.user?.userId || req.ip;
  }
});

// More restrictive rate limiting for bulk operations (disabled in development)
const bulkOperationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 0 : 10, // Unlimited in development, 10 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many bulk operations, please wait before trying again.',
    code: 'CRM_BULK_RATE_LIMIT'
  }
});

// Apply rate limiting only in production
if (!isDevelopment) {
  crmRoutes.use(crmRateLimit);
  crmRoutes.use(['/customers/bulk', '/interactions/bulk', '/export'], bulkOperationRateLimit);
} else {
  console.log('🚀 CRM rate limiting disabled in development mode');
}

// CRM proxy middleware
const crmProxy = createProxyMiddleware({
  target: CRM_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/crm': '/api' // Remove /crm prefix - CRM expects /api/customers not /api/crm/customers
  },
  timeout: parseInt(process.env.TIMEOUT_GATEWAY_CRM || '60000', 10), // Configurable timeout for CRM operations
  
  onProxyReq: (proxyReq, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;

    // Add gateway and user context headers
    proxyReq.setHeader('X-Gateway-Request-ID', requestId);
    proxyReq.setHeader('X-Gateway-Source', 'nexus-api-gateway');
    proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
    proxyReq.setHeader('X-Gateway-Proxy', 'true'); // Critical header for CRM to detect proxy requests
    
    // Multi-tenancy headers - CRITICAL for company isolation
    if (user) {
      proxyReq.setHeader('X-Company-ID', user.companyId);
      proxyReq.setHeader('X-User-ID', user.userId);
      proxyReq.setHeader('X-User-Role', user.role || 'user');
      
      // Forward the original JWT token for additional validation if needed
      const authHeader = req.get('Authorization');
      if (authHeader) {
        proxyReq.setHeader('Authorization', authHeader);
      }
    }

    // Preserve client information
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Real-IP', req.ip);
    proxyReq.setHeader('X-Original-Host', req.get('Host') || 'unknown');
    proxyReq.setHeader('X-User-Agent', req.get('User-Agent') || 'unknown');
    
    // For POST/PUT/PATCH requests, ensure proper body handling
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      // Body is already parsed by gateway, so we need to stringify it
      if (req.body && typeof req.body === 'object') {
        const bodyString = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyString));
        proxyReq.setHeader('X-Gateway-Body-Parsed', 'true'); // Indicate body was pre-parsed
        
        // Write the body to the proxy request
        proxyReq.write(bodyString);
      }
    }
    
    logger.info('CRM request proxied:', {
      requestId,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: CRM_SERVICE_URL,
      ip: req.ip,
      hasBody: !!req.body,
      bodyParsed: !!req.body && typeof req.body === 'object'
    });
  },

  onProxyRes: (proxyRes, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    
    // Add response headers
    proxyRes.headers['X-Gateway-Processed'] = 'true';
    proxyRes.headers['X-Request-ID'] = requestId;
    proxyRes.headers['X-Service'] = 'crm';
    
    // Cache headers for performance (adjust based on data sensitivity)
    if (req.method === 'GET' && proxyRes.statusCode === 200) {
      // Cache GET requests for 5 minutes unless it's sensitive data
      if (!req.path.includes('/customers/') || req.path.includes('/public')) {
        proxyRes.headers['Cache-Control'] = 'private, max-age=300';
      }
    }

    logger.info('CRM response received:', {
      requestId,
      statusCode: proxyRes.statusCode,
      contentLength: proxyRes.headers['content-length'],
      method: req.method,
      path: req.path
    });
  },

  onError: (err, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;
    
    logger.error('CRM service error:', {
      requestId,
      error: err.message,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: CRM_SERVICE_URL,
      code: (err as NodeJS.ErrnoException).code || 'UNKNOWN'
    });

    // Handle connection refused (service down)
    if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'CRM service is temporarily unavailable',
        code: 'CRM_SERVICE_UNAVAILABLE',
        requestId,
        retryAfter: 60
      });
      return;
    }

    // Handle timeout
    if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        error: 'CRM service timeout - operation took too long',
        code: 'CRM_SERVICE_TIMEOUT',
        requestId,
        suggestion: 'Try breaking down the request or contact support'
      });
      return;
    }

    // Handle network errors
    if ((err as NodeJS.ErrnoException).code === 'ENOTFOUND' || (err as NodeJS.ErrnoException).code === 'EAI_AGAIN') {
      res.status(502).json({
        success: false,
        error: 'CRM service network error',
        code: 'CRM_NETWORK_ERROR',
        requestId
      });
      return;
    }

    // Generic error
    res.status(502).json({
      success: false,
      error: 'CRM service error',
      code: 'CRM_SERVICE_ERROR',
      requestId,
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Health check endpoint (bypasses auth)
crmRoutes.get('/health', async (req: any, res) => {
  try {
    const response = await fetch(`${CRM_SERVICE_URL}/health`, { 
      method: 'GET'
    });
    
    const data = await response.json();
    res.status(response.status).json({
      service: 'crm',
      status: response.ok ? 'healthy' : 'unhealthy',
      gateway: 'operational',
      details: data
    });
  } catch (error: any) {
    res.status(503).json({
      service: 'crm',
      status: 'unreachable',
      gateway: 'operational',
      error: error.message
    });
  }
});

// Use proxy for all other routes
crmRoutes.use('/', crmProxy);

export default crmRoutes;