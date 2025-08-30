import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from './config';

class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.client = createClient({
        url: config.redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries >= this.maxReconnectAttempts) {
              logger.error('Redis: Maximum reconnection attempts reached');
              return new Error('Maximum reconnection attempts reached');
            }

            const delay = Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
            logger.warn(`Redis: Attempting reconnection ${retries + 1}/${this.maxReconnectAttempts} in ${delay}ms`);
            return delay;
          },
        },
        retry_unfulfilled_commands: true,
      });

      this.setupEventListeners();
    } catch (error) {
      logger.error('Redis: Failed to initialize client', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis: Connection established');
      this.isConnected = false; // Not yet ready
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis: Client ready for commands');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis: Connection error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis: Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis: Attempting to reconnect...');
      this.reconnectAttempts++;
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    if (this.isConnected) {
      logger.debug('Redis: Already connected');
      return;
    }

    try {
      await this.client.connect();
      logger.info('Redis: Successfully connected');
    } catch (error) {
      logger.error('Redis: Failed to connect', { error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      logger.warn('Redis: No client to disconnect');
      return;
    }

    try {
      await this.client.quit();
      logger.info('Redis: Successfully disconnected');
      this.isConnected = false;
    } catch (error) {
      logger.error('Redis: Error during disconnect', { error });
      // Force disconnect even if quit fails
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  public isReady(): boolean {
    return this.isConnected && this.client?.isReady === true;
  }

  public getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  // Cache operations with error handling
  public async get(key: string): Promise<string | null> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for GET operation', { key });
        return null;
      }

      const result = await this.client!.get(key);
      logger.debug('Redis: GET operation', { key, found: !!result });
      return result;
    } catch (error) {
      logger.error('Redis: GET operation failed', { key, error });
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for SET operation', { key });
        return false;
      }

      let result: string | null;
      if (ttlSeconds) {
        result = await this.client!.setEx(key, ttlSeconds, value);
      } else {
        result = await this.client!.set(key, value);
      }

      const success = result === 'OK';
      logger.debug('Redis: SET operation', { key, ttl: ttlSeconds, success });
      return success;
    } catch (error) {
      logger.error('Redis: SET operation failed', { key, error });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for DEL operation', { key });
        return false;
      }

      const result = await this.client!.del(key);
      const success = result > 0;
      logger.debug('Redis: DEL operation', { key, success });
      return success;
    } catch (error) {
      logger.error('Redis: DEL operation failed', { key, error });
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for EXISTS operation', { key });
        return false;
      }

      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis: EXISTS operation failed', { key, error });
      return false;
    }
  }

  // JSON operations
  public async setJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttlSeconds);
    } catch (error) {
      logger.error('Redis: JSON SET operation failed', { key, error });
      return false;
    }
  }

  public async getJSON<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis: JSON GET operation failed', { key, error });
      return null;
    }
  }

  // Hash operations
  public async hSet(key: string, field: string, value: string): Promise<boolean> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for HSET operation', { key, field });
        return false;
      }

      const result = await this.client!.hSet(key, field, value);
      return result >= 0;
    } catch (error) {
      logger.error('Redis: HSET operation failed', { key, field, error });
      return false;
    }
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for HGET operation', { key, field });
        return undefined;
      }

      return await this.client!.hGet(key, field);
    } catch (error) {
      logger.error('Redis: HGET operation failed', { key, field, error });
      return undefined;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string> | null> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for HGETALL operation', { key });
        return null;
      }

      return await this.client!.hGetAll(key);
    } catch (error) {
      logger.error('Redis: HGETALL operation failed', { key, error });
      return null;
    }
  }

  // List operations
  public async lPush(key: string, ...values: string[]): Promise<number | null> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for LPUSH operation', { key });
        return null;
      }

      return await this.client!.lPush(key, values);
    } catch (error) {
      logger.error('Redis: LPUSH operation failed', { key, error });
      return null;
    }
  }

  public async rPop(key: string): Promise<string | null> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for RPOP operation', { key });
        return null;
      }

      return await this.client!.rPop(key);
    } catch (error) {
      logger.error('Redis: RPOP operation failed', { key, error });
      return null;
    }
  }

  // Pub/Sub operations
  public async publish(channel: string, message: string): Promise<number | null> {
    try {
      if (!this.isReady()) {
        logger.warn('Redis: Client not ready for PUBLISH operation', { channel });
        return null;
      }

      const result = await this.client!.publish(channel, message);
      logger.debug('Redis: Message published', { channel, subscribers: result });
      return result;
    } catch (error) {
      logger.error('Redis: PUBLISH operation failed', { channel, error });
      return null;
    }
  }

  // Health check
  public async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis: PING failed', { error });
      return false;
    }
  }

  // Get connection info
  public getConnectionInfo() {
    return {
      connected: this.isConnected,
      ready: this.isReady(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      url: config.redisUrl,
    };
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Initialize Redis connection
export const initializeRedis = async (): Promise<void> => {
  try {
    await redisManager.connect();
    logger.info('Redis: Initialization completed');
  } catch (error) {
    logger.error('Redis: Initialization failed', { error });
    throw error;
  }
};

// Gracefully close Redis connection
export const closeRedis = async (): Promise<void> => {
  try {
    await redisManager.disconnect();
    logger.info('Redis: Connection closed gracefully');
  } catch (error) {
    logger.error('Redis: Error closing connection', { error });
    throw error;
  }
};

// Export Redis manager and client
export const redis = redisManager;
export const getRedisClient = () => redisManager.getClient();

// Cache utility functions
export const cacheService = {
  // User session caching
  setUserSession: async (sessionId: string, userData: any, ttlSeconds: number = 3600): Promise<boolean> => {
    const key = `session:${sessionId}`;
    return await redis.setJSON(key, userData, ttlSeconds);
  },

  getUserSession: async <T = any>(sessionId: string): Promise<T | null> => {
    const key = `session:${sessionId}`;
    return await redis.getJSON<T>(key);
  },

  // Service data caching
  setServiceCache: async (serviceId: string, data: any, ttlSeconds: number = 300): Promise<boolean> => {
    const key = `service:${serviceId}`;
    return await redis.setJSON(key, data, ttlSeconds);
  },

  getServiceCache: async <T = any>(serviceId: string): Promise<T | null> => {
    const key = `service:${serviceId}`;
    return await redis.getJSON<T>(key);
  },

  // Professional data caching
  setProfessionalCache: async (professionalId: string, data: any, ttlSeconds: number = 300): Promise<boolean> => {
    const key = `professional:${professionalId}`;
    return await redis.setJSON(key, data, ttlSeconds);
  },

  getProfessionalCache: async <T = any>(professionalId: string): Promise<T | null> => {
    const key = `professional:${professionalId}`;
    return await redis.getJSON<T>(key);
  },

  // Appointment data caching
  setAppointmentCache: async (appointmentId: string, data: any, ttlSeconds: number = 300): Promise<boolean> => {
    const key = `appointment:${appointmentId}`;
    return await redis.setJSON(key, data, ttlSeconds);
  },

  getAppointmentCache: async <T = any>(appointmentId: string): Promise<T | null> => {
    const key = `appointment:${appointmentId}`;
    return await redis.getJSON<T>(key);
  },

  // Rate limiting
  incrementRateLimit: async (key: string, windowSeconds: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    try {
      if (!redis.isReady()) {
        return { allowed: true, remaining: limit, resetTime: Date.now() + windowSeconds * 1000 };
      }

      const rateLimitKey = `rate_limit:${key}`;
      const current = await redis.get(rateLimitKey);
      const count = current ? parseInt(current) : 0;

      if (count >= limit) {
        const ttl = await redis.getClient().ttl(rateLimitKey);
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (ttl * 1000),
        };
      }

      // Increment counter
      if (count === 0) {
        await redis.set(rateLimitKey, '1', windowSeconds);
      } else {
        await redis.getClient().incr(rateLimitKey);
      }

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    } catch (error) {
      logger.error('Redis: Rate limit check failed', { key, error });
      return { allowed: true, remaining: limit, resetTime: Date.now() + windowSeconds * 1000 };
    }
  },

  // Clear all cache with pattern
  clearCachePattern: async (pattern: string): Promise<number> => {
    try {
      if (!redis.isReady()) {
        return 0;
      }

      const client = redis.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      return await client.del(keys);
    } catch (error) {
      logger.error('Redis: Clear cache pattern failed', { pattern, error });
      return 0;
    }
  },
};

export default redis;