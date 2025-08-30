import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

export const config: Config = {
  port: parseInt(process.env.PORT || '5005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  userManagementUrl: process.env.USER_MANAGEMENT_URL || 'http://localhost:5003',
  crmUrl: process.env.CRM_URL || 'http://localhost:5004',
  agendamentoUrl: process.env.AGENDAMENTO_URL || 'http://localhost:5007',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5000'],
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ],
  jwtSecret: process.env.JWT_SECRET || 'nexus-services-secret-key',
};

// Validation
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

if (!config.jwtSecret || config.jwtSecret === 'nexus-services-secret-key') {
  console.warn('WARNING: Using default JWT secret. Please set JWT_SECRET environment variable in production.');
}

export default config;