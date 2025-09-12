/**
 * Rotas para gerenciamento de agendamentos
 * Endpoints para CRUD completo de appointments
 * Com validações avançadas de conflitos e regras de negócio
 */

import { Router } from 'express';
import { appointmentController } from '../controllers/appointmentController';

// Import advanced validations
import { 
  validateAppointmentFormat, 
  validateAppointmentConflicts,
  suggestAlternativeTimes,
  validateAppointmentPermissions,
  logAppointmentOperation 
} from '../middleware/appointmentValidation';
// Import proper authentication middleware
import { authenticate, enforceCompanyAccess, requirePermission as requireCRMPermission } from '../middleware/auth';
import { 
  requirePermission, 
  validateOwnership,
  logAccess 
} from '../../../../shared/middleware/permissionValidation';

// Security middleware for string sanitization
const sanitizeStrings = (req: any, res: any, next: any) => {
  const sanitizeObj = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObj(obj[key]);
      }
    }
  };
  
  if (req.body) sanitizeObj(req.body);
  if (req.query) sanitizeObj(req.query);
  next();
};
import { prisma } from '../utils/database';

const router = Router();

// Apply authentication and company isolation to all routes
router.use(authenticate);
router.use(enforceCompanyAccess);

// GET /appointments - Lista agendamentos com filtros
router.get('/', 
  validateAppointmentPermissions('read'),
  logAccess('list_appointments'),
  appointmentController.getAppointments
);

// POST /appointments - Criar novo agendamento
router.post('/', 
  validateAppointmentPermissions('create'),
  logAppointmentOperation('create'),
  sanitizeStrings,
  validateAppointmentFormat,
  validateAppointmentConflicts,
  suggestAlternativeTimes,
  appointmentController.createAppointment
);

// GET /appointments/:id - Obter agendamento específico
router.get('/:id', 
  validateAppointmentPermissions('read'),
  validateOwnership('appointment', prisma),
  logAccess('get_appointment'),
  appointmentController.getAppointmentById
);

// PUT /appointments/:id - Atualizar agendamento (incluindo reagendamento)
router.put('/:id', 
  validateAppointmentPermissions('update'),
  validateOwnership('appointment', prisma),
  logAppointmentOperation('update'),
  sanitizeStrings,
  validateAppointmentFormat,
  validateAppointmentConflicts,
  suggestAlternativeTimes,
  appointmentController.updateAppointment
);

// DELETE /appointments/:id - Cancelar agendamento
router.delete('/:id', 
  validateAppointmentPermissions('delete'),
  validateOwnership('appointment', prisma),
  logAppointmentOperation('cancel'),
  appointmentController.cancelAppointment
);

// POST /appointments/:id/confirm - Confirmar agendamento
router.post('/:id/confirm', appointmentController.confirmAppointment);

// POST /appointments/:id/complete - Marcar como concluído
router.post('/:id/complete', appointmentController.completeAppointment);

// POST /appointments/:id/no-show - Marcar como falta
router.post('/:id/no-show', appointmentController.markNoShow);

// POST /appointments/:id/reminder - Enviar lembrete manual
router.post('/:id/reminder', async (req, res) => {
  // Redirecionar para controller de notificações
  req.params = { ...req.params };
  const { notificationController } = await import('../controllers/notificationController');
  return notificationController.sendReminder(req as any, res);
});

export default router;