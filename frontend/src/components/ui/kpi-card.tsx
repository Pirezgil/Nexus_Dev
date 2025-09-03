'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  className?: string;
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
      <div className={cn(
        "bg-white p-6 rounded-lg shadow-sm border animate-pulse",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const iconBgColors = {
    up: 'bg-green-100',
    down: 'bg-red-100',
    neutral: 'bg-blue-100'
  };

  const iconColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-blue-600'
  };

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