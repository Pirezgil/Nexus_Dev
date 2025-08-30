/**
 * TYPES - NEXUS CRM COMPLETO
 * 
 * Tipos TypeScript completos baseados na especificação
 * docs/02-modules/crm.md e schema Prisma expandido
 * 
 * Inclui todos os tipos para:
 * - Customers com todos os campos
 * - Custom Fields
 * - Segments  
 * - Interactions
 * - Integration APIs
 * - Responses padronizadas
 */

import { CustomerStatus, InteractionType, NoteType } from '@prisma/client';

// ==========================================
// CUSTOMER TYPES
// ==========================================

export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  tags: string[];
  interactionsCount: number;
  notesCount: number;
  lastInteractionAt?: Date;
  createdAt: Date;
  // Visit data for enhanced listing
  lastVisit?: Date | null;
  totalVisits: number;
  totalSpent: number;
  averageTicket: number;
}

export interface CustomerDetails {
  id: string;
  companyId: string;
  
  // Dados básicos
  name: string;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  cpfCnpj: string | null;
  rg: string | null;
  
  // Endereço completo
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  
  // Dados demográficos
  birthDate: Date | null;
  gender: string | null;
  maritalStatus: string | null;
  profession: string | null;
  
  // Relacionamento
  status: CustomerStatus;
  source: string | null;
  tags: string[];
  notes: string | null;
  
  // Preferências
  preferredContact: string | null;
  marketingConsent: boolean;
  
  // Dados de relacionamento (CRÍTICO para integração)
  firstVisit: Date | null;
  lastVisit: Date | null;
  totalVisits: number;
  totalSpent: number;
  averageTicket: number;
  
  // Avatar
  avatarUrl: string | null;
  
  // Auditoria
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  customerNotes: CustomerNote[];
  interactions: CustomerInteraction[];
  customValues: CustomerCustomValue[];
  segments: CustomerSegment[];
}

export interface CreateCustomerData {
  name: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  cpfCnpj?: string;
  rg?: string;
  
  // Endereço
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZipcode?: string;
  
  // Demografia
  birthDate?: Date;
  gender?: string;
  maritalStatus?: string;
  profession?: string;
  
  // Relacionamento
  status?: CustomerStatus;
  source?: string;
  tags?: string[];
  notes?: string;
  
  // Preferências
  preferredContact?: string;
  marketingConsent?: boolean;
  
  // Visit data
  firstVisit?: Date;
  
  // Avatar
  avatarUrl?: string;
  
  // Custom fields
  customFields?: Array<{
    fieldId: string;
    value: string;
  }>;
}

export interface UpdateCustomerData extends Partial<CreateCustomerData> {
  updatedBy?: string;
}

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
  segmentId?: string;
  // Visit filters
  lastVisitFrom?: Date;
  lastVisitTo?: Date;
  totalVisitsMin?: number;
  totalSpentMin?: number;
  // Demographics
  gender?: string;
  ageMin?: number;
  ageMax?: number;
}

// ==========================================
// INTERACTION TYPES
// ==========================================

export interface CustomerInteraction {
  id: string;
  customerId: string;
  companyId: string;
  type: InteractionType;
  subject: string | null;
  title: string;
  description: string | null;
  direction: string | null;
  status: string;
  metadata: any;
  isCompleted: boolean;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdBy: string;
  relatedServiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInteractionData {
  type: InteractionType;
  subject?: string;
  title: string;
  description?: string;
  direction?: string;
  status?: string;
  metadata?: any;
  scheduledAt?: Date;
  completedAt?: Date;
  relatedServiceId?: string;
}

// ==========================================
// NOTE TYPES
// ==========================================

export interface CustomerNote {
  id: string;
  customerId: string;
  companyId: string;
  content: string;
  type: NoteType;
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// CUSTOM FIELD TYPES
// ==========================================

export interface CustomField {
  id: string;
  companyId: string;
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: any;
  required: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: Date;
}

export interface CustomerCustomValue {
  id: string;
  customerId: string;
  customFieldId: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
  customField: CustomField;
}

export interface CreateCustomFieldData {
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  displayOrder?: number;
}

export interface UpdateCustomFieldData extends Partial<CreateCustomFieldData> {
  active?: boolean;
}

// ==========================================
// SEGMENT TYPES
// ==========================================

export interface CustomerSegment {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  criteria: any;
  isAuto: boolean;
  createdAt: Date;
  memberCount?: number;
}

export interface CustomerSegmentMember {
  customerId: string;
  segmentId: string;
  addedAt: Date;
  addedBy: string | null;
  customer: CustomerDetails;
  segment: CustomerSegment;
}

export interface CreateSegmentData {
  name: string;
  description?: string;
  color?: string;
  criteria?: SegmentCriteria;
  isAuto?: boolean;
}

export interface UpdateSegmentData extends Partial<CreateSegmentData> {}

export interface SegmentCriteria {
  // Financial criteria
  totalSpent?: {
    gte?: number;
    lte?: number;
    eq?: number;
  };
  averageTicket?: {
    gte?: number;
    lte?: number;
  };
  
