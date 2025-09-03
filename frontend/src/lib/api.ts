// ERP Nexus - Configuração API Client
// Integração com backend APIs conforme DESENVOLVIMENTO_COMPLETO.md

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiResponse } from '@/types';

// ✅ UNIFIED API GATEWAY ARCHITECTURE  
// Configuração dinâmica de URL baseada no ambiente
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '';

console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL || '(using relative paths for Next.js rewrites)',
  rewritesActive: !API_BASE_URL
});

// Gateway routes configuration
const API_ROUTES = {
  // Authentication routes (public)
  auth: '/api/auth',
  // Protected routes (require authentication)
  crm: '/api/crm',
  services: '/api/services',
  agendamento: '/api/agendamento',
  // Health check
  health: '/health',
} as const;

// Queue para controlar múltiplas tentativas de refresh simultâneas
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// Configuração base do Axios
const createApiInstance = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT_API_CLIENT || '30000', 10),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Interceptor de Request - Adicionar token JWT
  instance.interceptors.request.use(
    (config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log da requisição em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
        console.log(`🔍 Token status: ${token ? 'Present' : 'Missing'} | Auth header: ${config.headers.Authorization ? 'Set' : 'Not set'}`);
        if (token) {
          console.log(`🔑 Token (first 50 chars): ${token.substring(0, 50)}...`);
        } else {
          console.warn('⚠️ No auth token found in localStorage');
        }
      }
      
      return config;
    },
    (error) => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Interceptor de Response - Tratamento de erros e tokens
  instance.interceptors.response.use(
    (response) => {
      // Log da resposta em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ API Response: ${response.config.url}`, response.data);
      }
      
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      
      // Token expirado ou não autorizado - tentar renovar apenas para 401
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Se já está renovando, adicionar à fila de espera
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return instance(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;
        
        try {
          // Verificar se existe refresh token antes de tentar renovar
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            console.warn('⚠️ No refresh token available, redirecting to login');
            throw new Error('No refresh token available');
          }

          console.log('🔄 Attempting token refresh...');
          await refreshAuthToken();
          const newToken = getAuthToken();
          
          if (newToken) {
            // Processar fila de requisições pendentes
            processQueue(null, newToken);
            
            // Atualizar o header da requisição original de forma mais robusta
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            console.log('✅ Retrying original request with new token');
            return instance(originalRequest);
          } else {
            throw new Error('Failed to get new token after refresh');
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          // Processar fila com erro
          processQueue(refreshError, null);
          // Falha na renovação - redirecionar para login
          redirectToLogin();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      
      // Para 403, não tentar refresh - é um erro de permissão
      if (error.response?.status === 403) {
        console.warn('⚠️ Access forbidden - insufficient permissions');
      }
      
      // Log do erro
      console.error('❌ API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data,
      });
      
      return Promise.reject(error);
    }
  );

  return instance;
};

// ✅ API INSTANCES - Unified configuration
export const api = createApiInstance(API_BASE_URL);

// Services API - All requests go through Gateway on port 5001
export const servicesApi = api;

// Legacy compatibility - all point to gateway or direct services
export const userManagementApi = api;
export const crmApi = api;
export const agendamentoApi = api;

// ====================================
// HELPER FUNCTIONS
// ====================================

// Obter token do localStorage/sessionStorage
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // First try to get from localStorage (primary storage)
  const token = localStorage.getItem('erp_nexus_token');
  if (token) {
    return token;
  }
  
  // Fallback to sessionStorage if needed
  const sessionToken = sessionStorage.getItem('erp_nexus_token');
  if (sessionToken) {
    return sessionToken;
  }
  
  return null;
};

// Obter refresh token do localStorage
const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('erp_nexus_refresh_token');
};

