/**
 * Controller para health checks e status do módulo
 * Monitora saúde do sistema, banco de dados, Redis e integrações externas
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { checkDatabaseHealth } from '../utils/database';
import { checkRedisHealth } from '../utils/redis';
import { logger } from '../utils/logger';
import config from '../utils/config';
import { integrationService } from '../services/integrationService';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  details?: any;
  error?: string;
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: HealthCheckResult[];
}

export const healthController = {

  // GET /health - Health check básico
  basicHealth: async (req: Request, res: Response): Promise<void> => {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'agendamento',
          version: process.env.npm_package_version || '1.0.0',
          environment: config.NODE_ENV
        },
        message: 'Serviço de Agendamento operacional'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Erro no health check básico:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Falha no health check'
        }
      };
      
      res.status(503).json(response);
    }
  },

  // GET /health/detailed - Health check detalhado
  detailedHealth: async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const services: HealthCheckResult[] = [];

      // Verificar banco de dados
      const dbHealth = await checkDatabaseHealth();
      services.push({
        service: 'database',
        status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        responseTime: dbHealth.responseTime,
        details: {
          tablesAccessible: dbHealth.tablesAccessible,
          recordCount: dbHealth.recordCount
        },
        error: dbHealth.error
      });

      // Verificar Redis
      const redisHealth = await checkRedisHealth();
      services.push({
        service: 'redis',
        status: redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        responseTime: redisHealth.responseTime,
        details: {
          ping: redisHealth.ping,
          operations: redisHealth.operations
        },
        error: redisHealth.error
      });

      // Verificar integração com User Management
      try {
        const userMgmtHealth = await integrationService.checkUserManagementHealth();
        services.push({
          service: 'user-management',
          status: userMgmtHealth.success ? 'healthy' : 'unhealthy',
          responseTime: userMgmtHealth.responseTime,
          details: userMgmtHealth.data,
          error: userMgmtHealth.error
        });
      } catch (error) {
        services.push({
          service: 'user-management',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Verificar integração com CRM
      try {
        const crmHealth = await integrationService.checkCrmHealth();
        services.push({
          service: 'crm',
          status: crmHealth.success ? 'healthy' : 'unhealthy',
          responseTime: crmHealth.responseTime,
          details: crmHealth.data,
          error: crmHealth.error
        });
      } catch (error) {
        services.push({
          service: 'crm',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Verificar integração com Services
      try {
        const servicesHealth = await integrationService.checkServicesHealth();
        services.push({
          service: 'services-module',
          status: servicesHealth.success ? 'healthy' : 'unhealthy',
          responseTime: servicesHealth.responseTime,
          details: servicesHealth.data,
          error: servicesHealth.error
        });
      } catch (error) {
        services.push({
          service: 'services-module',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Verificar WhatsApp API (se habilitado)
      if (config.whatsapp.enabled) {
        try {
          const whatsappHealth = await integrationService.checkWhatsAppHealth();
          services.push({
            service: 'whatsapp',
            status: whatsappHealth.success ? 'healthy' : 'unhealthy',
            responseTime: whatsappHealth.responseTime,
            details: whatsappHealth.data,
            error: whatsappHealth.error
          });
        } catch (error) {
          services.push({
            service: 'whatsapp',
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Determinar status geral
      const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
      const degradedServices = services.filter(s => s.status === 'degraded').length;
      
      let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
      if (unhealthyServices > 0) {
        // Se mais da metade dos serviços estão problemáticos, sistema não saudável
        overallStatus = unhealthyServices > services.length / 2 ? 'unhealthy' : 'degraded';
      } else if (degradedServices > 0) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      const totalResponseTime = Date.now() - startTime;

      const systemHealth: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV,
        services
      };

      const response: ApiResponse = {
        success: overallStatus !== 'unhealthy',
        data: systemHealth
      };

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      res.status(statusCode).json(response);

    } catch (error) {
      logger.error('Erro no health check detalhado:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Falha no health check detalhado'
        }
      };
      
      res.status(503).json(response);
    }
  },

  // GET /health/readiness - Readiness probe para Kubernetes
  readinessProbe: async (req: Request, res: Response): Promise<void> => {
    try {
      // Verificar apenas serviços críticos
      const dbHealth = await checkDatabaseHealth();
      const redisHealth = await checkRedisHealth();

      const ready = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';

      if (ready) {
        const response: ApiResponse = {
          success: true,
          data: {
            status: 'ready',
            timestamp: new Date().toISOString()
          }
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          data: {
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            issues: [
              ...(dbHealth.status !== 'healthy' ? ['database'] : []),
              ...(redisHealth.status !== 'healthy' ? ['redis'] : [])
            ]
          }
        };
        res.status(503).json(response);
      }

    } catch (error) {
      logger.error('Erro no readiness probe:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'READINESS_CHECK_FAILED',
          message: 'Falha na verificação de prontidão'
        }
      };
      
      res.status(503).json(response);
    }
  },

  // GET /health/liveness - Liveness probe para Kubernetes
  livenessProbe: async (req: Request, res: Response): Promise<void> => {
    try {
      // Verificação básica se o processo está respondendo
      const response: ApiResponse = {
        success: true,
        data: {
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro no liveness probe:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LIVENESS_CHECK_FAILED',
          message: 'Falha na verificação de vida'
        }
      };
      
      res.status(503).json(response);
    }
  },

  // GET /health/metrics - Métricas básicas do sistema
  systemMetrics: async (req: Request, res: Response): Promise<void> => {
    try {
      const memoryUsage = process.memoryUsage();
      
      const response: ApiResponse = {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
          node_version: process.version,
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024), // MB
            usage_percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          },
          cpu: {
            usage: process.cpuUsage()
          },
          config: {
            port: config.PORT,
            log_level: config.LOG_LEVEL,
            whatsapp_enabled: config.whatsapp.enabled,
            sms_enabled: config.sms.enabled,
            email_enabled: config.email.enabled
          }
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Erro ao obter métricas do sistema:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'Falha ao obter métricas do sistema'
        }
      };
      
      res.status(500).json(response);
    }
  }
};