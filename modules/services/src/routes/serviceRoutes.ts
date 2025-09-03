import { Router } from 'express';
import { serviceController } from '../controllers/serviceController';
import { professionalController } from '../controllers/professionalController';
import { gatewayAuthenticate, authorize, requireCompanyAccess } from '../middleware/gatewayAuth';
import { validate, validatePagination } from '../middleware/validation';
import { ServiceCreateSchema, ServiceUpdateSchema, PaginationSchema } from '../types';

const router = Router();

// Apply Gateway authentication to all service routes (trusts API Gateway validation)
router.use(gatewayAuthenticate);
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
  authorize(['ADMIN', 'MANAGER', 'STAFF']),
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
  authorize(['ADMIN', 'MANAGER']),
  serviceController.bulkUpdatePrices
);

// GET /services/:id - Get service by ID
router.get('/:id',
  serviceController.getServiceById
);

// PUT /services/:id - Update service
router.put('/:id',
  (req, res, next) => {
    console.log('🔍 PUT /:id ROUTE REACHED', {
      url: req.originalUrl,
      method: req.method,
      user: req.user,
      companyId: req.companyId
    });
    next();
  },
  authorize(['ADMIN', 'MANAGER', 'STAFF']),
  validate({
    body: ServiceUpdateSchema
  }),
  serviceController.updateService
);

// DELETE /services/:id - Delete service
router.delete('/:id',
  authorize(['ADMIN', 'MANAGER']),
  serviceController.deleteService
);

// POST /services/:id/duplicate - Duplicate service
router.post('/:id/duplicate',
  authorize(['ADMIN', 'MANAGER', 'STAFF']),
  serviceController.duplicateService
);

// GET /services/:id/statistics - Get service statistics
router.get('/:id/statistics',
  serviceController.getServiceStatistics
);

// CORREÇÃO: /services/professionals endpoint que o frontend espera
// O frontend chama /api/services/professionals mas o endpoint está em /api/professionals
// Vamos adicionar aqui para compatibilidade
router.get('/professionals', 
  validatePagination,
  professionalController.getProfessionals
);

export default router;