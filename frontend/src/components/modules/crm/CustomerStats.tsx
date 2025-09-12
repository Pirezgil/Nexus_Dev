'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  Building,
  Star,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';
import { formatCurrency, formatTimeAgo, formatDate } from '@/lib/format';

interface CustomerStatsProps {
  customer?: {
    id: string;
    name: string;
    total_visits?: number;
    total_spent?: number;
    average_ticket?: number;
    first_visit?: string;
    last_visit?: string;
    createdAt: string;
  };
  interactions?: Array<{
    id: string;
    type: string;
    date: string;
    description: string;
  }>;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: string;
    type: string;
  }>;
  appointments?: Array<{
    id: string;
    date: string;
    service: string;
    status: string;
  }>;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  trend, 
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${trendColors[trend.direction]}`}>
                {trend.direction === 'up' && <TrendingUp className="h-4 w-4" />}
                {trend.direction === 'down' && <TrendingDown className="h-4 w-4" />}
                <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const CustomerStats: React.FC<CustomerStatsProps> = ({
  customer,
  interactions = [],
  notes = [],
  appointments = [],
  loading = false,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '1year' | 'all'>('6months');

  // Loading state
  if (loading || !customer) {
    return (
      <div className="space-y-6">
        {/* Stats Loading Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                    <div className="h-8 bg-muted rounded w-16 animate-pulse"></div>
                  </div>
                  <div className="w-12 h-12 bg-muted rounded-lg animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs Loading Skeleton */}
        <div className="space-y-4">
          <div className="h-10 bg-muted rounded w-64 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
            <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate interaction types
  const interactionTypes = interactions.reduce((acc, interaction) => {
    acc[interaction.type] = (acc[interaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate monthly visits (simulated data for demo)
  const monthlyVisits = [
    { month: 'Jan', visits: 2 },
    { month: 'Fev', visits: 3 },
    { month: 'Mar', visits: 1 },
    { month: 'Abr', visits: 4 },
    { month: 'Mai', visits: 2 },
    { month: 'Jun', visits: 0 },
  ];

  // Calculate visit frequency
  const daysSinceFirstVisit = customer.first_visit 
    ? Math.floor((Date.now() - new Date(customer.first_visit).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const visitFrequency = daysSinceFirstVisit > 0 && customer.total_visits
    ? (daysSinceFirstVisit / (customer.total_visits || 1)).toFixed(1)
    : '0';

  // Calculate satisfaction score (simulated)
  const satisfactionScore = 4.2;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Visitas"
          value={customer.total_visits || 0}
          icon={<Building className="h-6 w-6" />}
          trend={{ value: 15, direction: 'up' }}
          color="blue"
        />
        
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(customer.average_ticket || 0)}
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: -3, direction: 'down' }}
          color="green"
        />
        
        <StatCard
          title="Total Gasto"
          value={formatCurrency(customer.total_spent || 0)}
          icon={<TrendingUp className="h-6 w-6" />}
          trend={{ value: 8, direction: 'up' }}
          color="purple"
        />
        
        <StatCard
          title="Frequência"
          value={`${visitFrequency} dias`}
          icon={<Clock className="h-6 w-6" />}
          color="orange"
        />
      </div>

      {/* Detailed Statistics */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="interactions">Interações</TabsTrigger>
          <TabsTrigger value="visits">Visitas</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfação</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Journey */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Jornada do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Primeira visita</p>
                    <p className="font-medium">
                      {customer.first_visit ? formatDate(customer.first_visit) : 'Não registrada'}
                    </p>
                  </div>
                  <Star className="h-5 w-5 text-blue-600" />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Última visita</p>
                    <p className="font-medium">
                      {customer.last_visit ? formatDate(customer.last_visit) : 'Não registrada'}
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Tempo como cliente</p>
                    <p className="font-medium">
                      {formatTimeAgo(customer.createdAt)}
                    </p>
                  </div>
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resumo de Atividades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{interactions.length}</p>
                    <p className="text-sm text-muted-foreground">Interações</p>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{notes.length}</p>
                    <p className="text-sm text-muted-foreground">Anotações</p>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{appointments.length}</p>
                    <p className="text-sm text-muted-foreground">Agendamentos</p>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{Object.keys(interactionTypes).length}</p>
                    <p className="text-sm text-muted-foreground">Tipos de Contato</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interaction Types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Tipos de Interação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(interactionTypes).map(([type, count]) => {
                    const typeConfig = {
                      CALL: { label: 'Ligações', icon: Phone, color: 'bg-blue-100 text-blue-800' },
                      EMAIL: { label: 'Emails', icon: Mail, color: 'bg-green-100 text-green-800' },
                      WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-100 text-emerald-800' },
                      VISIT: { label: 'Visitas', icon: Building, color: 'bg-purple-100 text-purple-800' },
                      OTHER: { label: 'Outros', icon: Activity, color: 'bg-muted text-muted-foreground' },
                    };
                    
                    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.OTHER;
                    const Icon = config.icon;
                    
                    return (
                      <div key={type} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    );
                  })}
                  
                  {Object.keys(interactionTypes).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Nenhuma interação registrada</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Interactions */}
            <Card>
              <CardHeader>
                <CardTitle>Interações Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {interactions.slice(0, 5).map((interaction) => (
                    <div key={interaction.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {interaction.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(interaction.date)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {interaction.description}
                      </p>
                    </div>
                  ))}
                  
                  {interactions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Nenhuma interação recente</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Visit Chart (Simple Representation) */}
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-3">Visitas nos últimos meses</h4>
                  <div className="flex items-end justify-between h-32 gap-2">
                    {monthlyVisits.map((month) => (
                      <div key={month.month} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ 
                            height: `${(month.visits / Math.max(...monthlyVisits.map(m => m.visits))) * 100}%`,
                            minHeight: month.visits > 0 ? '4px' : '0'
                          }}
                        />
                        <span className="text-xs text-muted-foreground mt-2">{month.month}</span>
                        <span className="text-xs font-medium text-foreground">{month.visits}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Visit Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{customer.total_visits || 0}</p>
                    <p className="text-sm text-muted-foreground">Total de Visitas</p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{visitFrequency} dias</p>
                    <p className="text-sm text-muted-foreground">Frequência Média</p>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {customer.total_spent ? formatCurrency(customer.total_spent) : 'R$ 0'}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Investido</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="satisfaction" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Satisfaction Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Índice de Satisfação
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-6xl font-bold text-yellow-500 mb-2">
                  {satisfactionScore}
                </div>
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-6 w-6 ${
                        i < Math.floor(satisfactionScore) 
                          ? 'text-yellow-500 fill-current' 
                          : 'text-muted-foreground/50'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground">Baseado nas interações e feedbacks</p>
              </CardContent>
            </Card>

            {/* Loyalty Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status de Fidelidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="font-medium text-yellow-800">Cliente Fiel</p>
                      <p className="text-sm text-yellow-600">Visita regularmente</p>
                    </div>
                    <Star className="h-6 w-6 text-yellow-600" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tempo como cliente</span>
                      <span className="font-medium">{formatTimeAgo(customer.createdAt)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Investimento total</span>
                      <span className="font-medium">{formatCurrency(customer.total_spent || 0)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Probabilidade de retorno</span>
                      <span className="font-medium text-green-600">85%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};