'use client';

import { useState, useEffect } from 'react';
import { Appointment, Professional, Service } from '@/types';
import { agendamentoApi, servicesApi, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  DollarSign,
  Download,
  RefreshCw,
  Filter,
  Eye
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AgendaStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completionRate: number;
  totalRevenue: number;
  averageServiceDuration: number;
  busyHours: Array<{ hour: number; count: number }>;
  professionalStats: Array<{
    professional: Professional;
    appointments: number;
    completionRate: number;
    revenue: number;
  }>;
  serviceStats: Array<{
    service: Service;
    appointments: number;
    revenue: number;
  }>;
}

export default function RelatoriosAgendaPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgendaStats | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [selectedPeriod, selectedWeek, selectedProfessional]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Carregar dados base
      const [professionalsRes, servicesRes] = await Promise.all([
        apiGet<Professional[]>(servicesApi, '/professionals'),
        apiGet<Service[]>(servicesApi, '/services'),
      ]);

      if (professionalsRes.success) setProfessionals(professionalsRes.data);
      if (servicesRes.success) setServices(servicesRes.data);

      // Calcular período de dados
      const startDate = startOfWeek(selectedWeek, { locale: ptBR });
      const endDate = endOfWeek(selectedWeek, { locale: ptBR });

      // Carregar agendamentos do período
      const appointmentsRes = await apiGet<Appointment[]>(
        agendamentoApi,
        '/appointments',
        {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          professionalId: selectedProfessional !== 'all' ? selectedProfessional : undefined,
        }
      );

      if (appointmentsRes.success) {
        const appointments = appointmentsRes.data;
        const calculatedStats = calculateStats(appointments, professionalsRes.data, servicesRes.data);
        setStats(calculatedStats);
      }
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (
    appointments: Appointment[], 
    professionals: Professional[], 
    services: Service[]
  ): AgendaStats => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    const cancelled = appointments.filter(a => a.status === 'CANCELLED').length;
    const noShow = appointments.filter(a => a.status === 'NO_SHOW').length;
    
    // Calcular receita dos agendamentos completados
    const revenue = appointments
      .filter(a => a.status === 'COMPLETED')
      .reduce((sum, appointment) => {
        const service = services.find(s => s.id === appointment.serviceId);
        return sum + (Number(service?.price) || 0);
      }, 0);

    // Calcular duração média
    const avgDuration = services.reduce((sum, service) => sum + service.duration, 0) / services.length;

    // Horários mais movimentados
    const hourCounts: { [key: number]: number } = {};
    appointments.forEach(appointment => {
      const hour = new Date(appointment.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const busyHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Stats por profissional
    const professionalStats = professionals.map(professional => {
      const profAppointments = appointments.filter(a => a.professionalId === professional.id);
      const profCompleted = profAppointments.filter(a => a.status === 'COMPLETED').length;
      const profRevenue = profAppointments
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, appointment) => {
          const service = services.find(s => s.id === appointment.serviceId);
          return sum + (Number(service?.price) || 0);
        }, 0);

      return {
        professional,
        appointments: profAppointments.length,
        completionRate: profAppointments.length > 0 ? (profCompleted / profAppointments.length) * 100 : 0,
        revenue: profRevenue,
      };
    }).sort((a, b) => b.appointments - a.appointments);

    // Stats por serviço
    const serviceStats = services.map(service => {
      const serviceAppointments = appointments.filter(a => a.serviceId === service.id);
      const serviceRevenue = serviceAppointments
        .filter(a => a.status === 'COMPLETED')
        .length * Number(service.price);

      return {
        service,
        appointments: serviceAppointments.length,
        revenue: serviceRevenue,
      };
    }).sort((a, b) => b.appointments - a.appointments);

    return {
      totalAppointments: total,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      totalRevenue: revenue,
      averageServiceDuration: avgDuration,
      busyHours,
      professionalStats,
      serviceStats,
    };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Dados para gráfico de agendamentos por dia da semana
  const weekDaysData = {
    labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    datasets: [
      {
        label: 'Agendamentos',
        data: [2, 8, 12, 15, 18, 14, 6], // Dados simulados
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Dados para gráfico de horários mais movimentados
  const busyHoursData = stats ? {
    labels: stats.busyHours.map(h => `${h.hour}:00`),
    datasets: [
      {
        label: 'Agendamentos por Horário',
        data: stats.busyHours.map(h => h.count),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
      },
    ],
  } : null;

  // Dados para gráfico de status dos agendamentos
  const statusData = stats ? {
    labels: ['Concluídos', 'Cancelados', 'Faltou'],
    datasets: [
      {
        data: [stats.completedAppointments, stats.cancelledAppointments, stats.noShowAppointments],
        backgroundColor: [
          '#10B981', // Verde
          '#EF4444', // Vermelho
          '#6B7280', // Cinza
        ],
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (loading) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Carregando...
            </h1>
            <p className="text-slate-600">
              Gerando relatórios de agendamento
            </p>
          </div>
        </div>

        {/* Loading Content */}
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Relatórios de Agendamento
          </h1>
          <p className="text-slate-600">
            Análise detalhada dos agendamentos
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          
          <Button className="flex items-center gap-2">
            <Download size={16} />
            Exportar
          </Button>
        </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-400" size={20} />
            <label className="text-sm font-medium text-gray-700">Semana:</label>
            <Input
              type="week"
              value={format(selectedWeek, 'yyyy-\\WII')}
              onChange={(e) => {
                const [year, week] = e.target.value.split('-W');
                const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                setSelectedWeek(date);
              }}
              className="w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Users className="text-gray-400" size={20} />
            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">Todos os Profissionais</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="text-blue-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</p>
                <p className="text-sm text-gray-500">Total de Agendamentos</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatPercent(stats.completionRate)}</p>
                <p className="text-sm text-gray-500">Taxa de Conclusão</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="text-purple-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-gray-500">Receita Total</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="text-orange-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{Math.round(stats.averageServiceDuration)}min</p>
                <p className="text-sm text-gray-500">Duração Média</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agendamentos por Dia */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Agendamentos por Dia da Semana</h2>
          </div>
          <div className="h-80">
            <Bar data={weekDaysData} options={chartOptions} />
          </div>
        </Card>

        {/* Horários mais Movimentados */}
        {busyHoursData && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-green-600" size={20} />
              <h2 className="text-lg font-semibold">Horários Mais Movimentados</h2>
            </div>
            <div className="h-80">
              <Bar data={busyHoursData} options={chartOptions} />
            </div>
          </Card>
        )}

        {/* Status dos Agendamentos */}
        {statusData && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold">Status dos Agendamentos</h2>
            </div>
            <div className="h-80 flex items-center justify-center">
              <div className="w-64 h-64">
                <Doughnut data={statusData} options={chartOptions} />
              </div>
            </div>
          </Card>
        )}

        {/* Performance por Profissional */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-orange-600" size={20} />
            <h2 className="text-lg font-semibold">Performance por Profissional</h2>
          </div>
          
          {stats && (
            <div className="space-y-4">
              {stats.professionalStats.slice(0, 5).map((profStat, index) => (
                <div key={profStat.professional.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{profStat.professional.name}</p>
                      <p className="text-sm text-gray-500">
                        {profStat.appointments} agendamentos • {formatPercent(profStat.completionRate)} conclusão
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(profStat.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}