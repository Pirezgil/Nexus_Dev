'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, ExternalLink, X, Archive } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';
import { Notification, NotificationType, NotificationPriority } from '../../types/notification';

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
  showActions?: boolean;
}

export function NotificationItem({
  notification,
  onRead,
  onAction,
  onDismiss,
  compact = false,
  showActions = true
}: NotificationItemProps) {
  const isUnread = !notification.readAt;
  const hasAction = notification.requireAction && notification.actionUrl;

  // Cores por tipo
  const typeColors: Record<NotificationType, string> = {
    SUCCESS: 'text-green-600 bg-green-50 border-green-200',
    ERROR: 'text-red-600 bg-red-50 border-red-200',
    WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    INFO: 'text-blue-600 bg-blue-50 border-blue-200',
    CRITICAL: 'text-red-700 bg-red-100 border-red-300'
  };

  // Ícones por tipo
  const typeIcons: Record<NotificationType, string> = {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    CRITICAL: '🚨'
  };

  // Cores por prioridade
  const priorityColors: Record<NotificationPriority, string> = {
    LOW: 'bg-gray-100 text-gray-600',
    MEDIUM: 'bg-blue-100 text-blue-600',
    HIGH: 'bg-orange-100 text-orange-600',
    CRITICAL: 'bg-red-100 text-red-600'
  };

  const handleRead = () => {
    if (isUnread && onRead) {
      onRead(notification.id);
    }
  };

  const handleAction = () => {
    if (hasAction && onAction) {
      onAction(notification.id, 'ACTION');
      
      // Abrir URL se existir
      if (notification.actionUrl) {
        window.open(notification.actionUrl, '_blank');
      }
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(notification.id);
    }
  };

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR
  });

  return (
    <Card
      className={cn(
        'group relative transition-all duration-200 hover:shadow-md',
        isUnread && 'ring-2 ring-blue-500/20 bg-blue-50/30',
        compact && 'p-3',
        !compact && 'p-4'
      )}
    >
      {/* Indicador de não lida */}
      {isUnread && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
      )}

      <div className={cn('flex gap-3', isUnread && 'ml-4')}>
        {/* Ícone do tipo */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm',
          typeColors[notification.type]
        )}>
          {typeIcons[notification.type]}
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={cn(
              'font-medium text-sm leading-tight',
              isUnread ? 'text-gray-900' : 'text-gray-700'
            )}>
              {notification.title}
            </h3>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Badge de prioridade */}
              {notification.priority !== 'MEDIUM' && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs px-1.5 py-0.5',
                    priorityColors[notification.priority]
                  )}
                >
                  {notification.priority}
                </Badge>
              )}
              
              {/* Badge do módulo */}
              {notification.module && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                  {notification.module}
                </Badge>
              )}
            </div>
          </div>

          {/* Mensagem */}
          <p className={cn(
            'text-sm leading-relaxed',
            compact && 'line-clamp-2',
            isUnread ? 'text-gray-800' : 'text-gray-600'
          )}>
            {notification.message}
          </p>

          {/* Descrição adicional (se existir e não for compact) */}
          {!compact && notification.description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {notification.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{relativeTime}</span>
              {notification.category && (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{notification.category}</span>
                </>
              )}
            </div>

            {/* Ações */}
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Marcar como lida */}
                {isUnread && onRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRead}
                    className="h-6 w-6 p-0"
                    title="Marcar como lida"
                  >
                    <Eye size={12} />
                  </Button>
                )}

                {/* Ação principal */}
                {hasAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAction}
                    className="h-6 w-6 p-0 text-blue-600"
                    title={notification.actionLabel || 'Abrir'}
                  >
                    <ExternalLink size={12} />
                  </Button>
                )}

                {/* Arquivar/Dispensar */}
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                    title="Dispensar"
                  >
                    <X size={12} />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Botão de ação em destaque (para notificações críticas) */}
          {hasAction && notification.priority === 'CRITICAL' && (
            <Button
              onClick={handleAction}
              className="w-full mt-3"
              size="sm"
              variant={notification.type === 'ERROR' ? 'destructive' : 'default'}
            >
              {notification.actionLabel || 'Ver detalhes'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}