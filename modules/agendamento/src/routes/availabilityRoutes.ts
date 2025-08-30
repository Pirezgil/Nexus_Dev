/**
 * Rotas para verificação de disponibilidade de agendamentos
 * Endpoints conforme especificação docs/02-modules/agendamento.md
 */

import { Router } from 'express';
import { availabilityController } from '../controllers/availabilityController';

const router = Router();

// GET /availability - Endpoint CRÍTICO da especificação (linha 461)
router.get('/', availabilityController.getAvailability);

// GET /availability/quick - Verificação rápida de um slot específico
router.get('/quick', availabilityController.checkQuickAvailability);

// GET /availability/professionals - Profissionais disponíveis para um serviço/data
router.get('/professionals', availabilityController.getAvailableProfessionals);

export default router;