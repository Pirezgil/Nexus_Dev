// ERP Nexus - React Query Configuration
// Configuração completa do QueryClient para integração com APIs backend

import { QueryClient, DefaultOptions } from '@tanstack/react-query';

// ====================================
// QUERY CLIENT CONFIGURATION
// ====================================

const queryConfig: DefaultOptions = {
  queries: {
    // Cache strategies baseadas no tipo de dado
    staleTime: 5 * 60 * 1000, // 5 minutes (dados ficam "fresh")
    gcTime: 10 * 60 * 1000, // 10 minutes (garbage collection)
    
    // Retry logic inteligente
    retry: (failureCount, error: any) => {
      // Não retry em erros 4xx (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Máximo de 3 tentativas para erros de servidor
      return failureCount < 3;
    },
    
    // Background refetch configurado
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    refetchInterval: false, // Desabilita refetch automático global
  },
  mutations: {
    retry: 1, // Mutations falham mais rapidamente
  },
};

export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

// ====================================
// QUERY KEYS FACTORY
// ====================================

export const queryKeys = {
  // ========== AUTH ==========
  auth: {
    me: ['auth', 'me'] as const,
    validate: ['auth', 'validate'] as const,
  },
  
  // ========== CRM ==========
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
    search: (term: string) => ['customers', 'search', term] as const,
    basic: (id: string) => ['customers', id, 'basic'] as const,
    history: (id: string) => ['customers', id, 'history'] as const,
    notes: (id: string) => ['customers', id, 'notes'] as const,
    interactions: (id: string) => ['customers', id, 'interactions'] as const,
    tags: (id?: string) => id ? ['customers', id, 'tags'] as const : ['customers', 'tags'] as const,
    appointments: (id: string) => ['customers', id, 'appointments'] as const,
    stats: () => ['customers', 'stats'] as const,
  },
  
  // ========== SERVICES ==========
  services: {
    all: ['services'] as const,
    lists: () => [...queryKeys.services.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.services.lists(), filters] as const,
    details: () => [...queryKeys.services.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.services.details(), id] as const,
    categories: () => ['services', 'categories'] as const,
    search: (term: string) => ['services', 'search', term] as const,
    active: () => ['services', 'active'] as const,
  },
  
  professionals: {
    all: ['professionals'] as const,
    lists: () => [...queryKeys.professionals.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.professionals.lists(), filters] as const,
    details: () => [...queryKeys.professionals.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.professionals.details(), id] as const,
    active: () => ['professionals', 'active'] as const,
    available: (date: string, serviceId?: string) => 
      ['professionals', 'available', date, serviceId] as const,
    availability: (id: string, date: string) => 
      ['professionals', id, 'availability', date] as const,
    schedule: (id: string) => ['professionals', id, 'schedule'] as const,
    services: (id: string) => ['professionals', id, 'services'] as const,
    statistics: (id: string, period?: string) => 
      ['professionals', id, 'statistics', period] as const,
  },
  
  completedAppointments: {
    all: ['completed-appointments'] as const,
    lists: () => [...queryKeys.completedAppointments.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.completedAppointments.lists(), filters] as const,
    details: () => [...queryKeys.completedAppointments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.completedAppointments.details(), id] as const,
    photos: (id: string) => ['completed-appointments', id, 'photos'] as const,
    customer: (customerId: string) => 
      ['completed-appointments', 'customer', customerId] as const,
    professional: (professionalId: string) => 
      ['completed-appointments', 'professional', professionalId] as const,
  },
  
  // ========== AGENDAMENTO ==========
  appointments: {
    all: ['appointments'] as const,
    lists: () => [...queryKeys.appointments.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.appointments.lists(), filters] as const,
    details: () => [...queryKeys.appointments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.appointments.details(), id] as const,
    calendar: (professionalId?: string, date?: string) => 
      ['appointments', 'calendar', professionalId, date] as const,
    today: () => ['appointments', 'today'] as const,
    upcoming: () => ['appointments', 'upcoming'] as const,
    byStatus: (status: string) => ['appointments', 'status', status] as const,
    byCustomer: (customerId: string) => ['appointments', 'customer', customerId] as const,
    byProfessional: (professionalId: string) => 
      ['appointments', 'professional', professionalId] as const,
  },
  
  availability: {
    all: ['availability'] as const,
    professional: (professionalId: string, date: string) => 
      ['availability', professionalId, date] as const,
    slots: (professionalId: string, date: string, serviceId?: string) =>
      ['availability', 'slots', professionalId, date, serviceId] as const,
  },
  
  scheduleBlocks: {
    all: ['schedule-blocks'] as const,
    lists: () => [...queryKeys.scheduleBlocks.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.scheduleBlocks.lists(), filters] as const,
    professional: (professionalId: string) => 
      ['schedule-blocks', 'professional', professionalId] as const,
  },
  
  // ========== NOTIFICATIONS ==========
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.notifications.lists(), filters] as const,
    templates: () => ['notifications', 'templates'] as const,
    stats: () => ['notifications', 'stats'] as const,
    unread: () => ['notifications', 'unread'] as const,
  },
  
  // ========== WAITING LIST ==========
  waitingList: {
    all: ['waiting-list'] as const,
    lists: () => [...queryKeys.waitingList.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.waitingList.lists(), filters] as const,
    stats: () => ['waiting-list', 'stats'] as const,
    byService: (serviceId: string) => ['waiting-list', 'service', serviceId] as const,
    byProfessional: (professionalId: string) => 
      ['waiting-list', 'professional', professionalId] as const,
  },
  
  // ========== REPORTS ==========
  reports: {
    all: ['reports'] as const,
    daily: (date: string) => ['reports', 'daily', date] as const,
    weekly: (startDate: string) => ['reports', 'weekly', startDate] as const,
    monthly: (year: number, month: number) => 
      ['reports', 'monthly', year, month] as const,
    professional: (id: string, period?: string) => 
      ['reports', 'professional', id, period] as const,
    financial: (startDate: string, endDate: string) => 
      ['reports', 'financial', startDate, endDate] as const,
    dashboard: (period?: string) => ['reports', 'dashboard', period] as const,
    occupancy: (professionalId?: string, date?: string) =>
      ['reports', 'occupancy', professionalId, date] as const,
  },
  
  // ========== HEALTH ==========
  health: {
    status: () => ['health', 'status'] as const,
    services: () => ['health', 'services'] as const,
  },
} as const;

