// ERP Nexus - Agendamento Module Hooks  
// React Query hooks para integração completa com API Agendamento

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys, optimisticUpdates, invalidateQueries, cachePresets } from '@/lib/query-client';

// ====================================
// TYPES & INTERFACES
// ====================================

export interface Appointment {
  id: string;
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
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    duration: number;
    price: number;
    category: string;
  };
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  reminderSent: boolean;
  whatsappSent: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
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
    appointment: Appointment;
    type: 'appointment' | 'break' | 'unavailable';
  };
}

export interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
  appointmentId?: string;
}

export interface ProfessionalAvailability {
  professionalId: string;
  professional: {
    id: string;
    name: string;
  };
  date: string;
  slots: TimeSlot[];
  workingHours: {
    start: string;
    end: string;
  };
}

export interface ScheduleBlock {
  id: string;
  professionalId: string;
  professional?: {
    id: string;
    name: string;
  };
  startTime: string;
  endTime: string;
  reason: string;
  type: 'BREAK' | 'UNAVAILABLE' | 'VACATION' | 'HOLIDAY' | 'OTHER';
  isRecurring: boolean;
  recurringPattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurringEndDate?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'CUSTOM';
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  message: string;
  variables: string[]; // Available variables for template
  isActive: boolean;
  companyId: string;
}

export interface NotificationLog {
  id: string;
  appointmentId: string;
  appointment?: Appointment;
  templateId: string;
  template?: NotificationTemplate;
  channel: NotificationTemplate['channel'];
  recipient: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
  companyId: string;
  createdAt: string;
}

