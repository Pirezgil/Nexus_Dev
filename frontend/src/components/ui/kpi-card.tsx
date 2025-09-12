'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  className?: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'secondary';
  onClick?: () => void;
}

const KPICard = ({
  title,
  value,
  change,
  icon: Icon,
  trend = 'neutral',
  loading = false,
  className = ''
}: KPICardProps) => {
  if (loading) {
    return (
      <Card className={cn("transition-all duration-200", className)}>
        <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
            <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
            <div className="h-3 bg-muted rounded animate-pulse w-20"></div>
          </div>
          <div className="w-12 h-12 bg-muted rounded-lg animate-pulse"></div>
        </div>
        </CardContent>
      </Card>
    );
  }

  // ✅ Design system colors
  const trendColors = {
    up: 'text-success',
    down: 'text-error',
    neutral: 'text-muted-foreground'
  };

  const variantStyles = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary', border: 'border-primary/20' },
    success: { bg: 'bg-success/10', icon: 'text-success', border: 'border-success/20' },
    warning: { bg: 'bg-warning/10', icon: 'text-warning', border: 'border-warning/20' },
    error: { bg: 'bg-error/10', icon: 'text-error', border: 'border-error/20' },
    secondary: { bg: 'bg-muted', icon: 'text-muted-foreground', border: 'border-muted' }
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn(
      "bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={cn("text-sm font-medium", trendColors[trend])}>
              {change}
            </p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center",
          iconBgColors[trend]
        )}>
          <Icon className={cn("w-6 h-6", iconColors[trend])} />
        </div>
      </div>
    </div>
  );
};

export { KPICard };
export type { KPICardProps };