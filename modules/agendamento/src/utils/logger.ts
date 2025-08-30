/**
 * Sistema de logging winston configurado para o módulo Agendamento
 * Logs estruturados com diferentes levels e formatos para desenvolvimento/produção
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from './config';

// Criar diretório de logs se não existir
const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'stack']
  })
);

// Formato para desenvolvimento (console colorido)
const developmentFormat = winston.format.combine(
  customFormat,
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, metadata }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(metadata).length > 0) {
      log += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return log;
  })
);

// Formato para produção (JSON estruturado)
const productionFormat = winston.format.combine(
  customFormat,
  winston.format.json()
);

// Configuração dos transports
const transports: winston.transport[] = [
  // Console transport (sempre ativo)
  new winston.transports.Console({
    level: config.logging.level,
    format: config.isDevelopment ? developmentFormat : productionFormat,
    silent: config.isTest
  })
];

// File transport (se habilitado)
if (config.logging.fileEnabled) {
  transports.push(
    // Log geral
    new winston.transports.File({
      filename: config.logging.filePath,
      level: config.logging.level,
      format: winston.format.combine(
        customFormat,
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Log apenas de erros
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '.error.log'),
      level: 'error',
      format: winston.format.combine(
        customFormat,
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
}

// Criar logger principal
const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  // Não sair em caso de erro não capturado
  exitOnError: false,
  // Adicionar informações sobre exceções não capturadas
  exceptionHandlers: config.logging.fileEnabled ? [
    new winston.transports.File({
      filename: config.logging.filePath.replace('.log', '.exceptions.log')
    })
  ] : []
});

// Tipos específicos para o módulo Agendamento
interface AppointmentLogData {
  appointmentId?: string;
  customerId?: string;
  professionalId?: string;
  serviceId?: string;
  date?: string;
  time?: string;
  status?: string;
  action?: string;
  userId?: string;
  companyId?: string;
}

interface NotificationLogData {
  appointmentId?: string;
  notificationId?: string;
  type?: string;
  channel?: string;
  recipient?: string;
  status?: string;
  providerId?: string;
  error?: string;
}

interface IntegrationLogData {
  module?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  requestId?: string;
  error?: string;
}

// Logger especializado para agendamentos
export const appointmentLogger = {
  created: (data: AppointmentLogData) => {
    logger.info('Agendamento criado', {
      type: 'appointment_created',
      ...data
    });
  },
  
  updated: (data: AppointmentLogData) => {
    logger.info('Agendamento atualizado', {
      type: 'appointment_updated',
      ...data
    });
  },
  
  cancelled: (data: AppointmentLogData & { reason?: string }) => {
    logger.info('Agendamento cancelado', {
      type: 'appointment_cancelled',
      ...data
    });
  },
  
  confirmed: (data: AppointmentLogData) => {
    logger.info('Agendamento confirmado', {
      type: 'appointment_confirmed',
      ...data
    });
  },
  
  completed: (data: AppointmentLogData) => {
    logger.info('Agendamento concluído', {
      type: 'appointment_completed',
      ...data
    });
  },
  
  noShow: (data: AppointmentLogData) => {
    logger.warn('Cliente não compareceu', {
      type: 'appointment_no_show',
      ...data
    });
  },
  
  conflict: (data: AppointmentLogData & { conflictReason: string }) => {
    logger.warn('Conflito de agendamento detectado', {
      type: 'schedule_conflict',
      ...data
    });
  }
};

// Logger especializado para notificações
export const notificationLogger = {
  sent: (data: NotificationLogData) => {
    logger.info('Notificação enviada', {
      type: 'notification_sent',
      ...data
    });
  },
  
  delivered: (data: NotificationLogData) => {
    logger.info('Notificação entregue', {
      type: 'notification_delivered',
      ...data
    });
  },
  
  failed: (data: NotificationLogData) => {
    logger.error('Falha no envio de notificação', {
      type: 'notification_failed',
      ...data
    });
  },
  
  webhook: (data: NotificationLogData & { payload?: any }) => {
    logger.debug('Webhook de notificação recebido', {
      type: 'notification_webhook',
      ...data
    });
  }
};

// Logger especializado para integrações
export const integrationLogger = {
  request: (data: IntegrationLogData) => {
    logger.debug('Requisição para módulo externo', {
      type: 'integration_request',
      ...data
    });
  },
  
  response: (data: IntegrationLogData) => {
    logger.debug('Resposta de módulo externo', {
      type: 'integration_response',
      ...data
    });
  },
  
  error: (data: IntegrationLogData) => {
    logger.error('Erro na integração com módulo externo', {
      type: 'integration_error',
      ...data
    });
  },
  
  timeout: (data: IntegrationLogData) => {
    logger.warn('Timeout na integração com módulo externo', {
      type: 'integration_timeout',
      ...data
    });
  }
};

// Logger para auditoria
export const auditLogger = {
  userAction: (action: string, userId: string, companyId: string, details?: any) => {
    logger.info('Ação do usuário', {
      type: 'user_audit',
      action,
      userId,
      companyId,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  systemAction: (action: string, details?: any) => {
    logger.info('Ação do sistema', {
      type: 'system_audit',
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  dataChange: (table: string, recordId: string, changes: any, userId?: string) => {
    logger.info('Alteração de dados', {
      type: 'data_audit',
      table,
      recordId,
      changes,
      userId,
      timestamp: new Date().toISOString()
    });
  }
};

// Logger para performance
export const performanceLogger = {
  request: (method: string, url: string, duration: number, statusCode: number) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : duration > 1000 ? 'warn' : 'debug';
    
    logger.log(level, 'Requisição HTTP', {
      type: 'http_request',
      method,
      url,
      duration,
      statusCode
    });
  },
  
  database: (operation: string, duration: number, query?: string) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    
    logger.log(level, 'Operação de banco de dados', {
      type: 'database_operation',
      operation,
      duration,
      slowQuery: duration > 1000,
      ...(config.isDevelopment && query ? { query } : {})
    });
  },
  
  cache: (operation: 'hit' | 'miss' | 'set' | 'del', key: string, duration?: number) => {
    logger.debug('Operação de cache', {
      type: 'cache_operation',
      operation,
      key,
      duration
    });
  }
};

// Middleware para log de requisições HTTP
export const httpLoggerMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log da requisição
  logger.debug('Requisição recebida', {
    type: 'http_request_start',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    companyId: req.user?.company_id
  });
  
  // Interceptar resposta
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - start;
    
    // Log da resposta
    performanceLogger.request(req.method, req.url, duration, res.statusCode);
    
    // Chamar método original
    return originalSend.call(this, body);
  };
  
  next();
};

// Função de cleanup para logs antigos
export const cleanupOldLogs = () => {
  if (!config.logging.fileEnabled) return;
  
  const logFiles = fs.readdirSync(logDir)
    .filter(file => file.endsWith('.log'))
    .map(file => ({
      name: file,
      path: path.join(logDir, file),
      stat: fs.statSync(path.join(logDir, file))
    }));
  
  // Remover logs mais antigos que 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  logFiles
    .filter(file => file.stat.mtime < thirtyDaysAgo)
    .forEach(file => {
      try {
        fs.unlinkSync(file.path);
        logger.info(`Log antigo removido: ${file.name}`);
      } catch (error) {
        logger.error(`Erro ao remover log antigo ${file.name}:`, error);
      }
    });
};

// Agendar limpeza de logs (executar diariamente)
if (config.logging.fileEnabled && !config.isTest) {
  setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000); // 24 horas
}

export default logger;
export {
  logger,
  appointmentLogger,
  notificationLogger,
  integrationLogger,
  auditLogger,
  performanceLogger
};