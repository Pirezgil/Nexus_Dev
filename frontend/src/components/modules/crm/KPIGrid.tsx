'use client';

import React from 'react';
import { KPICard } from '@/components/ui/kpi-card';
import { useCustomerStats } from '@/hooks/api/use-customers';
import { Users, UserCheck, Calendar, DollarSign } from 'lucide-react';

export const KPIGrid: React.FC = () => {
  const { data: stats, isLoading } = useCustomerStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Total de Clientes"
        value={stats?.total || 0}
        change={stats?.growth}
        trend={stats?.growth && stats.growth > 0 ? 'up' : stats?.growth && stats.growth < 0 ? 'down' : 'neutral'}
        icon={Users}
        loading={isLoading}
        variant="primary"
      />
      
      <KPICard
        title="Clientes Ativos"
        value={stats?.active || 0}
        change={15} // Mockado por enquanto
        trend="up"
        icon={UserCheck}
        loading={isLoading}
        variant="success"
      />
      
      <KPICard
        title="Novos este Mês"
        value={stats?.newThisMonth || 0}
        change={-3}
        trend="down"
        icon={Calendar}
        loading={isLoading}
        variant="warning"
      />
      
      <KPICard
        title="Receita Total"
        value={`R$ ${((stats?.total || 0) * 250).toLocaleString('pt-BR')}`} // Estimativa
        change={8}
        trend="up"
        icon={DollarSign}
        loading={isLoading}
        variant="success"
      />
    </div>
  );
};