import { Router } from 'express';
import customerRoutesNoAuth from './customerRoutes';
import healthRoutes from './healthRoutes';
import statsRoutes from './statsRoutes';

const router = Router();

/**
 * API Routes
 */

// Health check routes (public)
router.use('/health', healthRoutes);

// Validation routes temporarily disabled for infrastructure setup

// Customer management routes - NO AUTH (TESTE)
router.use('/customers', customerRoutesNoAuth);

// Stats routes - NO AUTH (TESTE) 
router.use('/stats', statsRoutes);

// Rota de teste para validação de conectividade
router.post('/test-connection', (req, res) => {
  res.json({
    success: true,
    message: 'Conexão CRM funcionando!',
    timestamp: new Date().toISOString(),
    receivedData: {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      method: req.method,
      url: req.url
    }
  });
});

// API Info route
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Nexus CRM - SIMPLIFIED',
      version: '2.0.0-simplified',
      description: 'Customer Relationship Management - Direct Database Access',
      architecture: 'simplified',
      features: ['Direct DB connection', 'No API Gateway dependency', 'Minimal middleware'],
      endpoints: {
        health: '/health',
        customers: '/api/customers',
        test: '/api/test-connection',
      }
    },
    message: 'Nexus CRM API simplificado funcionando',
  });
});

// Catch-all for undefined API routes
router.all('/*', (req, res) => {
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