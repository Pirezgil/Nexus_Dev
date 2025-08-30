'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useServices, useProfessionals, useDeleteService, useDeleteProfessional } from '@/hooks/api/use-services';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { 
  Search, 
  Plus, 
  Package, 
  Users, 
  DollarSign, 
  Clock, 
  Edit, 
  Trash2,
  Star,
  Activity
} from 'lucide-react';

function ServicesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'services' | 'professionals'>('services');
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'service' | 'professional'; name: string } | null>(null);
  
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  const servicesQuery = useServices({ 
    search: debouncedSearch,
    page: 1,
    limit: 50 
  });
  
  const professionalsQuery = useProfessionals({ 
    search: debouncedSearch,
    page: 1,
    limit: 50 
  });
  
  const deleteServiceMutation = useDeleteService();
  const deleteProfessionalMutation = useDeleteProfessional();
  
  const services = servicesQuery.data?.data || [];
  const professionals = professionalsQuery.data?.data || [];
  const loading = (activeTab === 'services' ? servicesQuery.isLoading : professionalsQuery.isLoading);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      if (itemToDelete.type === 'service') {
        await deleteServiceMutation.mutateAsync(itemToDelete.id);
      } else {
        await deleteProfessionalMutation.mutateAsync(itemToDelete.id);
      }
      setItemToDelete(null);
    } catch (error) {
      // Error handled by mutations
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}min`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}min`;
    }
  };

  const getWorkingDays = (workSchedule: Professional['workSchedule']) => {
    const days = Object.entries(workSchedule).filter(([_, schedule]) => schedule.active);
    return days.length;
  };

  const renderServicesTab = () => (
    <div className="space-y-4">
      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhum serviço encontrado</p>
            <p className="text-sm mt-2">
              {searchTerm 
                ? 'Tente ajustar os termos de busca'
                : 'Clique em "Novo Serviço" para adicionar o primeiro serviço'
              }
            </p>
          </div>
        </Card>
      ) : (
        services.map((service) => (
          <Card key={service.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {service.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    service.isActive 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {service.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {service.description && (
                  <p className="text-gray-600 mb-3">{service.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign size={16} className="text-green-500" />
                    <span className="font-medium">{formatPrice(service.price)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-blue-500" />
                    <span>{formatDuration(service.duration)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package size={16} className="text-purple-500" />
                    <span>{service.category}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>ID: {service.id.slice(-8)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/services/edit/${service.id}`)}
                >
                  <Edit size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:border-red-200"
                  onClick={() => setItemToDelete({ id: service.id, type: 'service', name: service.name })}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  const renderProfessionalsTab = () => (
    <div className="space-y-4">
      {professionals.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500">
            <Users size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhum profissional encontrado</p>
            <p className="text-sm mt-2">
              {searchTerm 
                ? 'Tente ajustar os termos de busca'
                : 'Clique em "Novo Profissional" para adicionar o primeiro profissional'
              }
            </p>
          </div>
        </Card>
      ) : (
        professionals.map((professional) => (
          <Card key={professional.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">
                      {professional.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {professional.name}
                    </h3>
                    <p className="text-sm text-gray-500">{professional.email}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    professional.isActive 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {professional.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-blue-500" />
                    <span>{professional.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity size={16} className="text-green-500" />
                    <span>{getWorkingDays(professional.workSchedule)} dias/semana</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star size={16} className="text-yellow-500" />
                    <span>{professional.specialties.length} especialidade(s)</span>
                  </div>
                </div>

                {professional.specialties.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1">
                      {professional.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/services/professionals/${professional.id}`)}
                >
                  <Edit size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:border-red-200"
                  onClick={() => setItemToDelete({ id: professional.id, type: 'professional', name: professional.name })}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout
        title="Carregando..."
        subtitle="Buscando serviços e profissionais"
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Gestão de Serviços"
      subtitle={activeTab === 'services' 
        ? `${services.length} serviços cadastrados`
        : `${professionals.length} profissionais cadastrados`
      }
    >
      <div className="space-y-6">
        {/* Action Button */}
        <div className="flex justify-end">
          <Button 
          onClick={() => router.push(
            activeTab === 'services' 
              ? '/services/new' 
              : '/services/professionals/new'
          )}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          {activeTab === 'services' ? 'Novo Serviço' : 'Novo Profissional'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('services')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="inline mr-2" size={16} />
            Serviços ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('professionals')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'professionals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="inline mr-2" size={16} />
            Profissionais ({professionals.length})
          </button>
        </nav>
      </div>

      {/* Busca */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder={`Buscar ${activeTab === 'services' ? 'serviços' : 'profissionais'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Content */}
      {activeTab === 'services' ? renderServicesTab() : renderProfessionalsTab()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {itemToDelete?.type === 'service' ? 'Serviço' : 'Profissional'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{itemToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteServiceMutation.isPending || deleteProfessionalMutation.isPending}
            >
              {(deleteServiceMutation.isPending || deleteProfessionalMutation.isPending) ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ServicesPage);