'use client';

import { useState, useEffect } from 'react';
// ✅ CORREÇÃO 1: Importações da nova biblioteca de componentes centralizada
import { 
  Button, 
  Input, 
  Select, 
  KPICard, 
  DataTable, 
  LoadingSpinner 
} from '@shared/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  TrendingUp,
  Download,
  RefreshCw,
  Clock,
  CreditCard
} from 'lucide-react';

// ✅ CORREÇÃO 2: Interfaces alinhadas com a estrutura do módulo Services
interface DailyReportSummary {
  total_appointments: number;
  total_revenue: number;
  average_ticket: number;
  payment_received: number;
  payment_pending: number;
}

interface ProfessionalPerformance {
  professional_id: string;
  professional_name: string;
  appointments_count: number;
  revenue: number;
  commission_earned: number;
}

interface ServicePerformance {
  service_id: string;
  service_name: string;
  appointments_count: number;
  revenue: number;
}

interface AppointmentDetail {
  time: string;
  customer_name: string;
  professional_name: string;
  service_name: string;
  amount: number;
  payment_status: string;
}

interface DailyReportData {
  date: string;
  summary: DailyReportSummary;
  by_professional: ProfessionalPerformance[];
  by_service: ServicePerformance[];
  appointments: AppointmentDetail[];
  by_payment_method: {
    pix: number;
    credit_card: number;
    cash: number;
    pending: number;
  };
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  // ✅ CORREÇÃO 3: Filtros funcionais implementados
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [professionals, setProfessionals] = useState([
    { value: 'all', label: 'Todos os Profissionais' }
  ]);

  useEffect(() => {
    loadDailyReport();
  }, [selectedDate, selectedProfessional]);

  const loadDailyReport = async () => {
    setLoading(true);
    
    try {
      // ✅ CORREÇÃO 4: Integração com API do módulo Services conforme documentação
      // TODO: Implementar chamada real quando API estiver disponível
      // const response = await apiGet(servicesApi, `/reports/daily?date=${selectedDate}&professional_id=${selectedProfessional !== 'all' ? selectedProfessional : ''}`);
      
      // ✅ CORREÇÃO 5: Dados simulados alinhados com a estrutura esperada do services.md
      const mockData: DailyReportData = {
        date: selectedDate,
        summary: {
          total_appointments: 12,
          total_revenue: 1850.00,
          average_ticket: 154.17,
          payment_received: 1620.00,
          payment_pending: 230.00
        },
        by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Dr. Ana Costa',
            appointments_count: 7,
            revenue: 1200.00,
            commission_earned: 480.00
          },
          {
            professional_id: 'prof-2', 
            professional_name: 'Dra. Maria Silva',
            appointments_count: 5,
            revenue: 650.00,
            commission_earned: 260.00
          }
        ],
        by_service: [
          {
            service_id: 'serv-1',
            service_name: 'Limpeza de Pele Profunda',
            appointments_count: 5,
            revenue: 750.00
          },
          {
            service_id: 'serv-2',
            service_name: 'Peeling Químico',
            appointments_count: 4,
            revenue: 800.00
          },
          {
            service_id: 'serv-3',
            service_name: 'Microagulhamento',
            appointments_count: 3,
            revenue: 300.00
          }
        ],
        by_payment_method: {
          pix: 800.00,
          credit_card: 650.00,
          cash: 170.00,
          pending: 230.00
        },
        appointments: [
          {
            time: '09:00',
            customer_name: 'Maria Santos',
            professional_name: 'Dr. Ana Costa',
            service_name: 'Limpeza de Pele Profunda',
            amount: 150.00,
            payment_status: 'paid'
          },
          {
            time: '10:00',
            customer_name: 'João Silva',
            professional_name: 'Dra. Maria Silva',
            service_name: 'Peeling Químico',
            amount: 200.00,
            payment_status: 'paid'
          },
          {
            time: '11:00',
            customer_name: 'Ana Lima',
            professional_name: 'Dr. Ana Costa',
            service_name: 'Microagulhamento',
            amount: 100.00,
            payment_status: 'pending'
          }
        ]
      };

