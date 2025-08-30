import { Router } from 'express';
import { serviceController } from '../controllers/serviceController';
import { authenticate, authorize, requireCompanyAccess } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';
import { ServiceCreateSchema, ServiceUpdateSchema, PaginationSchema } from '../types';

const router = Router();

// Apply authentication to all service routes
router.use(authenticate);
router.use(requireCompanyAccess);

/**
 * Service Routes
 * 
 * All routes require authentication and company access
 */

// GET /services - Get services with pagination and filters
router.get('/', 
  validatePagination,
  serviceController.getServices
);

// POST /services - Create a new service
router.post('/',
  authorize(['admin', 'manager', 'staff']),
  validate({
    body: ServiceCreateSchema.omit({ companyId: true }) // companyId is added automatically
  }),
  serviceController.createService
);

// GET /services/search - Search services
router.get('/search',
  serviceController.searchServices
);

// GET /services/popular - Get popular services
router.get('/popular',
  serviceController.getPopularServices
);

// GET /services/categories - Get service categories
router.get('/categories',
  serviceController.getServiceCategories
);

// POST /services/bulk-update-prices - Bulk update service prices
router.post('/bulk-update-prices',
  authorize(['admin', 'manager']),
  serviceController.bulkUpdatePrices
);

// GET /services/:id - Get service by ID
router.get('/:id',
  serviceController.getServiceById
);

// PUT /services/:id - Update service
router.put('/:id',
  authorize(['admin', 'manager', 'staff']),
  validate({
    body: ServiceUpdateSchema
  }),
  serviceController.updateService
);

// DELETE /services/:id - Delete service
router.delete('/:id',
  authorize(['admin', 'manager']),
  serviceController.deleteService
);

// POST /services/:id/duplicate - Duplicate service
router.post('/:id/duplicate',
  authorize(['admin', 'manager', 'staff']),
  serviceController.duplicateService
);

// GET /services/:id/statistics - Get service statistics
router.get('/:id/statistics',
  serviceController.getServiceStatistics
);

export default router;