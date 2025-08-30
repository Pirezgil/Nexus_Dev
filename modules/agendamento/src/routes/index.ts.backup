/**
 * Arquivo principal de rotas do módulo Agendamento
 * Centraliza todas as rotas da API
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error';

// Importar rotas específicas
import appointmentRoutes from './appointmentRoutes';
import availabilityRoutes from './availabilityRoutes';
import calendarRoutes from './calendarRoutes';
import notificationRoutes from './notificationRoutes';
import waitingListRoutes from './waitingListRoutes';
import healthRoutes from './healthRoutes';
import reportRoutes from './reportRoutes';
import validationRoutes from './validationRoutes';
import { webhookRoutes } from './webhookRoutes';

const router = Router();

// Rota de saúde (sem autenticação)
router.use('/health', healthRoutes);

// Cross-module validation routes (sem autenticação para serviços internos)
router.use('/api', validationRoutes);

// Rotas de webhook (sem autenticação - WhatsApp precisa acessar)
router.use('/webhook', webhookRoutes);

// === TESTE TEMPORÁRIO ===
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Route test working!', timestamp: new Date().toISOString() });
});

// Middleware de autenticação para todas as outras rotas
router.use(authMiddleware);

// Rotas principais da API (conforme especificação)
router.use('/appointments', appointmentRoutes);
router.use('/availability', availabilityRoutes);  // CRÍTICO - endpoint especificado
router.use('/calendar', calendarRoutes);         // CRÍTICO - endpoint especificado  
router.use('/notifications', notificationRoutes);
router.use('/waiting-list', waitingListRoutes);  // NOVO - Lista de espera para 100%
router.use('/schedule-blocks', calendarRoutes);  // schedule-blocks está no calendarController
router.use('/reports', reportRoutes);

// Middleware de tratamento de erros (deve ser o último)
router.use(errorHandler);

export default router;