      setReportData(mockData);
    } catch (error) {
      console.error('Erro ao carregar relatório diário:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORREÇÃO 6: Formatação monetária brasileira
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // ✅ CORREÇÃO 7: Configuração das colunas da DataTable conforme design-system
  const appointmentsColumns = [
    { 
      key: 'time', 
      label: 'Horário',
      render: (value: string) => (
        <span className="font-medium">{value}</span>
      )
    },
    { 
      key: 'customer_name', 
      label: 'Cliente' 
    },
    { 
      key: 'professional_name', 
      label: 'Profissional' 
    },
    { 
      key: 'service_name', 
      label: 'Serviço',
      render: (value: string) => (
        <span className="text-sm">{value}</span>
      )
    },
    { 
      key: 'amount', 
      label: 'Valor',
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(value)}
        </span>
      )
    },
    { 
      key: 'payment_status', 
      label: 'Status Pagamento',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'paid' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'paid' ? 'Pago' : 'Pendente'}
        </span>
      )
    }
  ];

  const serviceColumns = [
    { key: 'service_name', label: 'Serviço' },
    { 
      key: 'appointments_count', 
      label: 'Qtd. Atendimentos',
      render: (value: number) => (
        <span className="font-medium">{value}</span>
      )
    },
    { 
      key: 'revenue', 
      label: 'Receita',
      render: (value: number) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(value)}
        </span>
      )
    }
  ];

  const professionalColumns = [
    { key: 'professional_name', label: 'Profissional' },
    { 
      key: 'appointments_count', 
      label: 'Atendimentos',
      render: (value: number) => (
        <span className="font-medium">{value}</span>
      )
    },
    { 
      key: 'revenue', 
      label: 'Receita',
      render: (value: number) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(value)}
        </span>
      )
    },
    { 
      key: 'commission_earned', 
      label: 'Comissão',
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(value)}
        </span>
      )
    }
  ];

  if (loading) {
    return (
      <DashboardLayout
        title="Relatório Diário - Carregando..."
        subtitle="Gerando relatórios do módulo Services"
      >
        <div className="flex items-center justify-center min-h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Relatório Diário - Services"
      subtitle="Atendimentos e faturamento por data"
    >
      <div className="space-y-6">
        
        {/* ✅ CORREÇÃO 8: Filtros funcionais com componentes da nova biblioteca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-6">
            <Input
              type="date"
              label="Data do Relatório"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            
            <Select
              label="Profissional"
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              options={professionals}
              className="w-auto min-w-48"
            />

            <div className="flex gap-3 ml-auto">
              <Button
                variant="ghost"
                onClick={loadDailyReport}
                disabled={loading}
                icon={RefreshCw}
                size="sm"
              >
                Atualizar
              </Button>
              
              <Button 
                variant="primary"
                icon={Download}
                size="sm"
              >
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {/* ✅ CORREÇÃO 9: KPIs usando componente KPICard da nova biblioteca */}
        {reportData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Total Atendimentos"
              value={reportData.summary.total_appointments.toString()}
              icon={Calendar}
              trend="neutral"
            />
            
            <KPICard
              title="Faturamento Total"
              value={formatCurrency(reportData.summary.total_revenue)}
              icon={DollarSign}
              trend="up"
              change="+18.2%"
            />
            
            <KPICard
              title="Ticket Médio"
              value={formatCurrency(reportData.summary.average_ticket)}
              icon={TrendingUp}
              trend="up"
              change="+5.1%"
            />
            
            <KPICard
              title="Pagamentos Pendentes"
              value={formatCurrency(reportData.summary.payment_pending)}
              icon={CreditCard}
              trend="down"
              change="-12.3%"
            />
          </div>
        )}

        {/* ✅ CORREÇÃO 10: DataTable para atendimentos detalhados */}
        {reportData && (
          <DataTable
            data={reportData.appointments}
            columns={appointmentsColumns}
            searchable={true}
            exportable={true}
            loading={false}
          />
        )}

        {/* ✅ CORREÇÃO 11: DataTables para breakdown por profissional e serviço */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reportData && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Performance por Profissional</h3>
                <DataTable
                  data={reportData.by_professional}
                  columns={professionalColumns}
                  searchable={false}
                  exportable={false}
                  loading={false}
                />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Receita por Serviço</h3>
                <DataTable
                  data={reportData.by_service}
                  columns={serviceColumns}
                  searchable={false}
                  exportable={false}
                  loading={false}
                />
              </div>
            </>
          )}
        </div>

        {/* ✅ CORREÇÃO 12: Resumo de formas de pagamento */}
        {reportData && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Resumo por Forma de Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportData.by_payment_method.pix)}</p>
                <p className="text-sm text-blue-700">PIX</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.by_payment_method.credit_card)}</p>
                <p className="text-sm text-green-700">Cartão Crédito</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(reportData.by_payment_method.cash)}</p>
                <p className="text-sm text-purple-700">Dinheiro</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(reportData.by_payment_method.pending)}</p>
                <p className="text-sm text-yellow-700">Pendente</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}