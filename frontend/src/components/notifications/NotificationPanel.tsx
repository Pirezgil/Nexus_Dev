'use client';

import React, { useState } from 'react';
import { MoreHorizontal, Settings, Check, Filter, Archive } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { NotificationBell } from './NotificationBell';
import { NotificationItem } from './NotificationItem';
import { NotificationFilters } from './NotificationFilters';
import { useNotifications } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

interface NotificationPanelProps {
  trigger?: React.ReactNode;
  side?: 'left' | 'right';
}

export function NotificationPanel({ trigger, side = 'right' }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    stats,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    takeAction,
    setFilters,
    resetFilters
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filtrar notificações por tab
  const filteredNotifications = React.useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.readAt);
      case 'important':
        return notifications.filter(n => n.priority === 'HIGH' || n.priority === 'CRITICAL');
      case 'actions':
        return notifications.filter(n => n.requireAction && !n.actionTakenAt);
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const handleNotificationRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const handleNotificationAction = async (id: string, action: string) => {
    try {
      await takeAction(id, action);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    }
  };

  const handleNotificationDismiss = (id: string) => {
    dismissNotification(id);
  };

  const defaultTrigger = (
    <NotificationBell
      unreadCount={unreadCount}
      onClick={() => setOpen(true)}
    />
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      
      <SheetContent side={side} className="w-96 p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Notificações</SheetTitle>
              <SheetDescription>
                {unreadCount > 0 ? 
                  `${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}` :
                  'Todas as notificações estão em dia'
                }
              </SheetDescription>
            </div>

            {/* Menu de ações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {unreadCount > 0 && (
                  <>
                    <DropdownMenuItem onClick={handleMarkAllAsRead}>
                      <Check className="mr-2 h-4 w-4" />
                      Marcar todas como lidas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {showFilters ? 'Ocultar' : 'Mostrar'} filtros
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        {/* Filtros */}
        {showFilters && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <NotificationFilters 
              onFiltersChange={setFilters}
              onReset={resetFilters}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 py-2 border-b">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                Todas
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Não lidas
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="important" className="text-xs">
                Importantes
                {stats && (stats.byPriority.HIGH + stats.byPriority.CRITICAL) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {stats.byPriority.HIGH + stats.byPriority.CRITICAL}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                Ações
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1">
            <TabsContent value={activeTab} className="h-full m-0">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center px-6">
                    <p className="text-red-600 text-sm font-medium">Erro ao carregar</p>
                    <p className="text-gray-500 text-xs mt-1">{error}</p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center px-6">
                    <div className="text-2xl mb-2">🎉</div>
                    <p className="text-gray-600 text-sm font-medium">
                      {activeTab === 'unread' ? 'Tudo em dia!' : 
                       activeTab === 'important' ? 'Nada importante' :
                       activeTab === 'actions' ? 'Sem ações pendentes' :
                       'Nenhuma notificação'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {activeTab === 'unread' ? 'Você não tem notificações não lidas.' :
                       activeTab === 'important' ? 'Não há notificações importantes.' :
                       activeTab === 'actions' ? 'Não há ações pendentes.' :
                       'Você não tem notificações.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={handleNotificationRead}
                        onAction={handleNotificationAction}
                        onDismiss={handleNotificationDismiss}
                        compact
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer com estatísticas */}
        {stats && (
          <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Total: {stats.total}</span>
              <span>Não lidas: {stats.unread}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}