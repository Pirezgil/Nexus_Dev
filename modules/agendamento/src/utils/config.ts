/**
 * Configuração centralizada do módulo Agendamento
 * Carrega e valida todas as variáveis de ambiente necessárias
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Carrega variáveis de ambiente
dotenv.config();

// Schema de validação das configurações
const configSchema = z.object({
  // Configurações básicas
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5007),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatória'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatória'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Módulos Integration URLs
  USER_MANAGEMENT_URL: z.string().url('URL inválida para USER_MANAGEMENT'),
  CRM_URL: z.string().url('URL inválida para CRM'),
  SERVICES_URL: z.string().url('URL inválida para SERVICES'),
  
  // WhatsApp Configuration
  WHATSAPP_ENABLED: z.coerce.boolean().default(false),
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  
  // SMS Configuration
  SMS_ENABLED: z.coerce.boolean().default(false),
  SMS_PROVIDER: z.string().optional(),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_AUTH_TOKEN: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),
  
  // Email Configuration
  EMAIL_ENABLED: z.coerce.boolean().default(true),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Application Configuration
  DEFAULT_TIMEZONE: z.string().default('America/Sao_Paulo'),
  DEFAULT_SLOT_DURATION_MINUTES: z.coerce.number().default(30),
  MAX_ADVANCE_BOOKING_DAYS: z.coerce.number().default(60),
  MIN_ADVANCE_BOOKING_HOURS: z.coerce.number().default(2),
  REMINDER_DEFAULT_HOURS_BEFORE: z.coerce.number().default(24),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_ENABLED: z.coerce.boolean().default(true),
  LOG_FILE_PATH: z.string().default('./logs/agendamento.log'),
  
  // Health Check
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // File Upload
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().default(5242880), // 5MB
  UPLOAD_ALLOWED_TYPES: z.string().default('image/jpeg,image/png,image/gif'),
  
  // External Integrations
  GOOGLE_CALENDAR_ENABLED: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

// Valida as configurações
const validateConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Erro de configuração:', error.errors);
      process.exit(1);
    }
    throw error;
  }
};

const config = validateConfig();

// Configurações derivadas
const derivedConfig = {
  ...config,
  
  // Database config
  database: {
    url: config.DATABASE_URL,
    ssl: config.NODE_ENV === 'production',
  },
  
  // Redis config
  redis: {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  
  // JWT config
  jwt: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
  },
  
  // WhatsApp config
  whatsapp: {
    enabled: config.WHATSAPP_ENABLED,
    apiUrl: config.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
    accessToken: config.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
    webhookVerifyToken: config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  },
  
  // SMS config
  sms: {
    enabled: config.SMS_ENABLED,
    provider: config.SMS_PROVIDER,
    accountSid: config.SMS_ACCOUNT_SID,
    authToken: config.SMS_AUTH_TOKEN,
    fromNumber: config.SMS_FROM_NUMBER,
  },
  
  // Email config
  email: {
    enabled: config.EMAIL_ENABLED,
    smtp: {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER && config.SMTP_PASSWORD ? {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      } : undefined,
    },
    from: config.EMAIL_FROM,
  },
  
  // Application business rules
  businessRules: {
    defaultSlotDurationMinutes: config.DEFAULT_SLOT_DURATION_MINUTES,
    maxAdvanceBookingDays: config.MAX_ADVANCE_BOOKING_DAYS,
    minAdvanceBookingHours: config.MIN_ADVANCE_BOOKING_HOURS,
    reminderDefaultHours: config.REMINDER_DEFAULT_HOURS_BEFORE,
    defaultTimezone: config.DEFAULT_TIMEZONE,
  },
  
  // External services URLs
  services: {
    userManagement: config.USER_MANAGEMENT_URL,
    crm: config.CRM_URL,
    services: config.SERVICES_URL,
  },
  
  // Logging config
  logging: {
    level: config.LOG_LEVEL,
    fileEnabled: config.LOG_FILE_ENABLED,
    filePath: config.LOG_FILE_PATH,
  },
  
  // Rate limiting config
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  },
  
  // File upload config
  upload: {
    maxFileSize: config.UPLOAD_MAX_FILE_SIZE,
    allowedTypes: config.UPLOAD_ALLOWED_TYPES.split(','),
  },
  
  // Health check config
  healthCheck: {
    enabled: config.HEALTH_CHECK_ENABLED,
    interval: config.HEALTH_CHECK_INTERVAL,
  },
  
  // Google Calendar config
  googleCalendar: {
    enabled: config.GOOGLE_CALENDAR_ENABLED,
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
  },
  
  // Development helpers
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isTest: config.NODE_ENV === 'test',
};

export default derivedConfig;

// Validação adicional para configurações críticas
export const validateCriticalConfig = () => {
  const errors: string[] = [];
  
  // Validações específicas para notificações
  if (derivedConfig.whatsapp.enabled) {
    if (!derivedConfig.whatsapp.accessToken) {
      errors.push('WHATSAPP_ACCESS_TOKEN é obrigatório quando WhatsApp está habilitado');
    }
    if (!derivedConfig.whatsapp.phoneNumberId) {
      errors.push('WHATSAPP_PHONE_NUMBER_ID é obrigatório quando WhatsApp está habilitado');
    }
  }
  
  if (derivedConfig.sms.enabled) {
    if (!derivedConfig.sms.provider) {
      errors.push('SMS_PROVIDER é obrigatório quando SMS está habilitado');
    }
    if (derivedConfig.sms.provider === 'twilio') {
      if (!derivedConfig.sms.accountSid || !derivedConfig.sms.authToken) {
        errors.push('SMS_ACCOUNT_SID e SMS_AUTH_TOKEN são obrigatórios para Twilio');
      }
    }
  }
  
  if (derivedConfig.email.enabled) {
    if (!derivedConfig.email.smtp.host) {
      errors.push('SMTP_HOST é obrigatório quando Email está habilitado');
    }
    if (!derivedConfig.email.from) {
      errors.push('EMAIL_FROM é obrigatório quando Email está habilitado');
    }
  }
  
  // Validações de business rules
  if (derivedConfig.businessRules.minAdvanceBookingHours > 24) {
    errors.push('MIN_ADVANCE_BOOKING_HOURS não pode ser maior que 24 horas');
  }
  
  if (derivedConfig.businessRules.maxAdvanceBookingDays > 365) {
    errors.push('MAX_ADVANCE_BOOKING_DAYS não pode ser maior que 365 dias');
  }
  
  if (derivedConfig.businessRules.defaultSlotDurationMinutes < 15) {
    errors.push('DEFAULT_SLOT_DURATION_MINUTES não pode ser menor que 15 minutos');
  }
  
  if (errors.length > 0) {
    console.error('❌ Erros de configuração crítica:', errors);
    if (derivedConfig.isProduction) {
      process.exit(1);
    }
  }
  
  return errors.length === 0;
};

// Log das configurações na inicialização (sem dados sensíveis)
export const logConfigSummary = () => {
  console.log('📋 Configurações do Módulo Agendamento:');
  console.log(`   • Ambiente: ${config.NODE_ENV}`);
  console.log(`   • Porta: ${config.PORT}`);
  console.log(`   • WhatsApp: ${derivedConfig.whatsapp.enabled ? '✅' : '❌'}`);
  console.log(`   • SMS: ${derivedConfig.sms.enabled ? '✅' : '❌'}`);
  console.log(`   • Email: ${derivedConfig.email.enabled ? '✅' : '❌'}`);
  console.log(`   • Google Calendar: ${derivedConfig.googleCalendar.enabled ? '✅' : '❌'}`);
  console.log(`   • Health Check: ${derivedConfig.healthCheck.enabled ? '✅' : '❌'}`);
  console.log(`   • Log Level: ${config.LOG_LEVEL}`);
  console.log(`   • Timezone: ${derivedConfig.businessRules.defaultTimezone}`);
};