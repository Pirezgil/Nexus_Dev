// ERP Nexus - Dashboard API Hooks
// Hooks para agregação de dados de todos os módulos no dashboard

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { getCurrentDateForInput } from '@/lib/dates';

// ====================================
// TYPES
// ====================================

export interface DashboardStats {
  revenue: {
    current: number;
    previous: number;
    trend: number; // percentage change
  };
  appointments: {
    current: number;
    previous: number;
    trend: number;
  };
  customers: {
    current: number;
    previous: number;
    trend: number;
  };
  occupancy: {
    current: number; // percentage
    previous: number;
    trend: number;
  };
  revenueChart: Array<{
    date: string;
    revenue: number;
    appointments: number;
  }>;
  appointmentsChart: Array<{
    date: string;
    scheduled: number;
    completed: number;
    cancelled: number;
  }>;
  topServices: Array<{
    id: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  topProfessionals: Array<{
    id: string;
    name: string;
    appointments: number;
    revenue: number;
  }>;
}

export interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  professionalName: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  duration: number;
}

export interface RecentCustomer {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  lastInteraction?: string;
  status: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  createdAt: string;
  module: 'crm' | 'services' | 'agendamento' | 'system';
}

// ====================================
// API FUNCTIONS
// ====================================

const dashboardApi = {
  // Get KPIs - TEMPORÁRIO: retornar dados mockados até analytics ser implementado
  getStats: async (period: string) => {
    try {
      // MOCKADO: dados de exemplo até que o serviço de analytics esteja disponível
      await new Promise(resolve => setTimeout(resolve, 500)); // simular delay
      
      const stats: DashboardStats = {
        revenue: {
          current: 45000,
          previous: 38000,
          trend: 18.4,
        },
        appointments: {
          current: 127,
          previous: 98,
          trend: 29.6,
        },
        customers: {
          current: 89,
          previous: 76,
          trend: 17.1,
        },
        occupancy: {
          current: 85,
          previous: 78,
          trend: 8.9,
        },
      };
      
      return stats;
    } catch (error) {
      console.error('Error fetching dashboard stats from analytics API:', error)
      // Fallback to mock data
      return getMockDashboardStats(period)
    }
  },

  // Get revenue chart data - TEMPORÁRIO: dados mockados
  getRevenueChart: async () => {
    try {
      // MOCKADO: dados de exemplo até que o serviço de analytics esteja disponível
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockData = [
        { date: '2025-01-01', revenue: 12000, appointments: 15 },
        { date: '2025-01-02', revenue: 15000, appointments: 18 },
        { date: '2025-01-03', revenue: 8000, appointments: 12 },
        { date: '2025-01-04', revenue: 18000, appointments: 22 },
        { date: '2025-01-05', revenue: 13000, appointments: 16 },
      ];
      
      return mockData;
    } catch (error) {
      console.error('Error fetching revenue chart:', error)
      return []
    }
  },

  getTodayAppointments: async () => {
    try {
      const response = await api.get('/api/agendamento/appointments', {
        params: {
          date: getCurrentDateForInput(),
          status: 'scheduled,confirmed,in_progress',
        }
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching today appointments:', error);
      // Return mock data as fallback
      return getMockTodayAppointments();
    }
  },

  getRecentCustomers: async (limit: number = 10) => {
    try {
      const response = await api.get('/api/customers', {
        params: {
          limit,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      });
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching recent customers:', error);
      // Return mock data as fallback
      return getMockRecentCustomers();
    }
  },

  getAlerts: async () => {
    const alerts: Alert[] = [];
    
    try {
      // Check for overdue appointments
      const overdueResponse = await api.get('/api/agendamento/appointments/overdue');
      if (overdueResponse.data.data?.length > 0) {
        alerts.push({
          id: 'overdue-appointments',
          type: 'warning',
          title: 'Agendamentos em Atraso',
          message: `${overdueResponse.data.data.length} agendamentos precisam de atenção`,
          createdAt: new Date().toISOString(),
          module: 'agendamento',
        });
      }
    } catch (error) {
      // Ignore error - module might be down
    }

    try {
      // Check for new customers without recent interaction
      const inactiveResponse = await api.get('/customers/inactive');
      if (inactiveResponse.data.data?.length > 0) {
        alerts.push({
          id: 'inactive-customers',
          type: 'info',
          title: 'Clientes sem Interação',
          message: `${inactiveResponse.data.data.length} clientes sem contato há mais de 30 dias`,
          createdAt: new Date().toISOString(),
          module: 'crm',
        });
      }
    } catch (error) {
      // Ignore error - module might be down
    }

    // If no alerts from APIs, return mock alerts for development
    if (alerts.length === 0) {
      alerts.push(...getMockAlerts());
    }

    return alerts;
  },
};

// ====================================
// MOCK DATA FOR DEVELOPMENT
// ====================================

const getMockDashboardStats = (period: string): DashboardStats => {
  const now = new Date();
  const chartData: any[] = [];
  
  // Generate chart data based on period
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    chartData.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.floor(Math.random() * 5000) + 2000,
      appointments: Math.floor(Math.random() * 20) + 10,
      scheduled: Math.floor(Math.random() * 15) + 8,
      completed: Math.floor(Math.random() * 12) + 6,
      cancelled: Math.floor(Math.random() * 3) + 1,
    });
  }

  return {
    revenue: {
      current: 72300,
      previous: 62500,
      trend: 15.8,
    },
    appointments: {
      current: 342,
      previous: 298,
      trend: 14.8,
    },
    customers: {
      current: 247,
      previous: 221,
      trend: 11.8,
    },
    occupancy: {
      current: 78.5,
      previous: 74.2,
      trend: 5.8,
    },
    revenueChart: chartData,
    appointmentsChart: chartData,
    topServices: [
      { id: '1', name: 'Corte + Escova', count: 45, revenue: 13500 },
      { id: '2', name: 'Massagem Relaxante', count: 32, revenue: 9600 },
      { id: '3', name: 'Limpeza de Pele', count: 28, revenue: 8400 },
      { id: '4', name: 'Manicure + Pedicure', count: 38, revenue: 7600 },
      { id: '5', name: 'Tratamento Capilar', count: 22, revenue: 6600 },
    ],
    topProfessionals: [
      { id: '1', name: 'Maria Silva', appointments: 85, revenue: 25500 },
      { id: '2', name: 'Ana Costa', appointments: 72, revenue: 21600 },
      { id: '3', name: 'João Santos', appointments: 65, revenue: 19500 },
      { id: '4', name: 'Carla Oliveira', appointments: 58, revenue: 17400 },
    ],
  };
};

