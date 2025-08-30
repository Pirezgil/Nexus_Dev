/**
 * Configuração e conexão com Redis
 * Cache, sessões e comunicação entre módulos
 */

import { createClient } from 'redis';
import config from './config';
import { logger, performanceLogger } from './logger';

// Criar cliente Redis principal
const createRedisClient = () => {
  const client = createClient({
    url: config.redis.url,
    password: config.redis.password,
    retryDelayOnFailover: config.redis.retryDelayOnFailover,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    lazyConnect: true
  });

  // Event listeners
  client.on('connect', () => {
    logger.info('🔗 Conectando ao Redis...');
  });

  client.on('ready', () => {
    logger.info('✅ Redis conectado e pronto');
  });

  client.on('error', (error) => {
    logger.error('❌ Erro no Redis:', error);
  });

  client.on('end', () => {
    logger.info('🔴 Conexão com Redis encerrada');
  });

  client.on('reconnecting', () => {
    logger.warn('🔄 Reconectando ao Redis...');
  });

  return client;
};

// Instância principal do Redis
export const redis = createRedisClient();

// Cliente para pub/sub (separado para melhor performance)
export const redisPubSub = createRedisClient();

// Inicializar conexões
export const connectRedis = async (): Promise<boolean> => {
  try {
    await redis.connect();
    await redisPubSub.connect();
    return true;
  } catch (error) {
    logger.error('❌ Erro ao conectar com Redis:', error);
    return false;
  }
};

// Função para inicializar o Redis (compatibilidade com app.ts)
export const initializeRedis = async (): Promise<void> => {
  const connected = await connectRedis();
  if (!connected) {
    throw new Error('Failed to initialize Redis connection');
  }
};

// Testar conexão
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const pong = await redis.ping();
    logger.info('✅ Redis respondeu:', pong);
    return true;
  } catch (error) {
    logger.error('❌ Erro ao testar conexão Redis:', error);
    return false;
  }
};

// === CACHE FUNCTIONS ===
export const cache = {
  // Definir chave no cache
  set: async (key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> => {
    try {
      const start = Date.now();
      const serializedValue = JSON.stringify(value);
      
      await redis.setEx(key, ttlSeconds, serializedValue);
      
      const duration = Date.now() - start;
      performanceLogger.cache('set', key, duration);
      
      return true;
    } catch (error) {
      logger.error('Erro ao definir cache:', { key, error });
      return false;
    }
  },

  // Obter chave do cache
  get: async <T = any>(key: string): Promise<T | null> => {
    try {
      const start = Date.now();
      const value = await redis.get(key);
      const duration = Date.now() - start;
      
      if (value) {
        performanceLogger.cache('hit', key, duration);
        return JSON.parse(value) as T;
      } else {
        performanceLogger.cache('miss', key, duration);
        return null;
      }
    } catch (error) {
      logger.error('Erro ao obter cache:', { key, error });
      return null;
    }
  },

  // Deletar chave do cache
  del: async (key: string): Promise<boolean> => {
    try {
      const start = Date.now();
      const result = await redis.del(key);
      const duration = Date.now() - start;
      
      performanceLogger.cache('del', key, duration);
      
      return result > 0;
    } catch (error) {
      logger.error('Erro ao deletar cache:', { key, error });
      return false;
    }
  },

  // Verificar se chave existe
  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await redis.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Erro ao verificar existência no cache:', { key, error });
      return false;
    }
  },

  // Incrementar valor numérico
  incr: async (key: string, ttlSeconds: number = 3600): Promise<number> => {
    try {
      const value = await redis.incr(key);
      if (value === 1) {
        // Se é o primeiro valor, definir TTL
        await redis.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      logger.error('Erro ao incrementar cache:', { key, error });
      return 0;
    }
  },

  // Limpar cache com padrão
  clear: async (pattern: string): Promise<number> => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        const result = await redis.del(keys);
        logger.info(`Cache limpo: ${result} chaves removidas para padrão ${pattern}`);
        return result;
      }
      return 0;
    } catch (error) {
      logger.error('Erro ao limpar cache:', { pattern, error });
      return 0;
    }
  }
};

