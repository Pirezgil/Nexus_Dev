import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../utils/database';
import { redisClient } from '../utils/redis';
import { ApiResponse } from '../types';

const router = Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check database connectivity
    const databaseHealthy = await checkDatabaseHealth();

    // Check Redis connectivity
    let redisHealthy = true;
    try {
      await redisClient.ping();
    } catch (error) {
      redisHealthy = false;
    }

    const responseTime = Date.now() - startTime;
    const isHealthy = databaseHealthy && redisHealthy;

    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: databaseHealthy ? 'healthy' : 'unhealthy',
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy',
        },
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
      },
    };

    const response: ApiResponse = {
      success: isHealthy,
      data: healthData,
      message: isHealthy ? 'Service is healthy' : 'Service is experiencing issues',
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Health check failed',
      message: 'Unable to perform health check',
    };

    res.status(503).json(response);
  }
});

/**
 * @route   GET /health/ready
 * @desc    Readiness check for Kubernetes
 * @access  Public
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const databaseHealthy = await checkDatabaseHealth();
    
    if (databaseHealthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'database not available' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', reason: 'health check failed' });
  }
});

/**
 * @route   GET /health/live
 * @desc    Liveness check for Kubernetes
 * @access  Public
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if the process is running, it's alive
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;