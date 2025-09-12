'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface NotificationBellProps {
  unreadCount: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
}

export function NotificationBell({
  unreadCount = 0,
  onClick,
  size = 'md',
  showBadge = true,
  className,
  variant = 'ghost'
}: NotificationBellProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  const hasUnread = unreadCount > 0;

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={onClick}
      className={cn(
        sizeClasses[size],
        'relative transition-all duration-200',
        hasUnread && 'text-blue-600 dark:text-blue-400',
        className
      )}
      aria-label={`Notificações ${hasUnread ? `(${unreadCount} não lidas)` : ''}`}
    >
      <Bell 
        size={iconSizes[size]} 
        className={cn(
          'transition-transform duration-200',
          hasUnread && 'animate-pulse'
        )}
      />
      
      {showBadge && hasUnread && (
        <Badge
          variant="destructive"
          className={cn(
            'absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold',
            'animate-in zoom-in-50 duration-200',
            size === 'sm' && 'h-4 w-4 text-[10px] -top-1 -right-1',
            size === 'lg' && 'h-6 w-6 -top-3 -right-3'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}