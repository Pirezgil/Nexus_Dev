import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Helper function to skip rate limiting in development
const isDevelopment = process.env.NODE_ENV === 'development';
const skipInDevelopment = () => isDevelopment;

/**
 * Rate limiter específico para operações de redefinição de senha
 * Mais restritivo para evitar ataques de força bruta
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 0 : 3, // Unlimited in development, 3 in production
  message: {
    success: false,
    error: 'Muitas tentativas de redefinição de senha. Tente novamente em 15 minutos.',
    code: 'TOO_MANY_PASSWORD_RESET_ATTEMPTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de redefinição de senha. Tente novamente em 15 minutos.',
      code: 'TOO_MANY_PASSWORD_RESET_ATTEMPTS',
      retryAfter: Math.ceil(15 * 60), // 15 minutes in seconds
    });
  },
  keyGenerator: (req) => {
    // Rate limit by IP and email combination for better security
    const email = req.body?.email || 'unknown';
    return `password_reset:${req.ip}:${email}`;
  },
});

/**
 * Rate limiter específico para verificação de email
 * Permite mais tentativas que password reset mas ainda restritivo
 */
export const emailVerificationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: isDevelopment ? 0 : 2, // Unlimited in development, 2 in production
  message: {
    success: false,
    error: 'Muitas tentativas de verificação de email. Tente novamente em 5 minutos.',
    code: 'TOO_MANY_EMAIL_VERIFICATION_ATTEMPTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Email verification rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de verificação de email. Tente novamente em 5 minutos.',
      code: 'TOO_MANY_EMAIL_VERIFICATION_ATTEMPTS',
      retryAfter: Math.ceil(5 * 60), // 5 minutes in seconds
    });
  },
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `email_verification:${req.ip}:${email}`;
  },
});

/**
 * Rate limiter específico para tentativas de login
 * Mais permissivo que password reset mas ainda protegido
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 0 : 5, // Unlimited in development, 5 in production
  message: {
    success: false,
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'TOO_MANY_LOGIN_ATTEMPTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email || 'unknown',
      endpoint: req.path,
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      retryAfter: Math.ceil(15 * 60),
    });
  },
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `login:${req.ip}:${email}`;
  },
});

/**
 * Rate limiter específico para registros de empresa
 * Muito restritivo para evitar spam de registros
 */
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isDevelopment ? 0 : 2, // Unlimited in development, 2 in production
  message: {
    success: false,
    error: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
    code: 'TOO_MANY_REGISTRATION_ATTEMPTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Registration rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      companyEmail: req.body?.company?.email || 'unknown',
      adminEmail: req.body?.admin?.email || 'unknown',
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
      code: 'TOO_MANY_REGISTRATION_ATTEMPTS',
      retryAfter: Math.ceil(60 * 60),
    });
  },
});

/**
 * Rate limiter para mudança de senha (usuários autenticados)
 * Moderadamente restritivo
 */
export const changePasswordRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutos
  max: isDevelopment ? 0 : 3, // Unlimited in development, 3 in production
  message: {
    success: false,
    error: 'Muitas tentativas de alteração de senha. Tente novamente em 30 minutos.',
    code: 'TOO_MANY_PASSWORD_CHANGE_ATTEMPTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Change password rate limit exceeded', {
      userId: req.user?.userId || 'unknown',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de alteração de senha. Tente novamente em 30 minutos.',
      code: 'TOO_MANY_PASSWORD_CHANGE_ATTEMPTS',
      retryAfter: Math.ceil(30 * 60),
    });
  },
  keyGenerator: (req) => {
    // Rate limit by user ID for authenticated users
    const userId = req.user?.userId || req.ip;
    return `change_password:${userId}`;
  },
});

/**
 * Rate limiter para operações gerais de autenticação
 * Configuração padrão para outros endpoints
 */
export const generalAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 0 : 100, // Unlimited in development, 100 in production
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'TOO_MANY_REQUESTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('General auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas requisições. Tente novamente em alguns minutos.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: Math.ceil(15 * 60),
    });
  },
});

/**
 * Rate limiter para verificação de token (usado por outros módulos)
 * Mais permissivo pois é usado frequentemente
 */
export const tokenValidationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: isDevelopment ? 0 : 60, // Unlimited in development, 60 in production
  message: {
    success: false,
    error: 'Muitas validações de token. Tente novamente em alguns segundos.',
    code: 'TOO_MANY_TOKEN_VALIDATIONS',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment,
  handler: (req, res) => {
    logger.warn('Token validation rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      success: false,
      error: 'Muitas validações de token. Tente novamente em alguns segundos.',
      code: 'TOO_MANY_TOKEN_VALIDATIONS',
      retryAfter: 60,
    });
  },
});