// Renovar token de autenticação via API Gateway
const refreshAuthToken = async (): Promise<void> => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    // Criar uma instância separada para evitar loop infinito no interceptor
    const refreshInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT_QUICK_OPERATIONS || '10000', 10),
    });

    const response = await refreshInstance.post(`${API_ROUTES.auth}/refresh`, { refreshToken });
    
    if (response.data?.success && response.data?.data) {
      const { token, refreshToken: newRefreshToken } = response.data.data;
      
      localStorage.setItem('erp_nexus_token', token);
      if (newRefreshToken) {
        localStorage.setItem('erp_nexus_refresh_token', newRefreshToken);
      }
      
      console.log('✅ Token refreshed successfully');
    } else {
      throw new Error('Invalid refresh response');
    }
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    // Limpar tokens inválidos
    localStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp_nexus_refresh_token');
    sessionStorage.removeItem('erp_nexus_token');
    throw error;
  }
};

// Redirecionar para login
const redirectToLogin = (): void => {
  if (typeof window !== 'undefined') {
    console.log('🔄 Cleaning up authentication state...');
    
    // Limpar tokens do localStorage
    localStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp_nexus_refresh_token');
    sessionStorage.removeItem('erp_nexus_token');
    
    // Limpar o localStorage do Zustand também
    try {
      localStorage.removeItem('erp-nexus-auth');
    } catch {
      // Ignore if unable to clear
    }
    
    // Show a user-friendly message before redirecting
    const showSessionExpiredMessage = () => {
      // Try to use toast if available
      try {
        const { toast } = require('@/hooks/use-toast');
        toast({
          title: 'Sessão Expirada',
          description: 'Sua sessão expirou. Redirecionando para o login...',
          variant: 'destructive',
        });
      } catch {
        // Fallback to console warning if toast is not available
        console.warn('Session expired - redirecting to login');
      }
      
      // Redirect immediately for better UX - user will see login form
      window.location.href = '/login';
    };
    
    showSessionExpiredMessage();
  }
};

// ====================================
// GENERIC API FUNCTIONS
// ====================================

// Wrapper genérico para requisições API
export const makeApiRequest = async <T = any>(
  apiInstance: AxiosInstance,
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiInstance(config);
    return {
      success: true,
      data: response.data.data || response.data,
      message: response.data.message,
    };
  } catch (error: any) {
    return {
      success: false,
      data: null as T,
      error: error.response?.data?.message || error.message || 'Erro desconhecido',
    };
  }
};

// GET request helper
export const apiGet = async <T = any>(
  apiInstance: AxiosInstance,
  endpoint: string,
  params?: Record<string, any>
): Promise<ApiResponse<T>> => {
  return makeApiRequest<T>(apiInstance, {
    method: 'GET',
    url: endpoint,
    params,
  });
};

// POST request helper
export const apiPost = async <T = any>(
  apiInstance: AxiosInstance,
  endpoint: string,
  data?: any
): Promise<ApiResponse<T>> => {
  return makeApiRequest<T>(apiInstance, {
    method: 'POST',
    url: endpoint,
    data,
  });
};

// PUT request helper
export const apiPut = async <T = any>(
  apiInstance: AxiosInstance,
  endpoint: string,
  data?: any
): Promise<ApiResponse<T>> => {
  return makeApiRequest<T>(apiInstance, {
    method: 'PUT',
    url: endpoint,
    data,
  });
};

// DELETE request helper
export const apiDelete = async <T = any>(
  apiInstance: AxiosInstance,
  endpoint: string
): Promise<ApiResponse<T>> => {
  return makeApiRequest<T>(apiInstance, {
    method: 'DELETE',
    url: endpoint,
  });
};

// ====================================
// HEALTH CHECK FUNCTIONS
// ====================================

// ✅ Check Gateway Health (includes all services)
export const checkApiHealth = async () => {
  try {
    const response = await apiGet(api, API_ROUTES.health);
    
    if (response.success && response.data) {
      const healthData = response.data;
      
      // Parse individual service status from gateway response
      const services = healthData.services || [];
      return {
        gateway: healthData.status === 'healthy',
        userManagement: services.find((s: any) => s.service === 'user-management')?.status === 'healthy',
        crm: services.find((s: any) => s.service === 'crm')?.status === 'healthy',
        services: services.find((s: any) => s.service === 'services')?.status === 'healthy',
        agendamento: services.find((s: any) => s.service === 'agendamento')?.status === 'healthy',
        summary: healthData.summary,
      };
    }
    
    return {
      gateway: false,
      userManagement: false,
      crm: false,
      services: false,
      agendamento: false,
      error: 'Invalid health check response'
    };
  } catch (error) {
    return {
      gateway: false,
      userManagement: false,
      crm: false,
      services: false,
      agendamento: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    };
  }
};

