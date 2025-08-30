// ERP Nexus - Services Module Hooks
// React Query hooks para integração completa com API Services

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys, optimisticUpdates, invalidateQueries, cachePresets } from '@/lib/query-client';
import { toast } from '@/hooks/use-toast';

// ====================================
// TYPES & INTERFACES
// ====================================

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number; // em minutos
  category: string;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    appointments: number;
    professionals: number;
  };
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  servicesCount: number;
  companyId: string;
}

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
  isActive: boolean;
  companyId: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    services: number;
    appointments: number;
    completedAppointments: number;
  };
}

export interface CompletedAppointment {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  professionalId: string;
  professional: {
    id: string;
    name: string;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    price: number;
    category: string;
  };
  startTime: string;
  endTime: string;
  duration: number;
  observations?: string;
  paymentStatus: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'OTHER';
  totalAmount: number;
  photos: ServicePhoto[];
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePhoto {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  type: 'BEFORE' | 'AFTER' | 'DURING';
  appointmentId: string;
  createdAt: string;
}

export interface ProfessionalAvailability {
  professional: Professional;
  date: string;
  slots: Array<{
    time: string;
    available: boolean;
    reason?: string;
    serviceId?: string;
  }>;
}

export interface ProfessionalStatistics {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
  occupancyRate: number;
  popularServices: Array<{
    serviceId: string;
    serviceName: string;
    count: number;
  }>;
  monthlyStats: Array<{
    month: string;
    appointments: number;
    revenue: number;
  }>;
}

export interface ServiceFilters {
  search?: string;
  category?: string;
  isActive?: boolean;
  priceMin?: number;
  priceMax?: number;
  durationMin?: number;
  durationMax?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProfessionalFilters {
  search?: string;
  isActive?: boolean;
  specialty?: string;
  hasServices?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CompletedAppointmentFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  professionalId?: string;
  serviceId?: string;
  paymentStatus?: CompletedAppointment['paymentStatus'];
  paymentMethod?: CompletedAppointment['paymentMethod'];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ====================================
// API FUNCTIONS
// ====================================

const servicesApi = {
  // ========== SERVICES CRUD ==========
  
  // List services with filters
  list: async (filters: ServiceFilters = {}): Promise<PaginatedResponse<Service>> => {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.priceMin) params.append('priceMin', filters.priceMin.toString());
    if (filters.priceMax) params.append('priceMax', filters.priceMax.toString());
    if (filters.durationMin) params.append('durationMin', filters.durationMin.toString());
    if (filters.durationMax) params.append('durationMax', filters.durationMax.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get(`/api/services?${params.toString()}`);
    return response.data.data || response.data;
  },

  // Get service by ID
  getById: async (id: string): Promise<Service> => {
    const response = await api.get(`/api/services/${id}`);
    return response.data.data || response.data;
  },

  // Create new service
  create: async (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<Service> => {
    const response = await api.post('/api/services', data);
    return response.data.data || response.data;
  },

  // Update service
  update: async ({ id, data }: { id: string; data: Partial<Service> }): Promise<Service> => {
    const response = await api.put(`/api/services/${id}`, data);
    return response.data.data || response.data;
  },

  // Delete service
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/services/${id}`);
  },

  // Search services
  search: async (term: string): Promise<Service[]> => {
    if (term.length < 2) return [];
    
    const response = await api.get(`/api/services/search?q=${encodeURIComponent(term)}`);
    return response.data.data || response.data;
  },

  // Get active services (lightweight)
  getActive: async (): Promise<Pick<Service, 'id' | 'name' | 'price' | 'duration' | 'category'>[]> => {
    const response = await api.get('/api/services/list');
    return response.data.data || response.data;
  },

  // ========== CATEGORIES ==========
  
  categories: {
    // List all categories
    list: async (): Promise<ServiceCategory[]> => {
      const response = await api.get('/api/services/categories');
      return response.data.data || response.data;
    },
    
    // Create category
    create: async (data: Omit<ServiceCategory, 'id' | 'companyId' | 'servicesCount'>): Promise<ServiceCategory> => {
      const response = await api.post('/api/services/categories', data);
      return response.data.data || response.data;
    },
    
    // Update category
    update: async ({ id, data }: { id: string; data: Partial<ServiceCategory> }): Promise<ServiceCategory> => {
      const response = await api.put(`/api/services/categories/${id}`, data);
      return response.data.data || response.data;
    },
    
    // Delete category
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/services/categories/${id}`);
    },
  },

