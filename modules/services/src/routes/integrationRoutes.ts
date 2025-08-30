import { Router } from 'express';
import { integrationController } from '../controllers/integrationController';
import { authenticate, authorize, requireCompanyAccess, authenticateServiceAccount } from '../middleware/auth';
import { customRateLimit } from '../middleware/validation';

const router = Router();

/**
 * Integration Routes
 * 
 * These routes handle cross-module communication and integrations
 */

// Integration rate limiting - more lenient for service-to-service communication
const integrationRateLimit = customRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute
  message: 'Too many integration requests, please try again later',
  keyGenerator: (req) => `integration:${req.user?.id || req.ip}`,
});

router.use(integrationRateLimit);

/**
 * Customer Integration Routes (CRM)
 */

// GET /customers/:customerId - Get customer from CRM
router.get('/customers/:customerId',
  authenticate,
  requireCompanyAccess,
  integrationController.getCustomer
);

// GET /customers/search - Search customers in CRM
router.get('/customers/search',
  authenticate,
  requireCompanyAccess,
  integrationController.searchCustomers
);

// POST /customers/:customerId/notes - Create note for customer in CRM
router.post('/customers/:customerId/notes',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager', 'staff']),
  integrationController.createCustomerNote
);

// POST /customers/:customerId/service-completed - Notify CRM about service completion
router.post('/customers/:customerId/service-completed',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager', 'staff']),
  integrationController.notifyServiceCompletion
);

// POST /customers/batch-update - Batch update customer data in CRM
router.post('/customers/batch-update',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager']),
  integrationController.batchUpdateCustomerData
);

/**
 * User Management Integration Routes
 */

// GET /users/:userId/profile - Get user profile from User Management
router.get('/users/:userId/profile',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager']),
  integrationController.getUserProfile
);

// POST /professionals/:professionalId/sync - Sync professional data with User Management
router.post('/professionals/:professionalId/sync',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager']),
  integrationController.syncProfessionalData
);

/**
 * CRITICAL: Agendamento Module Integration Routes
 * These endpoints are required for the Agendamento module to function
 */

// GET /services/list - Get services list for Agendamento module
router.get('/services/list',
  authenticate,
  requireCompanyAccess,
  integrationController.getServicesList
);

// GET /professionals/list - Get professionals list for Agendamento module
router.get('/professionals/list',
  authenticate,
  requireCompanyAccess,
  integrationController.getProfessionalsList
);

// GET /professionals/:id/availability - Check professional availability for specific date/service
router.get('/professionals/:id/availability',
  authenticate,
  requireCompanyAccess,
  integrationController.getProfessionalAvailability
);

// POST /appointments/:id/complete - Complete appointment callback from Agendamento
router.post('/appointments/:id/complete',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager', 'staff']),
  integrationController.completeAppointment
);

/**
 * System Integration Routes
 */

// GET /health/modules - Get health status of integrated modules
router.get('/health/modules',
  authenticate,
  authorize(['admin', 'manager']),
  integrationController.getModuleHealth
);

// GET /connectivity/test/:module - Test connectivity to specific module
router.get('/connectivity/test/:module',
  authenticate,
  authorize(['admin', 'manager']),
  integrationController.testConnectivity
);

// GET /statistics - Get integration usage statistics
router.get('/statistics',
  authenticate,
  requireCompanyAccess,
  authorize(['admin', 'manager']),
  integrationController.getIntegrationStats
);

// DELETE /cache - Clear integration caches
router.delete('/cache',
  authenticate,
  authorize(['admin']),
  integrationController.clearCaches
);

/**
 * Service-to-Service Routes
 * These routes are for internal communication between services
 * They use service account authentication instead of user authentication
 */

// Internal service routes - no user authentication required, use service key
router.use('/internal', authenticateServiceAccount);

// POST /internal/customers/batch-notify - Internal batch notification endpoint
router.post('/internal/customers/batch-notify',
  integrationController.batchUpdateCustomerData
);

// GET /internal/health - Internal health check
router.get('/internal/health',
  integrationController.getModuleHealth
);

export default router;