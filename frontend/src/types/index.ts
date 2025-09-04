// ERP Nexus - Tipos TypeScript Frontend
// Baseado no backend implementado conforme DESENVOLVIMENTO_COMPLETO.md

// ====================================
// AUTH & USERS TYPES
// ====================================
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
  companyId: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt?: string; // ✅ ISO 8601 string from API
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
  // Computed property for display
  name?: string;
}

export interface Company {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  settings: Record<string, any>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  company: Company;
}

// ====================================
// CRM TYPES
// ====================================

// Interface para endereço estruturado (alinhada com schema do backend)
export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  birthDate?: string; // ✅ ISO 8601 date string (YYYY-MM-DD) or null
  address: Address | null; // ✅ NOVA: Estrutura de endereço completa
  notes?: string;
  tags: string[];
  status: 'ACTIVE' | 'INACTIVE';
  companyId: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
  _count?: {
    notes: number;
    interactions: number;
  };
}

export interface CustomerNote {
  id: string;
  content: string;
  type: 'PUBLIC' | 'PRIVATE';
  customerId: string;
  userId: string;
  user: Pick<User, 'id' | 'name'>;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

export interface CustomerInteraction {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'SMS' | 'NOTE' | 'TASK' | 'VISIT' | 'OTHER';
  description?: string;
  date: string;
  customerId: string;
  userId: string;
  user: Pick<User, 'id' | 'name'>;
  createdAt: string;
}

// ====================================
// SERVICES TYPES
// ====================================
export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: string; // ✅ DECIMAL PRECISION: Changed from number to string
  duration: number; // em minutos
  category: string;
  status: ServiceStatus;
  companyId: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

export type ProfessionalStatus = 'ACTIVE' | 'INACTIVE' | 'VACATION' | 'SICK_LEAVE';

export interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialties: string[];
  workSchedule: {
    monday: { start: string; end: string; active: boolean };
    tuesday: { start: string; end: string; active: boolean };
    wednesday: { start: string; end: string; active: boolean };
    thursday: { start: string; end: string; active: boolean };
    friday: { start: string; end: string; active: boolean };
    saturday: { start: string; end: string; active: boolean };
    sunday: { start: string; end: string; active: boolean };
  };
  status: ProfessionalStatus;
  companyId: string;
  userId?: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

export interface CompletedAppointment {
  id: string;
  customerId: string;
  customer: Pick<Customer, 'id' | 'name'>;
  professionalId: string;
  professional: Pick<Professional, 'id' | 'name'>;
  serviceId: string;
  service: Pick<Service, 'id' | 'name' | 'price'>; // price is now string for precision
  startTime: string;
  endTime: string;
  observations: string;
  paymentStatus: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'OTHER';
  totalAmount: string; // ✅ DECIMAL PRECISION: Changed from number to string
  photos: ServicePhoto[];
  companyId: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

export interface ServicePhoto {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl: string;
  type: 'BEFORE' | 'AFTER' | 'DURING';
  appointmentId: string;
  createdAt: string;
}

// ====================================
// AGENDAMENTO TYPES
// ====================================
export interface Appointment {
  id: string;
  customerId: string;
  customer: Pick<Customer, 'id' | 'name' | 'phone'>;
  professionalId: string;
  professional: Pick<Professional, 'id' | 'name'>;
  serviceId: string;
  service: Pick<Service, 'id' | 'name' | 'duration' | 'price'>; // price is now string for precision
  startTime: string; // ✅ ISO 8601 string from API
  endTime: string; // ✅ ISO 8601 string from API
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  reminderSent: boolean;
  companyId: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

export interface CalendarAvailability {
  professional: Professional;
  date: string; // ✅ ISO 8601 date string (YYYY-MM-DD)
  slots: {
    time: string; // ✅ Time in HH:mm format
    available: boolean;
    reason?: string;
  }[];
}

export interface ScheduleBlock {
  id: string;
  professionalId: string;
  startTime: string; // ✅ ISO 8601 string from API
  endTime: string; // ✅ ISO 8601 string from API
  reason: string;
  type: 'BREAK' | 'UNAVAILABLE' | 'VACATION' | 'OTHER';
  companyId: string;
  createdAt: string; // ✅ ISO 8601 string from API
  updatedAt: string; // ✅ ISO 8601 string from API
}

// ====================================
// API RESPONSE TYPES
// ====================================
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ====================================
// FORM TYPES
// ====================================
export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  document?: string;
  birthDate?: string; // ✅ ISO 8601 date string (YYYY-MM-DD) or null
  address?: string;
  notes?: string;
}

export interface ServiceFormData {
  name: string;
  description?: string;
  price: string; // ✅ DECIMAL PRECISION: Changed from number to string
  duration: number;
  category: string;
  status?: ServiceStatus;
}

export interface ProfessionalFormData {
  name: string;
  email: string;
  phone: string;
  specialties: string[];
  workSchedule: Professional['workSchedule'];
  status: ProfessionalStatus;
}

export interface AppointmentFormData {
  customerId: string;
  professionalId: string;
  serviceId: string;
  startTime: string; // ✅ ISO 8601 string to send to API
  notes?: string;
}

// ====================================
// FILTER & SEARCH TYPES
// ====================================
export interface CustomerFilters {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  tags?: string[];
  dateRange?: {
    start: string; // ✅ ISO 8601 date string
    end: string; // ✅ ISO 8601 date string
  };
}

export interface AppointmentFilters {
  startDate?: string; // ✅ ISO 8601 date string
  endDate?: string; // ✅ ISO 8601 date string
  professionalId?: string;
  status?: Appointment['status'];
  customerId?: string;
}

// ====================================
// DASHBOARD & REPORTS TYPES
// ====================================
export interface DashboardStats {
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    growth: number;
  };
  appointments: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    completionRate: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number;
  };
  professionals: {
    active: number;
    occupancyRate: number;
  };
}

// ====================================
// UI COMPONENT TYPES
// ====================================
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// ====================================
// STORE TYPES (ZUSTAND)
// ====================================
export interface AuthStore {
  user: User | null;
  company: Company | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  status: 'initializing' | 'loading' | 'authenticated' | 'unauthenticated';
  isInitialized: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  initialize: () => void;
}

export interface UIStore {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  toasts: ToastMessage[];
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}