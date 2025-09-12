import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

export const usersRoutes = Router();

const USER_MANAGEMENT_URL = process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000';

// Helper function to make requests to user-management service
const forwardToUserManagement = async (req: Request, res: Response, path: string) => {
  const requestId = (req as any).requestId || 'unknown';
  
  try {
    logger.info('User management request forwarding:', {
      requestId,
      method: req.method,
      path: req.path,
      target: `${USER_MANAGEMENT_URL}${path}`,
      ip: req.ip,
      hasAuthHeader: !!req.headers.authorization
    });

    // Prepare headers - forward Authorization header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Gateway-Request-ID': requestId,
      'X-Gateway-Source': 'nexus-api-gateway',
      'X-Forwarded-For': req.ip || 'unknown',
      'X-Real-IP': req.ip || 'unknown', 
      'X-Original-Host': req.get('Host') || '',
      'X-Original-Proto': req.protocol,
    };

    // Forward Authorization header (required for protected user endpoints)
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Forward other relevant headers
    if (req.headers['x-company-id']) {
      headers['X-Company-ID'] = req.headers['x-company-id'] as string;
    }

    if (req.headers['x-user-id']) {
      headers['X-User-ID'] = req.headers['x-user-id'] as string;
    }

    // Use node-fetch for HTTP requests
    const fetchOptions: RequestInit = {
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    };
    
    const response = await fetch(`${USER_MANAGEMENT_URL}${path}`, fetchOptions as any);

    const data = await response.json();

    // Set response headers
    res.setHeader('X-Gateway-Processed', 'true');
    res.setHeader('X-Request-ID', requestId);

    logger.info('User management response forwarded:', {
      requestId,
      statusCode: response.status,
      success: response.ok
    });

    res.status(response.status).json(data);
  } catch (error: any) {
    logger.error('User management service error:', {
      requestId,
      error: error.message,
      method: req.method,
      path: req.path,
      target: USER_MANAGEMENT_URL
    });

    // Handle network errors
    res.status(503).json({
      success: false,
      error: 'User management service unavailable',
      code: 'USER_MANAGEMENT_SERVICE_ERROR',
      requestId
    });
  }
};

// User management routes (all require authentication - handled by middleware in server.ts)

// Get all users with pagination
usersRoutes.get('/', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users');
});

// Get user statistics
usersRoutes.get('/stats', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users/stats');
});

// Search users
usersRoutes.get('/search', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users/search');
});

// Get current user profile
usersRoutes.get('/profile', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users/profile');
});

// Update current user profile
usersRoutes.put('/profile', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users/profile');
});

// Create new user
usersRoutes.post('/', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, '/users');
});

// Get user by ID
usersRoutes.get('/:id', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}`);
});

// Update user
usersRoutes.put('/:id', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}`);
});

// Delete user (soft delete)
usersRoutes.delete('/:id', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}`);
});

// Activate user
usersRoutes.post('/:id/activate', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}/activate`);
});

// Deactivate user
usersRoutes.post('/:id/deactivate', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}/deactivate`);
});

// Reset user password (admin action)
usersRoutes.post('/:id/reset-password', (req: Request, res: Response) => {
  forwardToUserManagement(req, res, `/users/${req.params.id}/reset-password`);
});

export default usersRoutes;