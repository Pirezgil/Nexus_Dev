'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  Notification, 
  NotificationState, 
  NotificationAction, 
  NotificationFilters,
  NotificationPreferences,
  UseNotificationsResult
} from '../types/notification';
import { useAuth } from './AuthContext';
import { notificationApi } from '../lib/notificationApi';
import { useWebSocket } from '../hooks/useWebSocket';

// Estado inicial
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  preferences: null,
  stats: null,
  filters: {},
  connected: false
};

// Reducer para gerenciar estado
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_NOTIFICATIONS':
      const unreadCount = action.payload.filter(n => !n.readAt).length;
      return { 
        ...state, 
        notifications: action.payload, 
        unreadCount,
        loading: false, 
        error: null 
      };
    
    case 'ADD_NOTIFICATION':
      const newNotifications = [action.payload, ...state.notifications];
      const newUnreadCount = newNotifications.filter(n => !n.readAt).length;
      return { 
        ...state, 
        notifications: newNotifications,
        unreadCount: newUnreadCount
      };
    
    case 'UPDATE_NOTIFICATION':
      const updatedNotifications = state.notifications.map(n => 
        n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
      );
      const updatedUnreadCount = updatedNotifications.filter(n => !n.readAt).length;
      return { 
        ...state, 
        notifications: updatedNotifications,
        unreadCount: updatedUnreadCount
      };
    
    case 'REMOVE_NOTIFICATION':
      const filteredNotifications = state.notifications.filter(n => n.id !== action.payload);
      const filteredUnreadCount = filteredNotifications.filter(n => !n.readAt).length;
      return { 
        ...state, 
        notifications: filteredNotifications,
        unreadCount: filteredUnreadCount
      };
    
    case 'MARK_AS_READ':
      if (action.payload === 'all') {
        const allReadNotifications = state.notifications.map(n => ({ 
          ...n, 
          readAt: n.readAt || new Date() 
        }));
        return { 
          ...state, 
          notifications: allReadNotifications,
          unreadCount: 0
        };
      } else {
        const markedNotifications = state.notifications.map(n => 
          n.id === action.payload ? { ...n, readAt: new Date() } : n
        );
        const markedUnreadCount = markedNotifications.filter(n => !n.readAt).length;
        return { 
          ...state, 
          notifications: markedNotifications,
          unreadCount: markedUnreadCount
        };
      }
    
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.payload };
    
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    
    case 'CLEAR_ALL':
      return initialState;
    
    default:
      return state;
  }
}

// Contexto
const NotificationContext = createContext<UseNotificationsResult | undefined>(undefined);

// Provider
interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, token } = useAuth();

  // WebSocket integration
  const { connected, sendMessage } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:5006',
    enabled: !!user && !!token,
    onMessage: handleWebSocketMessage,
    onConnect: () => dispatch({ type: 'SET_CONNECTED', payload: true }),
    onDisconnect: () => dispatch({ type: 'SET_CONNECTED', payload: false })
  });

  // Handle WebSocket messages
  function handleWebSocketMessage(event: any) {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'notification':
          dispatch({ type: 'ADD_NOTIFICATION', payload: data.data });
          // Show toast notification
          showToastNotification(data.data);
          break;
        
        case 'status_update':
          if (data.data.status === 'read') {
            dispatch({ 
              type: 'UPDATE_NOTIFICATION', 
              payload: { 
                id: data.data.notificationId, 
                updates: { readAt: new Date() }
              }
            });
          }
          break;
        
        case 'metrics_update':
          // Handle metrics update if needed
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Show toast notification
  function showToastNotification(notification: Notification) {
    // This will be handled by a toast component
    const event = new CustomEvent('notification-toast', { detail: notification });
    window.dispatchEvent(event);
  }

  // Fetch notifications
  const fetchNotifications = useCallback(async (filters?: NotificationFilters) => {
    if (!token) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await notificationApi.getNotifications(filters);
      dispatch({ type: 'SET_NOTIFICATIONS', payload: response.data });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  // Mark as read
  const markAsRead = useCallback(async (id: string) => {
    if (!token) return;

    try {
      await notificationApi.markAsRead(id);
      dispatch({ type: 'MARK_AS_READ', payload: id });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      await notificationApi.markAllAsRead();
      dispatch({ type: 'MARK_AS_READ', payload: 'all' });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  // Dismiss notification (local only)
  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  // Take action
  const takeAction = useCallback(async (id: string, action: string) => {
    if (!token) return;

    try {
      await notificationApi.interact(id, action);
      dispatch({ 
        type: 'UPDATE_NOTIFICATION', 
        payload: { 
          id, 
          updates: { actionTakenAt: new Date() }
        }
      });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  // Update preferences
  const updatePreferences = useCallback(async (preferences: NotificationPreferences) => {
    if (!token) return;

    try {
      await notificationApi.updatePreferences(preferences);
      dispatch({ type: 'SET_PREFERENCES', payload: preferences });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  // Set filters
  const setFilters = useCallback((filters: NotificationFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
    fetchNotifications(filters);
  }, [fetchNotifications]);

  // Reset filters
  const resetFilters = useCallback(() => {
    const emptyFilters = {};
    dispatch({ type: 'SET_FILTERS', payload: emptyFilters });
    fetchNotifications(emptyFilters);
  }, [fetchNotifications]);

  // Clear all
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // Load initial data
  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      
      // Authenticate WebSocket
      if (connected) {
        sendMessage('authenticate', token);
      }
    } else {
      clearAll();
    }
  }, [user, token, connected, fetchNotifications, sendMessage, clearAll]);

  // Load preferences and stats
  useEffect(() => {
    if (user && token) {
      // Load preferences
      notificationApi.getPreferences()
        .then(preferences => dispatch({ type: 'SET_PREFERENCES', payload: preferences }))
        .catch(error => console.error('Failed to load preferences:', error));

      // Load stats
      notificationApi.getStats()
        .then(stats => dispatch({ type: 'SET_STATS', payload: stats }))
        .catch(error => console.error('Failed to load stats:', error));
    }
  }, [user, token]);

  const value: UseNotificationsResult = {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    stats: state.stats,
    preferences: state.preferences,
    connected: state.connected,
    
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    takeAction,
    updatePreferences,
    clearAll,
    
    setFilters,
    resetFilters
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook para usar o contexto
export function useNotifications(): UseNotificationsResult {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}