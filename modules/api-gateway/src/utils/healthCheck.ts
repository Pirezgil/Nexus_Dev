import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from './logger';

export const healthCheckRouter = Router();

interface ServiceStatus {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  responseTime?: number;
  error?: string;
  version?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceStatus[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    uptime: number;
    nodeVersion: string;
  };
}

const checkService = async (name: string, url: string, timeout = 5000): Promise<ServiceStatus> => {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'nexus-api-gateway-health-check'
      }
    } as any);
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json() as any;
      return {
        name,
        url,
        status: 'healthy',
        responseTime,
        version: data?.version || 'unknown'
      };
    } else {
      return {
        name,
        url,
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = `Timeout after ${timeout}ms`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    }
    
    return {
      name,
      url,
      status: 'unreachable',
      responseTime,
      error: errorMessage
    };
  }
};

healthCheckRouter.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = (req as any).requestId || 'unknown';
  
  try {
    // Get system information
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Define services to check
    const services = [
      {
        name: 'user-management',
        url: process.env.USER_MANAGEMENT_URL || 'http://nexus-user-management:3000'
      },
      {
        name: 'crm',
        url: process.env.CRM_URL || 'http://nexus-crm:3000'
      },
      {
        name: 'services',
        url: process.env.SERVICES_URL || 'http://nexus-services:3000'
      },
      {
        name: 'agendamento',
        url: process.env.AGENDAMENTO_URL || 'http://nexus-agendamento:3000'
      }
    ];
    
    // Check all services concurrently
    const serviceChecks = await Promise.all(
      services.map(service => checkService(service.name, service.url))
    );
    
    // Determine overall status
    const healthyCount = serviceChecks.filter(s => s.status === 'healthy').length;
    const totalServices = serviceChecks.length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalServices) {
      overallStatus = 'healthy';
    } else if (healthyCount > totalServices / 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }
    
    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: serviceChecks,
      system: {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        uptime: Math.floor(uptime),
        nodeVersion: process.version
      }
    };
    
    const responseTime = Date.now() - startTime;
    
    // Log health check
    logger.info('Health check completed:', {
      requestId,
      status: overallStatus,
      responseTime,
      servicesHealthy: healthyCount,
      servicesTotal: totalServices,
      ip: req.ip
    });
    
    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode)
       .setHeader('X-Response-Time', `${responseTime}ms`)
       .setHeader('Cache-Control', 'no-cache')
       .json(healthResponse);
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Health check error:', {
      requestId,
      error: error.message,
      responseTime,
      stack: error.stack
    });
    
    res.status(500)
       .setHeader('X-Response-Time', `${responseTime}ms`)
       .json({
         status: 'unhealthy',
         timestamp: new Date().toISOString(),
         error: 'Health check failed',
         message: error.message,
         requestId
       });
  }
});

// Simple liveness probe
healthCheckRouter.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple readiness probe
healthCheckRouter.get('/ready', (req: Request, res: Response) => {
  // Check if the gateway is ready to serve requests
  const memUsage = process.memoryUsage();
  const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  // Consider ready if memory usage is below 90%
  if (memoryPercentage > 90) {
    return res.status(503).json({
      status: 'not ready',
      reason: 'High memory usage',
      memoryPercentage: Math.round(memoryPercentage)
    });
  }
  
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    memoryPercentage: Math.round(memoryPercentage)
  });
});

export default healthCheckRouter;