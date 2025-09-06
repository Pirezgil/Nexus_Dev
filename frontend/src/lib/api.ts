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

// ========================================
// TOKEN REFRESH QUEUE & PERSISTENCE MANAGER
// ========================================

// Queue para controlar múltiplas tentativas de refresh simultâneas
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
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

// Token persistence manager com validação robusta
class TokenPersistenceManager {
  private static readonly TOKEN_KEY = 'erp_nexus_token';
  private static readonly REFRESH_TOKEN_KEY = 'erp_nexus_refresh_token';
  private static readonly TOKEN_TIMESTAMP_KEY = 'erp_nexus_token_timestamp';
  
  // Salvar token com timestamp e validação
  static saveToken(token: string, refreshToken?: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const timestamp = Date.now().toString();
      
      // Salvar com timestamp para rastreamento
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.TOKEN_TIMESTAMP_KEY, timestamp);
      
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
      
      // Verificar se foi salvo corretamente
      const savedToken = localStorage.getItem(this.TOKEN_KEY);
      const savedTimestamp = localStorage.getItem(this.TOKEN_TIMESTAMP_KEY);
      
      const success = savedToken === token && savedTimestamp === timestamp;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Token persistence result:', {
          success,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...',
          timestamp,
          refreshTokenSaved: !!refreshToken
        });
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to save token:', error);
      return false;
    }
  }
  
  // Recuperar token com fallbacks e validação
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      // Tentar localStorage primeiro
      let token = localStorage.getItem(this.TOKEN_KEY);
      const timestamp = localStorage.getItem(this.TOKEN_TIMESTAMP_KEY);
      
      if (token) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Token retrieved from localStorage:', {
            tokenPreview: token.substring(0, 20) + '...',
            timestamp: timestamp ? new Date(parseInt(timestamp)).toISOString() : 'no timestamp',
            age: timestamp ? (Date.now() - parseInt(timestamp)) / 1000 / 60 : 'unknown'
          });
        }
        return token;
      }
      
      // Fallback para sessionStorage
      token = sessionStorage.getItem(this.TOKEN_KEY);
      if (token) {
        // Mover de sessionStorage para localStorage
        this.saveToken(token);
        sessionStorage.removeItem(this.TOKEN_KEY);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Token migrated from sessionStorage to localStorage');
        }
        return token;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ No token found in any storage');
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error retrieving token:', error);
      return null;
    }
  }
  
  // Recuperar refresh token
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('❌ Error retrieving refresh token:', error);
      return null;
    }
  }
  
  // Limpar todos os tokens
  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
      sessionStorage.removeItem(this.TOKEN_KEY);
      
      // Limpar também o store do Zustand
      localStorage.removeItem('erp-nexus-auth');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 All tokens cleared from storage');
      }
    } catch (error) {
      console.error('❌ Error clearing tokens:', error);
    }
  }
  
  // Validar integridade do token
  static validateTokenIntegrity(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    // Verificar se é um JWT válido (tem 3 partes separadas por pontos)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Tentar decodificar o header e payload para verificar se é JSON válido
      JSON.parse(atob(parts[0]));
      JSON.parse(atob(parts[1]));
      return true;
    } catch (error) {
      return false;
    }
  }
}

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
      
      // Log da requisição em desenvolvimento com mais detalhes
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          hasData: !!config.data,
          dataKeys: config.data ? Object.keys(config.data) : [],
          headers: Object.keys(config.headers || {})
        });
        
        console.log(`🔍 Authentication Status:`, {
          tokenPresent: !!token,
          tokenValid: token ? TokenPersistenceManager.validateTokenIntegrity(token) : false,
          authHeaderSet: !!config.headers.Authorization,
          refreshInProgress: isRefreshing
        });
        
        if (token) {
          console.log(`🔑 Token Info:`, {
            preview: token.substring(0, 50) + '...',
            length: token.length,
            isValidJWT: TokenPersistenceManager.validateTokenIntegrity(token)
          });
        } else {
          console.warn('⚠️ No auth token found - request will be sent without authentication');
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
      // Log da resposta em desenvolvimento com mais detalhes
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ API Response: ${response.config.url}`, {
          status: response.status,
          success: response.data?.success,
          hasData: !!response.data?.data,
          dataType: typeof response.data?.data,
          responseSize: JSON.stringify(response.data).length
        });
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

          console.log('🔄 Attempting token refresh for failed request:', originalRequest.url);
          const newToken = await refreshAuthToken();
          
          console.log('🔄 Token refresh result:', {
            success: !!newToken,
            tokenPreview: newToken ? newToken.substring(0, 20) + '...' : 'null',
            originalUrl: originalRequest.url
          });
          
          if (newToken) {
            // Verificar novamente se o token foi persistido corretamente
            const persistedToken = getAuthToken();
            if (persistedToken !== newToken) {
              console.error('❌ Token persistence mismatch after refresh');
              throw new Error('Token persistence failed after refresh');
            }
            
            // Processar fila de requisições pendentes
            processQueue(null, newToken);
            
            // Atualizar o header da requisição original de forma mais robusta
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            console.log('✅ Retrying original request with refreshed token:', {
              url: originalRequest.url,
              tokenPreview: newToken.substring(0, 20) + '...',
              authHeaderSet: !!originalRequest.headers.Authorization
            });
            
            return instance(originalRequest);
          } else {
            throw new Error('Failed to get new token after refresh');
          }
        } catch (refreshError: any) {
          console.error('❌ Token refresh failed for request:', {
            originalUrl: originalRequest.url,
            error: refreshError.message,
            response: refreshError.response?.data
          });
          
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
      
      // Log do erro com mais contexto
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        errorCode: error.code,
        hasRefreshToken: !!getRefreshToken(),
        wasRetry: error.config?._retry,
        responseData: error.response?.data,
        requestId: error.config?.headers?.['x-request-id'] || 'unknown'
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

// ========================================
// TOKEN ACCESS FUNCTIONS (Updated)
// ========================================

// Obter token usando o manager robusto
const getAuthToken = (): string | null => {
  const token = TokenPersistenceManager.getToken();
  
  // Validar integridade do token antes de retornar
  if (token && !TokenPersistenceManager.validateTokenIntegrity(token)) {
    console.warn('⚠️ Invalid token format detected, clearing...');
    TokenPersistenceManager.clearTokens();
    return null;
  }
  
  return token;
};

// Obter refresh token usando o manager
const getRefreshToken = (): string | null => {
  return TokenPersistenceManager.getRefreshToken();
};

// ========================================
// ENHANCED TOKEN REFRESH FUNCTION
// ========================================

// Renovar token de autenticação via API Gateway (VERSÃO ROBUSTA)
const refreshAuthToken = async (): Promise<string | null> => {
  // Se já está refreshing, retornar a promise existente
  if (isRefreshing && refreshPromise) {
    console.log('🔄 Token refresh already in progress, waiting for result...');
    return refreshPromise;
  }
  
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    const error = new Error('No refresh token available');
    console.error('❌ Refresh failed:', error.message);
    throw error;
  }

  // Marcar como refreshing e criar nova promise
  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      // Criar uma instância separada para evitar loop infinito no interceptor
      const refreshInstance = axios.create({
        baseURL: API_BASE_URL,
        timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT_QUICK_OPERATIONS || '15000', 10),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🔄 Starting token refresh with token:', refreshToken.substring(0, 20) + '...');
      
      const response = await refreshInstance.post(`${API_ROUTES.auth}/refresh`, { 
        refreshToken,
        timestamp: Date.now() // Add timestamp for debugging
      });
      
      console.log('🔄 Refresh response received:', {
        success: response.data?.success,
        hasData: !!response.data?.data,
        statusCode: response.status
      });
      
      if (response.data?.success && response.data?.data) {
        const { token, refreshToken: newRefreshToken } = response.data.data;
        
        if (!token) {
          throw new Error('No token in refresh response');
        }
        
        // Validar formato do novo token
        if (!TokenPersistenceManager.validateTokenIntegrity(token)) {
          throw new Error('Invalid token format received from server');
        }
        
        // Salvar novos tokens usando o manager robusto
        const saveSuccess = TokenPersistenceManager.saveToken(token, newRefreshToken);
        
        if (!saveSuccess) {
          throw new Error('Failed to persist new token');
        }
        
        // Verificar se o token foi realmente salvo
        const verificationToken = TokenPersistenceManager.getToken();
        if (verificationToken !== token) {
          throw new Error('Token persistence verification failed');
        }
        
        console.log('✅ Token refreshed and verified successfully:', {
          tokenPreview: token.substring(0, 20) + '...',
          hasNewRefreshToken: !!newRefreshToken,
          persistenceVerified: true
        });
        
        return token;
      } else {
        throw new Error('Invalid refresh response format: ' + JSON.stringify(response.data));
      }
    } catch (error: any) {
      console.error('❌ Token refresh failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Limpar tokens inválidos apenas se o refresh falhar definitivamente
      TokenPersistenceManager.clearTokens();
      
      throw error;
    } finally {
      // Reset refresh state
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

// ========================================
// ENHANCED LOGIN REDIRECT FUNCTION
// ========================================

// Redirecionar para login com limpeza completa
const redirectToLogin = (): void => {
  if (typeof window !== 'undefined') {
    console.log('🔄 Starting complete authentication cleanup...');
    
    // Usar o manager para limpeza completa
    TokenPersistenceManager.clearTokens();
    
    // Limpar qualquer estado de refresh em andamento
    isRefreshing = false;
    refreshPromise = null;
    failedQueue = [];
    
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
      
      // Pequeno delay para permitir que a limpeza termine
      setTimeout(() => {
        console.log('🔄 Redirecting to login page...');
        window.location.href = '/login';
      }, 100);
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