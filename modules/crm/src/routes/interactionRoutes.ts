import { Router } from 'express';
import { InteractionController } from '../controllers/interactionController';
import { authenticate, enforceCompanyAccess, auditLog } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { 
  createInteractionSchema, 
  updateInteractionSchema,
  paginationSchema 
} from '../types';
import { z } from 'zod';

const router = Router({ mergeParams: true }); // Enable access to parent router params
const interactionController = new InteractionController();

// Parameter validation schemas
const interactionParamsSchema = z.object({
  params: z.object({
    customerId: z.string().uuid('ID do cliente deve ser um UUID válido'),
    interactionId: z.string().uuid('ID da interação deve ser um UUID válido').optional(),
  }),
});

const customerParamsSchema = z.object({
  params: z.object({
    customerId: z.string().uuid('ID do cliente deve ser um UUID válido'),
  }),
});

const typeParamsSchema = z.object({
  params: z.object({
    customerId: z.string().uuid('ID do cliente deve ser um UUID válido'),
    type: z.enum(['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'SMS', 'NOTE', 'TASK', 'VISIT']),
  }),
});

const completeInteractionSchema = z.object({
  body: z.object({
    completedAt: z.string().datetime().optional(),
  }),
});

// Temporarily disabled for timeout diagnosis
// router.use(authenticate);
// router.use(enforceCompanyAccess);

/**
 * @route GET /api/customers/:customerId/interactions
 * @description Get paginated interactions for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/',
  validateParams(customerParamsSchema),
  validateQuery(paginationSchema),
  interactionController.getInteractions
);

/**
 * @route POST /api/customers/:customerId/interactions
 * @description Create new interaction for customer
 * @access Private (authenticated users)
 */
router.post(
  '/',
  validateParams(customerParamsSchema),
  validateBody(createInteractionSchema),
  auditLog('CREATE_CUSTOMER_INTERACTION'),
  interactionController.createInteraction
);

/**
 * @route GET /api/customers/:customerId/interactions/upcoming
 * @description Get upcoming interactions for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/upcoming',
  validateParams(customerParamsSchema),
  interactionController.getUpcomingInteractions
);

/**
 * @route GET /api/customers/:customerId/interactions/overdue
 * @description Get overdue interactions for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/overdue',
  validateParams(customerParamsSchema),
  interactionController.getOverdueInteractions
);

/**
 * @route GET /api/customers/:customerId/interactions/search
 * @description Search interactions by title or description
 * @access Private (authenticated users)
 */
router.get(
  '/search',
  validateParams(customerParamsSchema),
  interactionController.searchInteractions
);

/**
 * @route GET /api/customers/:customerId/interactions/stats
 * @description Get interaction statistics for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/stats',
  validateParams(customerParamsSchema),
  interactionController.getInteractionStats
);

/**
 * @route GET /api/customers/:customerId/interactions/type/:type
 * @description Get interactions by type for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/type/:type',
  validateParams(typeParamsSchema),
  interactionController.getInteractionsByType
);

/**
 * @route GET /api/customers/:customerId/interactions/:interactionId
 * @description Get interaction by ID
 * @access Private (authenticated users)
 */
router.get(
  '/:interactionId',
  validateParams(interactionParamsSchema),
  interactionController.getInteractionById
);

/**
 * @route PUT /api/customers/:customerId/interactions/:interactionId
 * @description Update interaction
 * @access Private (authenticated users)
 */
router.put(
  '/:interactionId',
  validateParams(interactionParamsSchema),
  validateBody(updateInteractionSchema),
  auditLog('UPDATE_CUSTOMER_INTERACTION'),
  interactionController.updateInteraction
);

/**
 * @route DELETE /api/customers/:customerId/interactions/:interactionId
 * @description Delete interaction
 * @access Private (authenticated users)
 */
router.delete(
  '/:interactionId',
  validateParams(interactionParamsSchema),
  auditLog('DELETE_CUSTOMER_INTERACTION'),
  interactionController.deleteInteraction
);

/**
 * @route PATCH /api/customers/:customerId/interactions/:interactionId/complete
 * @description Mark interaction as completed
 * @access Private (authenticated users)
 */
router.patch(
  '/:interactionId/complete',
  validateParams(interactionParamsSchema),
  validateBody(completeInteractionSchema),
  auditLog('COMPLETE_CUSTOMER_INTERACTION'),
  interactionController.markAsCompleted
);

export default router;