'use client';

import { useState } from 'react';
import { CustomerFilters } from '@/hooks/api/use-customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { X, Filter, Calendar, Tag, User, Search } from 'lucide-react';

interface AdvancedFiltersProps {
  filters: CustomerFilters;
  onFiltersChange: (filters: CustomerFilters) => void;
  onClose: () => void;
  availableTags?: string[];
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose,
  availableTags = [],
}) => {
  const [localFilters, setLocalFilters] = useState<CustomerFilters>(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClearFilters = () => {
    const clearedFilters: CustomerFilters = {
      search: '',
      status: undefined,
      tags: [],
      dateRange: undefined,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
  };

  const handleTagToggle = (tag: string) => {
    setLocalFilters(prev => ({
      ...prev,
      tags: prev.tags?.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...(prev.tags || []), tag],
    }));
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      dateRange: {
        start: field === 'start' ? value : prev.dateRange?.start || '',
        end: field === 'end' ? value : prev.dateRange?.end || '',
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Filter className="text-blue-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">
                Filtros Avançados
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Busca por Texto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline mr-2" size={16} />
                Buscar por texto
              </label>
              <Input
                value={localFilters.search || ''}
                onChange={(e) => setLocalFilters(prev => ({ 
                  ...prev, 
                  search: e.target.value 
                }))}
                placeholder="Nome, email, telefone ou documento..."
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Digite qualquer termo para buscar em todos os campos do cliente
              </p>
            </div>

            {/* Status do Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <User className="inline mr-2" size={16} />
                Status do Cliente
              </label>
              <div className="flex gap-2">
                <Button
                  variant={!localFilters.status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters(prev => ({ 
                    ...prev, 
                    status: undefined 
                  }))}
                >
                  Todos
                </Button>
                <Button
                  variant={localFilters.status === 'ACTIVE' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters(prev => ({ 
                    ...prev, 
                    status: 'ACTIVE' 
                  }))}
                >
                  Ativos
                </Button>
                <Button
                  variant={localFilters.status === 'INACTIVE' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters(prev => ({ 
                    ...prev, 
                    status: 'INACTIVE' 
                  }))}
                >
                  Inativos
                </Button>
              </div>
            </div>

            {/* Filtro por Tags */}
            {availableTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Tag className="inline mr-2" size={16} />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        localFilters.tags?.includes(tag)
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Tag size={12} />
                      {tag}
                    </button>
                  ))}
                </div>
                {localFilters.tags && localFilters.tags.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {localFilters.tags.length} tag(s) selecionada(s)
                  </p>
                )}
              </div>
            )}

            {/* Período de Cadastro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Calendar className="inline mr-2" size={16} />
                Período de Cadastro
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Data inicial
                  </label>
                  <Input
                    type="date"
                    value={localFilters.dateRange?.start || ''}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Data final
                  </label>
                  <Input
                    type="date"
                    value={localFilters.dateRange?.end || ''}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Resumo dos Filtros Ativos */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Resumo dos Filtros
              </h3>
              <div className="space-y-1 text-sm text-gray-600">
                {localFilters.search && (
                  <div>• Busca: "{localFilters.search}"</div>
                )}
                {localFilters.status && (
                  <div>• Status: {localFilters.status === 'ACTIVE' ? 'Ativos' : 'Inativos'}</div>
                )}
                {localFilters.tags && localFilters.tags.length > 0 && (
                  <div>• Tags: {localFilters.tags.join(', ')}</div>
                )}
                {localFilters.dateRange && (localFilters.dateRange.start || localFilters.dateRange.end) && (
                  <div>
                    • Período: {localFilters.dateRange.start || 'início'} até {localFilters.dateRange.end || 'hoje'}
                  </div>
                )}
                {!localFilters.search && 
                 !localFilters.status && 
                 (!localFilters.tags || localFilters.tags.length === 0) && 
                 (!localFilters.dateRange || (!localFilters.dateRange.start && !localFilters.dateRange.end)) && (
                  <div className="text-gray-500 italic">Nenhum filtro aplicado</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="text-gray-600"
            >
              Limpar Tudo
            </Button>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex items-center gap-2"
              >
                <Filter size={16} />
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};