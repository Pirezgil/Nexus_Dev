/**
 * Rotas para gerenciamento de notificações
 * Endpoints para envio, histórico e templates de mensagens
 */

import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';

const router = Router();

// === NOTIFICATIONS ROUTES ===

// GET /notifications - Lista histórico de notificações
router.get('/', notificationController.getNotifications);

// POST /notifications/test - Testar envio de notificação
router.post('/test', notificationController.testNotification);

// POST /notifications/bulk - Enviar notificações em lote
router.post('/bulk', notificationController.sendBulkNotifications);

// GET /notifications/stats - Estatísticas de notificações
router.get('/stats', notificationController.getNotificationStats);

// === MESSAGE TEMPLATES ROUTES ===

// GET /message-templates - Lista templates de mensagem
router.get('/message-templates', notificationController.getMessageTemplates);

// POST /message-templates - Criar template de mensagem
router.post('/message-templates', notificationController.createMessageTemplate);

// PUT /message-templates/:id - Atualizar template
router.put('/message-templates/:id', notificationController.updateMessageTemplate);

// DELETE /message-templates/:id - Remover template
router.delete('/message-templates/:id', notificationController.deleteMessageTemplate);

export default router;