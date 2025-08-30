import { Router } from 'express';
import customerRoutes from './customerRoutes';
import noteRoutes from './noteRoutes';
import interactionRoutes from './interactionRoutes';
import statsRoutes from './statsRoutes';
import healthRoutes from './healthRoutes';

const router = Router();

/**
 * API Routes
 */

// Health check routes (public)
router.use('/health', healthRoutes);

// Validation routes temporarily disabled for infrastructure setup

// Customer management routes
router.use('/api/customers', customerRoutes);

// Customer notes routes (nested under customers)
router.use('/api/customers/:customerId/notes', noteRoutes);

// Customer interactions routes (nested under customers)
router.use('/api/customers/:customerId/interactions', interactionRoutes);

// Statistics routes
router.use('/api/stats', statsRoutes);

// API Info route
router.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Nexus CRM',
      version: '1.0.0',
      description: 'Customer Relationship Management module for Nexus ERP',
      endpoints: {
        health: '/health',
        customers: '/api/customers',
        statistics: '/api/stats',
      },
      documentation: {
        swagger: '/api/docs', // Future implementation
        postman: '/api/postman', // Future implementation
      },
    },
    message: 'Nexus CRM API is running',
  });
});

// Catch-all for undefined API routes
router.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: {
      health: 'GET /health',
      customers: {
        list: 'GET /api/customers',
        create: 'POST /api/customers',
        get: 'GET /api/customers/:id',
        update: 'PUT /api/customers/:id',
        delete: 'DELETE /api/customers/:id',
        search: 'GET /api/customers/search',
        history: 'GET /api/customers/:id/history',
        tags: 'GET /api/customers/tags',
        addTags: 'POST /api/customers/:id/tags',
        removeTags: 'DELETE /api/customers/:id/tags',
      },
      notes: {
        list: 'GET /api/customers/:customerId/notes',
        create: 'POST /api/customers/:customerId/notes',
        get: 'GET /api/customers/:customerId/notes/:noteId',
        update: 'PUT /api/customers/:customerId/notes/:noteId',
        delete: 'DELETE /api/customers/:customerId/notes/:noteId',
        recent: 'GET /api/customers/:customerId/notes/recent',
        search: 'GET /api/customers/:customerId/notes/search',
        stats: 'GET /api/customers/:customerId/notes/stats',
        byType: 'GET /api/customers/:customerId/notes/type/:type',
      },
      interactions: {
        list: 'GET /api/customers/:customerId/interactions',
        create: 'POST /api/customers/:customerId/interactions',
        get: 'GET /api/customers/:customerId/interactions/:interactionId',
        update: 'PUT /api/customers/:customerId/interactions/:interactionId',
        delete: 'DELETE /api/customers/:customerId/interactions/:interactionId',
        complete: 'PATCH /api/customers/:customerId/interactions/:interactionId/complete',
        upcoming: 'GET /api/customers/:customerId/interactions/upcoming',
        overdue: 'GET /api/customers/:customerId/interactions/overdue',
        search: 'GET /api/customers/:customerId/interactions/search',
        stats: 'GET /api/customers/:customerId/interactions/stats',
        byType: 'GET /api/customers/:customerId/interactions/type/:type',
      },
      statistics: {
        overview: 'GET /api/stats',
        dashboard: 'GET /api/stats/dashboard',
        performance: 'GET /api/stats/performance',
        dailyActivity: 'GET /api/stats/daily-activity',
        customerActivity: 'GET /api/stats/customers/:customerId/activity',
        refresh: 'POST /api/stats/refresh',
      },
    },
  });
});

export default router;