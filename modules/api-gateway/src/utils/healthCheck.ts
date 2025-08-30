import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logger } from './logger';

export const healthCheckRouter = Router();

interface ServiceConfig {
  name: string;
  url: string;
  timeout?: number;
  criticalService?: boolean;
}

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  responseTime: number;
  details?: any;
  error?: string;
  url: string;
  timestamp: string;
}

interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  version: string;
  uptime: number;
  services: ServiceHealth[];
  gateway: {
    memory: NodeJS.MemoryUsage;
    cpu?: any;
    environment: string;
  };
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    unreachable: number;
  };
}

// Service configuration
const SERVICES: ServiceConfig[] = [
  {
    name: 'user-management',
    url: process.env.USER_MANAGEMENT_URL || 'http://localhost:5003',
    timeout: 5000,
    criticalService: true
  },
  {
    name: 'crm',
    url: process.env.CRM_URL || 'http://localhost:5004',
    timeout: 5000,
    criticalService: false
  },
  {
    name: 'services',
    url: process.env.SERVICES_URL || 'http://localhost:5005',
    timeout: 5000,
    criticalService: false
  },
  {
    name: 'agendamento',
    url: process.env.AGENDAMENTO_URL || 'http://localhost:5002',
    timeout: 5000,
    criticalService: false
  }
];

/**
 * Check health of a single service
 */
async function checkServiceHealth(serviceConfig: ServiceConfig): Promise<ServiceHealth> {
  const startTime = Date.now();
  const healthUrl = `${serviceConfig.url}/health`;
  
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      timeout: serviceConfig.timeout || 5000,
      headers: {
        'Accept': 'application/json',
        'X-Health-Check': 'gateway',
        'X-Source': 'nexus-api-gateway'
      }
    });
    
    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;
    
    let details: any = {};
    try {
      details = await response.json();
    } catch (parseError) {
      details = { rawResponse: await response.text().catch(() => 'Unable to parse response') };
    }

    return {
      service: serviceConfig.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      details,
      url: serviceConfig.url,
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      service: serviceConfig.name,
      status: 'unreachable',
      responseTime,
      error: error.message,
      url: serviceConfig.url,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Determine overall system health status
 */
function determineOverallHealth(serviceHealths: ServiceHealth[]): 'healthy' | 'degraded' | 'critical' {
  const criticalServices = SERVICES.filter(s => s.criticalService);
  const criticalServiceNames = criticalServices.map(s => s.name);
  
  // Check if any critical services are down
  const criticalServiceHealths = serviceHealths.filter(h => criticalServiceNames.includes(h.service));
  const unhealthyCriticalServices = criticalServiceHealths.filter(h => h.status !== 'healthy');
  
  if (unhealthyCriticalServices.length > 0) {
    return 'critical';
  }
  
  // Check overall service health
  const unhealthyServices = serviceHealths.filter(h => h.status !== 'healthy');
  const totalServices = serviceHealths.length;
  const unhealthyPercentage = (unhealthyServices.length / totalServices) * 100;
  
  if (unhealthyPercentage === 0) {
    return 'healthy';
  } else if (unhealthyPercentage < 50) {
    return 'degraded';
  } else {
    return 'critical';
  }
}

/**
 * Main health check endpoint
 */
healthCheckRouter.get('/', async (req: Request, res: Response) => {
  const checkStartTime = Date.now();
  
  try {
    // Check all services in parallel
    const servicePromises = SERVICES.map(service => checkServiceHealth(service));
    const serviceHealths = await Promise.all(servicePromises);
    
    // Calculate summary statistics
    const summary = {
      total: serviceHealths.length,
      healthy: serviceHealths.filter(h => h.status === 'healthy').length,
      unhealthy: serviceHealths.filter(h => h.status === 'unhealthy').length,
      unreachable: serviceHealths.filter(h => h.status === 'unreachable').length
    };
    
    // Determine overall status
    const overallStatus = determineOverallHealth(serviceHealths);
    const totalCheckTime = Date.now() - checkStartTime;
    
    const healthResponse: GatewayHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: serviceHealths,
      gateway: {
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      },
      summary
    };
    
    // Log health check results
    logger.info('Health check completed:', {
      status: overallStatus,
      checkTime: `${totalCheckTime}ms`,
      summary,
      services: serviceHealths.map(h => ({ 
        name: h.service, 
        status: h.status, 
        responseTime: `${h.responseTime}ms` 
      }))
    });
    
    // Set appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503; // 503 for critical
    
    res.status(httpStatus).json(healthResponse);
    
  } catch (error: any) {
    logger.error('Health check error:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(503).json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: 'Health check system error',
      details: error.message,
      gateway: {
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }
});

/**
 * Health check for individual service
 */
healthCheckRouter.get('/:serviceName', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const serviceConfig = SERVICES.find(s => s.name === serviceName);
  
  if (!serviceConfig) {
    return res.status(404).json({
      success: false,
      error: `Service '${serviceName}' not found`,
      availableServices: SERVICES.map(s => s.name)
    });
  }

  try {
    const serviceHealth = await checkServiceHealth(serviceConfig);
    
    logger.info('Individual service health check:', {
      service: serviceName,
      status: serviceHealth.status,
      responseTime: `${serviceHealth.responseTime}ms`
    });
    
    const httpStatus = serviceHealth.status === 'healthy' ? 200 : 503;
    
    res.status(httpStatus).json({
      service: serviceName,
      ...serviceHealth,
      gateway: {
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
    
  } catch (error: any) {
    logger.error('Individual service health check error:', {
      service: serviceName,
      error: error.message
    });
    
    res.status(503).json({
      service: serviceName,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed gateway metrics endpoint
 */
healthCheckRouter.get('/metrics/detailed', async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // CPU usage would require additional monitoring setup
    const detailedMetrics = {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        ...memoryUsage,
        formatted: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external)
        }
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      },
      services: SERVICES.map(s => ({
        name: s.name,
        url: s.url,
        criticalService: s.criticalService || false
      }))
    };
    
    res.status(200).json(detailedMetrics);
    
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to collect detailed metrics',
      message: error.message
    });
  }
});

/**
 * Simple ping endpoint for basic connectivity check
 */
healthCheckRouter.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Gateway is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Helper functions
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours}h ${minutes}m ${secs}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default healthCheckRouter;