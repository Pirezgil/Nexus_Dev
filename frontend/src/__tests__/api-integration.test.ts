// ERP Nexus - API Integration Test
// Teste básico de integração com as APIs

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/lib/query-client';
import { checkApiHealth } from '@/lib/api';

// Mock do fetch global se não estiver disponível
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: { status: 'healthy' }
      }),
    })
  ) as jest.Mock;
}

describe('API Integration', () => {
  let testQueryClient: QueryClient;

  beforeAll(() => {
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterAll(() => {
    testQueryClient.clear();
  });

  describe('Query Client Configuration', () => {
    it('should have proper query client configuration', () => {
      expect(queryClient).toBeDefined();
      expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
      expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(10 * 60 * 1000);
    });

    it('should have organized query keys', () => {
      expect(queryKeys.customers.all).toEqual(['customers']);
      expect(queryKeys.customers.detail('123')).toEqual(['customers', 'detail', '123']);
      expect(queryKeys.services.all).toEqual(['services']);
      expect(queryKeys.appointments.all).toEqual(['appointments']);
    });
  });

  describe('API Health Check', () => {
    it('should check API health', async () => {
      const healthStatus = await checkApiHealth();
      
      // Should have all required service status
      expect(healthStatus).toHaveProperty('gateway');
      expect(healthStatus).toHaveProperty('userManagement');
      expect(healthStatus).toHaveProperty('crm');
      expect(healthStatus).toHaveProperty('services');
      expect(healthStatus).toHaveProperty('agendamento');
    });
  });

  describe('Query Keys Structure', () => {
    it('should have consistent query key structure for customers', () => {
      const keys = queryKeys.customers;
      
      expect(keys.all).toEqual(['customers']);
      expect(keys.lists()).toEqual(['customers', 'list']);
      expect(keys.list({ status: 'ACTIVE' })).toEqual(['customers', 'list', { status: 'ACTIVE' }]);
      expect(keys.detail('user-1')).toEqual(['customers', 'detail', 'user-1']);
    });

    it('should have consistent query key structure for services', () => {
      const keys = queryKeys.services;
      
      expect(keys.all).toEqual(['services']);
      expect(keys.lists()).toEqual(['services', 'list']);
      expect(keys.detail('service-1')).toEqual(['services', 'detail', 'service-1']);
    });

    it('should have consistent query key structure for appointments', () => {
      const keys = queryKeys.appointments;
      
      expect(keys.all).toEqual(['appointments']);
      expect(keys.lists()).toEqual(['appointments', 'list']);
      expect(keys.detail('appointment-1')).toEqual(['appointments', 'detail', 'appointment-1']);
      expect(keys.today()).toEqual(['appointments', 'today']);
    });
  });

  describe('Cache Presets', () => {
    it('should export cache presets', async () => {
      const { cachePresets } = await import('@/lib/query-client');
      
      expect(cachePresets).toHaveProperty('static');
      expect(cachePresets).toHaveProperty('dynamic');
      expect(cachePresets).toHaveProperty('realtime');
      expect(cachePresets).toHaveProperty('session');
      expect(cachePresets).toHaveProperty('search');
      
      // Verify cache times are reasonable
      expect(cachePresets.static.staleTime).toBe(10 * 60 * 1000); // 10 minutes
      expect(cachePresets.dynamic.staleTime).toBe(1 * 60 * 1000); // 1 minute
      expect(cachePresets.realtime.staleTime).toBe(30 * 1000); // 30 seconds
    });
  });
});

// Export basic test utilities for component testing
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

export const mockApiResponse = <T>(data: T) => ({
  success: true,
  data,
  message: 'Success',
});

export const mockApiError = (message: string, code = 'API_ERROR') => ({
  success: false,
  data: null,
  error: message,
  code,
});