// ====================================
// EXPORT API INSTANCES
// ====================================

// ====================================
// UNIFIED API EXPORTS
// ====================================

// Convenience functions for different modules (all use same gateway)
export const authApi = {
  login: (credentials: any) => apiPost(api, `${API_ROUTES.auth}/login`, credentials),
  register: (userData: any) => apiPost(api, `${API_ROUTES.auth}/register`, userData),
  validate: () => apiGet(api, `${API_ROUTES.auth}/validate`),
  refresh: (refreshToken: string) => apiPost(api, `${API_ROUTES.auth}/refresh`, { refreshToken }),
  logout: () => apiPost(api, `${API_ROUTES.auth}/logout`),
};

export const crmApiMethods = {
  // Customers CRUD
  getCustomers: (params?: any) => apiGet(api, `${API_ROUTES.crm}/customers`, params),
  getCustomer: (id: string) => apiGet(api, `${API_ROUTES.crm}/customers/${id}`),
  createCustomer: (data: any) => apiPost(api, `${API_ROUTES.crm}/customers`, data),
  updateCustomer: (id: string, data: any) => apiPut(api, `${API_ROUTES.crm}/customers/${id}`, data),
  deleteCustomer: (id: string) => apiDelete(api, `${API_ROUTES.crm}/customers/${id}`),
  
  // Customer search
  searchCustomers: (params?: any) => apiGet(api, `${API_ROUTES.crm}/customers/search`, params),
  getCustomerBasic: (id: string) => apiGet(api, `${API_ROUTES.crm}/customers/${id}/basic`),
  
  // Customer interactions
  getCustomerInteractions: (customerId: string, params?: any) => apiGet(api, `${API_ROUTES.crm}/customers/${customerId}/interactions`, params),
  createInteraction: (customerId: string, data: any) => apiPost(api, `${API_ROUTES.crm}/customers/${customerId}/interactions`, data),
  
  // Customer tags
  getCustomerTags: (customerId: string) => apiGet(api, `${API_ROUTES.crm}/customers/${customerId}/tags`),
  addCustomerTag: (customerId: string, data: any) => apiPost(api, `${API_ROUTES.crm}/customers/${customerId}/tags`, data),
  removeCustomerTag: (customerId: string, tagId: string) => apiDelete(api, `${API_ROUTES.crm}/customers/${customerId}/tags/${tagId}`),
  
  // Customer appointments history
  getCustomerAppointments: (customerId: string, params?: any) => apiGet(api, `${API_ROUTES.crm}/customers/${customerId}/appointments`, params),
};

