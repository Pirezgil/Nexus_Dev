'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceFormData, ServiceStatus } from '@/types';
import { useService, useUpdateService } from '@/hooks/api/use-services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Save, Package, DollarSign, Clock, Tag, Loader2 } from 'lucide-react';

interface EditarServicoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditarServicoPage({ params }: EditarServicoPageProps) {
  const router = useRouter();
  const { id } = use(params);
  
  const { data: service, isLoading, error } = useService(id);
  const updateServiceMutation = useUpdateService();
  
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    price: '0.00', // ✅ DECIMAL PRECISION: Changed from number to string
    duration: 60,
    category: '',
    status: 'ACTIVE',
  });

  // Popular form quando serviço carrega
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: service.price || '0.00', // ✅ DECIMAL PRECISION: Ensure string format
        duration: service.duration || 60,
        category: service.category || '',
        status: service.status || 'ACTIVE',
      });
    }
  }, [service]);

  const handleInputChange = (field: keyof ServiceFormData, value: string | number | ServiceStatus) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePriceChange = (value: string) => {
    // ✅ DECIMAL PRECISION: Handle price as string with proper validation
    const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      handleInputChange('price', numericValue.toFixed(2));
    } else {
      handleInputChange('price', '0.00');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateServiceMutation.mutateAsync({
        id,
        data: formData
      });
      router.push('/services');
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
    }
  };

  const isFormValid = formData.name.trim() && parseFloat(formData.price) > 0 && formData.duration > 0;

  const commonCategories = [
    'Beleza',
    'Estética',
    'Saúde',
    'Bem-estar',
    'Massagem',
    'Cabelo',
    'Unhas',
    'Pele',
    'Corpo',
    'Relaxamento',
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin" size={20} />
          Carregando serviço...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 mb-4">Erro ao carregar serviço</div>
          <Button onClick={() => router.back()}>
            <ArrowLeft size={16} className="mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Serviço não encontrado</div>
          <Button onClick={() => router.back()}>
            <ArrowLeft size={16} className="mr-2" />
            Voltar
          </Button>
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
            Editar Serviço
          </h1>
          <p className="text-slate-600">
            Edite as informações do serviço "{service.name}"
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <div className="flex items-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Voltar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Informações do Serviço</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Serviço *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ex: Corte de Cabelo Feminino"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descreva os detalhes do serviço..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preço *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={typeof formData.price === 'string' ? formData.price.replace('.', ',') : '0,00'}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Valor em reais (R$)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duração *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                  placeholder="60"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Duração em minutos
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    placeholder="Digite ou selecione uma categoria"
                    className="pl-10"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {commonCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleInputChange('category', category)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.category === category
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status do Serviço
              </label>
              <select
                value={formData.status || 'ACTIVE'}
                onChange={(e) => handleInputChange('status', e.target.value as ServiceStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="MAINTENANCE">Em Manutenção</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Serviços inativos ou em manutenção não aparecem para agendamento
              </p>
            </div>
          </div>
        </Card>

        {/* Resumo do Serviço */}
        <Card className="p-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumo do Serviço
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formData.price ? `R$ ${Number(formData.price).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
              </div>
              <p className="text-sm text-gray-600">Preço</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formData.duration ? `${Math.floor(Number(formData.duration) / 60)}h ${Number(formData.duration) % 60}min` : '0min'}
              </div>
              <p className="text-sm text-gray-600">Duração</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formData.category || 'Sem categoria'}
              </div>
              <p className="text-sm text-gray-600">Categoria</p>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                formData.status === 'ACTIVE' ? 'text-green-600' : 
                formData.status === 'INACTIVE' ? 'text-red-600' : 
                'text-yellow-600'
              }`}>
                {formData.status === 'ACTIVE' ? 'Ativo' : 
                 formData.status === 'INACTIVE' ? 'Inativo' : 
                 'Em Manutenção'}
              </div>
              <p className="text-sm text-gray-600">Status</p>
            </div>
          </div>

          {formData.name && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">{formData.name}</h4>
              {formData.description && (
                <p className="text-gray-600 text-sm mt-1">{formData.description}</p>
              )}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={updateServiceMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!isFormValid || updateServiceMutation.isPending}
            className="flex items-center gap-2"
          >
            {updateServiceMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {updateServiceMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
        </form>
      </div>
    </div>
  );
}