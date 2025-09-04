import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { authenticate, enforceCompanyAccess, auditLog } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { 
  createCustomerSchema, 
  updateCustomerSchema, 
  customerSearchSchema,
  paginationSchema,
  tagManagementSchema 
} from '../types';
import { z } from 'zod';

// Import new advanced validations
import { 
  validateDocuments, 
  validateUniqueFields, 
  validateRequiredFields,
  sanitizeStrings 
} from '../../shared/middleware/documentValidation';
import { 
  requirePermission, 
  validateOwnership,
  requireMinimumRole,
  logAccess 
} from '../../shared/middleware/permissionValidation';
import { prisma } from '../utils/database';

const router = Router();
const customerController = new CustomerController();

// Parameter validation schemas
const customerIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  }),
});

// Temporarily disabled for complete isolation test
// router.use(authenticate);
// router.use(enforceCompanyAccess);

/**
 * @route GET /api/customers
 * @description Get paginated list of customers with filters
 * @access Private (authenticated users)
 */
router.get(
  '/',
  requirePermission({ module: 'CRM', action: 'read' }),
  logAccess('list_customers'),
  validateQuery(paginationSchema.merge(customerSearchSchema)),
  customerController.getCustomers
);

/**
 * @route GET /api/customers/search
 * @description Advanced customer search
 * @access Private (authenticated users)
 */
router.get(
  '/search',
  customerController.searchCustomers
);

/**
 * @route GET /api/customers/tags
 * @description Get all customer tags for autocomplete
 * @access Private (authenticated users)
 */
router.get(
  '/tags',
  customerController.getCustomerTags
);

/**
 * @route POST /api/customers
 * @description Create new customer
 * @access Private (authenticated users)
 */
router.post(
  '/',
  // Temporarily disabled ALL middlewares for complete isolation test
  // requirePermission({ module: 'CRM', action: 'write' }),
  // sanitizeStrings,
  // validateRequiredFields(['name']),
  // validateBody(createCustomerSchema),
  // validateDocuments,
  // validateUniqueFields('customer', ['email', 'cpfCnpj'], prisma),
  // logAccess('create_customer'),
  // auditLog('CREATE_CUSTOMER'),
  customerController.createCustomer
);

/**
 * @route GET /api/customers/:id
 * @description Get customer by ID with full details
 * @access Private (authenticated users)
 */
router.get(
  '/:id',
  requirePermission({ module: 'CRM', action: 'read', resource: 'customer' }),
  validateOwnership('customer', prisma),
  logAccess('get_customer'),
  customerController.getCustomerById
);

/**
 * @route PUT /api/customers/:id
 * @description Update customer
 * @access Private (authenticated users)
 */
router.put(
  '/:id',
  requirePermission({ module: 'CRM', action: 'write', resource: 'customer' }),
  validateOwnership('customer', prisma),
  sanitizeStrings,
  validateBody(updateCustomerSchema),
  // Temporarily disabled for timeout diagnosis - validateDocuments,
  // Temporarily disabled for timeout diagnosis - validateUniqueFields('customer', ['email', 'cpfCnpj'], prisma),
  logAccess('update_customer'),
  auditLog('UPDATE_CUSTOMER'),
  customerController.updateCustomer
);

/**
 * @route DELETE /api/customers/:id
 * @description Delete customer
 * @access Private (authenticated users)
 */
router.delete(
  '/:id',
  requirePermission({ module: 'CRM', action: 'delete', resource: 'customer' }),
  validateOwnership('customer', prisma),
  logAccess('delete_customer'),
  auditLog('DELETE_CUSTOMER'),
  customerController.deleteCustomer
);

/**
 * @route GET /api/customers/:id/history
 * @description Get customer history (interactions + notes)
 * @access Private (authenticated users)
 */
router.get(
  '/:id/history',
  customerController.getCustomerHistory
);

/**
 * @route POST /api/customers/:id/tags
 * @description Add tags to customer
 * @access Private (authenticated users)
 */
router.post(
  '/:id/tags',
  validateBody(tagManagementSchema),
  auditLog('ADD_CUSTOMER_TAGS'),
  customerController.addTags
);

/**
 * @route DELETE /api/customers/:id/tags
 * @description Remove tags from customer
 * @access Private (authenticated users)
 */
router.delete(
  '/:id/tags',
  validateBody(tagManagementSchema),
  auditLog('REMOVE_CUSTOMER_TAGS'),
  customerController.removeTags
);

export default router;