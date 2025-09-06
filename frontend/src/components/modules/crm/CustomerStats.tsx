'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerStats } from '@/hooks/api/use-customers';
import { Users, UserCheck, UserPlus, TrendingUp } from 'lucide-react';

export function CustomerStats() {
  const { data: stats, isLoading } = useCustomerStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats?.overview) return null;

  const { overview } = stats;

  const statsCards = [
    {
      title: "Total de Clientes",
      value: (overview.totalCustomers || 0).toLocaleString(),
      icon: Users,
      description: "Clientes cadastrados",
    },
    {
      title: "Clientes Ativos",
      value: (overview.activeCustomers || 0).toLocaleString(),
      icon: UserCheck,
      description: overview.totalCustomers > 0 
        ? `${((overview.activeCustomers / overview.totalCustomers) * 100).toFixed(1)}% do total`
        : "0% do total",
      color: "text-green-600",
    },
    {
      title: "Prospects",
      value: (overview.prospectCustomers || 0).toLocaleString(),
      icon: UserPlus,
      description: overview.totalCustomers > 0 
        ? `${((overview.prospectCustomers / overview.totalCustomers) * 100).toFixed(1)}% do total`
        : "0% do total",
      color: "text-blue-600",
    },
    {
      title: "Interações",
      value: (overview.totalInteractions || 0).toLocaleString(),
      icon: TrendingUp,
      description: overview.totalCustomers > 0 
        ? `${(overview.averageInteractionsPerCustomer || 0).toFixed(1)} por cliente`
        : "0 por cliente",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {statsCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className={`text-xs ${stat.color || 'text-muted-foreground'}`}>
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}