import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { redisClient } from '../utils/redis';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';

export class HealthController {
  /**
   * GET /health
   * Basic health check endpoint
   */
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'healthy',
        service: 'nexus-crm',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
      message: 'CRM service is running',
    };

    res.json(response);
  });

  /**
   * GET /health/detailed
   * Detailed health check with dependency status
   */
  detailedHealthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const checks = {
      database: false,
      redis: false,
    };

    let overall = true;

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
      logger.debug('Database health check passed');
    } catch (error) {
      checks.database = false;
      overall = false;
      logger.error('Database health check failed', { error });
    }

    // Check Redis connection
    try {
      if (redisClient.isOpen) {
        await redisClient.ping();
        checks.redis = true;
        logger.debug('Redis health check passed');
      } else {
        checks.redis = false;
        overall = false;
        logger.warn('Redis connection is not open');
      }
    } catch (error) {
      checks.redis = false;
      overall = false;
      logger.error('Redis health check failed', { error });
    }

    const response: ApiResponse = {
      success: overall,
      data: {
        status: overall ? 'healthy' : 'degraded',
        service: 'nexus-crm',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        checks,
        dependencies: {
          database: checks.database ? 'healthy' : 'unhealthy',
          redis: checks.redis ? 'healthy' : 'unhealthy',
        },
      },
      message: overall ? 'All systems operational' : 'Some dependencies are unhealthy',
    };

    const statusCode = overall ? 200 : 503;
    res.status(statusCode).json(response);
  });

  /**
   * GET /health/ready
   * Readiness probe for container orchestration
   */
  readinessCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let isReady = true;
    const checks = [];

    // Check if database is accessible
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({ name: 'database', status: 'ready' });
    } catch (error) {
      isReady = false;
      checks.push({ name: 'database', status: 'not ready', error: error.message });
    }

    // Check if Redis is accessible (optional for readiness)
    try {
      if (redisClient.isOpen) {
        await redisClient.ping();
        checks.push({ name: 'redis', status: 'ready' });
      } else {
        // Redis being down doesn't make the service not ready
        checks.push({ name: 'redis', status: 'degraded' });
      }
    } catch (error) {
      checks.push({ name: 'redis', status: 'degraded', error: error.message });
    }

    const response: ApiResponse = {
      success: isReady,
      data: {
        ready: isReady,
        checks,
        timestamp: new Date().toISOString(),
      },
      message: isReady ? 'Service is ready' : 'Service is not ready',
    };

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(response);
  });

  /**
   * GET /health/live
   * Liveness probe for container orchestration
   */
  livenessCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Simple liveness check - if we can respond, we're alive
    const response: ApiResponse = {
      success: true,
      data: {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      message: 'Service is alive',
    };

    res.json(response);
  });

  /**
   * GET /health/metrics
   * Basic metrics endpoint
   */
  getMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const memoryUsage = process.memoryUsage();
    
    // Convert bytes to MB
    const memoryInMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
    };

    const response: ApiResponse = {
      success: true,
      data: {
        service: 'nexus-crm',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          ...memoryInMB,
          unit: 'MB',
        },
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        environment: process.env.NODE_ENV || 'development',
      },
      message: 'Metrics retrieved successfully',
    };

    res.json(response);
  });
}