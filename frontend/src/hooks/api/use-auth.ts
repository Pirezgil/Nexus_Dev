// ERP Nexus - Authentication Hooks
// React Query hooks para autenticação

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys, cachePresets } from '@/lib/query-client';
import type { LoginRequest, LoginResponse, User, Company } from '@/types/api';

// ====================================
// API FUNCTIONS
// ====================================

const authApi = {
  // Login
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data.data || response.data;
  },

  // Logout
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },

  // Get current user
  me: async (): Promise<User> => {
    const response = await api.get('/api/auth/me');
    return response.data.data || response.data;
  },

  // Validate token
  validate: async (): Promise<{ valid: boolean; user?: User; company?: Company }> => {
    const response = await api.post('/api/auth/validate');
    return response.data.data || response.data;
  },

  // Refresh token
  refresh: async (refreshToken: string): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/refresh', { refreshToken });
    return response.data.data || response.data;
  },
};

// ====================================
// HOOKS
// ====================================

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Store tokens - check structure from response
      if (typeof window !== 'undefined') {
        const accessToken = data.tokens?.accessToken || data.token;
        const refreshToken = data.tokens?.refreshToken || data.refreshToken;
        
        if (accessToken) {
          localStorage.setItem('erp_nexus_token', accessToken);
        }
        if (refreshToken) {
          localStorage.setItem('erp_nexus_refresh_token', refreshToken);
        }
      }

      // Set user data in cache
      queryClient.setQueryData(queryKeys.auth.me, data.user);
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Clear tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('erp_nexus_token');
        localStorage.removeItem('erp_nexus_refresh_token');
        sessionStorage.removeItem('erp_nexus_token');
      }

      // Clear all cached data
      queryClient.clear();
      
      // Redirect to login
      window.location.href = '/login';
    },
    onSettled: () => {
      // Always clear cache even if logout request fails
      queryClient.clear();
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.me,
    ...cachePresets.session,
    retry: (failureCount, error: any) => {
      // Don't retry if unauthorized
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

export const useValidateToken = () => {
  return useQuery({
    queryKey: queryKeys.auth.validate,
    queryFn: authApi.validate,
    ...cachePresets.session,
    retry: false,
  });
};