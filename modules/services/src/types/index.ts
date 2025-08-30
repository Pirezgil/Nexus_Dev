import { z } from 'zod';
import { 
  ServiceStatus, 
  ProfessionalStatus, 
  AppointmentStatus, 
  PaymentStatus, 
  PhotoType 
} from '@prisma/client';

// =============================================================================
// Configuration Types
// =============================================================================

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  userManagementUrl: string;
  crmUrl: string;
  agendamentoUrl: string;
  corsOrigins: string[];
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  uploadPath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  jwtSecret: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// Service Types
// =============================================================================

export interface ServiceInput {
  companyId: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  category?: string;
  requirements?: string;
  metadata?: any;
}

export interface ServiceUpdate {
  name?: string;
  description?: string;
  duration?: number;
  price?: number;
  category?: string;
  status?: ServiceStatus;
  requirements?: string;
  metadata?: any;
}

export interface ServiceFilter {
  companyId?: string;
  status?: ServiceStatus;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

// =============================================================================
// Professional Types
// =============================================================================

export interface ProfessionalInput {
  companyId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  specialties?: string[];
  hourlyRate?: number;
  commission?: number;
  workSchedule?: WorkSchedule;
  metadata?: any;
}

export interface ProfessionalUpdate {
  name?: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  status?: ProfessionalStatus;
  hourlyRate?: number;
  commission?: number;
  workSchedule?: WorkSchedule;
  metadata?: any;
}

export interface ProfessionalFilter {
  companyId?: string;
  status?: ProfessionalStatus;
  specialties?: string[];
  search?: string;
}

export interface WorkSchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
  breakStart?: string;
  breakEnd?: string;
}

// =============================================================================
// Appointment Types
// =============================================================================

export interface AppointmentInput {
  companyId: string;
  serviceId: string;
  professionalId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  startTime: Date;
  endTime: Date;
  servicePrice: number;
  discount?: number;
  paymentMethod?: string;
  notes?: string;
  customerNotes?: string;
  internalNotes?: string;
  metadata?: any;
}

export interface AppointmentUpdate {
  actualDuration?: number;
  status?: AppointmentStatus;
  discount?: number;
  totalAmount?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
  customerNotes?: string;
  internalNotes?: string;
  metadata?: any;
}

export interface AppointmentFilter {
  companyId?: string;
  serviceId?: string;
  professionalId?: string;
  customerId?: string;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

// =============================================================================
// Photo Upload Types
// =============================================================================

export interface PhotoUpload {
  appointmentId: string;
  companyId: string;
  type: PhotoType;
  description?: string;
}

export interface PhotoFilter {
  appointmentId?: string;
  companyId?: string;
  type?: PhotoType;
  startDate?: Date;
  endDate?: Date;
}

// =============================================================================
// Report Types
// =============================================================================

export interface DailyReport {
  date: Date;
  appointmentsCount: number;
  completedAppointments: number;
  totalRevenue: number;
  averageTicket: number;
  topServices: ServicePerformance[];
  professionalPerformance: ProfessionalPerformance[];
  paymentMethods: PaymentMethodStats[];
}

export interface ServicePerformance {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;
  averageDuration: number;
}

export interface ProfessionalPerformance {
  professionalId: string;
  professionalName: string;
  appointmentsCount: number;
  revenue: number;
  averageRating?: number;
  efficiency: number; // percentage
}

export interface PaymentMethodStats {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}

// =============================================================================
// Integration Types
// =============================================================================

export interface CRMCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMNote {
  customerId: string;
  content: string;
  type: 'general' | 'service' | 'appointment' | 'payment';
  metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  status: string;
}

// =============================================================================
// Validation Schemas (Zod)
// =============================================================================

// Service Validation Schemas
export const ServiceCreateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  duration: z.number().int().min(1).max(480), // Max 8 hours
  price: z.number().positive(),
  category: z.string().max(100).optional(),
  requirements: z.string().optional(),
  metadata: z.any().optional(),
});

export const ServiceUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  duration: z.number().int().min(1).max(480).optional(),
  price: z.number().positive().optional(),
  category: z.string().max(100).optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  requirements: z.string().optional(),
  metadata: z.any().optional(),
});

