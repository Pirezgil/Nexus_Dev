// ERP Nexus - Health Check Hooks
// React Query hooks para monitoramento de saúde dos serviços

import { useQuery } from '@tanstack/react-query';
import { checkApiHealth } from '@/lib/api';
import { queryKeys, cachePresets } from '@/lib/query-client';

// ====================================
// TYPES
// ====================================

export interface HealthStatus {
  gateway: boolean;
  userManagement: boolean;
  crm: boolean;
  services: boolean;
  agendamento: boolean;
  summary?: string;
  error?: string;
  timestamp?: string;
  serviceDetails?: Array<{
    service: string;
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }>;
}

// ====================================
// HOOKS
// ====================================

export const useHealthCheck = () => {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: checkApiHealth,
    ...cachePresets.realtime, // Health checks need frequent updates
    retry: 3, // Always retry health checks
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useHealthMonitor = (interval: number = 30000) => {
  return useQuery({
    queryKey: queryKeys.health.services(),
    queryFn: checkApiHealth,
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};