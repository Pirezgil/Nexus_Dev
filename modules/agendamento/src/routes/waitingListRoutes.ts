/**
 * Rotas para gestão de lista de espera
 * Endpoints para waiting list quando horários estão ocupados
 */

import { Router } from 'express';
import { waitingListController } from '../controllers/waitingListController';

const router = Router();

// GET /waiting-list - Lista pessoas na lista de espera
router.get('/', waitingListController.getWaitingList);

// POST /waiting-list - Adicionar à lista de espera
router.post('/', waitingListController.addToWaitingList);

// PUT /waiting-list/:id - Atualizar entrada da lista de espera
router.put('/:id', waitingListController.updateWaitingEntry);

// DELETE /waiting-list/:id - Remover da lista de espera
router.delete('/:id', waitingListController.removeFromWaitingList);

// POST /waiting-list/:id/contact - Contatar pessoa da lista de espera
router.post('/:id/contact', waitingListController.contactWaitingEntry);

// POST /waiting-list/:id/convert - Converter para agendamento
router.post('/:id/convert', waitingListController.convertToAppointment);

// GET /waiting-list/stats - Estatísticas da lista de espera
router.get('/stats', waitingListController.getWaitingListStats);

export default router;