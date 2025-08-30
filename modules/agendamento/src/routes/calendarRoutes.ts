/**
 * Rotas para funcionalidades de calendário
 * Endpoints para visualização, disponibilidade e bloqueios
 */

import { Router } from 'express';
import { calendarController } from '../controllers/calendarController';
import { requirePermission } from '../middleware/auth';

const router = Router();

// GET /calendar - Dados para renderização do calendário (ENDPOINT CRÍTICO)
router.get('/', requirePermission('AGENDAMENTO:read'), calendarController.getCalendarData);

// === SCHEDULE BLOCKS ROUTES ===

// GET /schedule-blocks - Lista bloqueios de horário
router.get('/schedule-blocks', requirePermission('AGENDAMENTO:read'), calendarController.getScheduleBlocks);

// POST /schedule-blocks - Criar novo bloqueio
router.post('/schedule-blocks', requirePermission('AGENDAMENTO:write'), calendarController.createScheduleBlock);

// PUT /schedule-blocks/:id - Atualizar bloqueio
router.put('/schedule-blocks/:id', requirePermission('AGENDAMENTO:write'), calendarController.updateScheduleBlock);

// DELETE /schedule-blocks/:id - Remover bloqueio
router.delete('/schedule-blocks/:id', requirePermission('AGENDAMENTO:delete'), calendarController.deleteScheduleBlock);

export default router;