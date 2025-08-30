import { Router } from 'express';
import { appointmentController } from '../controllers/appointmentController';
import { authenticate, authorize, requireCompanyAccess } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';
import { uploadMultiple } from '../middleware/upload';
import { AppointmentCreateSchema, AppointmentUpdateSchema } from '../types';

const router = Router();

// Apply authentication to all appointment routes
router.use(authenticate);
router.use(requireCompanyAccess);

/**
 * Appointment Routes
 * 
 * All routes require authentication and company access
 */

// GET /appointments/completed - Get completed appointments with pagination and filters
router.get('/completed', 
  validatePagination,
  appointmentController.getAppointments
);

// POST /appointments/completed - Create a completed appointment
router.post('/completed',
  authorize(['admin', 'manager', 'staff']),
  validate({
    body: AppointmentCreateSchema.omit({ companyId: true }) // companyId is added automatically
  }),
  appointmentController.createCompletedAppointment
);

// GET /appointments/today - Get today's appointments
router.get('/today',
  appointmentController.getTodaysAppointments
);

// GET /appointments/revenue - Get revenue summary
router.get('/revenue',
  authorize(['admin', 'manager']),
  appointmentController.getRevenueSummary
);

// GET /appointments/statistics - Get appointment statistics
router.get('/statistics',
  authorize(['admin', 'manager']),
  appointmentController.getAppointmentStatistics
);

// GET /appointments/export - Export appointments data
router.get('/export',
  authorize(['admin', 'manager']),
  appointmentController.exportAppointments
);

// GET /appointments/:id - Get appointment by ID
router.get('/:id',
  appointmentController.getAppointmentById
);

// PUT /appointments/:id - Update appointment
router.put('/:id',
  authorize(['admin', 'manager', 'staff']),
  validate({
    body: AppointmentUpdateSchema
  }),
  appointmentController.updateAppointment
);

// PUT /appointments/:id/payment - Update payment status
router.put('/:id/payment',
  authorize(['admin', 'manager', 'staff']),
  appointmentController.updatePaymentStatus
);

// POST /appointments/:id/photos - Upload photos for appointment
router.post('/:id/photos',
  authorize(['admin', 'manager', 'staff']),
  uploadMultiple('photos', 10), // Max 10 photos
  appointmentController.addPhotosToAppointment
);

// GET /appointments/:id/photos - Get appointment photos
router.get('/:id/photos',
  appointmentController.getAppointmentPhotos
);

// DELETE /appointments/photos/:photoId - Delete a specific photo
router.delete('/photos/:photoId',
  authorize(['admin', 'manager', 'staff']),
  appointmentController.deletePhoto
);

export default router;