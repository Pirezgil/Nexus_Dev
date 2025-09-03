// ERP Nexus - Dashboard Components Index
// Exports para todos os componentes do dashboard

// ====================================
// KPI COMPONENTS - REMOVIDO
// ====================================
// REFATORADO: KPICard agora deve ser importado da nova biblioteca modular
// import { KPICard } from '@/components/ui';

// ====================================
// CHART COMPONENTS
// ====================================
export { 
  RevenueChart, 
  RevenueChartWithStats 
} from './RevenueChart';

export { 
  AppointmentsChart, 
  AppointmentsChartWithStats, 
  SimpleAppointmentsChart 
} from './AppointmentsChart';

// ====================================
// SCHEDULE COMPONENTS
// ====================================
export { 
  TodaySchedule, 
  SimpleTodaySchedule 
} from './TodaySchedule';

// ====================================
// ALERT COMPONENTS
// ====================================
export { 
  AlertsPanel, 
  SimpleAlertsBanner 
} from './AlertsPanel';

// ====================================
// ACTION COMPONENTS
// ====================================
export { 
  QuickActions, 
  CompactQuickActions, 
  FloatingAction 
} from './QuickActions';

// ====================================
// RECENT ACTIVITY COMPONENT
// ====================================
export interface RecentActivity {
  id: string;
  type: 'appointment' | 'customer' | 'service' | 'system';
  title: string;
  description: string;
  time: string;
  icon?: React.ElementType;
  user?: string;
  metadata?: Record<string, any>;
}

export interface RecentActivityProps {
  activities: RecentActivity[];
  limit?: number;
  onViewAll?: () => void;
  className?: string;
}