  // Visit criteria
  totalVisits?: {
    gte?: number;
    lte?: number;
  };
  lastVisit?: {
    gte?: string; // Date string
    lte?: string;
  };
  firstVisit?: {
    gte?: string;
    lte?: string;
  };
  
  // Status criteria
  status?: {
    in?: CustomerStatus[];
    eq?: CustomerStatus;
  };
  
  // Tags criteria
  tags?: {
    hasSome?: string[];
    hasAll?: string[];
  };
  
  // Demographics
  gender?: {
    eq?: string;
  };
  ageRange?: {
    min?: number;
    max?: number;
  };
  
  // Location
  addressCity?: {
    in?: string[];
    eq?: string;
  };
  addressState?: {
    in?: string[];
    eq?: string;
  };
  
  // Contact preferences
  preferredContact?: {
    eq?: string;
  };
  marketingConsent?: {
    eq?: boolean;
  };
  
  // Time-based
  createdAt?: {
    gte?: string;
    lte?: string;
  };
}

// ==========================================
// INTEGRATION TYPES (Para outros módulos)
// ==========================================

export interface CustomerBasicData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferred_contact: string;
}

export interface VisitUpdateData {
  visit_date: string; // ISO date string
  service_value: number;
}

export interface ServiceInteractionData {
  serviceId: string;
  serviceName: string;
  professionalName?: string;
  description?: string;
  durationMinutes?: number;
  serviceValue?: number;
  photos?: string[];
}

export interface CustomerSummaryForService {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: Date | null;
  last_visit: Date | null;
  total_visits: number;
  total_spent: number;
  average_ticket: number;
  tags: string[];
  notes: string | null;
  preferred_contact: string;
  marketing_consent: boolean;
  custom_fields: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  recent_interactions: CustomerInteraction[];
}

// ==========================================
// PAGINATION TYPES
// ==========================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationInput {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
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

// ==========================================
// INPUT/OUTPUT TYPES
// ==========================================

export interface CreateCustomerInput extends CreateCustomerData {}
export interface UpdateCustomerInput extends UpdateCustomerData {}
export interface CustomerSearchInput extends CustomerSearchFilters {}

export interface TagManagementInput {
  tags: string[];
}

export interface InteractionSummary {
  total_interactions: number;
  types: {
    [key: string]: number;
  };
  last_interaction?: Date;
}

export interface CustomerInteractionsResponse {
  interactions: CustomerInteraction[];
  summary: InteractionSummary;
}

// ==========================================
// ANALYTICS TYPES
// ==========================================

export interface CompanyCustomerStats {
  total_customers: number;
  active_customers: number;
  recent_customers: number; // Last 30 days
  total_revenue: number;
  average_ticket: number;
  last_updated: string;
}

export interface SegmentAnalytics {
  total_segments: number;
  auto_segments: number;
  manual_segments: number;
  total_customers: number;
  segmented_customers: number;
  unsegmented_customers: number;
  segmentation_rate: string; // Percentage
  segment_distribution: Array<{
    id: string;
    name: string;
    color: string | null;
    customer_count: number;
    percentage: string;
  }>;
  top_segments: Array<{
    id: string;
    name: string;
    customer_count: number;
    percentage: string;
  }>;
}

export interface CustomFieldStats {
  total_fields: number;
  fields_by_type: {
    [fieldType: string]: number;
  };
  fields_with_data: number;
  usage_stats: Array<{
    field_id: string;
    customers_with_value: number;
  }>;
}

// ==========================================
// IMPORT/EXPORT TYPES
// ==========================================

export interface ImportCustomerData {
  name: string;
  email?: string;
  phone?: string;
  cpf_cnpj?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  birth_date?: string;
  gender?: string;
  profession?: string;
  tags?: string; // Comma-separated
  source?: string;
  preferred_contact?: string;
  marketing_consent?: boolean;
}

export interface ImportResult {
  total_processed: number;
  successful_imports: number;
  failed_imports: number;
  duplicates_skipped: number;
  errors: Array<{
    row: number;
    error: string;
    data: ImportCustomerData;
  }>;
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  timestamp?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
  timestamp: string;
}

// ==========================================
// ERROR TYPES
// ==========================================

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public validationErrors?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ==========================================
// MIDDLEWARE TYPES
// ==========================================

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  email: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ==========================================
// SERVICE LAYER TYPES
// ==========================================

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string;
  tags?: string[];
}

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

export interface ValidationSchema {
  body?: ValidationRules;
  params?: ValidationRules;
  query?: ValidationRules;
}

export interface ValidationRules {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    format?: 'email' | 'phone' | 'cpf' | 'cnpj' | 'date';
    enum?: (string | number)[];
    pattern?: string;
    items?: ValidationRules;
    properties?: ValidationRules;
    default?: any;
  };
}

// ==========================================
// EXPORT ALL TYPES
// ==========================================

export * from '@prisma/client';