export interface WaitingListItem {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  serviceId: string;
  service: {
    id: string;
    name: string;
    duration: number;
  };
  professionalId?: string;
  professional?: {
    id: string;
    name: string;
  };
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'WAITING' | 'CONTACTED' | 'SCHEDULED' | 'CANCELLED';
  contactedAt?: string;
  scheduledAt?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFilters {
  startDate?: string;
  endDate?: string;
  professionalId?: string;
  customerId?: string;
  serviceId?: string;
  status?: Appointment['status'];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WaitingListFilters {
  serviceId?: string;
  professionalId?: string;
  priority?: WaitingListItem['priority'];
  status?: WaitingListItem['status'];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationFilters {
  appointmentId?: string;
  channel?: NotificationTemplate['channel'];
  status?: NotificationLog['status'];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
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

const appointmentsApi = {
  // ========== APPOINTMENTS CRUD ==========
  
  // List appointments with filters
  list: async (filters: AppointmentFilters = {}): Promise<PaginatedResponse<Appointment>> => {
    const params = new URLSearchParams();
    
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.professionalId) params.append('professionalId', filters.professionalId);
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.serviceId) params.append('serviceId', filters.serviceId);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get(`/api/agendamento/appointments?${params.toString()}`);
    return response.data.data || response.data;
  },

  // Get appointment by ID
  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get(`/api/agendamento/appointments/${id}`);
    return response.data.data || response.data;
  },

  // Create new appointment
  create: async (data: {
    customerId: string;
    professionalId: string;
    serviceId: string;
    startTime: string;
    notes?: string;
  }): Promise<Appointment> => {
    const response = await api.post('/api/agendamento/appointments', data);
    return response.data.data || response.data;
  },

  // Update appointment
  update: async ({ id, data }: { id: string; data: Partial<Appointment> }): Promise<Appointment> => {
    const response = await api.put(`/api/agendamento/appointments/${id}`, data);
    return response.data.data || response.data;
  },

  // Delete appointment
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/agendamento/appointments/${id}`);
  },

  // Confirm appointment
  confirm: async (id: string): Promise<Appointment> => {
    const response = await api.patch(`/api/agendamento/appointments/${id}/confirm`);
    return response.data.data || response.data;
  },

  // Start appointment (change status to IN_PROGRESS)
  start: async (id: string): Promise<Appointment> => {
    const response = await api.patch(`/api/agendamento/appointments/${id}/start`);
    return response.data.data || response.data;
  },

  // Complete appointment
  complete: async (id: string, data?: {
    observations?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    totalAmount?: number;
  }): Promise<Appointment> => {
    const response = await api.patch(`/api/agendamento/appointments/${id}/complete`, data);
    return response.data.data || response.data;
  },

  // Cancel appointment
  cancel: async (id: string, reason?: string): Promise<Appointment> => {
    const response = await api.patch(`/api/agendamento/appointments/${id}/cancel`, { reason });
    return response.data.data || response.data;
  },

  // Mark as no-show
  noShow: async (id: string, reason?: string): Promise<Appointment> => {
    const response = await api.patch(`/api/agendamento/appointments/${id}/no-show`, { reason });
    return response.data.data || response.data;
  },

  // Get today's appointments
  getToday: async (): Promise<Appointment[]> => {
    const response = await api.get('/api/agendamento/appointments/today');
    return response.data.data || response.data;
  },

  // Get upcoming appointments
  getUpcoming: async (days: number = 7): Promise<Appointment[]> => {
    const response = await api.get(`/api/agendamento/appointments/upcoming?days=${days}`);
    return response.data.data || response.data;
  },

  // ========== CALENDAR & AVAILABILITY ==========
  
  // Get calendar events for FullCalendar
  getCalendar: async (startDate: string, endDate: string, professionalIds?: string[]): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    params.append('start', startDate);
    params.append('end', endDate);
    if (professionalIds?.length) {
      professionalIds.forEach(id => params.append('professionalIds', id));
    }

    const response = await api.get(`/api/agendamento/calendar?${params.toString()}`);
    return response.data.data || response.data;
  },

  // Get availability for specific professional and date
  getAvailability: async (professionalId: string, date: string, serviceId?: string): Promise<ProfessionalAvailability> => {
    const params = new URLSearchParams();
    params.append('date', date);
    if (serviceId) params.append('serviceId', serviceId);
    
    const response = await api.get(`/api/agendamento/availability/${professionalId}?${params.toString()}`);
    return response.data.data || response.data;
  },

  // Get availability for multiple professionals
  getMultipleAvailability: async (
    professionalIds: string[], 
    date: string, 
    serviceId?: string
  ): Promise<ProfessionalAvailability[]> => {
    const params = new URLSearchParams();
    params.append('date', date);
    professionalIds.forEach(id => params.append('professionalIds', id));
    if (serviceId) params.append('serviceId', serviceId);
    
    const response = await api.get(`/api/agendamento/availability?${params.toString()}`);
    return response.data.data || response.data;
  },

  // ========== SCHEDULE BLOCKS ==========
  
  scheduleBlocks: {
    // List schedule blocks
    list: async (filters: {
      professionalId?: string;
      startDate?: string;
      endDate?: string;
      type?: ScheduleBlock['type'];
    } = {}): Promise<ScheduleBlock[]> => {
      const params = new URLSearchParams();
      
      if (filters.professionalId) params.append('professionalId', filters.professionalId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);

      const response = await api.get(`/api/agendamento/schedule-blocks?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Create schedule block
    create: async (data: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<ScheduleBlock> => {
      const response = await api.post('/api/agendamento/schedule-blocks', data);
      return response.data.data || response.data;
    },

    // Update schedule block
    update: async ({ id, data }: { id: string; data: Partial<ScheduleBlock> }): Promise<ScheduleBlock> => {
      const response = await api.put(`/api/agendamento/schedule-blocks/${id}`, data);
      return response.data.data || response.data;
    },

    // Delete schedule block
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/agendamento/schedule-blocks/${id}`);
    },
  },

  // ========== NOTIFICATIONS ==========
  
  notifications: {
    // List notification logs
    list: async (filters: NotificationFilters = {}): Promise<PaginatedResponse<NotificationLog>> => {
      const params = new URLSearchParams();
      
      if (filters.appointmentId) params.append('appointmentId', filters.appointmentId);
      if (filters.channel) params.append('channel', filters.channel);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await api.get(`/api/agendamento/notifications?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Send test notification
    sendTest: async (data: {
      templateId: string;
      recipient: string;
      variables?: Record<string, string>;
    }): Promise<void> => {
      await api.post('/api/agendamento/notifications/test', data);
    },

    // Send appointment notification
    send: async (appointmentId: string, templateType: NotificationTemplate['type']): Promise<void> => {
      await api.post(`/api/agendamento/notifications/send`, {
        appointmentId,
        templateType,
      });
    },

    // Resend notification
    resend: async (notificationId: string): Promise<void> => {
      await api.post(`/api/agendamento/notifications/${notificationId}/resend`);
    },

    // Get notification statistics
    getStats: async (startDate?: string, endDate?: string): Promise<{
      total: number;
      sent: number;
      delivered: number;
      failed: number;
      channels: Record<string, number>;
    }> => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await api.get(`/api/agendamento/notifications/stats?${params.toString()}`);
      return response.data.data || response.data;
    },
  },

