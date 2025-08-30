'use client';

import { useState, useEffect } from 'react';
import { CompletedAppointment, Customer, Professional, Service } from '@/types';
import { servicesApi, apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Plus, 
  Calendar, 
  User, 
  Package, 
  DollarSign, 
  Clock, 
  Image, 
  FileImage,
  Eye,
  Download
} from 'lucide-react';

export default function AtendimentosPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<CompletedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadAppointments();
  }, [searchTerm, dateFilter]);

  const loadAppointments = async () => {
    setLoading(true);
    
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (dateFilter) params.date = dateFilter;

      const response = await apiGet<CompletedAppointment[]>(
        servicesApi,
        '/appointments/completed',
        params
      );

      if (response.success) {
        setAppointments(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar atendimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatDuration = (start: string, end: string) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffInMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}min`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}min`;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      PAID: 'bg-green-100 text-green-800 border-green-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels = {
      PAID: 'Pago',
      PENDING: 'Pendente',
      CANCELLED: 'Cancelado',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      CASH: 'Dinheiro',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT_CARD: 'Cartão de Débito',
      PIX: 'PIX',
      OTHER: 'Outro',
    };
    return labels[method as keyof typeof labels] || method;
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Carregando..."
        subtitle="Buscando histórico de atendimentos"
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Histórico de Atendimentos"
      subtitle={`${filteredAppointments.length} atendimentos realizados`}
    >
      <div className="space-y-6">
          <Button 
            onClick={() => router.push('/services/atendimentos/novo')}
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Atendimento
          </Button>
        </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Busca */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Buscar por cliente, profissional ou serviço..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro de Data */}
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-400" size={20} />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </Card>

      {/* Lista de Atendimentos */}
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhum atendimento encontrado</p>
              <p className="text-sm mt-2">
                {searchTerm || dateFilter
                  ? 'Tente ajustar os filtros de busca'
                  : 'Registre o primeiro atendimento realizado'
                }
              </p>
            </div>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <Card key={appointment.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {appointment.service.name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(appointment.paymentStatus)}`}>
                      {getPaymentStatusLabel(appointment.paymentStatus)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-blue-500" />
                      <span>{appointment.customer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-purple-500" />
                      <span>{appointment.professional.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-green-500" />
                      <span>{formatDuration(appointment.startTime, appointment.endTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-red-500" />
                      <span className="font-medium">{formatPrice(appointment.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <span>{formatDateTime(appointment.startTime)} - {formatDateTime(appointment.endTime)}</span>
                    <span>Pagamento: {getPaymentMethodLabel(appointment.paymentMethod)}</span>
                  </div>

                  {appointment.observations && (
                    <div className="bg-gray-50 p-3 rounded-lg mb-4">
                      <p className="text-sm text-gray-700">
                        <strong>Observações:</strong> {appointment.observations}
                      </p>
                    </div>
                  )}

                  {/* Fotos do Atendimento */}
                  {appointment.photos && appointment.photos.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Image size={16} />
                        Fotos ({appointment.photos.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {appointment.photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={photo.thumbnailUrl || photo.url}
                                alt={photo.originalName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            
                            {/* Overlay com ações */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white/90 text-gray-700 hover:bg-white"
                                onClick={() => window.open(photo.url, '_blank')}
                              >
                                <Eye size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white/90 text-gray-700 hover:bg-white"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = photo.url;
                                  link.download = photo.originalName;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                              >
                                <Download size={14} />
                              </Button>
                            </div>
                            
                            {/* Badge do tipo de foto */}
                            <div className="absolute top-1 left-1">
                              <span className={`text-xs px-1 py-0.5 rounded text-white font-medium ${
                                photo.type === 'BEFORE' ? 'bg-blue-500' :
                                photo.type === 'AFTER' ? 'bg-green-500' :
                                'bg-orange-500'
                              }`}>
                                {photo.type === 'BEFORE' ? 'Antes' :
                                 photo.type === 'AFTER' ? 'Depois' : 'Durante'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/services/atendimentos/${appointment.id}`)}
                  >
                    Ver Detalhes
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}