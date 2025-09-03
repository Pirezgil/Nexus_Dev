// ERP Nexus - API Types
// Tipos TypeScript organizados para todas as APIs

// ====================================
// COMMON API TYPES
// ====================================

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface SearchFilter {
  search?: string;
}

// ====================================
// AUTH TYPES
// ====================================

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  company: Company;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
  companyId: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatar?: string;
  phone?: string;
  settings?: Record<string, any>;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  document: string; // CNPJ
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  website?: string;
  logo?: string;
  settings: CompanySettings;
  subscription?: {
    plan: string;
    status: 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'EXPIRED';
    expiresAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  language: string;
  businessHours: {
    monday: { start: string; end: string; active: boolean };
    tuesday: { start: string; end: string; active: boolean };
    wednesday: { start: string; end: string; active: boolean };
    thursday: { start: string; end: string; active: boolean };
    friday: { start: string; end: string; active: boolean };
    saturday: { start: string; end: string; active: boolean };
    sunday: { start: string; end: string; active: boolean };
  };
  notifications: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };
}

// ====================================
// CRM TYPES
// ====================================

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  documentType?: 'CPF' | 'CNPJ';
  birthDate?: string;
  gender?: 'M' | 'F' | 'OTHER';
  address?: CustomerAddress;
  notes?: string;
  tags: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'BLOCKED';
  source?: 'ORGANIC' | 'REFERRAL' | 'SOCIAL_MEDIA' | 'ADVERTISING' | 'OTHER';
  metadata?: Record<string, any>;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  _count?: {
    notes: number;
    interactions: number;
    appointments: number;
  };
  lastInteraction?: {
    date: string;
    type: string;
  };
}

export interface CustomerAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CustomerFilters extends PaginationParams, SearchFilter, DateRangeFilter {
  status?: Customer['status'];
  tags?: string[];
  source?: Customer['source'];
  hasEmail?: boolean;
  hasPhone?: boolean;
  birthMonth?: number;
  gender?: Customer['gender'];
}

export interface CustomerNote {
  id: string;
  content: string;
  type: 'GENERAL' | 'IMPORTANT' | 'REMINDER' | 'FOLLOW_UP' | 'COMPLAINT' | 'COMPLIMENT' | 'MEDICAL' | 'FINANCIAL';
  isPrivate: boolean;
  isPinned: boolean;
  customerId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  attachments?: CustomerNoteAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNoteAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface CustomerInteraction {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'SMS' | 'NOTE' | 'TASK' | 'VISIT' | 'SOCIAL_MEDIA' | 'OTHER';
  direction: 'INBOUND' | 'OUTBOUND';
  title: string;
  description?: string;
  date: string;
  duration?: number; // in minutes
  outcome?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  metadata?: Record<string, any>;
  isCompleted: boolean;
  scheduledAt?: string;
  completedAt?: string;
  customerId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  attachments?: CustomerInteractionAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInteractionAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  isSystemTag: boolean;
  customersCount: number;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  prospects: number;
  blocked: number;
  newThisMonth: number;
  growth: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byTags: Array<{
    name: string;
    count: number;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

// ====================================
// SERVICES TYPES
// ====================================

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: string; // ✅ DECIMAL PRECISION: Changed from number to string
  duration: number; // in minutes
  category: string;
  categoryId?: string;
  color?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  allowOnlineBooking: boolean;
  requiresApproval: boolean;
  maxAdvanceBookingDays?: number;
  minNoticeHours?: number;
  tags: string[];
  metadata?: Record<string, any>;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  _count?: {
    appointments: number;
    professionals: number;
  };
  avgRating?: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  servicesCount: number;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFilters extends PaginationParams, SearchFilter {
  category?: string;
  categoryId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  allowOnlineBooking?: boolean;
  priceMin?: string; // ✅ DECIMAL PRECISION: Changed from number to string
  priceMax?: string; // ✅ DECIMAL PRECISION: Changed from number to string
  durationMin?: number;
  durationMax?: number;
  tags?: string[];
  professionalId?: string; // Filter by professional's services
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  document?: string;
  avatar?: string;
  bio?: string;
  specialties: string[];
  workSchedule: ProfessionalWorkSchedule;
  status: 'ACTIVE' | 'INACTIVE' | 'VACATION' | 'SICK_LEAVE';
  allowOnlineBooking: boolean;
  notificationPreferences: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };
  companyId: string;
  userId?: string; // If professional is also a system user
  createdAt: string;
  updatedAt: string;
  // Computed fields
  _count?: {
    services: number;
    appointments: number;
    completedAppointments: number;
  };
  avgRating?: number;
  stats?: {
    completionRate: number;
    occupancyRate: number;
    avgAppointmentDuration: number;
  };
}

export interface ProfessionalWorkSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  start: string; // HH:mm format
  end: string;   // HH:mm format
  active: boolean;
  breaks?: Array<{
    start: string;
    end: string;
    title?: string;
  }>;
}

export interface ProfessionalFilters extends PaginationParams, SearchFilter {
  status?: 'ACTIVE' | 'INACTIVE' | 'VACATION' | 'SICK_LEAVE';
  allowOnlineBooking?: boolean;
  specialty?: string;
  hasServices?: boolean;
  serviceId?: string; // Filter by service
  availableOn?: string; // Filter by availability on date
}

export interface ProfessionalAvailability {
  professionalId: string;
  professional: {
    id: string;
    name: string;
    avatar?: string;
  };
  date: string;
  slots: TimeSlot[];
  workingHours: {
    start: string;
    end: string;
  };
  breaks: Array<{
    start: string;
    end: string;
    title?: string;
  }>;
  exceptions: Array<{
    start: string;
    end: string;
    reason: string;
    type: 'BREAK' | 'UNAVAILABLE' | 'VACATION';
  }>;
}

export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
  reason?: string;
  appointmentId?: string;
  duration?: number; // Available duration in minutes
}

