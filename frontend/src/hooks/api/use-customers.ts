// ERP Nexus - CRM Customer Hooks
// React Query hooks para integração completa com API CRM

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys, optimisticUpdates, invalidateQueries, cachePresets } from '@/lib/query-client';
import { toast } from '@/hooks/use-toast';

// ====================================
// TYPES & INTERFACES
// ====================================

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'BLOCKED';
  tags: string[];
  notes?: string;
  metadata?: Record<string, any>;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    notes: number;
    interactions: number;
    appointments: number;
  };
}

export interface CustomerFilters {
  search?: string;
  status?: Customer['status'];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerNote {
  id: string;
  content: string;
  type: 'GENERAL' | 'IMPORTANT' | 'REMINDER' | 'FOLLOW_UP' | 'COMPLAINT' | 'COMPLIMENT';
  isPrivate: boolean;
  customerId: string;
  userId: string;
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInteraction {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'SMS' | 'NOTE' | 'TASK' | 'VISIT' | 'OTHER';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, any>;
  isCompleted: boolean;
  scheduledAt?: string;
  completedAt?: string;
  customerId: string;
  userId: string;
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  customersCount: number;
  companyId: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  prospects: number;
  newThisMonth: number;
  growth: number;
  topTags: Array<{
    name: string;
    count: number;
  }>;
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

const customersApi = {
  // ========== CUSTOMERS CRUD ==========
  
  // List customers with filters and pagination
  list: async (filters: CustomerFilters = {}): Promise<PaginatedResponse<Customer>> => {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.tags?.length) filters.tags.forEach(tag => params.append('tags', tag));
    if (filters.dateRange?.start) params.append('startDate', filters.dateRange.start);
    if (filters.dateRange?.end) params.append('endDate', filters.dateRange.end);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get(`/api/crm/customers?${params.toString()}`);
    return response.data.data || response.data;
  },

  // Get customer by ID with full details
  getById: async (id: string): Promise<Customer> => {
    const response = await api.get(`/api/crm/customers/${id}`);
    return response.data.data || response.data;
  },

  // Get customer basic info (lightweight)
  getBasic: async (id: string): Promise<Pick<Customer, 'id' | 'name' | 'email' | 'phone'>> => {
    const response = await api.get(`/api/crm/customers/${id}/basic`);
    return response.data.data || response.data;
  },

  // Create new customer
  create: async (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<Customer> => {
    const response = await api.post('/api/crm/customers', data);
    return response.data.data || response.data;
  },

  // Update customer
  update: async ({ id, data }: { id: string; data: Partial<Customer> }): Promise<Customer> => {
    const response = await api.put(`/api/crm/customers/${id}`, data);
    return response.data.data || response.data;
  },

  // Delete customer
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/crm/customers/${id}`);
  },

  // Search customers with debounced query
  search: async (term: string): Promise<Customer[]> => {
    if (term.length < 2) return [];
    
    const response = await api.get(`/api/crm/customers/search?q=${encodeURIComponent(term)}`);
    return response.data.data || response.data;
  },

  // Get customer history (combined interactions + notes)
  getHistory: async (id: string): Promise<{
    notes: CustomerNote[];
    interactions: CustomerInteraction[];
  }> => {
    const response = await api.get(`/api/crm/customers/${id}/history`);
    return response.data.data || response.data;
  },

  // ========== CUSTOMER NOTES ==========
  
  notes: {
    // List notes for customer
    list: async (customerId: string): Promise<CustomerNote[]> => {
      const response = await api.get(`/api/crm/customers/${customerId}/notes`);
      return response.data.data || response.data;
    },
    
    // Create new note
    create: async ({ 
      customerId, 
      data 
    }: { 
      customerId: string; 
      data: Omit<CustomerNote, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'user' | 'customerId'>
    }): Promise<CustomerNote> => {
      const response = await api.post(`/api/crm/customers/${customerId}/notes`, data);
      return response.data.data || response.data;
    },
    
    // Update note
    update: async ({ 
      customerId, 
      noteId, 
      data 
    }: { 
      customerId: string; 
      noteId: string; 
      data: Partial<CustomerNote> 
    }): Promise<CustomerNote> => {
      const response = await api.put(`/api/crm/customers/${customerId}/notes/${noteId}`, data);
      return response.data.data || response.data;
    },
    
    // Delete note
    delete: async ({ customerId, noteId }: { customerId: string; noteId: string }): Promise<void> => {
      await api.delete(`/api/crm/customers/${customerId}/notes/${noteId}`);
    },
  },

  // ========== CUSTOMER INTERACTIONS ==========
  
  interactions: {
    // List interactions for customer
    list: async (customerId: string): Promise<CustomerInteraction[]> => {
      const response = await api.get(`/api/crm/customers/${customerId}/interactions`);
      return response.data.data || response.data;
    },
    
    // Create new interaction
    create: async ({ 
      customerId, 
      data 
    }: { 
      customerId: string; 
      data: Omit<CustomerInteraction, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'user' | 'customerId'>
    }): Promise<CustomerInteraction> => {
      const response = await api.post(`/api/crm/customers/${customerId}/interactions`, data);
      return response.data.data || response.data;
    },
    
    // Update interaction
    update: async ({ 
      customerId, 
      interactionId, 
      data 
    }: { 
      customerId: string; 
      interactionId: string; 
      data: Partial<CustomerInteraction> 
    }): Promise<CustomerInteraction> => {
      const response = await api.put(`/api/crm/customers/${customerId}/interactions/${interactionId}`, data);
      return response.data.data || response.data;
    },
    
    // Delete interaction
    delete: async ({ 
      customerId, 
      interactionId 
    }: { 
      customerId: string; 
      interactionId: string 
    }): Promise<void> => {
      await api.delete(`/api/crm/customers/${customerId}/interactions/${interactionId}`);
    },
    
    // Mark interaction as completed
    complete: async ({ 
      customerId, 
      interactionId 
    }: { 
      customerId: string; 
      interactionId: string 
    }): Promise<CustomerInteraction> => {
      const response = await api.patch(`/api/crm/customers/${customerId}/interactions/${interactionId}/complete`);
      return response.data.data || response.data;
    },
  },

  // ========== CUSTOMER TAGS ==========
  
  tags: {
    // List all available tags
    listAll: async (): Promise<CustomerTag[]> => {
      const response = await api.get('/api/crm/tags');
      return response.data.data || response.data;
    },
    
    // Get customer tags
    getCustomerTags: async (customerId: string): Promise<string[]> => {
      const response = await api.get(`/api/crm/customers/${customerId}/tags`);
      return response.data.data || response.data;
    },
    
    // Add tags to customer
    add: async ({ customerId, tags }: { customerId: string; tags: string[] }): Promise<Customer> => {
      const response = await api.post(`/api/crm/customers/${customerId}/tags`, { tags });
      return response.data.data || response.data;
    },
    
    // Remove tags from customer
    remove: async ({ customerId, tags }: { customerId: string; tags: string[] }): Promise<Customer> => {
      const response = await api.delete(`/api/crm/customers/${customerId}/tags`, { 
        data: { tags } 
      });
      return response.data.data || response.data;
    },
  },

  // ========== CUSTOMER APPOINTMENTS ==========
  
  appointments: {
    // Get customer appointment history
    list: async (customerId: string, filters?: { 
      status?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<any[]> => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      
      const response = await api.get(`/api/crm/customers/${customerId}/appointments?${params.toString()}`);
      return response.data.data || response.data;
    },
  },

  // ========== STATISTICS ==========
  
  stats: async (): Promise<CustomerStats> => {
    const response = await api.get('/api/crm/stats/dashboard');
    return response.data.data || response.data;
  },
};

// ====================================
// REACT QUERY HOOKS
// ====================================

// ========== CUSTOMER QUERY HOOKS ==========

export const useCustomers = (filters: CustomerFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.customers.list(filters),
    queryFn: () => customersApi.list(filters),
    ...cachePresets.dynamic, // Dados mudam com frequência
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
};

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => customersApi.getById(id),
    enabled: !!id,
    ...cachePresets.session, // Dados de sessão do usuário
  });
};

export const useCustomerBasic = (id: string) => {
  return useQuery({
    queryKey: queryKeys.customers.basic(id),
    queryFn: () => customersApi.getBasic(id),
    enabled: !!id,
    ...cachePresets.static, // Dados básicos mudam raramente
  });
};

export const useCustomerSearch = (term: string) => {
  return useQuery({
    queryKey: queryKeys.customers.search(term),
    queryFn: () => customersApi.search(term),
    enabled: term.length >= 2, // Só busca com 2+ caracteres
    ...cachePresets.search, // Configuração para pesquisas
  });
};

export const useCustomerHistory = (id: string) => {
  return useQuery({
    queryKey: queryKeys.customers.history(id),
    queryFn: () => customersApi.getHistory(id),
    enabled: !!id,
    ...cachePresets.dynamic,
  });
};

export const useCustomerNotes = (customerId: string) => {
  return useQuery({
    queryKey: queryKeys.customers.notes(customerId),
    queryFn: () => customersApi.notes.list(customerId),
    enabled: !!customerId,
    ...cachePresets.dynamic,
  });
};

export const useCustomerInteractions = (customerId: string) => {
  return useQuery({
    queryKey: queryKeys.customers.interactions(customerId),
    queryFn: () => customersApi.interactions.list(customerId),
    enabled: !!customerId,
    ...cachePresets.dynamic,
  });
};

export const useCustomerTags = () => {
  return useQuery({
    queryKey: queryKeys.customers.tags(),
    queryFn: customersApi.tags.listAll,
    ...cachePresets.static, // Tags mudam raramente
  });
};

export const useCustomerAppointments = (customerId: string, filters?: any) => {
  return useQuery({
    queryKey: queryKeys.customers.appointments(customerId),
    queryFn: () => customersApi.appointments.list(customerId, filters),
    enabled: !!customerId,
    ...cachePresets.dynamic,
  });
};

export const useCustomerStats = () => {
  return useQuery({
    queryKey: queryKeys.customers.stats(),
    queryFn: customersApi.stats,
    ...cachePresets.realtime, // Stats precisam estar atualizadas
  });
};

// ========== CUSTOMER MUTATION HOOKS ==========

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.create,
    onMutate: async (newCustomer) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.customers.lists() });
      
      // Optimistically add customer to cache
      const tempId = `temp-${Date.now()}`;
      const optimisticCustomer = {
        ...newCustomer,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        companyId: 'current',
      };
      
      optimisticUpdates.addCustomer(optimisticCustomer);
      
      return { optimisticCustomer };
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      invalidateQueries.customers();
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.stats() });
      
      // Show success toast
      toast({
        title: "Cliente criado com sucesso!",
        description: `${data.name} foi adicionado ao seu CRM.`,
        variant: "default"
      });
    },
    onError: (error, newCustomer, context) => {
      // Rollback optimistic update
      if (context?.optimisticCustomer) {
        optimisticUpdates.removeCustomer(context.optimisticCustomer.id);
      }
      
      console.error('Failed to create customer:', error);
      
      // Show error toast
      toast({
        title: "Erro ao criar cliente",
        description: "Não foi possível salvar o cliente. Tente novamente.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Refetch to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.update,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.customers.detail(id) });
      
      // Snapshot previous value
      const previousCustomer = queryClient.getQueryData(queryKeys.customers.detail(id));
      
      // Optimistically update
      optimisticUpdates.updateCustomer(id, data);
      
      return { previousCustomer };
    },
    onSuccess: (data, variables) => {
      // Update cache with real data
      queryClient.setQueryData(queryKeys.customers.detail(variables.id), data);
      
      // Invalidate related queries
      invalidateQueries.customer(variables.id);
      
      // Show success toast
      toast({
        title: "Cliente atualizado!",
        description: `As informações de ${data.name} foram salvas.`,
        variant: "default"
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousCustomer) {
        queryClient.setQueryData(
          queryKeys.customers.detail(variables.id), 
          context.previousCustomer
        );
      }
      
      console.error('Failed to update customer:', error);
      
      // Show error toast
      toast({
        title: "Erro ao atualizar cliente",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive"
      });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.delete,
    onMutate: async (customerId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.customers.lists() });
      
      // Snapshot previous value
      const previousCustomer = queryClient.getQueryData(queryKeys.customers.detail(customerId));
      
      // Optimistically remove from cache
      optimisticUpdates.removeCustomer(customerId);
      
      return { previousCustomer };
    },
    onSuccess: (_, customerId) => {
      // Invalidate and refetch
      invalidateQueries.customers();
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.stats() });
      
      // Show success toast
      toast({
        title: "Cliente removido",
        description: "O cliente foi removido com sucesso do seu CRM.",
        variant: "default"
      });
    },
    onError: (error, customerId, context) => {
      // Rollback optimistic update
      if (context?.previousCustomer) {
        optimisticUpdates.addCustomer(context.previousCustomer);
      }
      
      console.error('Failed to delete customer:', error);
      
      // Show error toast
      toast({
        title: "Erro ao remover cliente",
        description: "Não foi possível remover o cliente. Tente novamente.",
        variant: "destructive"
      });
    },
  });
};

// ========== NOTES MUTATION HOOKS ==========

export const useCreateCustomerNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.notes.create,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.notes(variables.customerId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.history(variables.customerId) 
      });
    },
  });
};

export const useUpdateCustomerNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.notes.update,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.notes(variables.customerId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.history(variables.customerId) 
      });
    },
  });
};

export const useDeleteCustomerNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.notes.delete,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.notes(variables.customerId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.history(variables.customerId) 
      });
    },
  });
};

// ========== INTERACTIONS MUTATION HOOKS ==========

export const useCreateCustomerInteraction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.interactions.create,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.interactions(variables.customerId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.history(variables.customerId) 
      });
    },
  });
};

export const useUpdateCustomerInteraction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.interactions.update,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.interactions(variables.customerId) 
      });
    },
  });
};

export const useCompleteCustomerInteraction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.interactions.complete,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.customers.interactions(variables.customerId) 
      });
    },
  });
};

// ========== TAGS MUTATION HOOKS ==========

export const useAddCustomerTags = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.tags.add,
    onSuccess: (_, variables) => {
      invalidateQueries.customer(variables.customerId);
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.tags() });
    },
  });
};

export const useRemoveCustomerTags = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: customersApi.tags.remove,
    onSuccess: (_, variables) => {
      invalidateQueries.customer(variables.customerId);
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
};

// ====================================
// CUSTOM COMPOUND HOOKS
// ====================================

// Hook composto para listagem com filtros e busca
export const useCustomersWithFilters = () => {
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  
  const query = useCustomers(filters);
  
  const updateFilters = useCallback((newFilters: Partial<CustomerFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset page when changing filters (except when explicitly setting page)
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
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

// Hook para customer completo com todas as informações relacionadas
export const useCustomerComplete = (id: string) => {
  const customer = useCustomer(id);
  const notes = useCustomerNotes(id);
  const interactions = useCustomerInteractions(id);
  const appointments = useCustomerAppointments(id);
  
  return {
    customer,
    notes,
    interactions,
    appointments,
    isLoading: customer.isLoading || notes.isLoading || interactions.isLoading || appointments.isLoading,
    error: customer.error || notes.error || interactions.error || appointments.error,
  };
};