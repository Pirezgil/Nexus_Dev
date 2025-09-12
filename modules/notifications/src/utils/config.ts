import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5006'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://nexus_user:nexus_password@localhost:5433/nexus_erp?schema=public',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-here',
  gatewayHmacSecret: process.env.GATEWAY_HMAC_SECRET || 'your-super-secure-hmac-secret-for-inter-service-auth',

  // CORS
  corsOrigins: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://nexus-frontend:3000'
  ],

  // Mock Services
  mockServices: {
    email: process.env.MOCK_EMAIL_SERVICE === 'true',
    sms: process.env.MOCK_SMS_SERVICE === 'true',
    push: process.env.MOCK_PUSH_SERVICE === 'true',
  },
};