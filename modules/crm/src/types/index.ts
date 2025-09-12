import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Re-export enums from Prisma schema
export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE', 
  PROSPECT = 'PROSPECT',
  BLOCKED = 'BLOCKED'
}

export enum InteractionType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  NOTE = 'NOTE',
  TASK = 'TASK',
  VISIT = 'VISIT',
  SERVICE = 'SERVICE'
}

export enum NoteType {
  GENERAL = 'GENERAL',
  IMPORTANT = 'IMPORTANT',
  REMINDER = 'REMINDER',
  FOLLOW_UP = 'FOLLOW_UP',
  COMPLAINT = 'COMPLAINT',
  COMPLIMENT = 'COMPLIMENT'
}

// Environment configuration types
export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  userManagementUrl: string;
  corsOrigins: string[];
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

// Authentication types (from User Management module)
export interface JwtPayload {
  userId: string;
  companyId: string;
  role: string;
  sessionId: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Customer types
export interface CustomerSummary {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: CustomerStatus;
  tags: string[];
  interactionsCount: number;
  notesCount: number;
  lastInteractionAt?: Date;
  createdAt: Date;
}

export interface CustomerDetails {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status: CustomerStatus;
  tags: string[];
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  notes: CustomerNoteDetails[];
  interactions: CustomerInteractionDetails[];
}

export interface AddressStructured {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

export interface CreateCustomerData {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string; // Legacy format for compatibility
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  // New structured address format
  addressStructured?: AddressStructured;
  status?: CustomerStatus;
  tags?: string[];
  metadata?: any;
  // Additional fields
  profession?: string;
  source?: string;
  preferredContact?: string;
  marketingConsent?: boolean;
  secondaryPhone?: string;
  rg?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string; // Legacy format for compatibility
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  // New structured address format
  addressStructured?: AddressStructured;
  status?: CustomerStatus;
  tags?: string[];
  metadata?: any;
  // Additional fields
  profession?: string;
  source?: string;
  preferredContact?: string;
  marketingConsent?: boolean;
  secondaryPhone?: string;
  rg?: string;
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
}

// Customer Notes types
export interface CustomerNoteDetails {
  id: string;
  content: string;
  type: NoteType;
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteData {
  content: string;
  type?: NoteType;
  isPrivate?: boolean;
}

export interface UpdateNoteData {
  content?: string;
  type?: NoteType;
  isPrivate?: boolean;
}

// Customer Interactions types
export interface CustomerInteractionDetails {
  id: string;
  type: InteractionType;
  title: string;
  description?: string;
  metadata?: any;
  isCompleted: boolean;
  scheduledAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInteractionData {
  type: InteractionType;
  title: string;
  description?: string;
  metadata?: any;
  isCompleted?: boolean;
  scheduledAt?: Date;
  completedAt?: Date;
}

export interface UpdateInteractionData {
  title?: string;
  description?: string;
  metadata?: any;
  isCompleted?: boolean;
  scheduledAt?: Date;
  completedAt?: Date;
}

// Search and filtering types
export interface CustomerSearchFilters {
  search?: string;
  status?: CustomerStatus[];
  tags?: string[];
  city?: string;
  state?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  lastInteractionFrom?: Date;
  lastInteractionTo?: Date;
}

export interface InteractionFilters {
  type?: InteractionType[];
  isCompleted?: boolean;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  createdBy?: string;
}

// Statistics types
export interface CustomerStatistics {
  totalCustomers: number;
  activeCustomers: number;
  prospectCustomers: number;
  inactiveCustomers: number;
  blockedCustomers: number;
  totalInteractions: number;
  totalNotes: number;
  averageInteractionsPerCustomer: number;
  topTags: Array<{ tag: string; count: number }>;
  customersByStatus: Array<{ status: CustomerStatus; count: number }>;
  interactionsByType: Array<{ type: InteractionType; count: number }>;
  customersGrowth: Array<{ date: string; count: number }>;
}

// Pagination types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(255),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  document: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  status: z.nativeEnum(CustomerStatus).optional().default(CustomerStatus.PROSPECT),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.any().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(255).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  document: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  type: z.nativeEnum(NoteType).optional().default(NoteType.GENERAL),
  isPrivate: z.boolean().optional().default(false),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório').optional(),
  type: z.nativeEnum(NoteType).optional(),
  isPrivate: z.boolean().optional(),
});

export const createInteractionSchema = z.object({
  type: z.nativeEnum(InteractionType),
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: z.string().optional(),
  metadata: z.any().optional(),
  isCompleted: z.boolean().optional().default(true),
  scheduledAt: z.string().datetime().optional().or(z.date().optional()),
  completedAt: z.string().datetime().optional().or(z.date().optional()),
});

export const updateInteractionSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255).optional(),
  description: z.string().optional(),
  metadata: z.any().optional(),
  isCompleted: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().or(z.date().optional()),
  completedAt: z.string().datetime().optional().or(z.date().optional()),
});

export const customerSearchSchema = z.object({
  search: z.string().optional(),
  status: z.array(z.nativeEnum(CustomerStatus)).optional(),
  tags: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  createdFrom: z.string().datetime().optional().or(z.date().optional()),
  createdTo: z.string().datetime().optional().or(z.date().optional()),
  lastInteractionFrom: z.string().datetime().optional().or(z.date().optional()),
  lastInteractionTo: z.string().datetime().optional().or(z.date().optional()),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(1000),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Schema combinado para busca de clientes com paginação
export const customerSearchWithPaginationSchema = customerSearchSchema.merge(paginationSchema);

export const tagManagementSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).min(1, 'Ao menos uma tag é necessária'),
});

// Type exports for Zod schemas
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
export type UpdateInteractionInput = z.infer<typeof updateInteractionSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type TagManagementInput = z.infer<typeof tagManagementSchema>;

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