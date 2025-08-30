import { LucideIcon } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend?: TrendDirection;
  loading?: boolean;
}