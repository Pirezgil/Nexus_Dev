/**
 * Validation routes for Agendamento module
 * Routes for cross-module validation of Agendamento entities
 */

import { Router } from 'express';
import { ValidationController } from '../controllers/validationController';

const router = Router();

// Appointment validation endpoints
router.get('/appointments/:id/validate', ValidationController.validateAppointment);
router.get('/appointments/:id/validate-status', ValidationController.validateAppointmentByStatus);
router.post('/appointments/validate-batch', ValidationController.validateAppointmentsBatch);

// Customer/Professional appointment validation
router.get('/appointments/customer/:customerId/validate', ValidationController.validateAppointmentsByCustomer);
router.get('/appointments/professional/:professionalId/validate', ValidationController.validateAppointmentsByProfessional);

// Time slot validation
router.post('/appointments/validate-timeslot', ValidationController.validateTimeSlot);

// Health check
router.get('/validation/health', ValidationController.healthCheck);

export default router;