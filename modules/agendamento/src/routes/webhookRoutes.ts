/**
 * Rotas para webhooks do WhatsApp Business API
 */

import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = Router();
const webhookController = new WebhookController();

/**
 * GET /webhook/whatsapp - Verificação do webhook
 * Usado pelo WhatsApp para verificar o endpoint
 */
router.get('/whatsapp', webhookController.verifyWebhook);

/**
 * POST /webhook/whatsapp - Processar events do webhook
 * Recebe updates de status de mensagens e mensagens recebidas
 */
router.post('/whatsapp', webhookController.handleWebhook);

/**
 * GET /webhook/stats/:company_id - Estatísticas dos webhooks
 * Métricas de entrega, leitura e status das mensagens
 */
router.get('/stats/:company_id', webhookController.getWebhookStats);

/**
 * GET /webhook/tracking/:company_id - Tracking de mensagens
 * Lista mensagens com informações de status e entrega
 */
router.get('/tracking/:company_id', webhookController.getMessageTracking);

export { router as webhookRoutes };