export interface ProfessionalStatistics {
  period: {
    start: string;
    end: string;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    average: number;
    growth: number;
  };
  occupancy: {
    rate: number;
    hoursWorked: number;
    hoursAvailable: number;
  };
  ratings: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  services: Array<{
    serviceId: string;
    serviceName: string;
    count: number;
    revenue: number;
  }>;
  timeline: Array<{
    date: string;
    appointments: number;
    revenue: number;
    hoursWorked: number;
  }>;
}

export interface CompletedAppointment {
  id: string;
  appointmentId: string; // Reference to original scheduled appointment
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  professionalId: string;
  professional: {
    id: string;
    name: string;
    avatar?: string;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    price: string; // ✅ DECIMAL PRECISION: Changed from number to string
    category: string;
    duration: number;
  };
  startTime: string;
  endTime: string;
  actualDuration?: number; // Real duration vs scheduled
  observations?: string;
  internalNotes?: string;
  paymentStatus: 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELLED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'OTHER';
  totalAmount: string; // ✅ DECIMAL PRECISION: Changed from number to string
  discountAmount?: number;
  discountReason?: string;
  photos: ServicePhoto[];
  rating?: {
    score: number; // 1-5
    comment?: string;
    ratedAt: string;
  };
  followUpNeeded: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompletedAppointmentFilters extends PaginationParams, DateRangeFilter {
  customerId?: string;
  professionalId?: string;
  serviceId?: string;
  paymentStatus?: CompletedAppointment['paymentStatus'];
  paymentMethod?: CompletedAppointment['paymentMethod'];
  hasPhotos?: boolean;
  hasRating?: boolean;
  ratingMin?: number;
  followUpNeeded?: boolean;
  totalAmountMin?: string; // ✅ DECIMAL PRECISION: Changed from number to string
  totalAmountMax?: string; // ✅ DECIMAL PRECISION: Changed from number to string
}

export interface ServicePhoto {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  type: 'BEFORE' | 'AFTER' | 'DURING' | 'RESULT';
  description?: string;
  appointmentId: string;
  uploadedBy: string;
  createdAt: string;
}

// ====================================
// AGENDAMENTO TYPES
// ====================================

export interface Appointment {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
  professionalId: string;
  professional: {
    id: string;
    name: string;
    avatar?: string;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    duration: number;
    price: string; // ✅ DECIMAL PRECISION: Changed from number to string
    category: string;
    color?: string;
  };
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  source: 'MANUAL' | 'ONLINE' | 'PHONE' | 'WHATSAPP' | 'WALK_IN' | 'RECURRING';
  notes?: string;
  internalNotes?: string;
  reminderSent: boolean;
  confirmationSent: boolean;
  whatsappSent: boolean;
  price?: string; // ✅ DECIMAL PRECISION: Override service price if needed
  deposit?: {
    amount: string; // ✅ DECIMAL PRECISION: Changed from number to string
    status: 'PENDING' | 'PAID' | 'CANCELLED';
    paidAt?: string;
    method?: string;
  };
  recurrence?: {
    pattern: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    endDate?: string;
    maxOccurrences?: number;
    parentId?: string; // Reference to parent recurring appointment
  };
  companyId: string;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  duration?: number;
  isRecurring?: boolean;
  canCancel?: boolean;
  canReschedule?: boolean;
}

export type AppointmentStatus = 
  | 'SCHEDULED'    // Agendado
  | 'CONFIRMED'    // Confirmado pelo cliente
  | 'IN_PROGRESS'  // Em andamento
  | 'COMPLETED'    // Concluído
  | 'CANCELLED'    // Cancelado
  | 'NO_SHOW'      // Faltou
  | 'RESCHEDULED'; // Reagendado

export interface AppointmentFilters extends PaginationParams, DateRangeFilter {
  customerId?: string;
  professionalId?: string;
  serviceId?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  source?: Appointment['source'];
  isRecurring?: boolean;
  hasDeposit?: boolean;
  depositStatus?: 'PENDING' | 'PAID' | 'CANCELLED';
  reminderSent?: boolean;
  confirmationSent?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  resourceId: string; // professionalId
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    appointment?: Appointment;
    scheduleBlock?: ScheduleBlock;
    type: 'appointment' | 'break' | 'unavailable' | 'vacation' | 'holiday';
    status?: AppointmentStatus;
    customerName?: string;
    serviceName?: string;
    notes?: string;
  };
  allDay?: boolean;
  editable?: boolean;
  startEditable?: boolean;
  durationEditable?: boolean;
}