  // ========== NOTIFICATION TEMPLATES ==========
  
  templates: {
    // List templates
    list: async (): Promise<NotificationTemplate[]> => {
      const response = await api.get('/api/agendamento/notifications/templates');
      return response.data.data || response.data;
    },

    // Create template
    create: async (data: Omit<NotificationTemplate, 'id' | 'companyId'>): Promise<NotificationTemplate> => {
      const response = await api.post('/api/agendamento/notifications/templates', data);
      return response.data.data || response.data;
    },

    // Update template
    update: async ({ id, data }: { id: string; data: Partial<NotificationTemplate> }): Promise<NotificationTemplate> => {
      const response = await api.put(`/api/agendamento/notifications/templates/${id}`, data);
      return response.data.data || response.data;
    },

    // Delete template
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/agendamento/notifications/templates/${id}`);
    },
  },

  // ========== WAITING LIST ==========
  
  waitingList: {
    // List waiting list items
    list: async (filters: WaitingListFilters = {}): Promise<PaginatedResponse<WaitingListItem>> => {
      const params = new URLSearchParams();
      
      if (filters.serviceId) params.append('serviceId', filters.serviceId);
      if (filters.professionalId) params.append('professionalId', filters.professionalId);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.status) params.append('status', filters.status);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/api/agendamento/waiting-list?${params.toString()}`);
      return response.data.data || response.data;
    },

    // Add to waiting list
    add: async (data: Omit<WaitingListItem, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'companyId' | 'contactedAt' | 'scheduledAt'>): Promise<WaitingListItem> => {
      const response = await api.post('/api/agendamento/waiting-list', data);
      return response.data.data || response.data;
    },

    // Update waiting list item
    update: async ({ id, data }: { id: string; data: Partial<WaitingListItem> }): Promise<WaitingListItem> => {
      const response = await api.put(`/api/agendamento/waiting-list/${id}`, data);
      return response.data.data || response.data;
    },

    // Remove from waiting list
    remove: async (id: string): Promise<void> => {
      await api.delete(`/api/agendamento/waiting-list/${id}`);
    },

    // Contact waiting list item
    contact: async (id: string, notes?: string): Promise<WaitingListItem> => {
      const response = await api.patch(`/api/agendamento/waiting-list/${id}/contact`, { notes });
      return response.data.data || response.data;
    },

    // Schedule from waiting list
    schedule: async (id: string, appointmentData: {
      professionalId: string;
      serviceId: string;
      startTime: string;
      notes?: string;
    }): Promise<{ waitingListItem: WaitingListItem; appointment: Appointment }> => {
      const response = await api.post(`/api/agendamento/waiting-list/${id}/schedule`, appointmentData);
      return response.data.data || response.data;
    },

    // Get waiting list statistics
    getStats: async (): Promise<{
      total: number;
      waiting: number;
      contacted: number;
      scheduled: number;
      cancelled: number;
      byService: Record<string, number>;
      byPriority: Record<string, number>;
    }> => {
      const response = await api.get('/api/agendamento/waiting-list/stats');
      return response.data.data || response.data;
    },
  },

  // ========== WEBHOOK HANDLERS ==========
  
  webhooks: {
    // Handle WhatsApp webhook
    whatsapp: async (data: any): Promise<void> => {
      await api.post('/api/agendamento/webhook/whatsapp', data);
    },
  },
};

