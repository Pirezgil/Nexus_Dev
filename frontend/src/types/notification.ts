// Tipos para o sistema de notificações no frontend
export interface Notification {
  id: string;
  title: string;
  message: string;
  description?: string;
  type: NotificationType;
  priority: NotificationPriority;
  category?: string;
  module?: string;
  persistent?: boolean;
  requireAction?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  actionData?: Record<string, any>;
  sentAt?: Date;
  readAt?: Date;
  actionTakenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'CRITICAL';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType | NotificationType[];
  priority?: NotificationPriority | NotificationPriority[];
  module?: string | string[];
  category?: string | string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface NotificationPreferences {
  channels: Array<{
    type: string;
    enabled: boolean;
    recipient?: string;
  }>;
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  frequency?: {
    immediate: boolean;
    digest: boolean;
    digestTime: string;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

// Estados do sistema de notificações
export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  preferences: NotificationPreferences | null;
  stats: NotificationStats | null;
  filters: NotificationFilters;
  connected: boolean; // WebSocket connection status
}

// Ações para o contexto
export type NotificationAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: string; updates: Partial<Notification> } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_AS_READ'; payload: string | 'all' }
  | { type: 'SET_PREFERENCES'; payload: NotificationPreferences }
  | { type: 'SET_STATS'; payload: NotificationStats }
  | { type: 'SET_FILTERS'; payload: NotificationFilters }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'CLEAR_ALL' };

// Props para componentes
export interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export interface NotificationListProps {
  notifications: Notification[];
  loading?: boolean;
  onRead?: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  onDismiss?: (id: string) => void;
  emptyMessage?: string;
  showFilters?: boolean;
}

export interface NotificationToastProps {
  notification: Notification;
  duration?: number;
  onClose?: () => void;
  onAction?: (action: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface NotificationBellProps {
  unreadCount: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

// WebSocket events
export interface NotificationWebSocketEvent {
  type: 'notification' | 'status_update' | 'metrics_update';
  data: any;
  timestamp: string;
}

// API responses
export interface NotificationApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

export interface PaginatedNotificationResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Hooks types
export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  stats: NotificationStats | null;
  preferences: NotificationPreferences | null;
  connected: boolean;
  
  // Actions
  fetchNotifications: (filters?: NotificationFilters) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => void;
  takeAction: (id: string, action: string) => Promise<void>;
  updatePreferences: (preferences: NotificationPreferences) => Promise<void>;
  clearAll: () => void;
  
  // Filters
  setFilters: (filters: NotificationFilters) => void;
  resetFilters: () => void;
}

// Configuration
export interface NotificationConfig {
  apiUrl: string;
  websocketUrl: string;
  toastDuration: number;
  maxToasts: number;
  enableWebSocket: boolean;
  enableSound: boolean;
  soundUrl?: string;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme: {
    success: string;
    error: string;
    warning: string;
    info: string;
    critical: string;
  };
}