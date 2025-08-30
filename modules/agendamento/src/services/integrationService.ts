/**
 * Service para integração com módulos externos
 * Handles comunicação com User Management, CRM, Services e WhatsApp API
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { 
  IExternalCustomer, 
  IExternalProfessional, 
  IExternalService,
  ICustomerBasic,
  IProfessionalBasic,
  IServiceBasic,
  ErrorCode,
  AppointmentError
} from '../types';
import { logger, integrationLogger } from '../utils/logger';
import config from '../utils/config';
import { appointmentCache } from '../utils/redis';

interface IntegrationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  responseTime?: number;
}

interface HealthCheckResponse {
  success: boolean;
  data?: any;
  error?: string;
  responseTime: number;
}

// Configuração do axios com timeouts e retry
const createAxiosInstance = (baseURL: string) => {
  const instance = axios.create({
    baseURL,
    timeout: 10000, // 10s timeout
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Interceptor para logging de requests
  instance.interceptors.request.use((config) => {
    integrationLogger.request({
      module: config.baseURL?.includes('user-management') ? 'user-management' :
              config.baseURL?.includes('crm') ? 'crm' :
              config.baseURL?.includes('services') ? 'services' : 'unknown',
      endpoint: config.url || '',
      method: config.method?.toUpperCase() || 'GET'
    });
    return config;
  });

  // Interceptor para logging de responses
  instance.interceptors.response.use(
    (response) => {
      integrationLogger.response({
        module: response.config.baseURL?.includes('user-management') ? 'user-management' :
                response.config.baseURL?.includes('crm') ? 'crm' :
                response.config.baseURL?.includes('services') ? 'services' : 'unknown',
        endpoint: response.config.url || '',
        method: response.config.method?.toUpperCase() || 'GET',
        statusCode: response.status,
        responseTime: response.config.metadata?.endTime - response.config.metadata?.startTime
      });
      return response;
    },
    (error) => {
      integrationLogger.error({
        module: error.config?.baseURL?.includes('user-management') ? 'user-management' :
                error.config?.baseURL?.includes('crm') ? 'crm' :
                error.config?.baseURL?.includes('services') ? 'services' : 'unknown',
        endpoint: error.config?.url || '',
        method: error.config?.method?.toUpperCase() || 'GET',
        statusCode: error.response?.status,
        error: error.message
      });
      return Promise.reject(error);
    }
  );

  return instance;
};

// Instâncias dos serviços
const userManagementApi = createAxiosInstance(config.services.userManagement);
const crmApi = createAxiosInstance(config.services.crm);
const servicesApi = createAxiosInstance(config.services.services);

export const integrationService = {

  // === USER MANAGEMENT INTEGRATION ===
  
  // Validar token JWT
  validateToken: async (token: string): Promise<IntegrationResponse> => {
    try {
      const startTime = Date.now();
      
      const response = await userManagementApi.post('/auth/validate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      logger.error('Erro na validação do token:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime
      };
    }
  },

  // Obter dados do usuário
  getUserById: async (userId: string, companyId: string): Promise<any> => {
    try {
      const response = await userManagementApi.get(`/users/${userId}`, {
        params: { company_id: companyId }
      });
      
      return response.data.data.user;
      
    } catch (error) {
      logger.error(`Erro ao buscar usuário ${userId}:`, error);
      return null;
    }
  },

  // Health check do User Management
  checkUserManagementHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const startTime = Date.now();
      const response = await userManagementApi.get('/health');
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime
      };
    }
  },

  // === CRM INTEGRATION ===
  
  // Buscar cliente por ID
  getCustomerById: async (customerId: string, companyId: string): Promise<ICustomerBasic | null> => {
    try {
      // Verificar cache primeiro
      const cacheKey = `customer:${customerId}`;
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await crmApi.get(`/api/crm/customers/${customerId}`, {
        params: { company_id: companyId }
      });
      
      const customer: IExternalCustomer = response.data.data.customer;
      
      const customerBasic: ICustomerBasic = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        avatar_url: customer.avatar_url
      };

      // Cache por 1 hora
      await appointmentCache.set(cacheKey, customerBasic, 3600);
      
      return customerBasic;
      
    } catch (error) {
      logger.error(`Erro ao buscar cliente ${customerId}:`, error);
      return null;
    }
  },

  // Buscar clientes (para busca/autocomplete)
  searchCustomers: async (companyId: string, query: string, limit = 10): Promise<ICustomerBasic[]> => {
    try {
      // Verificar cache para pesquisas recentes
      const cacheKey = appointmentCache.keys.customerSearch(companyId, query);
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await crmApi.get('/api/crm/customers', {
        params: { 
          company_id: companyId,
          search: query,
          limit
        }
      });
      
      const customers: ICustomerBasic[] = response.data.data.customers.map((customer: IExternalCustomer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        avatar_url: customer.avatar_url
      }));

      // Cache por 10 minutos
      await appointmentCache.set(cacheKey, customers, 600);
      
      return customers;
      
    } catch (error) {
      logger.error('Erro ao buscar clientes:', error);
      return [];
    }
  },

  // Health check do CRM
  checkCrmHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const startTime = Date.now();
      const response = await crmApi.get('/api/health');
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime
      };
    }
  },

  // === SERVICES INTEGRATION ===
  
  // Buscar profissional por ID
  getProfessionalById: async (professionalId: string, companyId: string): Promise<IProfessionalBasic | null> => {
    try {
      // Verificar cache primeiro
      const cacheKey = `professional:${professionalId}`;
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await servicesApi.get(`/api/professionals/${professionalId}`, {
        params: { company_id: companyId }
      });
      
      const professional: IExternalProfessional = response.data.data.professional;
      
      const professionalBasic: IProfessionalBasic = {
        id: professional.id,
        name: professional.name,
        photo_url: professional.photo_url,
        specialties: professional.specialties,
        services: professional.services
      };

      // Cache por 1 hora
      await appointmentCache.set(cacheKey, professionalBasic, 3600);
      
      return professionalBasic;
      
    } catch (error) {
      logger.error(`Erro ao buscar profissional ${professionalId}:`, error);
      return null;
    }
  },

  // Buscar profissionais da empresa
  getProfessionals: async (companyId: string, professionalId?: string): Promise<IProfessionalBasic[] | null> => {
    try {
      // Se for um profissional específico, buscar apenas ele
      if (professionalId) {
        const professional = await integrationService.getProfessionalById(professionalId, companyId);
        return professional ? [professional] : [];
      }

      // Verificar cache
      const cacheKey = appointmentCache.keys.professionals(companyId);
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await servicesApi.get('/api/professionals', {
        params: { company_id: companyId, active: true }
      });
      
      const professionals: IProfessionalBasic[] = response.data.data.professionals.map((prof: IExternalProfessional) => ({
        id: prof.id,
        name: prof.name,
        photo_url: prof.photo_url,
        specialties: prof.specialties,
        services: prof.services
      }));

      // Cache por 30 minutos
      await appointmentCache.set(cacheKey, professionals, 1800);
      
      return professionals;
      
    } catch (error) {
      logger.error('Erro ao buscar profissionais:', error);
      return null;
    }
  },

  // Buscar serviço por ID
  getServiceById: async (serviceId: string, companyId: string): Promise<IServiceBasic | null> => {
    try {
      // Verificar cache primeiro
      const cacheKey = `service:${serviceId}`;
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await servicesApi.get(`/api/services/${serviceId}`, {
        params: { company_id: companyId }
      });
      
      const service: IExternalService = response.data.data.service;
      
      const serviceBasic: IServiceBasic = {
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
        category: service.category,
        description: service.description
      };

      // Cache por 1 hora
      await appointmentCache.set(cacheKey, serviceBasic, 3600);
      
      return serviceBasic;
      
    } catch (error) {
      logger.error(`Erro ao buscar serviço ${serviceId}:`, error);
      return null;
    }
  },

  // Buscar serviços da empresa
  getServices: async (companyId: string): Promise<IServiceBasic[]> => {
    try {
      // Verificar cache
      const cacheKey = appointmentCache.keys.services(companyId);
      const cached = await appointmentCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await servicesApi.get('/api/services', {
        params: { company_id: companyId, active: true }
      });
      
      const services: IServiceBasic[] = response.data.data.services.map((service: IExternalService) => ({
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
        category: service.category,
        description: service.description
      }));

      // Cache por 30 minutos
      await appointmentCache.set(cacheKey, services, 1800);
      
      return services;
      
    } catch (error) {
      logger.error('Erro ao buscar serviços:', error);
      return [];
    }
  },

  // Notificar módulo Services sobre agendamento concluído
  notifyAppointmentCompleted: async (appointmentId: string, completedData: any): Promise<boolean> => {
    try {
      await servicesApi.post(`/api/appointments/${appointmentId}/complete`, completedData);
      return true;
      
    } catch (error) {
      logger.error('Erro ao notificar conclusão do agendamento:', error);
      return false;
    }
  },

  // Health check do Services
  checkServicesHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const startTime = Date.now();
      const response = await servicesApi.get('/api/health');
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime
      };
    }
  },

  // === WHATSAPP INTEGRATION ===
  
  // Enviar mensagem via WhatsApp Business API
  sendWhatsAppMessage: async (phone: string, message: string): Promise<IntegrationResponse> => {
    try {
      if (!config.whatsapp.enabled || !config.whatsapp.accessToken) {
        return {
          success: false,
          error: 'WhatsApp não configurado'
        };
      }

      const startTime = Date.now();
      
      const response = await axios.post(
        `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''), // Remove caracteres não numéricos
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${config.whatsapp.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      logger.error('Erro ao enviar mensagem WhatsApp:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime: Date.now() - Date.now()
      };
    }
  },

  // Health check do WhatsApp API
  checkWhatsAppHealth: async (): Promise<HealthCheckResponse> => {
    try {
      if (!config.whatsapp.enabled) {
        return {
          success: false,
          error: 'WhatsApp não habilitado',
          responseTime: 0
        };
      }

      const startTime = Date.now();
      
      // Verificar se consegue acessar a API do WhatsApp
      const response = await axios.get(
        `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.whatsapp.accessToken}`
          },
          timeout: 10000
        }
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        data: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        responseTime
      };
    }
  },

  // === UTILITY FUNCTIONS ===
  
  // Retry de requisições com backoff exponencial
  withRetry: async <T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        logger.warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms...`);
      }
    }
    
    throw lastError;
  },

  // Invalidar cache relacionado a uma empresa
  invalidateCompanyCache: async (companyId: string) => {
    try {
      await appointmentCache.invalidateByCompany(companyId);
      logger.info(`Cache da empresa ${companyId} invalidado`);
    } catch (error) {
      logger.error('Erro ao invalidar cache da empresa:', error);
    }
  },

  // Obter status de todas as integrações
  getIntegrationsStatus: async (companyId: string) => {
    try {
      const [userMgmt, crm, services, whatsapp] = await Promise.allSettled([
        integrationService.checkUserManagementHealth(),
        integrationService.checkCrmHealth(),
        integrationService.checkServicesHealth(),
        config.whatsapp.enabled ? integrationService.checkWhatsAppHealth() : Promise.resolve({ success: false, responseTime: 0, error: 'Desabilitado' })
      ]);

      return {
        user_management: userMgmt.status === 'fulfilled' ? userMgmt.value : { success: false, error: 'Timeout' },
        crm: crm.status === 'fulfilled' ? crm.value : { success: false, error: 'Timeout' },
        services: services.status === 'fulfilled' ? services.value : { success: false, error: 'Timeout' },
        whatsapp: whatsapp.status === 'fulfilled' ? whatsapp.value : { success: false, error: 'Timeout' }
      };
      
    } catch (error) {
      logger.error('Erro ao verificar status das integrações:', error);
      throw error;
    }
  }
};