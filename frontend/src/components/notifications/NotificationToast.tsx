'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Notification, NotificationType, NotificationPriority } from '../../types/notification';

interface NotificationToastProps {
  notification: Notification;
  duration?: number;
  onClose?: () => void;
  onAction?: (action: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showProgress?: boolean;
}

export function NotificationToast({
  notification,
  duration = 5000,
  onClose,
  onAction,
  position = 'top-right',
  showProgress = true
}: NotificationToastProps) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Cores por tipo
  const typeColors: Record<NotificationType, string> = {
    SUCCESS: 'border-green-500 bg-green-50 text-green-900',
    ERROR: 'border-red-500 bg-red-50 text-red-900',
    WARNING: 'border-yellow-500 bg-yellow-50 text-yellow-900',
    INFO: 'border-blue-500 bg-blue-50 text-blue-900',
    CRITICAL: 'border-red-600 bg-red-100 text-red-900'
  };

  // Ícones por tipo
  const typeIcons: Record<NotificationType, string> = {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    CRITICAL: '🚨'
  };

  // Posicionamento
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  // Animações de entrada por posição
  const enterAnimations = {
    'top-right': 'animate-in slide-in-from-right-full',
    'top-left': 'animate-in slide-in-from-left-full',
    'bottom-right': 'animate-in slide-in-from-right-full',
    'bottom-left': 'animate-in slide-in-from-left-full'
  };

  // Animações de saída por posição
  const exitAnimations = {
    'top-right': 'animate-out slide-out-to-right-full',
    'top-left': 'animate-out slide-out-to-left-full',
    'bottom-right': 'animate-out slide-out-to-right-full',
    'bottom-left': 'animate-out slide-out-to-left-full'
  };

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose?.();
    }, 150); // Tempo da animação de saída
  }, [onClose]);

  const handleAction = useCallback(() => {
    onAction?.('ACTION');
    
    // Abrir URL se existir
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
    
    handleClose();
  }, [notification.actionUrl, onAction, handleClose]);

  // Auto-dismiss com barra de progresso
  useEffect(() => {
    if (duration <= 0 || notification.persistent) return;

    setIsVisible(true);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return prev - (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, notification.persistent, handleClose]);

  // Entrada animada
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const hasAction = notification.requireAction && (notification.actionUrl || notification.actionLabel);

  return (
    <Card
      className={cn(
        'fixed z-50 w-80 max-w-sm shadow-lg transition-all duration-300',
        positionClasses[position],
        typeColors[notification.type],
        'border-l-4 border-l-current',
        isVisible && !isExiting && enterAnimations[position],
        isExiting && exitAnimations[position]
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Barra de progresso */}
      {showProgress && !notification.persistent && duration > 0 && (
        <div className="absolute top-0 left-0 h-1 bg-current opacity-20 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="p-4">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className="flex-shrink-0 text-lg">
            {typeIcons[notification.type]}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-tight">
                {notification.title}
              </h3>
              
              {/* Badge de prioridade para notificações críticas */}
              {notification.priority === 'CRITICAL' && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                  CRÍTICO
                </Badge>
              )}
              
              {/* Botão de fechar */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-5 w-5 p-0 opacity-70 hover:opacity-100 -mt-1 -mr-1"
                aria-label="Fechar notificação"
              >
                <X size={14} />
              </Button>
            </div>

            {/* Mensagem */}
            <p className="text-sm leading-relaxed line-clamp-3 mb-2">
              {notification.message}
            </p>

            {/* Módulo/Categoria */}
            {(notification.module || notification.category) && (
              <div className="flex items-center gap-2 text-xs opacity-75 mb-2">
                {notification.module && <span>{notification.module}</span>}
                {notification.module && notification.category && <span>•</span>}
                {notification.category && <span>{notification.category}</span>}
              </div>
            )}

            {/* Ação */}
            {hasAction && (
              <Button
                onClick={handleAction}
                size="sm"
                variant="outline"
                className="w-full mt-2 bg-white/50 hover:bg-white/80"
              >
                <ExternalLink size={14} className="mr-2" />
                {notification.actionLabel || 'Ver detalhes'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Container para múltiplos toasts
interface NotificationToastContainerProps {
  notifications: Notification[];
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onClose?: (id: string) => void;
  onAction?: (id: string, action: string) => void;
}

export function NotificationToastContainer({
  notifications,
  maxToasts = 5,
  position = 'top-right',
  onClose,
  onAction
}: NotificationToastContainerProps) {
  // Mostrar apenas os mais recentes
  const visibleNotifications = notifications.slice(0, maxToasts);

  // Calcular espaçamento baseado na posição
  const isTop = position.includes('top');
  const spacing = 'gap-2';

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col',
        spacing,
        isTop ? 'top-4' : 'bottom-4',
        position.includes('right') ? 'right-4' : 'left-4'
      )}
    >
      {visibleNotifications.map((notification, index) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          position={position}
          onClose={() => onClose?.(notification.id)}
          onAction={(action) => onAction?.(notification.id, action)}
          duration={notification.persistent ? 0 : undefined}
          style={{
            animationDelay: `${index * 100}ms`
          } as React.CSSProperties}
        />
      ))}

      {/* Indicador de mais notificações */}
      {notifications.length > maxToasts && (
        <Card className="p-2 text-center bg-gray-100 border-gray-300">
          <span className="text-xs text-gray-600">
            +{notifications.length - maxToasts} mais notificações
          </span>
        </Card>
      )}
    </div>
  );
}