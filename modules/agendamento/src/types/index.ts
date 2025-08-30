/**
 * Tipos TypeScript para o módulo Agendamento
 * Definições de interfaces, tipos e enums usados em todo o módulo
 */

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: IUser;
}

// === APPOINTMENT TYPES ===
export interface ICustomerBasic {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
}

export interface IProfessionalBasic {
  id: string;
  name: string;
  photo_url?: string;
  specialties?: string[];
  services?: string[];
}

export interface IServiceBasic {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category?: string;
  description?: string;
}

export interface IAppointment {
  id: string;
  company_id: string;
  customer_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: Date;
  appointment_time: Date;
  appointment_end_time: Date;
  timezone: string;
  status: AppointmentStatus;
  notes?: string;
  internal_notes?: string;
  estimated_price?: number;
  send_confirmation: boolean;
  send_reminder: boolean;
  reminder_hours_before: number;
  confirmed_at?: Date;
  confirmed_by?: string;
  original_appointment_id?: string;
  rescheduled_from_date?: Date;
  rescheduled_from_time?: Date;
  reschedule_reason?: string;
  completed_at?: Date;
  completed_appointment_id?: string;
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IAppointmentWithDetails extends IAppointment {
  customer: ICustomerBasic;
  professional: IProfessionalBasic;
  service: IServiceBasic;
}

export interface ICreateAppointmentRequest {
  customer_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM
  notes?: string;
  send_confirmation?: boolean;
  send_reminder?: boolean;
  reminder_hours_before?: number;
}

export interface IUpdateAppointmentRequest {
  appointment_date?: string;
  appointment_time?: string;
  notes?: string;
  internal_notes?: string;
  status?: AppointmentStatus;
  reschedule_reason?: string;
  send_reschedule_notification?: boolean;
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled'
}

// === CALENDAR TYPES ===
export interface ITimeSlot {
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  available: boolean;
  reason?: string;    // Motivo da indisponibilidade
  appointment_id?: string;
}

export interface IAvailabilityDay {
  date: string; // YYYY-MM-DD
  day_name: string;
  is_business_day: boolean;
  business_hours?: {
    start: string;
    end: string;
    lunch_break?: string;
  };
  available_slots: ITimeSlot[];
  total_slots: number;
  available_count: number;
}

export interface IAvailabilityRequest {
  professional_id: string;
  service_id: string;
  date: string; // YYYY-MM-DD
  days?: number; // Quantos dias verificar (default: 7)
}

export interface ICalendarData {
  view: CalendarView;
  period: {
    start_date: string;
    end_date: string;
  };
  business_hours: Record<string, { start: string; end: string }>;
  professionals: IProfessionalBasic[];
  appointments: ICalendarAppointment[];
  schedule_blocks: ICalendarBlock[];
}

export interface ICalendarAppointment {
  id: string;
  professional_id: string;
  customer_name: string;
  service_name: string;
  start: string; // ISO DateTime
  end: string;   // ISO DateTime
  status: AppointmentStatus;
  color: string;
  phone?: string;
  notes?: string;
}

export interface ICalendarBlock {
  id: string;
  professional_id?: string;
  title: string;
  start: string; // ISO DateTime
  end: string;   // ISO DateTime
  type: BlockType;
  color: string;
  description?: string;
}

export enum CalendarView {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

// === SCHEDULE BLOCK TYPES ===
export interface IScheduleBlock {
  id: string;
  company_id: string;
  professional_id?: string;
  start_date: Date;
  end_date: Date;
  start_time?: Date;
  end_time?: Date;
  block_type: BlockType;
  title: string;
  description?: string;
  is_recurring: boolean;
  recurrence_rule?: any;
  active: boolean;
  created_by?: string;
  created_at: Date;
}

export interface ICreateScheduleBlockRequest {
  professional_id?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  start_time?: string; // HH:MM
  end_time?: string;   // HH:MM
  block_type: BlockType;
  title: string;
  description?: string;
  is_recurring?: boolean;
  recurrence_rule?: any;
}

export enum BlockType {
  HOLIDAY = 'holiday',
  VACATION = 'vacation',
  MAINTENANCE = 'maintenance',
  PERSONAL = 'personal',
  BREAK = 'break',
  LUNCH = 'lunch'
}

// === NOTIFICATION TYPES ===
export interface INotification {
  id: string;
  appointment_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  recipient_phone?: string;
  recipient_email?: string;
  message_template?: string;
  message_content?: string;
  status: NotificationStatus;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  failure_reason?: string;
  external_message_id?: string;
  provider_response?: any;
  created_at: Date;
}

export interface IMessageTemplate {
  id: string;
  company_id: string;
  template_name: string;
  template_type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  content: string;
  active: boolean;
  is_default: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ISendNotificationRequest {
  template_type: NotificationType;
  channel: NotificationChannel;
  phone?: string;
  email?: string;
  variables: Record<string, any>;
}

export interface INotificationVariables {
  customer_name: string;
  date: string;
  time: string;
  professional: string;
  service: string;
  company_name?: string;
  address?: string;
  phone?: string;
  [key: string]: any;
}

export enum NotificationType {
  CONFIRMATION = 'confirmation',
  REMINDER = 'reminder',
  CANCELLATION = 'cancellation',
  RESCHEDULE = 'reschedule',
  NO_SHOW = 'no_show'
}

export enum NotificationChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}

// === WAITING LIST TYPES ===
export interface IWaitingList {
  id: string;
  company_id: string;
  customer_id: string;
  service_id: string;
  professional_id?: string;
  preferred_date?: Date;
  preferred_time_start?: Date;
  preferred_time_end?: Date;
  flexible_date: boolean;
  flexible_time: boolean;
  status: WaitingListStatus;
  priority: number;
  notify_phone: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
  expires_at?: Date;
  contacted_at?: Date;
  contacted_by?: string;
  appointment_id?: string;
  created_by?: string;
  created_at: Date;
}

export interface ICreateWaitingListRequest {
  customer_id: string;
  service_id: string;
  professional_id?: string;
  preferred_date?: string;
  preferred_time_start?: string;
  preferred_time_end?: string;
  flexible_date?: boolean;
  flexible_time?: boolean;
  priority?: number;
}

export enum WaitingListStatus {
  WAITING = 'waiting',
  CONTACTED = 'contacted',
  SCHEDULED = 'scheduled',
  EXPIRED = 'expired'
}

// === BUSINESS HOURS TYPES ===
export interface IBusinessHour {
  id: string;
  company_id: string;
  day_of_week: number; // 0 = domingo, 1 = segunda
  is_open: boolean;
  start_time?: Date;
  end_time?: Date;
  lunch_start?: Date;
  lunch_end?: Date;
  slot_duration_minutes: number;
  advance_booking_days: number;
  same_day_booking: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IWorkDay {
  day_of_week: number;
  day_name: string;
  is_open: boolean;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  lunch_start?: string | null; // HH:MM
  lunch_end?: string | null;   // HH:MM
  slot_duration_minutes: number;
  advance_booking_days: number;
  same_day_booking: boolean;
}

export interface IBusinessHoursConfig {
  company_id: string;
  days: IWorkDay[];
}

export interface IBusinessHoursRequest {
  day_of_week: number;
  is_open: boolean;
  start_time?: string; // HH:MM
  end_time?: string;   // HH:MM
  lunch_start?: string;
  lunch_end?: string;
  slot_duration_minutes?: number;
}

// === REPORTS TYPES ===
export interface IAppointmentReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_appointments: number;
    total_revenue: number;
    average_per_day: number;
    by_status: Record<AppointmentStatus, number>;
    by_professional: Array<{
      professional_id: string;
      professional_name: string;
      appointments: number;
      revenue: number;
    }>;
    by_service: Array<{
      service_id: string;
      service_name: string;
      appointments: number;
      revenue: number;
    }>;
  };
  daily_breakdown: Array<{
    date: string;
    appointments: number;
    revenue: number;
    no_shows: number;
    occupancy_rate: number;
  }>;
}

export interface INoShowReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_no_shows: number;
    no_show_rate: number;
    revenue_lost: number;
  };
  by_customer: Array<{
    customer_id: string;
    customer_name: string;
    phone: string;
    no_shows: number;
    last_no_show: string;
  }>;
}

