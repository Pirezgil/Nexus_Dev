import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import FormData from 'form-data';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

export const authRoutes = Router();

const USER_MANAGEMENT_URL = process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000';

// Specific rate limiting for auth routes (disabled in development)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 0 : 50, // unlimited in development, 50 in production
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development or for health checks
    return process.env.NODE_ENV === 'development' || req.path === '/health' || req.path === '/validate';
  }
});

// Login attempts rate limiting (disabled in development)
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 0 : 10, // unlimited in development, 10 in production
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'LOGIN_RATE_LIMIT'
  },
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

// Apply auth rate limiting only in production
if (process.env.NODE_ENV !== 'development') {
  authRoutes.use(authRateLimit);
  authRoutes.use(['/login', '/register', '/forgot-password'], loginRateLimit);
} else {
  console.log('🚀 Auth rate limiting disabled in development mode');
}

// Handle OPTIONS requests for CORS
authRoutes.options('*', (req: Request, res: Response) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5000',
    process.env.FRONTEND_URL
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Company-ID, X-User-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).end();
});

// Helper function to make requests to user-management service
const forwardToUserManagement = async (req: Request, res: Response, path: string) => {
  const requestId = (req as any).requestId || 'unknown';
  
  
  try {
    logger.info('Auth request forwarding:', {
      requestId,
      method: req.method,
      path: req.path,
      target: `${USER_MANAGEMENT_URL}${path}`,
      ip: req.ip,
      hasAuthHeader: !!req.headers.authorization
    });

    // Prepare headers - forward Authorization header if present
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Gateway-Request-ID': requestId,
      'X-Gateway-Source': 'nexus-api-gateway',
      'X-Forwarded-For': req.ip || 'unknown',
      'X-Real-IP': req.ip || 'unknown', 
      'X-Original-Host': req.get('Host') || '',
      'X-Original-Proto': req.protocol,
    };

    // Forward Authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
      logger.debug('Authorization header forwarded', { requestId });
    } else {
      logger.debug('No Authorization header found in request', { requestId });
    }


    // Use node-fetch for HTTP requests
    const fetchOptions: RequestInit = {
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    };
    
    const response = await fetch(`${USER_MANAGEMENT_URL}${path}`, fetchOptions as any);

    const data = await response.json();

    // Add CORS headers
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002', 
      'http://localhost:5000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    const origin = req.headers.origin;
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';
    
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Gateway-Processed', 'true');
    res.setHeader('X-Request-ID', requestId);

    logger.info('Auth response forwarded:', {
      requestId,
      statusCode: response.status,
      success: response.ok
    });

    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('Auth service error:', {
      requestId,
      error: error.message,
      method: req.method,
      path: req.path,
      target: USER_MANAGEMENT_URL
    });

    // Handle network errors
    res.status(503).json({
      success: false,
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR',
      requestId
    });
  }
};

// Direct route handlers
authRoutes.post('/login', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/login');
});

authRoutes.post('/register', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/register');
});

authRoutes.post('/logout', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/logout');
});

authRoutes.post('/refresh', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/refresh');
});

authRoutes.get('/validate', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/validate');
});

authRoutes.get('/me', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/me');
});

authRoutes.post('/forgot-password', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/forgot-password');
});

authRoutes.post('/reset-password', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/reset-password');
});

authRoutes.post('/change-password', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/change-password');
});

// Profile management endpoints
authRoutes.patch('/profile', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/profile');
});

authRoutes.patch('/password', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/auth/password');
});

// Special handler for avatar upload with file processing
authRoutes.post('/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId || 'unknown';
  
  try {
    logger.info('Avatar upload request:', {
      requestId,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      mimetype: req.file?.mimetype,
      fieldname: req.file?.fieldname,
      hasAuth: !!req.headers.authorization
    });
    

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    // Create form data for forwarding to user-management
    const formData = new FormData();
    formData.append('avatar', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Forward to user-management service
    const targetUrl = `${USER_MANAGEMENT_URL}/auth/avatar`;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization || '',
        'X-Gateway-Request-ID': requestId,
        ...formData.getHeaders()
      },
      body: formData
    });
    

    const data = await response.json();

    // Add CORS headers
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002', 
      'http://localhost:5000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    const origin = req.headers.origin;
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';
    
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Gateway-Processed', 'true');
    res.setHeader('X-Request-ID', requestId);

    logger.info('Avatar upload forwarded:', {
      requestId,
      statusCode: response.status,
      success: response.ok
    });

    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('Avatar upload proxy error:', {
      requestId,
      error: error.message,
      hasFile: !!req.file
    });

    res.status(503).json({
      success: false,
      error: 'Erro no upload da imagem',
      code: 'UPLOAD_SERVICE_ERROR',
      requestId
    });
  }
});

// Static file proxy for uploaded avatars
authRoutes.get('/uploads/*', async (req: Request, res: Response) => {
  
  try {
    const filePath = req.path; // e.g., /uploads/avatars/user-id/file.jpg
    const response = await fetch(`${USER_MANAGEMENT_URL}${filePath}`);
    
    if (!response.ok) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Forward the file
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.send(buffer);
  } catch (error: any) {
    logger.error('File proxy error:', { error: error.message, path: req.path });
    res.status(500).json({
      success: false,
      error: 'Failed to load file'
    });
  }
});

export default authRoutes;