  // ========== PROFESSIONALS CRUD ==========
  
  professionals: {
    // List professionals with filters
    list: async (filters: ProfessionalFilters = {}): Promise<PaginatedResponse<Professional>> => {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
      if (filters.specialty) params.append('specialty', filters.specialty);
      if (filters.hasServices !== undefined) params.append('hasServices', filters.hasServices.toString());
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/api/services/professionals?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Get professional by ID
    getById: async (id: string): Promise<Professional> => {
      const response = await api.get(`/api/services/professionals/${id}`);
      return response.data.data || response.data;
    },

    // Create new professional
    create: async (data: Omit<Professional, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<Professional> => {
      const response = await api.post('/api/services/professionals', data);
      return response.data.data || response.data;
    },

    // Update professional
    update: async ({ id, data }: { id: string; data: Partial<Professional> }): Promise<Professional> => {
      const response = await api.put(`/api/services/professionals/${id}`, data);
      return response.data.data || response.data;
    },

    // Delete professional
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/services/professionals/${id}`);
    },

    // Get active professionals (lightweight)
    getActive: async (): Promise<Pick<Professional, 'id' | 'name' | 'specialties'>[]> => {
      const response = await api.get('/api/services/professionals/list');
      return response.data.data || response.data;
    },

    // Get professional availability
    getAvailability: async (id: string, date: string, serviceId?: string): Promise<ProfessionalAvailability> => {
      const params = new URLSearchParams();
      params.append('date', date);
      if (serviceId) params.append('serviceId', serviceId);
      
      const response = await api.get(`/api/services/professionals/${id}/availability?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Update professional schedule
    updateSchedule: async ({ 
      id, 
      schedule 
    }: { 
      id: string; 
      schedule: Professional['workSchedule'] 
    }): Promise<Professional> => {
      const response = await api.put(`/api/services/professionals/${id}/schedule`, { workSchedule: schedule });
      return response.data.data || response.data;
    },

    // Get professional statistics
    getStatistics: async (id: string, period?: string): Promise<ProfessionalStatistics> => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      
      const response = await api.get(`/api/services/professionals/${id}/statistics?${params.toString()}`);
      return response.data.data || response.data;
    },
  },

  // ========== PROFESSIONAL-SERVICE RELATIONSHIPS ==========
  
  professionalServices: {
    // Get services for professional
    list: async (professionalId: string): Promise<Service[]> => {
      const response = await api.get(`/api/services/professionals/${professionalId}/services`);
      return response.data.data || response.data;
    },
    
    // Add service to professional
    add: async ({ 
      professionalId, 
      serviceIds 
    }: { 
      professionalId: string; 
      serviceIds: string[] 
    }): Promise<void> => {
      await api.post(`/api/services/professionals/${professionalId}/services`, { serviceIds });
    },
    
    // Remove service from professional
    remove: async ({ 
      professionalId, 
      serviceId 
    }: { 
      professionalId: string; 
      serviceId: string 
    }): Promise<void> => {
      await api.delete(`/api/services/professionals/${professionalId}/services/${serviceId}`);
    },
  },

  // ========== COMPLETED APPOINTMENTS ==========
  
  completedAppointments: {
    // List completed appointments with filters
    list: async (filters: CompletedAppointmentFilters = {}): Promise<PaginatedResponse<CompletedAppointment>> => {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.customerId) params.append('customerId', filters.customerId);
      if (filters.professionalId) params.append('professionalId', filters.professionalId);
      if (filters.serviceId) params.append('serviceId', filters.serviceId);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/api/services/appointments?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Get completed appointment by ID
    getById: async (id: string): Promise<CompletedAppointment> => {
      const response = await api.get(`/api/services/appointments/${id}`);
      return response.data.data || response.data;
    },

    // Create completed appointment (from scheduled appointment)
    create: async (data: {
      appointmentId: string;
      observations?: string;
      paymentStatus: CompletedAppointment['paymentStatus'];
      paymentMethod: CompletedAppointment['paymentMethod'];
      totalAmount: number;
    }): Promise<CompletedAppointment> => {
      const response = await api.post('/api/services/appointments', data);
      return response.data.data || response.data;
    },

    // Update completed appointment
    update: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<CompletedAppointment> 
    }): Promise<CompletedAppointment> => {
      const response = await api.put(`/api/services/appointments/${id}`, data);
      return response.data.data || response.data;
    },

