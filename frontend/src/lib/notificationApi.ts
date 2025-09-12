import { api } from './api';
import { 
  Notification, 
  NotificationFilters, 
  NotificationPreferences, 
  NotificationStats,
  NotificationApiResponse,
  PaginatedNotificationResponse
} from '../types/notification';

// API client para notificações
class NotificationApiClient {
  private baseUrl = '/api/notifications';

  // GET /api/notifications - Lista notificações com filtros
  async getNotifications(
    filters?: NotificationFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedNotificationResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...this.serializeFilters(filters)
    });

    const response = await api.get<NotificationApiResponse<PaginatedNotificationResponse>>(
      `${this.baseUrl}?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch notifications');
    }

    return response.data.data!;
  }

  // GET /api/notifications/:id - Busca notificação por ID
  async getNotification(id: string): Promise<Notification> {
    const response = await api.get<NotificationApiResponse<Notification>>(
      `${this.baseUrl}/${id}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch notification');
    }

    return response.data.data!;
  }

  // POST /api/notifications - Cria nova notificação
  async createNotification(notification: Partial<Notification>): Promise<Notification> {
    const response = await api.post<NotificationApiResponse<Notification>>(
      this.baseUrl,
      notification
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create notification');
    }

    return response.data.data!;
  }

  // POST /api/notifications/bulk - Cria múltiplas notificações
  async createBulkNotifications(notifications: Partial<Notification>[]): Promise<{
    success: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const response = await api.post<NotificationApiResponse<any>>(
      `${this.baseUrl}/bulk`,
      { notifications }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create notifications');
    }

    return response.data.data!;
  }

  // PUT /api/notifications/:id - Atualiza notificação
  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification> {
    const response = await api.put<NotificationApiResponse<Notification>>(
      `${this.baseUrl}/${id}`,
      updates
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update notification');
    }

    return response.data.data!;
  }

  // DELETE /api/notifications/:id - Remove notificação
  async deleteNotification(id: string): Promise<void> {
    const response = await api.delete<NotificationApiResponse<void>>(
      `${this.baseUrl}/${id}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete notification');
    }
  }

  // POST /api/notifications/:id/read - Marca como lida
  async markAsRead(id: string): Promise<Notification> {
    const response = await api.post<NotificationApiResponse<Notification>>(
      `${this.baseUrl}/${id}/read`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark as read');
    }

    return response.data.data!;
  }

  // POST /api/notifications/mark-all-read - Marca todas como lidas
  async markAllAsRead(): Promise<{ count: number }> {
    const response = await api.post<NotificationApiResponse<{ count: number }>>(
      `${this.baseUrl}/mark-all-read`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to mark all as read');
    }

    return response.data.data!;
  }

  // POST /api/notifications/:id/interact - Registra interação
  async interact(
    id: string, 
    action: 'VIEW' | 'CLICK' | 'DISMISS' | 'ACTION' | 'ARCHIVE' | 'DELETE',
    data?: Record<string, any>
  ): Promise<void> {
    const response = await api.post<NotificationApiResponse<void>>(
      `${this.baseUrl}/${id}/interact`,
      { action, data }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to register interaction');
    }
  }

  // GET /api/notifications/stats - Obtém estatísticas
  async getStats(filters?: NotificationFilters): Promise<NotificationStats> {
    const params = filters ? `?${new URLSearchParams(this.serializeFilters(filters)).toString()}` : '';
    
    const response = await api.get<NotificationApiResponse<NotificationStats>>(
      `${this.baseUrl}/stats${params}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch stats');
    }

    return response.data.data!;
  }

  // GET /api/preferences - Obtém preferências do usuário
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await api.get<NotificationApiResponse<NotificationPreferences>>(
      '/api/preferences'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch preferences');
    }

    return response.data.data!;
  }

  // PUT /api/preferences - Atualiza preferências
  async updatePreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const response = await api.put<NotificationApiResponse<NotificationPreferences>>(
      '/api/preferences',
      preferences
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update preferences');
    }

    return response.data.data!;
  }

  // POST /api/preferences/reset - Reseta preferências
  async resetPreferences(): Promise<NotificationPreferences> {
    const response = await api.post<NotificationApiResponse<NotificationPreferences>>(
      '/api/preferences/reset'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to reset preferences');
    }

    return response.data.data!;
  }

  // Helper para serializar filtros
  private serializeFilters(filters?: NotificationFilters): Record<string, string> {
    if (!filters) return {};

    const serialized: Record<string, string> = {};

    if (typeof filters.read === 'boolean') {
      serialized.read = filters.read.toString();
    }

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        serialized.type = filters.type.join(',');
      } else {
        serialized.type = filters.type;
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        serialized.priority = filters.priority.join(',');
      } else {
        serialized.priority = filters.priority;
      }
    }

    if (filters.module) {
      if (Array.isArray(filters.module)) {
        serialized.module = filters.module.join(',');
      } else {
        serialized.module = filters.module;
      }
    }

    if (filters.category) {
      if (Array.isArray(filters.category)) {
        serialized.category = filters.category.join(',');
      } else {
        serialized.category = filters.category;
      }
    }

    if (filters.dateFrom) {
      serialized.dateFrom = filters.dateFrom.toISOString();
    }

    if (filters.dateTo) {
      serialized.dateTo = filters.dateTo.toISOString();
    }

    return serialized;
  }
}

