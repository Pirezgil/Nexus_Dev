import { Router } from 'express';
import { professionalController } from '../controllers/professionalController';
import { gatewayAuthenticate, authorize, requireCompanyAccess } from '../middleware/gatewayAuth';
import { validate, validatePagination } from '../middleware/validation';
import { ProfessionalCreateSchema, ProfessionalUpdateSchema } from '../types';

const router = Router();

// Apply authentication to all professional routes
router.use(gatewayAuthenticate);
router.use(requireCompanyAccess);

/**
 * Professional Routes
 * 
 * All routes require authentication and company access
 */

// GET /professionals - Get professionals with pagination and filters
router.get('/', 
  validatePagination,
  professionalController.getProfessionals
);

// POST /professionals - Create a new professional
router.post('/',
  authorize(['admin', 'manager']),
  validate({
    body: ProfessionalCreateSchema.omit({ companyId: true }) // companyId is added automatically
  }),
  professionalController.createProfessional
);

// GET /professionals/search - Search professionals
router.get('/search',
  professionalController.searchProfessionals
);

// GET /professionals/specialties - Get professional specialties
router.get('/specialties',
  professionalController.getProfessionalSpecialties
);

// GET /professionals/available - Get available professionals for time slot
router.get('/available',
  professionalController.getAvailableProfessionals
);

// GET /professionals/performance - Get performance summary for all professionals
router.get('/performance',
  authorize(['admin', 'manager']),
  professionalController.getPerformanceSummary
);

// GET /professionals/:id - Get professional by ID
router.get('/:id',
  professionalController.getProfessionalById
);

// PUT /professionals/:id - Update professional
router.put('/:id',
  authorize(['admin', 'manager']),
  validate({
    body: ProfessionalUpdateSchema
  }),
  professionalController.updateProfessional
);

// DELETE /professionals/:id - Delete professional
router.delete('/:id',
  authorize(['admin', 'manager']),
  professionalController.deleteProfessional
);

// GET /professionals/:id/statistics - Get professional statistics
router.get('/:id/statistics',
  professionalController.getProfessionalStatistics
);

// PUT /professionals/:id/schedule - Update professional work schedule
router.put('/:id/schedule',
  authorize(['admin', 'manager', 'staff']),
  professionalController.updateWorkSchedule
);

// GET /professionals/:id/upcoming - Get upcoming appointments for professional
router.get('/:id/upcoming',
  professionalController.getUpcomingAppointments
);

export default router;