    // Delete completed appointment
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/services/appointments/${id}`);
    },
  },

  // ========== PHOTO MANAGEMENT ==========
  
  photos: {
    // Upload photos for completed appointment
    upload: async (appointmentId: string, files: File[], type: ServicePhoto['type']): Promise<ServicePhoto[]> => {
      const formData = new FormData();
      files.forEach(file => formData.append('photos', file));
      formData.append('type', type);
      
      const response = await api.post(`/api/services/appointments/${appointmentId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data || response.data;
    },
    
    // Get photos for completed appointment
    list: async (appointmentId: string): Promise<ServicePhoto[]> => {
      const response = await api.get(`/api/services/appointments/${appointmentId}/photos`);
      return response.data.data || response.data;
    },
    
    // Delete photo
    delete: async ({ appointmentId, photoId }: { appointmentId: string; photoId: string }): Promise<void> => {
      await api.delete(`/api/services/appointments/${appointmentId}/photos/${photoId}`);
    },
  },

  // ========== REPORTS ==========
  
  reports: {
    // Daily report
    daily: async (date: string): Promise<any> => {
      const response = await api.get(`/api/services/reports/daily?date=${date}`);
      return response.data.data || response.data;
    },
    
    // Professional report
    professional: async (professionalId: string, startDate: string, endDate: string): Promise<any> => {
      const response = await api.get(`/api/services/reports/professional/${professionalId}?startDate=${startDate}&endDate=${endDate}`);
      return response.data.data || response.data;
    },
    
    // Financial report
    financial: async (startDate: string, endDate: string): Promise<any> => {
      const response = await api.get(`/api/services/reports/financial?startDate=${startDate}&endDate=${endDate}`);
      return response.data.data || response.data;
    },
  },
};

// ====================================
// REACT QUERY HOOKS
// ====================================

// ========== SERVICES HOOKS ==========

export const useServices = (filters: ServiceFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: () => servicesApi.list(filters),
    ...cachePresets.dynamic,
    placeholderData: (previousData) => previousData,
  });
};

export const useService = (id: string) => {
  return useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: () => servicesApi.getById(id),
    enabled: !!id,
    ...cachePresets.static,
  });
};

export const useActiveServices = () => {
  return useQuery({
    queryKey: queryKeys.services.active(),
    queryFn: servicesApi.getActive,
    ...cachePresets.static,
  });
};

export const useServiceSearch = (term: string) => {
  return useQuery({
    queryKey: queryKeys.services.search(term),
    queryFn: () => servicesApi.search(term),
    enabled: term.length >= 2,
    ...cachePresets.search,
  });
};

// ========== CATEGORIES HOOKS ==========

export const useServiceCategories = () => {
  return useQuery({
    queryKey: queryKeys.services.categories(),
    queryFn: servicesApi.categories.list,
    ...cachePresets.static,
  });
};

// ========== PROFESSIONALS HOOKS ==========

export const useProfessionals = (filters: ProfessionalFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.professionals.list(filters),
    queryFn: () => servicesApi.professionals.list(filters),
    ...cachePresets.dynamic,
    placeholderData: (previousData) => previousData,
  });
};

export const useProfessional = (id: string) => {
  return useQuery({
    queryKey: queryKeys.professionals.detail(id),
    queryFn: () => servicesApi.professionals.getById(id),
    enabled: !!id,
    ...cachePresets.static,
  });
};

export const useActiveProfessionals = () => {
  return useQuery({
    queryKey: queryKeys.professionals.active(),
    queryFn: servicesApi.professionals.getActive,
    ...cachePresets.static,
  });
};