export const servicesApiMethods = {
  // Services CRUD - All through API Gateway
  getServices: (params?: any) => apiGet(servicesApi, `${API_ROUTES.services}`, params),
  getService: (id: string) => apiGet(servicesApi, `${API_ROUTES.services}/${id}`),
  createService: (data: any) => apiPost(servicesApi, `${API_ROUTES.services}`, data),
  updateService: (id: string, data: any) => apiPut(servicesApi, `${API_ROUTES.services}/${id}`, data),
  deleteService: (id: string) => apiDelete(servicesApi, `${API_ROUTES.services}/${id}`),
  
  // Services list and search
  getServicesList: (params?: any) => apiGet(servicesApi, '/api/services/list', params),
  searchServices: (params?: any) => apiGet(servicesApi, '/api/services/search', params),
  
  // Professionals CRUD
  getProfessionals: (params?: any) => apiGet(servicesApi, '/api/professionals', params),
  getProfessional: (id: string) => apiGet(servicesApi, `/api/professionals/${id}`),
  createProfessional: (data: any) => apiPost(servicesApi, '/api/professionals', data),
  updateProfessional: (id: string, data: any) => apiPut(servicesApi, `/api/professionals/${id}`, data),
  deleteProfessional: (id: string) => apiDelete(servicesApi, `/api/professionals/${id}`),
  
  // Professionals list and availability
  getProfessionalsList: (params?: any) => apiGet(servicesApi, '/api/professionals/list', params),
  getProfessionalAvailability: (id: string, params?: any) => apiGet(servicesApi, `/api/professionals/${id}/availability`, params),
  updateProfessionalSchedule: (id: string, data: any) => apiPut(servicesApi, `/api/professionals/${id}/schedule`, data),
  
  // Professional services relationship
  getProfessionalServices: (professionalId: string) => apiGet(servicesApi, `/api/professionals/${professionalId}/services`),
  addServiceToProfessional: (professionalId: string, data: any) => apiPost(servicesApi, `/api/professionals/${professionalId}/services`, data),
  removeServiceFromProfessional: (professionalId: string, serviceId: string) => apiDelete(servicesApi, `/api/professionals/${professionalId}/services/${serviceId}`),
  
  // Categories
  getCategories: () => apiGet(servicesApi, '/api/categories'),
  createCategory: (data: any) => apiPost(servicesApi, '/api/categories', data),
  updateCategory: (id: string, data: any) => apiPut(servicesApi, `/api/categories/${id}`, data),
  deleteCategory: (id: string) => apiDelete(servicesApi, `/api/categories/${id}`),
};

export const agendamentoApiMethods = {
  // Appointments CRUD
  getAppointments: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/appointments`, params),
  getAppointment: (id: string) => apiGet(api, `${API_ROUTES.agendamento}/appointments/${id}`),
  createAppointment: (data: any) => apiPost(api, `${API_ROUTES.agendamento}/appointments`, data),
  updateAppointment: (id: string, data: any) => apiPut(api, `${API_ROUTES.agendamento}/appointments/${id}`, data),
  deleteAppointment: (id: string) => apiDelete(api, `${API_ROUTES.agendamento}/appointments/${id}`),
  confirmAppointment: (id: string, data?: any) => apiPost(api, `${API_ROUTES.agendamento}/appointments/${id}/confirm`, data),
  completeAppointment: (id: string, data?: any) => apiPost(api, `${API_ROUTES.agendamento}/appointments/${id}/complete`, data),
  
  // Calendar data
  getCalendar: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/calendar`, params),
  getAvailability: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/availability`, params),
  
  // Schedule blocks
  getScheduleBlocks: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/schedule-blocks`, params),
  createScheduleBlock: (data: any) => apiPost(api, `${API_ROUTES.agendamento}/schedule-blocks`, data),
  updateScheduleBlock: (id: string, data: any) => apiPut(api, `${API_ROUTES.agendamento}/schedule-blocks/${id}`, data),
  deleteScheduleBlock: (id: string) => apiDelete(api, `${API_ROUTES.agendamento}/schedule-blocks/${id}`),
  
  // Notifications
  getNotifications: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/notifications`, params),
  testNotification: (data: any) => apiPost(api, `${API_ROUTES.agendamento}/notifications/test`, data),
  
  // Waiting list
  getWaitingList: (params?: any) => apiGet(api, `${API_ROUTES.agendamento}/waiting-list`, params),
  addToWaitingList: (data: any) => apiPost(api, `${API_ROUTES.agendamento}/waiting-list`, data),
  updateWaitingListItem: (id: string, data: any) => apiPut(api, `${API_ROUTES.agendamento}/waiting-list/${id}`, data),
  removeFromWaitingList: (id: string) => apiDelete(api, `${API_ROUTES.agendamento}/waiting-list/${id}`),
};

export default {
  // Single API instance for all requests
  api,
  // Module-specific convenience methods
  auth: authApi,
  crm: crmApiMethods,
  services: servicesApiMethods,
  agendamento: agendamentoApiMethods,
  // Generic helper functions
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  healthCheck: checkApiHealth,
  // Route constants
  routes: API_ROUTES,
};

// Export the API_ROUTES for use in components
export { API_ROUTES };