export interface ScheduleBlock {
  id: string;
  professionalId: string;
  professional?: {
    id: string;
    name: string;
    avatar?: string;
  };
  title: string;
  startTime: string;
  endTime: string;
  reason?: string;
  type: ScheduleBlockType;
  isRecurring: boolean;
  recurringPattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurringEndDate?: string;
  recurringDays?: number[]; // 0-6, Sunday-Saturday
  color?: string;
  isAllDay: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleBlockType = 
  | 'BREAK'       // Intervalo
  | 'LUNCH'       // Almoço
  | 'UNAVAILABLE' // Indisponível
  | 'VACATION'    // Férias
  | 'HOLIDAY'     // Feriado
  | 'SICK_LEAVE'  // Licença médica
  | 'PERSONAL'    // Pessoal
  | 'TRAINING'    // Treinamento
  | 'OTHER';      // Outro

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  type: NotificationTemplateType;
  channel: NotificationChannel;
  trigger: NotificationTrigger;
  timing?: {
    delay: number;
    unit: 'MINUTES' | 'HOURS' | 'DAYS';
  };
  subject?: string; // For email
  message: string;
  variables: string[]; // Available template variables
  status: 'ACTIVE' | 'INACTIVE';
  isSystem: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationTemplateType = 
  | 'CONFIRMATION'   // Confirmação de agendamento
  | 'REMINDER'       // Lembrete
  | 'CANCELLATION'   // Cancelamento
  | 'RESCHEDULE'     // Reagendamento
  | 'FOLLOW_UP'      // Follow-up
  | 'BIRTHDAY'       // Aniversário
  | 'PROMOTION'      // Promoção
  | 'FEEDBACK'       // Feedback
  | 'CUSTOM';        // Personalizado

export type NotificationChannel = 
  | 'WHATSAPP'
  | 'SMS'
  | 'EMAIL'
  | 'PUSH';

export type NotificationTrigger = 
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_COMPLETED'
  | 'MANUAL'
  | 'BIRTHDAY'
  | 'FOLLOW_UP';

export interface NotificationLog {
  id: string;
  appointmentId?: string;
  appointment?: Partial<Appointment>;
  customerId?: string;
  customer?: {
    id: string;
    name: string;
  };
  templateId: string;
  template?: {
    id: string;
    name: string;
    type: NotificationTemplateType;
  };
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  error?: string;
  metadata?: Record<string, any>;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationStatus = 
  | 'PENDING'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export interface NotificationFilters extends PaginationParams, DateRangeFilter {
  appointmentId?: string;
  customerId?: string;
  templateId?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  recipient?: string;
  hasError?: boolean;
}

export interface WaitingListItem {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    duration: number;
    price: string; // ✅ DECIMAL PRECISION: Changed from number to string
    category: string;
  };
  professionalId?: string;
  professional?: {
    id: string;
    name: string;
  };
  preferredDate?: string;
  preferredTime?: string;
  preferredDuration?: number; // Minutes
  notes?: string;
  priority: WaitingListPriority;
  status: WaitingListStatus;
  source: 'MANUAL' | 'ONLINE' | 'CANCELLATION' | 'NO_SHOW' | 'RESCHEDULE';
  notificationPreferences: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  contactAttempts: number;
  maxContactAttempts: number;
  lastContactedAt?: string;
  scheduledAt?: string;
  appointmentId?: string; // When converted to appointment
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type WaitingListPriority = 
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type WaitingListStatus = 
  | 'WAITING'
  | 'CONTACTED'
  | 'SCHEDULED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface WaitingListFilters extends PaginationParams, DateRangeFilter {
  serviceId?: string;
  professionalId?: string;
  customerId?: string;
  priority?: WaitingListPriority;
  status?: WaitingListStatus;
  source?: WaitingListItem['source'];
  preferredDate?: string;
  hasPreferredProfessional?: boolean;
  needsContact?: boolean;
}

// ====================================
// REPORTS TYPES
// ====================================

export interface ReportFilters extends DateRangeFilter {
  professionalId?: string;
  serviceId?: string;
  customerId?: string;
  period?: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
  groupBy?: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
}

export interface DashboardStats {
  appointments: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number;
    completionRate: number;
    byStatus: Record<AppointmentStatus, number>;
  };
  customers: {
    total: number;
    active: number;
    new: number;
    growth: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number;
    pending: number;
  };
  professionals: {
    total: number;
    active: number;
    occupancyRate: number;
    avgRating: number;
  };
  services: {
    total: number;
    active: number;
    popular: Array<{
      id: string;
      name: string;
      count: number;
    }>;
  };
  waitingList: {
    total: number;
    priority: Record<WaitingListPriority, number>;
  };
  notifications: {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  };
}

export interface FinancialReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalRevenue: string; // ✅ DECIMAL PRECISION: Changed from number to string
    totalAppointments: number;
    averageTicket: number;
    growth: number;
  };
  byPaymentMethod: Record<string, {
    amount: string; // ✅ DECIMAL PRECISION: Changed from number to string
    count: number;
    percentage: number;
  }>;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    category: string;
    revenue: number;
    count: number;
    avgPrice: number;
  }>;
  byProfessional: Array<{
    professionalId: string;
    professionalName: string;
    revenue: number;
    appointments: number;
    avgTicket: number;
  }>;
  timeline: Array<{
    date: string;
    revenue: number;
    appointments: number;
    avgTicket: number;
  }>;
  pending: {
    amount: string; // ✅ DECIMAL PRECISION: Changed from number to string
    count: number;
    overdue: number;
  };
}

// ====================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ====================================

export type {
  // Re-export for backward compatibility
  Customer as CustomerType,
  Service as ServiceType,
  Professional as ProfessionalType,
  Appointment as AppointmentType,
};