import { Request, Response } from 'express';
import { getDatabaseHealth } from '../utils/database';
import { redis } from '../utils/redis';
import { integrationService } from '../services/integrationService';
import { logger, logHealthCheck } from '../utils/logger';
import { asyncHandler } from '../middleware/error';

export class HealthController {
  /**
   * Basic health check endpoint
   */
  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const health = {
        status: 'healthy',
        service: 'nexus-services',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        responseTime: Date.now() - startTime,
      };

      logHealthCheck('nexus-services', 'healthy', health);

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      const health = {
        status: 'unhealthy',
        service: 'nexus-services',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      logHealthCheck('nexus-services', 'unhealthy', health);

      res.status(503).json({
        success: false,
        data: health,
      });
    }
  });

  /**
   * Detailed health check with dependencies
   */
  detailedHealth = asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Check all dependencies in parallel
      const [databaseHealth, redisHealth, moduleHealth] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkModuleIntegrations(),
      ]);

      const health = {
        status: 'healthy',
        service: 'nexus-services',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        responseTime: Date.now() - startTime,
        dependencies: {
          database: this.getSettledResult(databaseHealth),
          redis: this.getSettledResult(redisHealth),
          integrations: this.getSettledResult(moduleHealth),
        },
        system: {
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
            external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100,
          },
          cpu: {
            usage: process.cpuUsage(),
          },
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        },
      };

      // Determine overall health status
      const dependencyStatuses = Object.values(health.dependencies);
      const hasUnhealthyDependency = dependencyStatuses.some(dep => dep.status !== 'healthy');
      
      if (hasUnhealthyDependency) {
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      logHealthCheck('nexus-services-detailed', health.status as any, health);

      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: health,
      });
    } catch (error) {
      const health = {
        status: 'unhealthy',
        service: 'nexus-services',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      logHealthCheck('nexus-services-detailed', 'unhealthy', health);

      res.status(503).json({
        success: false,
        data: health,
      });
    }
  });

  /**
   * Readiness probe for Kubernetes
   */
  readiness = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Check critical dependencies for readiness
      const [databaseReady, redisReady] = await Promise.allSettled([
        this.checkDatabaseReadiness(),
        this.checkRedisReadiness(),
      ]);

      const ready = {
        ready: true,
        service: 'nexus-services',
        timestamp: new Date().toISOString(),
        checks: {
          database: this.getSettledResult(databaseReady).status === 'healthy',
          redis: this.getSettledResult(redisReady).status === 'healthy',
        },
      };

      // Service is ready if critical dependencies are healthy
      ready.ready = ready.checks.database && ready.checks.redis;

      const statusCode = ready.ready ? 200 : 503;

      res.status(statusCode).json({
        success: ready.ready,
        data: ready,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        data: {
          ready: false,
          service: 'nexus-services',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * Liveness probe for Kubernetes
   */
  liveness = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Simple liveness check - just verify the process is responding
      const live = {
        alive: true,
        service: 'nexus-services',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
      };

      res.json({
        success: true,
        data: live,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        data: {
          alive: false,
          service: 'nexus-services',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<any> {
    try {
      const health = await getDatabaseHealth();
      return {
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        responseTime: health.responseTime,
        statistics: health.statistics,
        lastCheck: health.timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<any> {
    try {
      const isReady = redis.isReady();
      const pingResult = await redis.ping();
      const connectionInfo = redis.getConnectionInfo();

      return {
        status: isReady && pingResult ? 'healthy' : 'unhealthy',
        connected: connectionInfo.connected,
        ready: connectionInfo.ready,
        reconnectAttempts: connectionInfo.reconnectAttempts,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Check module integrations health
   */
  private async checkModuleIntegrations(): Promise<any> {
    try {
      const moduleHealth = await integrationService.getModuleHealthStatus();
      
      const allHealthy = Object.values(moduleHealth).every(module => module.status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        modules: moduleHealth,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Check database readiness (simpler check for readiness probe)
   */
  private async checkDatabaseReadiness(): Promise<any> {
    try {
      const health = await getDatabaseHealth();
      return {
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        responseTime: health.responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis readiness (simpler check for readiness probe)
   */
  private async checkRedisReadiness(): Promise<any> {
    try {
      const pingResult = await redis.ping();
      return {
        status: pingResult ? 'healthy' : 'unhealthy',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper method to extract result from Promise.allSettled
   */
  private getSettledResult(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    }
  }

  /**
   * Get service metrics
   */
  getMetrics = asyncHandler(async (req: Request, res: Response) => {
    try {
      const metrics = {
        service: 'nexus-services',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        eventLoop: {
          // This would require additional monitoring setup
          lag: 0, // process.hrtime() based calculation
        },
        gc: {
          // This would require gc-stats or similar
          collections: 0,
        },
        http: {
          // This would be tracked by middleware
          requests: {
            total: 0,
            active: 0,
          },
          responses: {
            '2xx': 0,
            '4xx': 0,
            '5xx': 0,
          },
        },
        database: {
          connections: {
            active: 0, // Would need Prisma connection info
            idle: 0,
          },
        },
        redis: {
          connectionInfo: redis.getConnectionInfo(),
        },
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get service metrics', { error });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get service metrics',
        code: 'METRICS_ERROR',
      });
    }
  });
}

export const healthController = new HealthController();