// Template API
class TemplateApiClient {
  private baseUrl = '/api/templates';

  // GET /api/templates - Lista templates
  async getTemplates(): Promise<any[]> {
    const response = await api.get<NotificationApiResponse<any[]>>(this.baseUrl);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch templates');
    }

    return response.data.data!;
  }

  // POST /api/templates/:id/render - Renderiza template
  async renderTemplate(
    id: string, 
    variables: Record<string, any>
  ): Promise<{ title: string; message: string; description?: string }> {
    const response = await api.post<NotificationApiResponse<any>>(
      `${this.baseUrl}/${id}/render`,
      { variables }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to render template');
    }

    return response.data.data!;
  }
}

// Analytics API
class AnalyticsApiClient {
  private baseUrl = '/api/analytics';

  // GET /api/analytics/dashboard - Dashboard data
  async getDashboard(
    dateFrom?: Date,
    dateTo?: Date,
    modules?: string[]
  ): Promise<any> {
    const params = new URLSearchParams();
    
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    if (modules) params.append('modules', modules.join(','));

    const response = await api.get<NotificationApiResponse<any>>(
      `${this.baseUrl}/dashboard?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch dashboard');
    }

    return response.data.data!;
  }

  // GET /api/analytics/report - Relatório detalhado
  async getReport(
    dateFrom: Date,
    dateTo: Date,
    options?: {
      modules?: string[];
      groupBy?: string[];
      interval?: string;
    }
  ): Promise<any> {
    const params = new URLSearchParams({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString()
    });

    if (options?.modules) params.append('modules', options.modules.join(','));
    if (options?.groupBy) params.append('groupBy', options.groupBy.join(','));
    if (options?.interval) params.append('interval', options.interval);

    const response = await api.get<NotificationApiResponse<any>>(
      `${this.baseUrl}/report?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch report');
    }

    return response.data.data!;
  }
}

// Instâncias exportadas
export const notificationApi = new NotificationApiClient();
export const templateApi = new TemplateApiClient();
export const analyticsApi = new AnalyticsApiClient();

// Helper functions
export const notificationUtils = {
  // Formatar tempo relativo
  getRelativeTime: (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    
    return date.toLocaleDateString('pt-BR');
  },

  // Obter ícone por tipo
  getTypeIcon: (type: string): string => {
    const icons = {
      SUCCESS: '✅',
      ERROR: '❌', 
      WARNING: '⚠️',
      INFO: 'ℹ️',
      CRITICAL: '🚨'
    };
    return icons[type as keyof typeof icons] || 'ℹ️';
  },

  // Obter cor por tipo
  getTypeColor: (type: string): string => {
    const colors = {
      SUCCESS: 'green',
      ERROR: 'red',
      WARNING: 'yellow', 
      INFO: 'blue',
      CRITICAL: 'red'
    };
    return colors[type as keyof typeof colors] || 'blue';
  },

  // Obter cor por prioridade
  getPriorityColor: (priority: string): string => {
    const colors = {
      LOW: 'gray',
      MEDIUM: 'blue',
      HIGH: 'orange',
      CRITICAL: 'red'
    };
    return colors[priority as keyof typeof colors] || 'gray';
  }
};