// ====================================
// REACT QUERY HOOKS
// ====================================

// ========== APPOINTMENTS HOOKS ==========

export const useAppointments = (filters: AppointmentFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.appointments.list(filters),
    queryFn: () => appointmentsApi.list(filters),
    ...cachePresets.dynamic,
    placeholderData: (previousData) => previousData,
  });
};

export const useAppointment = (id: string) => {
  return useQuery({
    queryKey: queryKeys.appointments.detail(id),
    queryFn: () => appointmentsApi.getById(id),
    enabled: !!id,
    ...cachePresets.session,
  });
};

export const useTodayAppointments = () => {
  return useQuery({
    queryKey: queryKeys.appointments.today(),
    queryFn: appointmentsApi.getToday,
    ...cachePresets.realtime,
  });
};

export const useUpcomingAppointments = (days: number = 7) => {
  return useQuery({
    queryKey: queryKeys.appointments.upcoming(),
    queryFn: () => appointmentsApi.getUpcoming(days),
    ...cachePresets.realtime,
  });
};

export const useAppointmentsByStatus = (status: Appointment['status']) => {
  return useQuery({
    queryKey: queryKeys.appointments.byStatus(status),
    queryFn: () => appointmentsApi.list({ status, limit: 100 }),
    ...cachePresets.dynamic,
  });
};

export const useCustomerAppointments = (customerId: string) => {
  return useQuery({
    queryKey: queryKeys.appointments.byCustomer(customerId),
    queryFn: () => appointmentsApi.list({ customerId, limit: 100 }),
    enabled: !!customerId,
    ...cachePresets.dynamic,
  });
};

export const useProfessionalAppointments = (professionalId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: queryKeys.appointments.byProfessional(professionalId),
    queryFn: () => appointmentsApi.list({ professionalId, startDate, endDate, limit: 100 }),
    enabled: !!professionalId,
    ...cachePresets.dynamic,
  });
};

// ========== CALENDAR HOOKS ==========

export const useCalendarEvents = (startDate: string, endDate: string, professionalIds?: string[]) => {
  return useQuery({
    queryKey: queryKeys.appointments.calendar(professionalIds?.join(','), `${startDate}-${endDate}`),
    queryFn: () => appointmentsApi.getCalendar(startDate, endDate, professionalIds),
    enabled: !!startDate && !!endDate,
    ...cachePresets.dynamic,
  });
};

export const useProfessionalAvailability = (professionalId: string, date: string, serviceId?: string) => {
  return useQuery({
    queryKey: queryKeys.availability.professional(professionalId, date),
    queryFn: () => appointmentsApi.getAvailability(professionalId, date, serviceId),
    enabled: !!professionalId && !!date,
    ...cachePresets.dynamic,
  });
};

export const useMultipleProfessionalsAvailability = (professionalIds: string[], date: string, serviceId?: string) => {
  return useQuery({
    queryKey: queryKeys.availability.slots(professionalIds.join(','), date, serviceId),
    queryFn: () => appointmentsApi.getMultipleAvailability(professionalIds, date, serviceId),
    enabled: professionalIds.length > 0 && !!date,
    ...cachePresets.dynamic,
  });
};

// ========== SCHEDULE BLOCKS HOOKS ==========

export const useScheduleBlocks = (filters: Parameters<typeof appointmentsApi.scheduleBlocks.list>[0] = {}) => {
  return useQuery({
    queryKey: queryKeys.scheduleBlocks.list(filters),
    queryFn: () => appointmentsApi.scheduleBlocks.list(filters),
    ...cachePresets.dynamic,
  });
};

