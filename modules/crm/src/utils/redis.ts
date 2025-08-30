import { createClient } from 'redis';
import { config } from './config';
import { logger } from './logger';

// Create Redis client
export const redisClient = createClient({
  url: config.redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis reconnection failed after 10 attempts');
        return new Error('Redis reconnection failed');
      }
      return Math.min(retries * 50, 1000);
    },
  },
});

// Redis connection event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis client connected and ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Connect to Redis
const connectRedis = async (): Promise<void> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    throw error;
  }
};

// Redis utility functions
export const redis = {
  // Get value
  async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      throw error;
    }
  },

  // Set value with optional expiration
  async set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<void> {
    try {
      if (options) {
        await redisClient.set(key, value, options);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET error', { key, error });
      throw error;
    }
  },

  // Delete key
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
      throw error;
    }
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error });
      throw error;
    }
  },

  // Set with expiration
  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      await redisClient.setEx(key, seconds, value);
    } catch (error) {
      logger.error('Redis SETEX error', { key, seconds, error });
      throw error;
    }
  },

  // Increment value
  async incr(key: string): Promise<number> {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', { key, error });
      throw error;
    }
  },

  // Set TTL
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await redisClient.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, seconds, error });
      throw error;
    }
  },

  // Get all keys matching pattern
  async keys(pattern: string): Promise<string[]> {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', { pattern, error });
      throw error;
    }
  },

  // Publish message to channel
  async publish(channel: string, message: string): Promise<void> {
    try {
      await redisClient.publish(channel, message);
    } catch (error) {
      logger.error('Redis PUBLISH error', { channel, error });
      throw error;
    }
  },

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await redisClient.hSet(key, field, value);
    } catch (error) {
      logger.error('Redis HSET error', { key, field, error });
      throw error;
    }
  },

  async hget(key: string, field: string): Promise<string | undefined> {
    try {
      return await redisClient.hGet(key, field);
    } catch (error) {
      logger.error('Redis HGET error', { key, field, error });
      throw error;
    }
  },

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await redisClient.hGetAll(key);
    } catch (error) {
      logger.error('Redis HGETALL error', { key, error });
      throw error;
    }
  },
};

// Initialize Redis connection
export const initializeRedis = async (): Promise<void> => {
  await connectRedis();
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing Redis connection...');
  await redisClient.quit();
});

process.on('SIGTERM', async () => {
  logger.info('Closing Redis connection...');
  await redisClient.quit();
});

export default redisClient;