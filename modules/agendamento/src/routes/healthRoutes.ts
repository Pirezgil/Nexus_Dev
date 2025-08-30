/**
 * Rotas para health checks e monitoramento
 * Endpoints para verificar saúde do sistema
 */

import { Router } from 'express';
import { healthController } from '../controllers/healthController';

const router = Router();

// GET /health - Health check básico
router.get('/', healthController.basicHealth);

// GET /health/detailed - Health check detalhado
router.get('/detailed', healthController.detailedHealth);

// GET /health/readiness - Readiness probe (Kubernetes)
router.get('/readiness', healthController.readinessProbe);

// GET /health/liveness - Liveness probe (Kubernetes)
router.get('/liveness', healthController.livenessProbe);

// GET /health/metrics - Métricas do sistema
router.get('/metrics', healthController.systemMetrics);

export default router;