import { Router } from 'express';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

// Import route modules
import healthRoutes from './healthRoutes';
import serviceRoutes from './serviceRoutes';
import professionalRoutes from './professionalRoutes';
import appointmentRoutes from './appointmentRoutes';
import reportRoutes from './reportRoutes';
import integrationRoutes from './integrationRoutes';

const router = Router();

/**
 * API Routes Configuration
 * 
 * All API routes are prefixed and organized by functionality
 */

// Health check routes (no authentication required)
router.use('/health', healthRoutes);

// Validation routes temporarily disabled for infrastructure setup

// Apply authentication middleware to all API routes
router.use('/api/*', authenticate);

// Core business logic routes (protected by authentication)
router.use('/api/services', serviceRoutes);
router.use('/api/professionals', professionalRoutes);
router.use('/api/appointments', appointmentRoutes);

// Analytics and reporting routes (protected by authentication)
router.use('/api/reports', reportRoutes);

// Integration routes for cross-module communication (protected by authentication)
router.use('/api/integrations', integrationRoutes);

// CORREÇÃO: Endpoints específicos para o módulo agendamento
// O frontend do agendamento espera que os endpoints estejam em /api/services/
router.use('/api/services', integrationRoutes);

// Legacy routes for backward compatibility (without /api prefix) - also protected
router.use('/services', authenticate, serviceRoutes);
router.use('/professionals', authenticate, professionalRoutes);
router.use('/appointments', authenticate, appointmentRoutes);
router.use('/reports', authenticate, reportRoutes);
router.use('/integrations', authenticate, integrationRoutes);

// API documentation route (if needed)
router.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Nexus Services API',
      version: '1.0.0',
      documentation: 'https://docs.nexus-erp.com/services',
      endpoints: {
        health: {
          description: 'Health check and monitoring endpoints',
          routes: [
            'GET /health - Basic health check',
            'GET /health/detailed - Detailed health with dependencies',
            'GET /health/ready - Kubernetes readiness probe',
            'GET /health/live - Kubernetes liveness probe',
            'GET /health/metrics - Service metrics',
          ],
        },
        services: {
          description: 'Service/procedure management endpoints',
          routes: [
            'GET /api/services - List services',
            'POST /api/services - Create service',
            'GET /api/services/:id - Get service details',
            'PUT /api/services/:id - Update service',
            'DELETE /api/services/:id - Delete service',
            'GET /api/services/search - Search services',
            'GET /api/services/popular - Get popular services',
            'GET /api/services/categories - Get service categories',
          ],
        },
        professionals: {
          description: 'Professional/staff management endpoints',
          routes: [
            'GET /api/professionals - List professionals',
            'POST /api/professionals - Create professional',
            'GET /api/professionals/:id - Get professional details',
            'PUT /api/professionals/:id - Update professional',
            'DELETE /api/professionals/:id - Delete professional',
            'GET /api/professionals/search - Search professionals',
            'GET /api/professionals/available - Get available professionals',
            'PUT /api/professionals/:id/schedule - Update work schedule',
          ],
        },
        appointments: {
          description: 'Appointment and service completion tracking',
          routes: [
            'GET /api/appointments/completed - List completed appointments',
            'POST /api/appointments/completed - Create completed appointment',
            'GET /api/appointments/:id - Get appointment details',
            'PUT /api/appointments/:id - Update appointment',
            'POST /api/appointments/:id/photos - Upload photos',
            'GET /api/appointments/today - Today\'s appointments',
            'GET /api/appointments/revenue - Revenue summary',
          ],
        },
        reports: {
          description: 'Analytics and reporting endpoints',
          routes: [
            'GET /api/reports/daily - Daily report',
            'GET /api/reports/weekly - Weekly summary',
            'GET /api/reports/monthly - Monthly summary',
            'GET /api/reports/dashboard - Dashboard metrics',
            'GET /api/reports/professional/:id - Professional performance',
            'GET /api/reports/services - Service analytics',
            'GET /api/reports/financial - Financial report',
          ],
        },
        integrations: {
          description: 'Cross-module integration endpoints',
          routes: [
            'GET /api/integrations/customers/:id - Get customer from CRM',
            'GET /api/integrations/customers/search - Search customers',
            'POST /api/integrations/customers/:id/notes - Create customer note',
            'GET /api/integrations/health/modules - Module health status',
            'GET /api/integrations/connectivity/test/:module - Test connectivity',
          ],
        },
      },
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>',
        roles: ['admin', 'manager', 'staff'],
      },
      rateLimit: {
        default: '100 requests per 15 minutes per IP',
        reports: '10 requests per minute per user',
        integrations: '100 requests per minute per user',
      },
      pagination: {
        parameters: {
          page: 'Page number (default: 1)',
          limit: 'Items per page (default: 20, max: 100)',
          sortBy: 'Field to sort by (default: createdAt)',
          sortOrder: 'Sort order: asc or desc (default: desc)',
        },
      },
      responses: {
        success: {
          format: {
            success: true,
            data: '...',
            pagination: '... (for paginated responses)',
            meta: '... (additional metadata)',
          },
        },
        error: {
          format: {
            success: false,
            error: 'Error message',
            code: 'ERROR_CODE',
            details: '... (validation errors)',
          },
        },
      },
    },
    meta: {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

// Catch-all route for API endpoints
router.use('/api/*', (req, res) => {
  logger.warn('API endpoint not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'API_ENDPOINT_NOT_FOUND',
    suggestion: 'Check the API documentation at /api/docs',
    availableEndpoints: [
      '/api/services',
      '/api/professionals', 
      '/api/appointments',
      '/api/reports',
      '/api/integrations',
    ],
  });
});

// Root API info
router.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Nexus Services API',
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        documentation: '/api/docs',
        health: '/health',
        services: '/api/services',
        professionals: '/api/professionals',
        appointments: '/api/appointments',
        reports: '/api/reports',
        integrations: '/api/integrations',
      },
    },
  });
});

export default router;