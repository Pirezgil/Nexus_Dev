/**
 * =====================================================================
 * Shared Secrets Configuration for ERP Nexus
 * =====================================================================
 * This module provides a unified interface for accessing Docker Secrets
 * across all microservices, with development and production modes.
 * =====================================================================
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  algorithm: string;
  issuer?: string;
  audience?: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  webhookToken: string;
  apiVersion: string;
  baseUrl?: string;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  serviceName: string;
  version: string;
  isDocker: boolean;
  isDevelopment: boolean;
  logLevel: string;
}

export interface SecretsConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  hmacSecret: string;
  whatsapp: WhatsAppConfig;
  app: AppConfig;
}

class SecretsManager {
  private static instance: SecretsManager;
  private secretsPath = '/run/secrets';
  private isDockerContainer: boolean;
  private config: SecretsConfig | null = null;

  constructor() {
    this.isDockerContainer = this.checkDockerEnvironment();
  }

  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Check if running inside Docker container
   */
  private checkDockerEnvironment(): boolean {
    try {
      return fs.existsSync('/.dockerenv') ||
             (fs.existsSync('/proc/1/cgroup') &&
              fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
    } catch {
      return false;
    }
  }

  /**
   * Read a secret from Docker Secrets or fall back to environment variable
   */
  private readSecret(secretName: string, envFallback?: string, defaultValue?: string): string {
    // Try Docker Secrets first
    if (this.isDockerContainer) {
      const secretPath = path.join(this.secretsPath, secretName);
      try {
        if (fs.existsSync(secretPath)) {
          const value = fs.readFileSync(secretPath, 'utf8').trim();
          if (value) {
            logger?.debug(`✅ Loaded secret from Docker: ${secretName}`);
            return value;
          }
        }
      } catch (error) {
        logger?.warn(`⚠️  Failed to read Docker secret ${secretName}:`, error);
      }
    }

    // Fall back to environment variable
    if (envFallback && process.env[envFallback]) {
      logger?.debug(`📱 Using environment variable: ${envFallback}`);
      return process.env[envFallback];
    }

    // Use default value
    if (defaultValue !== undefined) {
      logger?.debug(`🔧 Using default value for: ${secretName}`);
      return defaultValue;
    }

    throw new Error(`Required secret '${secretName}' not found (env: ${envFallback})`);
  }

  /**
   * Load database configuration from secrets
   */
  private loadDatabaseConfig(): DatabaseConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Try to get complete database URL first
    let databaseUrl: string;
    try {
      databaseUrl = this.readSecret('nexus_database_url', 'DATABASE_URL');
    } catch {
      // Construct URL from individual components
      const host = this.readSecret('nexus_db_host', 'POSTGRES_HOST', 'postgres');
      const port = parseInt(this.readSecret('nexus_db_port', 'POSTGRES_PORT', '5432'));
      const database = this.readSecret('nexus_db_name', 'POSTGRES_DB', 'nexus_erp');
      const username = this.readSecret('nexus_db_user', 'POSTGRES_USER', 'nexus_user');
      const password = this.readSecret('nexus_db_password', 'POSTGRES_PASSWORD', 'nexus_password');
      
      const sslMode = isDevelopment ? '' : '?sslmode=require';
      databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}${sslMode}`;
    }

    // Parse URL to extract components
    const url = new URL(databaseUrl);
    
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1),
      username: url.username,
      password: url.password,
      url: databaseUrl,
      ssl: !isDevelopment,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000')
    };
  }

  /**
   * Load Redis configuration from secrets
   */
  private loadRedisConfig(): RedisConfig {
    let redisUrl: string;
    let redisPassword: string | undefined;

    try {
      redisUrl = this.readSecret('nexus_redis_url', 'REDIS_URL', 'redis://redis:6379');
      try {
        redisPassword = this.readSecret('nexus_redis_password', 'REDIS_PASSWORD');
      } catch {
        // Redis password is optional in development
      }
    } catch {
      // Construct URL from components
      const host = this.readSecret('nexus_redis_host', 'REDIS_HOST', 'redis');
      const port = parseInt(this.readSecret('nexus_redis_port', 'REDIS_PORT', '6379'));
      redisUrl = `redis://${host}:${port}`;
    }

    // Parse URL
    const url = new URL(redisUrl);
    
    return {
      url: redisUrl,
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: redisPassword || url.password || undefined,
      db: parseInt(this.readSecret('nexus_redis_db', 'REDIS_DB', '0')),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      lazyConnect: true
    };
  }

  /**
   * Load JWT configuration from secrets
   */
  private loadJWTConfig(): JWTConfig {
    return {
      secret: this.readSecret('nexus_jwt_secret', 'JWT_SECRET', 'development-jwt-secret-change-in-production'),
      expiresIn: this.readSecret('nexus_jwt_expires_in', 'JWT_EXPIRES_IN', '24h'),
      algorithm: this.readSecret('nexus_jwt_algorithm', 'JWT_ALGORITHM', 'HS256'),
      issuer: process.env.JWT_ISSUER || 'nexus-erp',
      audience: process.env.JWT_AUDIENCE || 'nexus-erp-users'
    };
  }

  /**
   * Load WhatsApp configuration from secrets
   */
  private loadWhatsAppConfig(): WhatsAppConfig {
    return {
      phoneNumberId: this.readSecret('nexus_whatsapp_phone_id', 'WHATSAPP_PHONE_NUMBER_ID', 'your-phone-number-id-here'),
      accessToken: this.readSecret('nexus_whatsapp_access_token', 'WHATSAPP_ACCESS_TOKEN', 'your-access-token-here'),
      appSecret: this.readSecret('nexus_whatsapp_app_secret', 'WHATSAPP_APP_SECRET', 'your-app-secret-here'),
      webhookToken: this.readSecret('nexus_whatsapp_webhook_token', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'your-webhook-verify-token-here'),
      apiVersion: this.readSecret('nexus_whatsapp_api_version', 'WHATSAPP_API_VERSION', 'v18.0'),
      baseUrl: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com'
    };
  }

  /**
   * Load application configuration
   */
  private loadAppConfig(): AppConfig {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
      serviceName: process.env.SERVICE_NAME || 'nexus-service',
      version: process.env.SERVICE_VERSION || '1.0.0',
      isDocker: this.isDockerContainer,
      isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
      logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')
    };
  }

  /**
   * Get HMAC secret for service communication
   */
  public getHMACSecret(): string {
    return this.readSecret('nexus_hmac_secret', 'GATEWAY_HMAC_SECRET', 'development-hmac-secret-change-in-production');
  }

  /**
   * Load and return complete configuration
   */
  public getConfig(): SecretsConfig {
    if (this.config) {
      return this.config;
    }

    try {
      this.config = {
        database: this.loadDatabaseConfig(),
        redis: this.loadRedisConfig(),
        jwt: this.loadJWTConfig(),
        hmacSecret: this.getHMACSecret(),
        whatsapp: this.loadWhatsAppConfig(),
        app: this.loadAppConfig()
      };

      logger?.info('🔐 Secrets configuration loaded successfully', {
        isDocker: this.isDockerContainer,
        environment: this.config.app.nodeEnv,
        serviceName: this.config.app.serviceName
      });

      return this.config;
    } catch (error) {
      logger?.error('❌ Failed to load secrets configuration:', error);
      throw error;
    }
  }

  /**
   * Validate that all required secrets are available
   */
  public validateSecrets(): boolean {
    try {
      const config = this.getConfig();
      
      // Validate required secrets
      const requiredSecrets = [
        config.database.url,
        config.jwt.secret,
        config.hmacSecret
      ];

      for (const secret of requiredSecrets) {
        if (!secret || secret.trim() === '') {
          throw new Error('Missing required secret value');
        }
      }

      // Validate database URL format
      new URL(config.database.url);

      // Validate Redis URL format
      new URL(config.redis.url);

      logger?.info('✅ All required secrets validated successfully');
      return true;
    } catch (error) {
      logger?.error('❌ Secrets validation failed:', error);
      return false;
    }
  }

  /**
   * Reset configuration cache (useful for testing)
   */
  public resetConfig(): void {
    this.config = null;
  }

  /**
   * Get development-friendly database credentials for debugging
   */
  public getDevelopmentCredentials(): { host: string; port: number; database: string; username: string; password: string } {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Development credentials only available in development environment');
    }

    const config = this.getConfig();
    return {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      username: config.database.username,
      password: config.database.password
    };
  }
}

// Export singleton instance
export const secretsManager = SecretsManager.getInstance();

// Export configuration getter
export const getSecretsConfig = (): SecretsConfig => secretsManager.getConfig();

// Export validation function
export const validateSecretsConfig = (): boolean => secretsManager.validateSecrets();

// Export HMAC secret getter
export const getHMACSecret = (): string => secretsManager.getHMACSecret();

// Export development credentials getter
export const getDevelopmentCredentials = () => secretsManager.getDevelopmentCredentials();

// For backward compatibility, export individual config sections
export const getDatabaseConfig = (): DatabaseConfig => secretsManager.getConfig().database;
export const getRedisConfig = (): RedisConfig => secretsManager.getConfig().redis;
export const getJWTConfig = (): JWTConfig => secretsManager.getConfig().jwt;
export const getWhatsAppConfig = (): WhatsAppConfig => secretsManager.getConfig().whatsapp;
export const getAppConfig = (): AppConfig => secretsManager.getConfig().app;