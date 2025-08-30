import { Router } from 'express';
import { healthController } from '../controllers/healthController';

const router = Router();

/**
 * Health Check Routes
 * 
 * These routes are used for monitoring and health checks
 * They should be accessible without authentication for monitoring systems
 */

// Basic health check
router.get('/', healthController.healthCheck);

// Detailed health check with dependency status
router.get('/detailed', healthController.detailedHealth);

// Kubernetes readiness probe
router.get('/ready', healthController.readiness);

// Kubernetes liveness probe
router.get('/live', healthController.liveness);

// Service metrics (may require authentication in production)
router.get('/metrics', healthController.getMetrics);

export default router;