// Professional Validation Schemas
export const ProfessionalCreateSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  specialties: z.array(z.string()).default([]),
  hourlyRate: z.number().positive().optional(),
  commission: z.number().min(0).max(100).optional(),
  workSchedule: z.any().optional(),
  metadata: z.any().optional(),
});

export const ProfessionalUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  specialties: z.array(z.string()).optional(),
  status: z.nativeEnum(ProfessionalStatus).optional(),
  hourlyRate: z.number().positive().optional(),
  commission: z.number().min(0).max(100).optional(),
  workSchedule: z.any().optional(),
  metadata: z.any().optional(),
});

// Appointment Validation Schemas
export const AppointmentCreateSchema = z.object({
  companyId: z.string().uuid(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().max(50).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  servicePrice: z.number().positive(),
  discount: z.number().min(0).optional(),
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  metadata: z.any().optional(),
});

export const AppointmentUpdateSchema = z.object({
  actualDuration: z.number().int().min(1).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  discount: z.number().min(0).optional(),
  totalAmount: z.number().positive().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  metadata: z.any().optional(),
});

// Photo Upload Validation Schema
export const PhotoUploadSchema = z.object({
  appointmentId: z.string().uuid(),
  companyId: z.string().uuid(),
  type: z.nativeEnum(PhotoType),
  description: z.string().optional(),
});

// Pagination Schema
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date Range Schema
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// Error Types
// =============================================================================

export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, public details?: any) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

// =============================================================================
// Integration Validation Schemas
// =============================================================================

// Professional Availability Query Schema
export const ProfessionalAvailabilityQuerySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  service_id: z.string().uuid('Invalid service ID format'),
});

// Complete Appointment Body Schema
export const CompleteAppointmentBodySchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID format'),
  professional_id: z.string().uuid('Invalid professional ID format'),
  service_id: z.string().uuid('Invalid service ID format'),
  completed_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid completed_at date format',
  }),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  payment_status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'CANCELLED', 'REFUNDED']).optional(),
  payment_amount: z.number().positive('Payment amount must be positive'),
  payment_method: z.string().optional(),
});

// Services List Query Schema
export const ServicesListQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  category: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

// Professionals List Query Schema
export const ProfessionalsListQuerySchema = z.object({
  service_id: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'VACATION', 'SICK_LEAVE']).optional(),
  specialties: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

// Professional Availability Response Schema
export const ProfessionalAvailabilityResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    availableSlots: z.array(z.string()),
    workingHours: z.object({
      start: z.string(),
      end: z.string(),
    }).nullable(),
    bookedSlots: z.array(z.string()),
  }),
  meta: z.object({
    professionalId: z.string(),
    date: z.string(),
    serviceId: z.string(),
    companyId: z.string(),
    checkedAt: z.string(),
  }),
});

// Services List Response Schema
export const ServicesListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    duration: z.number(),
    price: z.number(),
    category: z.string().nullable(),
  })),
  source: z.literal('services'),
  meta: z.object({
    count: z.number(),
    companyId: z.string(),
    retrievedAt: z.string(),
  }),
});

// Professionals List Response Schema
export const ProfessionalsListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    specialties: z.array(z.string()),
    status: z.string(),
  })),
  source: z.literal('services'),
  meta: z.object({
    count: z.number(),
    companyId: z.string(),
    serviceId: z.string().nullable(),
    retrievedAt: z.string(),
  }),
});

// Complete Appointment Response Schema
export const CompleteAppointmentResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    completedAppointmentId: z.string(),
    appointmentId: z.string(),
    customerId: z.string(),
    professionalId: z.string(),
    serviceId: z.string(),
    totalAmount: z.number(),
    paymentStatus: z.string(),
    completedAt: z.string(),
    createdAt: z.string(),
  }),
  message: z.string(),
});

// =============================================================================
// Utility Types
// =============================================================================

export type SortOrder = 'asc' | 'desc';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Express Request extension for authenticated requests
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      companyId?: string;
      rawBody?: Buffer;
    }
  }
}