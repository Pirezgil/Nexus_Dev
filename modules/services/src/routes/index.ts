import { Router } from 'express';
import { logger } from '../utils/logger';

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
 * Each route module handles its own authentication middleware
 * This allows for different auth strategies (JWT vs Gateway headers)
 */

// Health check routes (no authentication required)
router.use('/health', healthRoutes);

// Core business logic routes (authentication handled in route modules)
router.use('/services', serviceRoutes);
router.use('/professionals', professionalRoutes);
router.use('/appointments', appointmentRoutes);

// Analytics and reporting routes (authentication handled in route modules)
router.use('/reports', reportRoutes);

// Integration routes for cross-module communication (authentication handled in route modules)
router.use('/integrations', integrationRoutes);

// CORREÇÃO: Endpoints específicos para o módulo agendamento
// O frontend do agendamento espera que os endpoints estejam em /api/services/
// router.use('/api/services', integrationRoutes); // TEMPORARIAMENTE DESABILITADO

// Legacy routes for backward compatibility (without /api prefix)
// Each route handles its own authentication
router.use('/services', serviceRoutes);
router.use('/professionals', professionalRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reports', reportRoutes);
router.use('/integrations', integrationRoutes);

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
            'GET /services - List services',
            'POST /services - Create service',
            'GET /services/:id - Get service details',
            'PUT /services/:id - Update service',
            'DELETE /services/:id - Delete service',
            'GET /services/search - Search services',
            'GET /services/popular - Get popular services',
            'GET /services/categories - Get service categories',
          ],
        },
        professionals: {
          description: 'Professional/staff management endpoints',
          routes: [
            'GET /professionals - List professionals',
            'POST /professionals - Create professional',
            'GET /professionals/:id - Get professional details',
            'PUT /professionals/:id - Update professional',
            'DELETE /professionals/:id - Delete professional',
            'GET /professionals/search - Search professionals',
            'GET /professionals/available - Get available professionals',
            'PUT /professionals/:id/schedule - Update work schedule',
          ],
        },
        appointments: {
          description: 'Appointment and service completion tracking',
          routes: [
            'GET /appointments/completed - List completed appointments',
            'POST /appointments/completed - Create completed appointment',
            'GET /appointments/:id - Get appointment details',
            'PUT /appointments/:id - Update appointment',
            'POST /appointments/:id/photos - Upload photos',
            'GET /appointments/today - Today\'s appointments',
            'GET /appointments/revenue - Revenue summary',
          ],
        },
        reports: {
          description: 'Analytics and reporting endpoints',
          routes: [
            'GET /reports/daily - Daily report',
            'GET /reports/weekly - Weekly summary',
            'GET /reports/monthly - Monthly summary',
            'GET /reports/dashboard - Dashboard metrics',
            'GET /reports/professional/:id - Professional performance',
            'GET /reports/services - Service analytics',
            'GET /reports/financial - Financial report',
          ],
        },
        integrations: {
          description: 'Cross-module integration endpoints',
          routes: [
            'GET /integrations/customers/:id - Get customer from CRM',
            'GET /integrations/customers/search - Search customers',
            'POST /integrations/customers/:id/notes - Create customer note',
            'GET /integrations/health/modules - Module health status',
            'GET /integrations/connectivity/test/:module - Test connectivity',
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
      '/services',
      '/professionals', 
      '/appointments',
      '/reports',
      '/integrations',
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
        services: '/services',
        professionals: '/professionals',
        appointments: '/appointments',
        reports: '/reports',
        integrations: '/integrations',
      },
    },
  });
});

export default router;