// === API RESPONSE TYPES ===
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// === ERROR TYPES ===
export class AppointmentError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode = 400, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppointmentError';
  }
}

export enum ErrorCode {
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
  APPOINTMENT_NOT_FOUND = 'APPOINTMENT_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  PROFESSIONAL_NOT_FOUND = 'PROFESSIONAL_NOT_FOUND',
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  INVALID_TIME_SLOT = 'INVALID_TIME_SLOT',
  OUTSIDE_BUSINESS_HOURS = 'OUTSIDE_BUSINESS_HOURS',
  PROFESSIONAL_NOT_AVAILABLE = 'PROFESSIONAL_NOT_AVAILABLE',
  INVALID_APPOINTMENT_STATUS = 'INVALID_APPOINTMENT_STATUS',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

// === INTEGRATION TYPES ===
export interface IExternalCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  address?: any;
  preferences?: any;
}

export interface IExternalProfessional {
  id: string;
  name: string;
  photo_url?: string;
  specialties: string[];
  services: string[];
  schedule?: any;
  is_active: boolean;
}

export interface IExternalService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  description?: string;
  professionals: string[];
  is_active: boolean;
}

// === UTILS TYPES ===
export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeRange {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface BusinessRules {
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  allowSameDayBooking: boolean;
  slotDurationMinutes: number;
  reminderDefaultHours: number;
  autoConfirmationEnabled: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}