export const useProfessionalScheduleBlocks = (professionalId: string) => {
  return useQuery({
    queryKey: queryKeys.scheduleBlocks.professional(professionalId),
    queryFn: () => appointmentsApi.scheduleBlocks.list({ professionalId }),
    enabled: !!professionalId,
    ...cachePresets.dynamic,
  });
};

// ========== NOTIFICATIONS HOOKS ==========

export const useNotifications = (filters: NotificationFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => appointmentsApi.notifications.list(filters),
    ...cachePresets.dynamic,
  });
};

export const useNotificationTemplates = () => {
  return useQuery({
    queryKey: queryKeys.notifications.templates(),
    queryFn: appointmentsApi.templates.list,
    ...cachePresets.static,
  });
};

export const useNotificationStats = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: queryKeys.notifications.stats(),
    queryFn: () => appointmentsApi.notifications.getStats(startDate, endDate),
    ...cachePresets.realtime,
  });
};

// ========== WAITING LIST HOOKS ==========

export const useWaitingList = (filters: WaitingListFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.waitingList.list(filters),
    queryFn: () => appointmentsApi.waitingList.list(filters),
    ...cachePresets.dynamic,
    placeholderData: (previousData) => previousData,
  });
};

export const useWaitingListByService = (serviceId: string) => {
  return useQuery({
    queryKey: queryKeys.waitingList.byService(serviceId),
    queryFn: () => appointmentsApi.waitingList.list({ serviceId, limit: 100 }),
    enabled: !!serviceId,
    ...cachePresets.dynamic,
  });
};

export const useWaitingListStats = () => {
  return useQuery({
    queryKey: queryKeys.waitingList.stats(),
    queryFn: appointmentsApi.waitingList.getStats,
    ...cachePresets.realtime,
  });
};

// ====================================
// MUTATION HOOKS
// ====================================

// ========== APPOINTMENTS MUTATIONS ==========

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: (data) => {
      // Invalidate related queries
      invalidateQueries.appointments();
      invalidateQueries.availability(data.professionalId);
      
      // Invalidate calendar for the appointment date
      const appointmentDate = new Date(data.startTime).toISOString().split('T')[0];
      invalidateQueries.date(appointmentDate);
    },
  });
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.update,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.appointments.detail(id) });
      
      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData(queryKeys.appointments.detail(id));
      
      // Optimistically update
      optimisticUpdates.updateAppointmentStatus(id, data.status || '');
      
      return { previousAppointment };
    },
    onSuccess: (data, variables) => {
      // Update cache with real data
      queryClient.setQueryData(queryKeys.appointments.detail(variables.id), data);
      
      // Invalidate related queries
      invalidateQueries.appointment(variables.id, {
        professionalId: data.professionalId,
        customerId: data.customerId,
        date: new Date(data.startTime).toISOString().split('T')[0],
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousAppointment) {
        queryClient.setQueryData(
          queryKeys.appointments.detail(variables.id), 
          context.previousAppointment
        );
      }
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.delete,
    onSuccess: (_, appointmentId) => {
      queryClient.removeQueries({ queryKey: queryKeys.appointments.detail(appointmentId) });
      invalidateQueries.appointments();
    },
  });
};

export const useConfirmAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.confirm,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.appointments.detail(data.id), data);
      optimisticUpdates.updateAppointmentStatus(data.id, 'CONFIRMED');
    },
  });
};

export const useStartAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.start,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.appointments.detail(data.id), data);
      optimisticUpdates.updateAppointmentStatus(data.id, 'IN_PROGRESS');
    },
  });
};

export const useCompleteAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Parameters<typeof appointmentsApi.complete>[1] }) =>
      appointmentsApi.complete(id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.appointments.detail(data.id), data);
      optimisticUpdates.updateAppointmentStatus(data.id, 'COMPLETED');
      
      // Invalidate reports as completed appointment affects revenue
      invalidateQueries.reports();
    },
  });
};

