import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const servicesRoutes = Router();

const SERVICES_SERVICE_URL = process.env.SERVICES_URL || 'http://nexus-services:3000';

// Services-specific rate limiting (disabled in development)
const isDevelopment = process.env.NODE_ENV === 'development';

const servicesRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 0 : 120, // Unlimited in development, 120 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many services requests, please slow down.',
    code: 'SERVICES_RATE_LIMIT'
  },
  keyGenerator: (req: any) => {
    // Rate limit by user if authenticated, otherwise by IP
    return req.user?.userId || req.ip;
  }
});

// File upload rate limiting (disabled in development)
const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDevelopment ? 0 : 20, // Unlimited in development, 20 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many file uploads, please wait before uploading more files.',
    code: 'UPLOAD_RATE_LIMIT'
  }
});

// Report generation rate limiting (disabled in development)
const reportRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 0 : 10, // Unlimited in development, 10 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many report requests, please wait before generating more reports.',
    code: 'REPORT_RATE_LIMIT'
  }
});

// Apply rate limiting only in production
if (!isDevelopment) {
  servicesRoutes.use(servicesRateLimit);
  servicesRoutes.use(['/professionals/*/photos', '/services/*/images'], uploadRateLimit);
  servicesRoutes.use(['/reports', '/export'], reportRateLimit);
} else {
  console.log('🚀 Services rate limiting disabled in development mode');
}

// Services proxy middleware
const servicesProxy = createProxyMiddleware({
  target: SERVICES_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/services': '/api/services'
  },
  timeout: 60000, // 60 seconds for services (file uploads may take time)
  
  onProxyReq: (proxyReq, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    const user = req.user;

    // Add gateway headers
    proxyReq.setHeader('X-Gateway-Request-ID', requestId);
    proxyReq.setHeader('X-Gateway-Source', 'nexus-api-gateway');
    proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
    
    // Multi-tenancy headers for company/user isolation
    if (user) {
      proxyReq.setHeader('X-Company-ID', user.companyId);
      proxyReq.setHeader('X-User-ID', user.userId);
      proxyReq.setHeader('X-User-Role', user.role || 'user');
      
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
    
    // For file uploads, preserve content-type and content-length
    const contentType = req.get('Content-Type');
    if (contentType) {
      proxyReq.setHeader('Content-Type', contentType);
    }
    
    logger.info('Services request proxied:', {
      requestId,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      contentType: contentType,
      target: SERVICES_SERVICE_URL,
      ip: req.ip
    });
  },

  onProxyRes: (proxyRes, req: any, res) => {
    const requestId = req.requestId || 'unknown';
    
    // Add response headers
    proxyRes.headers['X-Gateway-Processed'] = 'true';
    proxyRes.headers['X-Request-ID'] = requestId;
    proxyRes.headers['X-Service'] = 'services';
    
    // Handle file download headers
    const contentType = proxyRes.headers['content-type'];
    if (contentType && (contentType.includes('image/') || contentType.includes('application/'))) {
      // Don't cache files by default for security
      proxyRes.headers['Cache-Control'] = 'no-store';
      proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
    }
    
    // Cache service listings and public data
    if (req.method === 'GET' && proxyRes.statusCode === 200 && req.path.includes('/services')) {
      proxyRes.headers['Cache-Control'] = 'private, max-age=600'; // 10 minutes
    }

    logger.info('Services response received:', {
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
    
    logger.error('Services service error:', {
      requestId,
      error: err.message,
      method: req.method,
      path: req.path,
      companyId: user?.companyId,
      userId: user?.userId,
      target: SERVICES_SERVICE_URL,
      code: (err as any).code
    });

    if ((err as any).code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'Services module is temporarily unavailable',
        code: 'SERVICES_UNAVAILABLE',
        requestId,
        retryAfter: 60
      });
      return;
    }

    if ((err as any).code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        error: 'Services operation timeout',
        code: 'SERVICES_TIMEOUT',
        requestId,
        suggestion: 'For file uploads, try smaller files or check your connection'
      });
      return;
    }

    // File size errors (common with uploads)
    if (err.message?.includes('PayloadTooLargeError') || (err as any).code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        requestId,
        maxSize: '10MB'
      });
      return;
    }

    res.status(502).json({
      success: false,
      error: 'Services module error',
      code: 'SERVICES_ERROR',
      requestId
    });
  }
});

// Health check endpoint
servicesRoutes.get('/health', async (req: any, res) => {
  try {
    const response = await fetch(`${SERVICES_SERVICE_URL}/health`, { 
      method: 'GET'
    } as any);
    
    const data = await response.json();
    res.status(response.status).json({
      service: 'services',
      status: response.ok ? 'healthy' : 'unhealthy',
      gateway: 'operational',
      details: data
    });
  } catch (error: any) {
    res.status(503).json({
      service: 'services',
      status: 'unreachable',
      gateway: 'operational',
      error: error.message
    });
  }
});

// Use proxy for all other routes
servicesRoutes.use('/', servicesProxy);

export default servicesRoutes;