const getMockTodayAppointments = (): TodayAppointment[] => [
  {
    id: '1',
    time: '09:00',
    customerName: 'Maria Silva',
    customerPhone: '(11) 99999-9999',
    serviceName: 'Corte + Escova',
    professionalName: 'Ana Costa',
    status: 'scheduled',
    duration: 90,
  },
  {
    id: '2',
    time: '10:30',
    customerName: 'João Santos',
    customerPhone: '(11) 88888-8888',
    serviceName: 'Massagem Relaxante',
    professionalName: 'Carlos Oliveira',
    status: 'confirmed',
    duration: 60,
  },
  {
    id: '3',
    time: '14:00',
    customerName: 'Ana Paula',
    customerPhone: '(11) 77777-7777',
    serviceName: 'Limpeza de Pele',
    professionalName: 'Maria Silva',
    status: 'in_progress',
    duration: 75,
  },
  {
    id: '4',
    time: '15:30',
    customerName: 'Pedro Costa',
    serviceName: 'Corte Masculino',
    professionalName: 'João Santos',
    status: 'scheduled',
    duration: 30,
  },
  {
    id: '5',
    time: '16:30',
    customerName: 'Lucia Fernandes',
    serviceName: 'Manicure + Pedicure',
    professionalName: 'Carla Oliveira',
    status: 'scheduled',
    duration: 45,
  },
];

const getMockRecentCustomers = (): RecentCustomer[] => [
  {
    id: '1',
    name: 'Maria Silva',
    email: 'maria.silva@email.com',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastInteraction: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: '2',
    name: 'João Santos',
    email: 'joao.santos@email.com',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    lastInteraction: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: '3',
    name: 'Ana Paula Costa',
    email: 'ana.costa@email.com',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: '4',
    name: 'Pedro Oliveira',
    email: 'pedro.oliveira@email.com',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastInteraction: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'inactive',
  },
];

const getMockAlerts = (): Alert[] => [
  {
    id: 'system-update',
    type: 'info',
    title: 'Sistema Atualizado',
    message: 'Nova versão instalada com melhorias de performance',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    module: 'system',
  },
  {
    id: 'backup-success',
    type: 'success',
    title: 'Backup Concluído',
    message: 'Backup automático realizado com sucesso',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    module: 'system',
  },
];

// ====================================
// REACT QUERY HOOKS
// ====================================

export const useDashboardStats = (period: string = 'month') => {
  return useQuery({
    queryKey: ['analytics', 'dashboard', 'kpis', period],
    queryFn: () => dashboardApi.getStats(period),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once to avoid long delays
    refetchOnWindowFocus: false, // Avoid refetching on window focus
  });
};

export const useRevenueChart = () => {
  return useQuery({
    queryKey: ['analytics', 'revenue', 'chart'],
    queryFn: dashboardApi.getRevenueChart,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

export const useTodayAppointments = () => {
  return useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: dashboardApi.getTodayAppointments,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 60000, // Refetch every minute
    retry: 1,
  });
};

export const useRecentCustomers = (limit: number = 10) => {
  return useQuery({
    queryKey: ['customers', 'recent', limit],
    queryFn: () => dashboardApi.getRecentCustomers(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

export const useAlerts = () => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: dashboardApi.getAlerts,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30000, // Check alerts every 30 seconds
    retry: 1,
  });
};

// ====================================
// UTILITY HOOKS
// ====================================

export const useDashboardRefresh = () => {
  const [isAutoRefresh, setIsAutoRefresh] = React.useState(true);
  
  // You can add logic here to control auto-refresh behavior
  
  return {
    isAutoRefresh,
    setIsAutoRefresh,
  };
};

// Add React import for hooks
import * as React from 'react';