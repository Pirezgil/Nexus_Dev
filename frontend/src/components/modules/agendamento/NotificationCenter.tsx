'use client';

import { useState, useEffect } from 'react';
import { Appointment } from '@/types';
import { agendamentoApi, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Bell, 
  X, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle,
  Info,
  Phone
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, addMinutes, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'reminder' | 'upcoming' | 'overdue' | 'cancelled' | 'confirmed' | 'info';
  title: string;
  message: string;
  appointment?: Appointment;
  createdAt: Date;
  read: boolean;
  urgent: boolean;
}

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    
    // Atualizar notificações a cada minuto
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const loadNotifications = async () => {
    setLoading(true);
    
    try {
      // Carregar agendamentos de hoje e amanhã
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addMinutes(new Date(), 24 * 60), 'yyyy-MM-dd');

      const [todayRes, tomorrowRes] = await Promise.all([
        apiGet<Appointment[]>(agendamentoApi, '/api/agendamento/appointments', { 
          date: today,
          status: 'SCHEDULED,CONFIRMED'
        }),
        apiGet<Appointment[]>(agendamentoApi, '/api/agendamento/appointments', { 
          date: tomorrow,
          status: 'SCHEDULED,CONFIRMED'
        }),
      ]);

      const todayAppointments = todayRes.success ? todayRes.data : [];
      const tomorrowAppointments = tomorrowRes.success ? tomorrowRes.data : [];

      // Gerar notificações baseadas nos agendamentos
      const generatedNotifications = generateNotifications([
        ...todayAppointments,
        ...tomorrowAppointments,
      ]);

      setNotifications(generatedNotifications);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = (appointments: Appointment[]): Notification[] => {
    const notifications: Notification[] = [];
    const now = new Date();

    appointments.forEach((appointment) => {
      const startTime = new Date(appointment.startTime);
      const minutesUntil = differenceInMinutes(startTime, now);

      // Agendamentos próximos (15 minutos)
      if (minutesUntil > 0 && minutesUntil <= 15) {
        notifications.push({
          id: `upcoming-${appointment.id}`,
          type: 'upcoming',
          title: 'Agendamento próximo',
          message: `${appointment.customer.name} - ${appointment.service.name} em ${minutesUntil} minutos`,
          appointment,
          createdAt: now,
          read: false,
          urgent: minutesUntil <= 5,
        });
      }

      // Agendamentos atrasados
      if (minutesUntil < -5 && appointment.status === 'SCHEDULED') {
        notifications.push({
          id: `overdue-${appointment.id}`,
          type: 'overdue',
          title: 'Agendamento atrasado',
          message: `${appointment.customer.name} - ${appointment.service.name} (${Math.abs(minutesUntil)} min de atraso)`,
          appointment,
          createdAt: now,
          read: false,
          urgent: true,
        });
      }

      // Lembretes para amanhã
      if (isTomorrow(startTime)) {
        notifications.push({
          id: `tomorrow-${appointment.id}`,
          type: 'reminder',
          title: 'Agendamento amanhã',
          message: `${appointment.customer.name} - ${format(startTime, 'HH:mm')} - ${appointment.service.name}`,
          appointment,
          createdAt: now,
          read: false,
          urgent: false,
        });
      }

      // Agendamentos confirmados hoje
      if (isToday(startTime) && appointment.status === 'CONFIRMED' && minutesUntil > 15) {
        notifications.push({
          id: `confirmed-${appointment.id}`,
          type: 'confirmed',
          title: 'Agendamento confirmado',
          message: `${appointment.customer.name} - ${format(startTime, 'HH:mm')} - ${appointment.service.name}`,
          appointment,
          createdAt: now,
          read: false,
          urgent: false,
        });
      }
    });

    // Ordenar por urgência e data
    return notifications.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  };

  const getNotificationIcon = (type: string, urgent: boolean) => {
    const iconClass = urgent ? 'text-red-500' : 'text-gray-500';
    
    switch (type) {
      case 'upcoming':
        return <Clock className={iconClass} size={20} />;
      case 'overdue':
        return <AlertTriangle className="text-red-500" size={20} />;
      case 'reminder':
        return <Calendar className={iconClass} size={20} />;
      case 'confirmed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'cancelled':
        return <X className="text-red-500" size={20} />;
      default:
        return <Info className={iconClass} size={20} />;
    }
  };

  const getNotificationColor = (type: string, urgent: boolean) => {
    if (urgent) return 'border-red-200 bg-red-50';
    
    switch (type) {
      case 'upcoming':
        return 'border-blue-200 bg-blue-50';
      case 'overdue':
        return 'border-red-200 bg-red-50';
      case 'reminder':
        return 'border-yellow-200 bg-yellow-50';
      case 'confirmed':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.appointment) {
      // Navegar para detalhes do agendamento
      // router.push(`/agendamento/${notification.appointment.id}`);
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = differenceInMinutes(now, date);
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`;
    if (diffInMinutes < 24 * 60) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return format(date, 'dd/MM HH:mm', { locale: ptBR });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Notificações
              </h3>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Marcar todas como lidas
                </Button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type, notification.urgent)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className={`text-sm font-medium truncate ${
                              notification.urgent ? 'text-red-900' : 'text-gray-900'
                            }`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 ml-2"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          
                          <p className={`text-sm mt-1 ${
                            notification.urgent ? 'text-red-700' : 'text-gray-600'
                          }`}>
                            {notification.message}
                          </p>
                          
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                            
                            {notification.appointment && (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Ligar para cliente
                                    window.open(`tel:${notification.appointment!.customer.phone}`);
                                  }}
                                >
                                  <Phone size={10} />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {!notification.read && (
                            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    // router.push('/agendamento');
                  }}
                  className="w-full"
                >
                  Ver todos os agendamentos
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Hook para usar notificações em qualquer lugar
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Implementar lógica de notificações globais
  
  return {
    notifications,
    unreadCount,
    markAsRead: (id: string) => {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    },
    addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        createdAt: new Date(),
      };
      setNotifications(prev => [newNotification, ...prev]);
    },
  };
};