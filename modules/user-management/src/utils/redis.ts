import { createClient } from 'redis';
import { config } from './config';
import { logger } from './logger';

/**
 * Redis client configuration
 */
export const redisClient = createClient({
  url: config.redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis connection failed after 10 retries');
      }
      return Math.min(retries * 50, 500);
    },
  },
});

/**
 * Redis connection handlers
 */
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: err });
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

/**
 * Initialize Redis connection
 */
export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    process.exit(1);
  }
};

/**
 * Close Redis connection
 */
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Disconnected from Redis');
  } catch (error) {
    logger.error('Error disconnecting from Redis', { error });
  }
};

/**
 * Redis utility functions for session management
 */
export class SessionStore {
  private static prefix = 'session:';

  static async set(sessionId: string, data: any, expireInSeconds: number): Promise<void> {
    const key = this.prefix + sessionId;
    await redisClient.setEx(key, expireInSeconds, JSON.stringify(data));
  }

  static async get(sessionId: string): Promise<any> {
    const key = this.prefix + sessionId;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  static async delete(sessionId: string): Promise<void> {
    const key = this.prefix + sessionId;
    await redisClient.del(key);
  }

  static async exists(sessionId: string): Promise<boolean> {
    const key = this.prefix + sessionId;
    const exists = await redisClient.exists(key);
    return exists === 1;
  }

  static async extend(sessionId: string, expireInSeconds: number): Promise<void> {
    const key = this.prefix + sessionId;
    await redisClient.expire(key, expireInSeconds);
  }
}

/**
 * Redis utility functions for rate limiting
 */
export class RateLimiter {
  static async increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    const pipeline = redisClient.multi();
    
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    pipeline.ttl(key);
    
    const results = await pipeline.exec();
    
    const count = results?.[0] as number;
    const ttl = results?.[2] as number;
    
    return { count, ttl };
  }

  static async reset(key: string): Promise<void> {
    await redisClient.del(key);
  }
}

/**
 * Redis utility functions for caching
 */
export class Cache {
  static async set(key: string, value: any, expireInSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    
    if (expireInSeconds) {
      await redisClient.setEx(key, expireInSeconds, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  static async delete(key: string): Promise<void> {
    await redisClient.del(key);
  }

  static async deletePattern(pattern: string): Promise<void> {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  }

  static async exists(key: string): Promise<boolean> {
    const exists = await redisClient.exists(key);
    return exists === 1;
  }
}