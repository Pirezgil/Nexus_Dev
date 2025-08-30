import { Router } from 'express';
import { HealthController } from '../controllers/healthController';

const router = Router();
const healthController = new HealthController();

/**
 * @route GET /health
 * @description Basic health check endpoint
 * @access Public
 */
router.get('/', healthController.healthCheck);

/**
 * @route GET /health/detailed
 * @description Detailed health check with dependency status
 * @access Public
 */
router.get('/detailed', healthController.detailedHealthCheck);

/**
 * @route GET /health/ready
 * @description Readiness probe for container orchestration
 * @access Public
 */
router.get('/ready', healthController.readinessCheck);

/**
 * @route GET /health/live
 * @description Liveness probe for container orchestration
 * @access Public
 */
router.get('/live', healthController.livenessCheck);

/**
 * @route GET /health/metrics
 * @description Basic metrics endpoint
 * @access Public
 */
router.get('/metrics', healthController.getMetrics);

export default router;