import { Router } from 'express';
import { NoteController } from '../controllers/noteController';
import { authenticate, enforceCompanyAccess, auditLog } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { 
  createNoteSchema, 
  updateNoteSchema,
  paginationSchema 
} from '../types';
import { z } from 'zod';

const router = Router({ mergeParams: true }); // Enable access to parent router params
const noteController = new NoteController();

// Parameter validation schemas
const noteParamsSchema = z.object({
  params: z.object({
    customerId: z.string().uuid('ID do cliente deve ser um UUID válido'),
    noteId: z.string().uuid('ID da nota deve ser um UUID válido').optional(),
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
    type: z.enum(['GENERAL', 'IMPORTANT', 'REMINDER', 'FOLLOW_UP', 'COMPLAINT', 'COMPLIMENT']),
  }),
});

// Apply authentication to all routes
router.use(authenticate);
router.use(enforceCompanyAccess);

/**
 * @route GET /api/customers/:customerId/notes
 * @description Get paginated notes for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/',
  validateParams(customerParamsSchema),
  validateQuery(paginationSchema),
  noteController.getNotes
);

/**
 * @route POST /api/customers/:customerId/notes
 * @description Create new note for customer
 * @access Private (authenticated users)
 */
router.post(
  '/',
  validateParams(customerParamsSchema),
  validateBody(createNoteSchema),
  auditLog('CREATE_CUSTOMER_NOTE'),
  noteController.createNote
);

/**
 * @route GET /api/customers/:customerId/notes/recent
 * @description Get recent notes for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/recent',
  validateParams(customerParamsSchema),
  noteController.getRecentNotes
);

/**
 * @route GET /api/customers/:customerId/notes/search
 * @description Search notes by content
 * @access Private (authenticated users)
 */
router.get(
  '/search',
  validateParams(customerParamsSchema),
  noteController.searchNotes
);

/**
 * @route GET /api/customers/:customerId/notes/stats
 * @description Get notes statistics for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/stats',
  validateParams(customerParamsSchema),
  noteController.getNotesStats
);

/**
 * @route GET /api/customers/:customerId/notes/type/:type
 * @description Get notes by type for a customer
 * @access Private (authenticated users)
 */
router.get(
  '/type/:type',
  validateParams(typeParamsSchema),
  noteController.getNotesByType
);

/**
 * @route GET /api/customers/:customerId/notes/:noteId
 * @description Get note by ID
 * @access Private (authenticated users)
 */
router.get(
  '/:noteId',
  validateParams(noteParamsSchema),
  noteController.getNoteById
);

/**
 * @route PUT /api/customers/:customerId/notes/:noteId
 * @description Update note
 * @access Private (authenticated users)
 */
router.put(
  '/:noteId',
  validateParams(noteParamsSchema),
  validateBody(updateNoteSchema),
  auditLog('UPDATE_CUSTOMER_NOTE'),
  noteController.updateNote
);

/**
 * @route DELETE /api/customers/:customerId/notes/:noteId
 * @description Delete note
 * @access Private (authenticated users)
 */
router.delete(
  '/:noteId',
  validateParams(noteParamsSchema),
  auditLog('DELETE_CUSTOMER_NOTE'),
  noteController.deleteNote
);

export default router;