// ERP Nexus - Executive Dashboard Page
// CORRIGIDO: Agora usa Biblioteca_visual.tsx e Design System completo

'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  RefreshCw,
  Plus,
  Download,
  Search,
  ChevronDown,
  User,
  LogOut,
  Calendar,
  Users,
  Settings
} from 'lucide-react';

// REFATORADO: Importar da nova biblioteca de componentes modular
import { 
  Button, 
  KPICard, 
  DataTable, 
  Alert, 
  Sidebar, 
  LoadingSpinner,
  Select,
  Input
} from '@shared/components/ui';

import { withAuth } from '@/components/auth/withAuth';
import { 
  useDashboardStats, 
  useRecentCustomers, 
  useTodayAppointments, 
  useAlerts,
  useRevenueChart
} from '@/hooks/api/use-dashboard';
import { useCurrentUser, usePermissions } from '@/stores/auth';
import { cn } from '@/utils';
import { SIDEBAR_ITEMS, filterSidebarItemsByPermissions } from '@/config/sidebar';
import { UserAvatar } from '@/components/ui/UserAvatar';

// Types
type TimePeriod = 'today' | 'week' | 'month' | 'quarter';

function DashboardPage() {
  const { user, displayName } = useCurrentUser();
  const permissions = usePermissions();
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Data hooks
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats(period);
  const { data: revenueChartData, isLoading: chartLoading } = useRevenueChart();
  const { data: recentCustomers } = useRecentCustomers(10);
  const { data: todayAppointments } = useTodayAppointments();
  const { data: alerts } = useAlerts();

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetchStats]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as Element)?.closest('.relative')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // Determinar saudação baseada na hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // REFATORADO: Usar configuração centralizada do sidebar
  const sidebarItems = filterSidebarItemsByPermissions(SIDEBAR_ITEMS, permissions);

  // CORRIGIDO: Configurar colunas da DataTable
  const tableColumns = [
    { key: 'name', label: 'Cliente' },
    { key: 'service', label: 'Serviço' },
    { key: 'date', label: 'Data' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          value === 'Concluído' ? 'bg-green-100 text-green-800' : 
          value === 'Agendado' ? 'bg-blue-100 text-blue-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { key: 'amount', label: 'Valor' }
  ];

  // CORRIGIDO: Dados mockados para DataTable
  const recentData = [
    { id: '1', name: 'João Silva', service: 'Consulta', date: '2025-01-15', status: 'Concluído', amount: 'R$ 150,00' },
    { id: '2', name: 'Maria Santos', service: 'Procedimento', date: '2025-01-14', status: 'Agendado', amount: 'R$ 300,00' },
    { id: '3', name: 'Pedro Costa', service: 'Avaliação', date: '2025-01-13', status: 'Concluído', amount: 'R$ 200,00' }
  ];

  // Loading state
  if (statsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          items={sidebarItems}
        />
        <div className="flex-1 p-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* CORRIGIDO: Usar Sidebar da Biblioteca_visual.tsx */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        items={sidebarItems}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* CORRIGIDO: Header conforme padrão ERP */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {`${getGreeting()}, ${displayName}!`}
              </h2>
              <p className="text-slate-600">
                Visão geral do seu negócio
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  placeholder="Buscar..."
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ 
                    backgroundColor: '#F8FAFC',
                    color: '#020617',
                    borderColor: '#D1D5DB'
                  }}
                />
              </div>
              {/* Notifications */}
              <Button variant="ghost" icon={Clock}>
                3
              </Button>
              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <UserAvatar size="sm" />
                  <span className="text-slate-900">{displayName}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {/* User Info Section */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <UserAvatar size="md" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{displayName}</h3>
                          <p className="text-sm text-slate-500">{user?.email}</p>
                          <p className="text-xs text-slate-400 capitalize">{user?.role?.toLowerCase()}</p>
                        </div>
                      </div>
                      
                      {user?.company && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Empresa:</span> {user.company.name}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Menu Options */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          window.location.href = '/settings';
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-slate-700">Meu Perfil</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          window.location.href = '/settings';
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                        <span className="text-slate-700">Configurações</span>
                      </button>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          // Implementar logout
                          console.log('Logout clicked');
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-red-50 rounded-md transition-colors text-red-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4">
                <Select 
                  value={period}
                  onChange={(value) => setPeriod(value as TimePeriod)}
                  options={[
                    { value: 'today', label: 'Hoje' },
                    { value: 'week', label: 'Semana' },
                    { value: 'month', label: 'Mês' },
                    { value: 'quarter', label: 'Trimestre' }
                  ]}
                />
                
                <Button
                  variant={autoRefresh ? 'primary' : 'ghost'}
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  Auto-refresh
                </Button>
              </div>
            </div>

            {/* CORRIGIDO: Alertas usando Alert da Biblioteca_visual */}
            {alerts && alerts.length > 0 && (
              <Alert type="info" title="Informações Importantes">
                {alerts.length} alertas requerem sua atenção
              </Alert>
            )}

            {/* CORRIGIDO: KPI Cards usando dados dos hooks */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KPICard
                title="Receita do Mês"
                value={stats?.revenue ? `R$ ${stats.revenue.current.toLocaleString()}` : "R$ 0"}
                change={stats?.revenue ? `${stats.revenue.trend > 0 ? '+' : ''}${stats.revenue.trend.toFixed(1)}%` : "0%"}
                icon={DollarSign}
                trend={stats?.revenue?.trend > 0 ? 'up' : stats?.revenue?.trend < 0 ? 'down' : 'neutral'}
                loading={statsLoading}
              />
              
              <KPICard
                title="Atendimentos Concluídos"
                value={stats?.appointments?.current?.toString() || "0"}
                change={stats?.appointments ? `${stats.appointments.trend > 0 ? '+' : ''}${stats.appointments.trend.toFixed(1)}%` : "0%"}
                icon={Calendar}
                trend={stats?.appointments?.trend > 0 ? 'up' : stats?.appointments?.trend < 0 ? 'down' : 'neutral'}
                loading={statsLoading}
              />
              
              <KPICard
                title="Novos Clientes"
                value={stats?.customers?.current?.toString() || "0"}
                change={stats?.customers ? `${stats.customers.trend > 0 ? '+' : ''}${stats.customers.trend.toFixed(1)}%` : "0%"}
                icon={Users}
                trend={stats?.customers?.trend > 0 ? 'up' : stats?.customers?.trend < 0 ? 'down' : 'neutral'}
                loading={statsLoading}
              />
              
              <KPICard
                title="Ocupação"
                value={stats?.occupancy ? `${stats.occupancy.current.toFixed(1)}%` : "0%"}
                change={stats?.occupancy ? `${stats.occupancy.trend > 0 ? '+' : ''}${stats.occupancy.trend.toFixed(1)}%` : "0%"}
                icon={TrendingUp}
                trend={stats?.occupancy?.trend > 0 ? 'up' : stats?.occupancy?.trend < 0 ? 'down' : 'neutral'}
                loading={statsLoading}
              />
            </div>

            {/* CORRIGIDO: Alert para informações importantes */}
            <Alert type="warning" title="Atenção" dismissible>
              Você tem 3 agendamentos hoje que precisam de confirmação.
            </Alert>

            {/* CORRIGIDO: Action Buttons usando Button da Biblioteca_visual */}
            <div className="flex items-center space-x-4">
              <Button 
                variant="primary" 
                icon={Plus}
              >
                Novo Agendamento
              </Button>
              <Button variant="secondary" icon={Download}>
                Exportar Relatório
              </Button>
              <Button variant="ghost" icon={RefreshCw}>
                Atualizar Dados
              </Button>
            </div>

            {/* CORRIGIDO: DataTable usando dados dos hooks */}
            <DataTable
              columns={tableColumns}
              data={recentCustomers?.length ? recentCustomers.map(customer => ({
                id: customer.id,
                name: customer.name,
                service: 'Consulta', // Default service
                date: new Date(customer.createdAt).toLocaleDateString('pt-BR'),
                status: customer.status === 'active' ? 'Ativo' : 'Inativo',
                amount: 'R$ 0,00' // Default amount
              })) : recentData}
              loading={!recentCustomers}
              onEdit={(row) => console.log('Editar', row)}
              onDelete={(row) => console.log('Excluir', row)}
              onView={(row) => console.log('Visualizar', row)}
              searchable={true}
              exportable={true}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);