export const useProfessionalAvailability = (id: string, date: string, serviceId?: string) => {
  return useQuery({
    queryKey: queryKeys.professionals.availability(id, date),
    queryFn: () => servicesApi.professionals.getAvailability(id, date, serviceId),
    enabled: !!id && !!date,
    ...cachePresets.dynamic,
  });
};

export const useProfessionalStatistics = (id: string, period?: string) => {
  return useQuery({
    queryKey: queryKeys.professionals.statistics(id, period),
    queryFn: () => servicesApi.professionals.getStatistics(id, period),
    enabled: !!id,
    ...cachePresets.realtime,
  });
};

export const useProfessionalServices = (professionalId: string) => {
  return useQuery({
    queryKey: queryKeys.professionals.services(professionalId),
    queryFn: () => servicesApi.professionalServices.list(professionalId),
    enabled: !!professionalId,
    ...cachePresets.static,
  });
};

// ========== COMPLETED APPOINTMENTS HOOKS ==========

export const useCompletedAppointments = (filters: CompletedAppointmentFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.completedAppointments.list(filters),
    queryFn: () => servicesApi.completedAppointments.list(filters),
    ...cachePresets.dynamic,
    placeholderData: (previousData) => previousData,
  });
};

export const useCompletedAppointment = (id: string) => {
  return useQuery({
    queryKey: queryKeys.completedAppointments.detail(id),
    queryFn: () => servicesApi.completedAppointments.getById(id),
    enabled: !!id,
    ...cachePresets.session,
  });
};

export const useAppointmentPhotos = (appointmentId: string) => {
  return useQuery({
    queryKey: queryKeys.completedAppointments.photos(appointmentId),
    queryFn: () => servicesApi.photos.list(appointmentId),
    enabled: !!appointmentId,
    ...cachePresets.dynamic,
  });
};

// ========== REPORTS HOOKS ==========

export const useDailyReport = (date: string) => {
  return useQuery({
    queryKey: queryKeys.reports.daily(date),
    queryFn: () => servicesApi.reports.daily(date),
    enabled: !!date,
    ...cachePresets.realtime,
  });
};

export const useProfessionalReport = (professionalId: string, startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reports.professional(professionalId, `${startDate}-${endDate}`),
    queryFn: () => servicesApi.reports.professional(professionalId, startDate, endDate),
    enabled: !!professionalId && !!startDate && !!endDate,
    ...cachePresets.dynamic,
  });
};

export const useFinancialReport = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: queryKeys.reports.financial(startDate, endDate),
    queryFn: () => servicesApi.reports.financial(startDate, endDate),
    enabled: !!startDate && !!endDate,
    ...cachePresets.dynamic,
  });
};

// ====================================
// MUTATION HOOKS
// ====================================

// ========== SERVICES MUTATIONS ==========

export const useCreateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.create,
    onSuccess: (data) => {
      invalidateQueries.services();
      queryClient.invalidateQueries({ queryKey: queryKeys.services.categories() });
      
      // Show success toast
      toast({
        title: "Serviço criado com sucesso!",
        description: `${data.name} foi adicionado ao catálogo de serviços.`,
        variant: "default"
      });
    },
    onError: (error) => {
      console.error('Failed to create service:', error);
      
      // Show error toast
      toast({
        title: "Erro ao criar serviço",
        description: "Não foi possível salvar o serviço. Tente novamente.",
        variant: "destructive"
      });
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.update,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.services.detail(variables.id), data);
      invalidateQueries.services();
      
      // Show success toast
      toast({
        title: "Serviço atualizado!",
        description: `As informações de ${data.name} foram salvas.`,
        variant: "default"
      });
    },
    onError: (error) => {
      console.error('Failed to update service:', error);
      
      // Show error toast
      toast({
        title: "Erro ao atualizar serviço",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive"
      });
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.delete,
    onSuccess: (_, serviceId) => {
      queryClient.removeQueries({ queryKey: queryKeys.services.detail(serviceId) });
      invalidateQueries.services();
      
      // Show success toast
      toast({
        title: "Serviço removido",
        description: "O serviço foi removido com sucesso do catálogo.",
        variant: "default"
      });
    },
    onError: (error) => {
      console.error('Failed to delete service:', error);
      
      // Show error toast
      toast({
        title: "Erro ao remover serviço",
        description: "Não foi possível remover o serviço. Tente novamente.",
        variant: "destructive"
      });
    },
  });
};

