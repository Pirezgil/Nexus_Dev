'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceFormData } from '@/types';
import { servicesApi, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowLeft, Save, Package, DollarSign, Clock, Tag } from 'lucide-react';

export default function NovoServicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    price: 0,
    duration: 60, // 1 hora por padrão
    category: '',
  });

  const handleInputChange = (field: keyof ServiceFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiPost(servicesApi, '/services', formData);

      if (response.success) {
        router.push('/services');
      } else {
        console.error('Erro ao criar serviço:', response.error);
        // TODO: Mostrar toast de erro
      }
    } catch (error) {
      console.error('Erro ao criar serviço:', error);
      // TODO: Mostrar toast de erro
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.price > 0 && formData.duration > 0;

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

  return (
    <DashboardLayout
      title="Novo Serviço"
      subtitle="Cadastre um novo serviço no sistema"
    >
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
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
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
          </div>
        </Card>

        {/* Resumo do Serviço */}
        <Card className="p-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumo do Serviço
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formData.price ? `R$ ${formData.price.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
              </div>
              <p className="text-sm text-gray-600">Preço</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formData.duration ? `${Math.floor(formData.duration / 60)}h ${formData.duration % 60}min` : '0min'}
              </div>
              <p className="text-sm text-gray-600">Duração</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formData.category || 'Sem categoria'}
              </div>
              <p className="text-sm text-gray-600">Categoria</p>
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
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!isFormValid || loading}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? 'Salvando...' : 'Salvar Serviço'}
          </Button>
        </div>
        </form>
      </div>
    </DashboardLayout>
  );
}