// ====================================
// CACHE INVALIDATION HELPERS
// ====================================

export const invalidateQueries = {
  // Invalidate all customer related queries
  customers: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
  },
  
  // Invalidate customer specific data
  customer: (id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.notes(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.interactions(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.tags(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.appointments(id) });
  },
  
  // Invalidate all services related queries
  services: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
  },
  
  // Invalidate all professionals related queries
  professionals: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.professionals.all });
  },
  
  // Invalidate professional specific data
  professional: (id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.professionals.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.professionals.services(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.professionals.schedule(id) });
  },
  
  // Invalidate all appointments related queries
  appointments: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
  },
  
  // Invalidate appointment specific data and related queries
  appointment: (id: string, data?: { professionalId?: string; customerId?: string; date?: string }) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.detail(id) });
    
    if (data?.professionalId) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.appointments.byProfessional(data.professionalId) 
      });
    }
    
    if (data?.customerId) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.appointments.byCustomer(data.customerId) 
      });
    }
    
    if (data?.date) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.appointments.calendar(undefined, data.date) 
      });
    }
    
    // Always invalidate today and upcoming
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.today() });
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.upcoming() });
  },
  
  // Invalidate availability data
  availability: (professionalId?: string, date?: string) => {
    if (professionalId && date) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.availability.professional(professionalId, date) 
      });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    }
  },
  
  // Invalidate reports
  reports: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
  },
  
  // Invalidate all related to a specific date (appointments, availability, reports)
  date: (date: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.calendar(undefined, date) });
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.daily(date) });
    // Could add more date-specific invalidations
  },
};

// ====================================
// OPTIMISTIC UPDATE HELPERS
// ====================================

export const optimisticUpdates = {
  // Update customer in cache optimistically
  updateCustomer: (customerId: string, updates: any) => {
    queryClient.setQueryData(
      queryKeys.customers.detail(customerId),
      (oldData: any) => oldData ? { ...oldData, ...updates } : null
    );
    
    // Update in lists as well
    queryClient.setQueriesData(
      { queryKey: queryKeys.customers.lists() },
      (oldData: any) => {
        if (!oldData?.data) return oldData;
        
        return {
          ...oldData,
          data: oldData.data.map((customer: any) => 
            customer.id === customerId ? { ...customer, ...updates } : customer
          ),
        };
      }
    );
  },
  
  // Add new customer to cache optimistically  
  addCustomer: (customer: any) => {
    // Add to lists
    queryClient.setQueriesData(
      { queryKey: queryKeys.customers.lists() },
      (oldData: any) => {
        if (!oldData?.data) return oldData;
        
        return {
          ...oldData,
          data: [customer, ...oldData.data],
          total: oldData.total + 1,
        };
      }
    );
  },
  
  // Remove customer from cache optimistically
  removeCustomer: (customerId: string) => {
    // Remove from lists
    queryClient.setQueriesData(
      { queryKey: queryKeys.customers.lists() },
      (oldData: any) => {
        if (!oldData?.data) return oldData;
        
        return {
          ...oldData,
          data: oldData.data.filter((customer: any) => customer.id !== customerId),
          total: oldData.total - 1,
        };
      }
    );
    
    // Remove detail cache
    queryClient.removeQueries({ queryKey: queryKeys.customers.detail(customerId) });
  },
  
  // Update appointment status optimistically
  updateAppointmentStatus: (appointmentId: string, status: string) => {
    queryClient.setQueryData(
      queryKeys.appointments.detail(appointmentId),
      (oldData: any) => oldData ? { ...oldData, status } : null
    );
    
    // Update in lists as well
    queryClient.setQueriesData(
      { queryKey: queryKeys.appointments.lists() },
      (oldData: any) => {
        if (!oldData?.data) return oldData;
        
        return {
          ...oldData,
          data: oldData.data.map((appointment: any) => 
            appointment.id === appointmentId ? { ...appointment, status } : appointment
          ),
        };
      }
    );
  },
};

// ====================================
// CACHE CONFIGURATION PRESETS
// ====================================

export const cachePresets = {
  // Para dados que mudam raramente (services, professionals)
  static: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Para dados que mudam com frequência (appointments, availability) 
  dynamic: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  
  // Para dados críticos que precisam estar sempre atualizados (dashboard stats)
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000, // Auto-refetch every minute
  },
  
  // Para dados de usuário/sessão
  session: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  },
  
  // Para pesquisas
  search: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
};

export default queryClient;