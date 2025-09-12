import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

// Environment configuration types
export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  corsOrigins: string[];
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  bcryptSaltRounds: number;
  email: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

// Authentication types
export interface JwtPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  sessionId: string;
  permissions?: string[]; // Array of module permissions
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface LoginResponse {
  user: UserSummary;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// User types
export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  lastLoginAt?: Date;
  company: CompanySummary;
}

export interface CompanySummary {
  id: string;
  name: string;
  plan: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  companyId: string;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  status?: UserStatus;
  avatar?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// Company types
export interface CreateCompanyData {
  name: string;
  email: string;
  phone?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

// Pagination types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
}

// Validation schemas using Zod
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const registerCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2, 'Nome da empresa deve ter ao menos 2 caracteres'),
    email: z.string().email('Email da empresa inválido'),
    phone: z.string().optional(),
    cnpj: z.string().optional(),
  }),
  admin: z.object({
    firstName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    lastName: z.string().min(2, 'Sobrenome deve ter ao menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string()
      .min(8, 'Senha deve ter ao menos 8 caracteres')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve ter ao menos uma letra minúscula, uma maiúscula e um número'),
  }),
});

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter ao menos 2 caracteres'),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  status: z.nativeEnum(UserStatus).optional().default(UserStatus.ACTIVE),
  emailVerified: z.boolean().optional().default(false),
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve ter ao menos uma letra minúscula, uma maiúscula e um número'),
});

export const updateUserSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  firstName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'Sobrenome deve ter ao menos 2 caracteres').optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatar: z.string().url('Avatar deve ser uma URL válida').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'Nova senha deve ter ao menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Nova senha deve ter ao menos uma letra minúscula, uma maiúscula e um número'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve ter ao menos uma letra minúscula, uma maiúscula e um número'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

// Profile update schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'Sobrenome deve ter ao menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'Nova senha deve ter ao menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Nova senha deve ter ao menos uma letra minúscula, uma maiúscula e um número'),
});

export const avatarUploadSchema = z.object({
  mimetype: z.string().refine(
    (type) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type),
    'Apenas arquivos de imagem são permitidos (JPEG, PNG, WebP)'
  ),
  size: z.number().max(5 * 1024 * 1024, 'Arquivo deve ter no máximo 5MB'),
});

// Type exports for Zod schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>;

// Error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 400);
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados') {
    super(message, 409);
  }
}