export const useCancelAppointment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentsApi.cancel(id, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.appointments.detail(data.id), data);
      optimisticUpdates.updateAppointmentStatus(data.id, 'CANCELLED');
      
      // Invalidate availability as cancellation frees up time slots
      invalidateQueries.availability(data.professionalId);
    },
  });
};

export const useMarkNoShow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentsApi.noShow(id, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.appointments.detail(data.id), data);
      optimisticUpdates.updateAppointmentStatus(data.id, 'NO_SHOW');
    },
  });
};

// ========== SCHEDULE BLOCKS MUTATIONS ==========

export const useCreateScheduleBlock = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.scheduleBlocks.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.lists() });
      // Invalidate availability for affected professional
      invalidateQueries.availability(data.professionalId);
    },
  });
};

export const useUpdateScheduleBlock = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.scheduleBlocks.update,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.lists() });
      invalidateQueries.availability(data.professionalId);
    },
  });
};

export const useDeleteScheduleBlock = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.scheduleBlocks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.lists() });
      // Could invalidate availability but we'd need the professionalId
      queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    },
  });
};

// ========== NOTIFICATIONS MUTATIONS ==========

export const useSendNotification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ appointmentId, templateType }: { appointmentId: string; templateType: NotificationTemplate['type'] }) =>
      appointmentsApi.notifications.send(appointmentId, templateType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.stats() });
    },
  });
};

export const useSendTestNotification = () => {
  return useMutation({
    mutationFn: appointmentsApi.notifications.sendTest,
  });
};

export const useResendNotification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.notifications.resend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
    },
  });
};

// ========== TEMPLATES MUTATIONS ==========

export const useCreateNotificationTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.templates.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.templates() });
    },
  });
};

export const useUpdateNotificationTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.templates.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.templates() });
    },
  });
};

export const useDeleteNotificationTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.templates.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.templates() });
    },
  });
};

// ========== WAITING LIST MUTATIONS ==========

export const useAddToWaitingList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.waitingList.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.stats() });
    },
  });
};

export const useUpdateWaitingListItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.waitingList.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.lists() });
    },
  });
};

export const useRemoveFromWaitingList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appointmentsApi.waitingList.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.stats() });
    },
  });
};

export const useContactWaitingListItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      appointmentsApi.waitingList.contact(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.lists() });
    },
  });
};

export const useScheduleFromWaitingList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, appointmentData }: { 
      id: string; 
      appointmentData: Parameters<typeof appointmentsApi.waitingList.schedule>[1] 
    }) => appointmentsApi.waitingList.schedule(id, appointmentData),
    onSuccess: (data) => {
      // Invalidate waiting list
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.waitingList.stats() });
      
      // Invalidate appointments
      invalidateQueries.appointments();
      
      // Invalidate availability
      invalidateQueries.availability(data.appointment.professionalId);
    },
  });
};

// ====================================
// CUSTOM COMPOUND HOOKS
// ====================================

// Hook composto para appointments com filtros
export const useAppointmentsWithFilters = () => {
  const [filters, setFilters] = useState<AppointmentFilters>({
    page: 1,
    limit: 20,
    sortBy: 'startTime',
    sortOrder: 'asc',
  });
  
  const query = useAppointments(filters);
  
  const updateFilters = useCallback((newFilters: Partial<AppointmentFilters>) => {
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

// Hook para waiting list com filtros
export const useWaitingListWithFilters = () => {
  const [filters, setFilters] = useState<WaitingListFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  
  const query = useWaitingList(filters);
  
  const updateFilters = useCallback((newFilters: Partial<WaitingListFilters>) => {
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

// Hook para calendar completo (eventos + disponibilidade)
export const useCalendarComplete = (
  startDate: string, 
  endDate: string, 
  professionalIds?: string[]
) => {
  const events = useCalendarEvents(startDate, endDate, professionalIds);
  const scheduleBlocks = useScheduleBlocks({ startDate, endDate });
  
  return {
    events,
    scheduleBlocks,
    isLoading: events.isLoading || scheduleBlocks.isLoading,
    error: events.error || scheduleBlocks.error,
  };
};