// ========== PROFESSIONALS MUTATIONS ==========

export const useCreateProfessional = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionals.create,
    onSuccess: () => {
      invalidateQueries.professionals();
    },
  });
};

export const useUpdateProfessional = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionals.update,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.professionals.detail(variables.id), data);
      invalidateQueries.professional(variables.id);
    },
  });
};

export const useDeleteProfessional = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionals.delete,
    onSuccess: (_, professionalId) => {
      queryClient.removeQueries({ queryKey: queryKeys.professionals.detail(professionalId) });
      invalidateQueries.professionals();
    },
  });
};

export const useUpdateProfessionalSchedule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionals.updateSchedule,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.professionals.detail(variables.id), data);
      // Invalidate availability for this professional
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.professionals.availability(variables.id, '') 
      });
    },
  });
};

// ========== PROFESSIONAL-SERVICES MUTATIONS ==========

export const useAddServiceToProfessional = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionalServices.add,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.professionals.services(variables.professionalId) 
      });
      invalidateQueries.professional(variables.professionalId);
    },
  });
};

export const useRemoveServiceFromProfessional = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.professionalServices.remove,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.professionals.services(variables.professionalId) 
      });
      invalidateQueries.professional(variables.professionalId);
    },
  });
};

// ========== COMPLETED APPOINTMENTS MUTATIONS ==========

export const useCreateCompletedAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.completedAppointments.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.completedAppointments.lists() });
      invalidateQueries.reports();
      // Invalidate related appointment data
      invalidateQueries.appointments();
    },
  });
};

export const useUpdateCompletedAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.completedAppointments.update,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.completedAppointments.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.completedAppointments.lists() });
    },
  });
};

// ========== PHOTOS MUTATIONS ==========

export const useUploadAppointmentPhotos = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ appointmentId, files, type }: { appointmentId: string; files: File[]; type: ServicePhoto['type'] }) =>
      servicesApi.photos.upload(appointmentId, files, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.completedAppointments.photos(variables.appointmentId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.completedAppointments.detail(variables.appointmentId) 
      });
    },
  });
};

export const useDeleteAppointmentPhoto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.photos.delete,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.completedAppointments.photos(variables.appointmentId) 
      });
    },
  });
};

// ====================================
// CUSTOM COMPOUND HOOKS
// ====================================

// Hook composto para services com filtros
export const useServicesWithFilters = () => {
  const [filters, setFilters] = useState<ServiceFilters>({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  
  const query = useServices(filters);
  
  const updateFilters = useCallback((newFilters: Partial<ServiceFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  }, []);
  
  return {
    ...query,
    filters,
    updateFilters,
    resetFilters,
  };
};

// Hook composto para professionals com filtros
export const useProfessionalsWithFilters = () => {
  const [filters, setFilters] = useState<ProfessionalFilters>({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  
  const query = useProfessionals(filters);
  
  const updateFilters = useCallback((newFilters: Partial<ProfessionalFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  }, []);
  
  return {
    ...query,
    filters,
    updateFilters,
    resetFilters,
  };
};

// Hook para professional completo com todos os dados relacionados
export const useProfessionalComplete = (id: string) => {
  const professional = useProfessional(id);
  const services = useProfessionalServices(id);
  const statistics = useProfessionalStatistics(id);
  
  return {
    professional,
    services,
    statistics,
    isLoading: professional.isLoading || services.isLoading || statistics.isLoading,
    error: professional.error || services.error || statistics.error,
  };
};

// Hook para completed appointments com filtros
export const useCompletedAppointmentsWithFilters = () => {
  const [filters, setFilters] = useState<CompletedAppointmentFilters>({
    page: 1,
    limit: 20,
    sortBy: 'startTime',
    sortOrder: 'desc',
  });
  
  const query = useCompletedAppointments(filters);
  
  const updateFilters = useCallback((newFilters: Partial<CompletedAppointmentFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'startTime',
      sortOrder: 'desc',
    });
  }, []);
  
  return {
    ...query,
    filters,
    updateFilters,
    resetFilters,
  };
};