// === FUNÇÕES ESPECÍFICAS DE CACHE PARA AGENDAMENTO ===
export const appointmentCache = {
  // Chaves de cache específicas
  keys: {
    availability: (professionalId: string, date: string) => 
      `availability:${professionalId}:${date}`,
    professionalSchedule: (professionalId: string, date: string) => 
      `professional_schedule:${professionalId}:${date}`,
    businessHours: (companyId: string) => 
      `business_hours:${companyId}`,
    services: (companyId: string) => 
      `services:${companyId}`,
    professionals: (companyId: string) => 
      `professionals:${companyId}`,
    customerSearch: (companyId: string, query: string) => 
      `customer_search:${companyId}:${query}`,
    appointmentDetails: (appointmentId: string) => 
      `appointment:${appointmentId}`,
    calendarData: (companyId: string, view: string, date: string, professionalId?: string) =>
      `calendar:${companyId}:${view}:${date}${professionalId ? `:${professionalId}` : ''}`
  },

  // Cache de disponibilidade
  setAvailability: async (professionalId: string, date: string, availability: any, ttl = 1800) => {
    const key = appointmentCache.keys.availability(professionalId, date);
    return cache.set(key, availability, ttl);
  },

  getAvailability: async (professionalId: string, date: string) => {
    const key = appointmentCache.keys.availability(professionalId, date);
    return cache.get(key);
  },

  // Cache de dados do calendário
  setCalendarData: async (companyId: string, view: string, date: string, data: any, professionalId?: string, ttl = 300) => {
    const key = appointmentCache.keys.calendarData(companyId, view, date, professionalId);
    return cache.set(key, data, ttl);
  },

  getCalendarData: async (companyId: string, view: string, date: string, professionalId?: string) => {
    const key = appointmentCache.keys.calendarData(companyId, view, date, professionalId);
    return cache.get(key);
  },

  // Cache de horários comerciais
  setBusinessHours: async (companyId: string, businessHours: any, ttl = 3600) => {
    const key = appointmentCache.keys.businessHours(companyId);
    return cache.set(key, businessHours, ttl);
  },

  getBusinessHours: async (companyId: string) => {
    const key = appointmentCache.keys.businessHours(companyId);
    return cache.get(key);
  },

  // Invalidar cache quando dados mudam
  invalidateByProfessional: async (professionalId: string) => {
    const pattern = `*:${professionalId}:*`;
    return cache.clear(pattern);
  },

  invalidateByCompany: async (companyId: string) => {
    const patterns = [
      `*:${companyId}:*`,
      `business_hours:${companyId}`,
      `services:${companyId}`,
      `professionals:${companyId}`
    ];
    
    let totalCleared = 0;
    for (const pattern of patterns) {
      totalCleared += await cache.clear(pattern);
    }
    
    return totalCleared;
  },

  invalidateByDate: async (date: string) => {
    const pattern = `*:${date}*`;
    return cache.clear(pattern);
  }
};

// === PUB/SUB PARA COMUNICAÇÃO ENTRE MÓDULOS ===
export const pubsub = {
  // Publicar evento
  publish: async (channel: string, message: any): Promise<boolean> => {
    try {
      const serializedMessage = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
        module: 'agendamento'
      });
      
      await redisPubSub.publish(channel, serializedMessage);
      
      logger.debug('Evento publicado', {
        channel,
        messageType: message.type || 'unknown'
      });
      
      return true;
    } catch (error) {
      logger.error('Erro ao publicar evento:', { channel, error });
      return false;
    }
  },

  // Subscrever a canal
  subscribe: async (channel: string, callback: (message: any) => void): Promise<boolean> => {
    try {
      await redisPubSub.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error('Erro ao processar mensagem pub/sub:', { channel, error });
        }
      });
      
      logger.info(`Subscrito ao canal: ${channel}`);
      return true;
    } catch (error) {
      logger.error('Erro ao subscrever canal:', { channel, error });
      return false;
    }
  }
};

// === EVENTOS ESPECÍFICOS DO AGENDAMENTO ===
export const appointmentEvents = {
  // Canais de eventos
  channels: {
    appointmentCreated: 'appointment:created',
    appointmentUpdated: 'appointment:updated',
    appointmentCancelled: 'appointment:cancelled',
    appointmentCompleted: 'appointment:completed',
    notificationSent: 'notification:sent',
    scheduleChanged: 'schedule:changed'
  },

  // Publicar eventos
  publishAppointmentCreated: (appointmentId: string, data: any) => {
    return pubsub.publish(appointmentEvents.channels.appointmentCreated, {
      type: 'appointment_created',
      appointmentId,
      data
    });
  },

  publishAppointmentUpdated: (appointmentId: string, changes: any) => {
    return pubsub.publish(appointmentEvents.channels.appointmentUpdated, {
      type: 'appointment_updated',
      appointmentId,
      changes
    });
  },

  publishAppointmentCancelled: (appointmentId: string, reason: string) => {
    return pubsub.publish(appointmentEvents.channels.appointmentCancelled, {
      type: 'appointment_cancelled',
      appointmentId,
      reason
    });
  },

  publishNotificationSent: (appointmentId: string, notificationData: any) => {
    return pubsub.publish(appointmentEvents.channels.notificationSent, {
      type: 'notification_sent',
      appointmentId,
      notificationData
    });
  }
};

// Verificar saúde do Redis
export const checkRedisHealth = async () => {
  try {
    const start = Date.now();
    const pong = await redis.ping();
    const responseTime = Date.now() - start;
    
    // Testar operações básicas
    await redis.set('health_check', 'ok', { EX: 60 });
    const value = await redis.get('health_check');
    await redis.del('health_check');
    
    return {
      status: 'healthy',
      responseTime,
      ping: pong,
      operations: value === 'ok' ? 'working' : 'failed'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Graceful shutdown
export const closeRedisConnections = async () => {
  try {
    await redis.quit();
    await redisPubSub.quit();
    logger.info('✅ Conexões Redis fechadas');
  } catch (error) {
    logger.error('❌ Erro ao fechar conexões Redis:', error);
  }
};

// Handler para processo de shutdown
process.on('SIGTERM', closeRedisConnections);
process.on('SIGINT', closeRedisConnections);

export default redis;