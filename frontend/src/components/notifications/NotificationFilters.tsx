'use client';

import React, { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { NotificationFilters as INotificationFilters } from '../../types/notification';
import { cn } from '../../lib/utils';

interface NotificationFiltersProps {
  onFiltersChange: (filters: INotificationFilters) => void;
  onReset: () => void;
  className?: string;
}

export function NotificationFilters({ 
  onFiltersChange, 
  onReset,
  className 
}: NotificationFiltersProps) {
  const [filters, setFilters] = useState<INotificationFilters>({});
  const [datePickerOpen, setDatePickerOpen] = useState<'from' | 'to' | null>(null);

  const handleFilterChange = (key: keyof INotificationFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onReset();
  };

  const removeFilter = (key: keyof INotificationFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = Object.keys(filters).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header com contador e reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Filtros</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs"
          >
            Limpar tudo
          </Button>
        )}
      </div>

      {/* Filtros ativos como badges removíveis */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.read !== undefined && (
            <Badge variant="outline" className="gap-1">
              {filters.read ? 'Lidas' : 'Não lidas'}
              <X 
                size={12} 
                className="cursor-pointer hover:text-red-500" 
                onClick={() => removeFilter('read')} 
              />
            </Badge>
          )}
          
          {filters.type && (
            <Badge variant="outline" className="gap-1">
              Tipo: {Array.isArray(filters.type) ? filters.type.join(', ') : filters.type}
              <X 
                size={12} 
                className="cursor-pointer hover:text-red-500" 
                onClick={() => removeFilter('type')} 
              />
            </Badge>
          )}
          
          {filters.priority && (
            <Badge variant="outline" className="gap-1">
              Prioridade: {Array.isArray(filters.priority) ? filters.priority.join(', ') : filters.priority}
              <X 
                size={12} 
                className="cursor-pointer hover:text-red-500" 
                onClick={() => removeFilter('priority')} 
              />
            </Badge>
          )}
          
          {filters.module && (
            <Badge variant="outline" className="gap-1">
              Módulo: {Array.isArray(filters.module) ? filters.module.join(', ') : filters.module}
              <X 
                size={12} 
                className="cursor-pointer hover:text-red-500" 
                onClick={() => removeFilter('module')} 
              />
            </Badge>
          )}
          
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="outline" className="gap-1">
              Período: {filters.dateFrom ? format(filters.dateFrom, 'dd/MM', { locale: ptBR }) : '...'} - {filters.dateTo ? format(filters.dateTo, 'dd/MM', { locale: ptBR }) : '...'}
              <X 
                size={12} 
                className="cursor-pointer hover:text-red-500" 
                onClick={() => {
                  removeFilter('dateFrom');
                  removeFilter('dateTo');
                }} 
              />
            </Badge>
          )}
        </div>
      )}

      <Separator />

      {/* Controles de filtro */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status de leitura */}
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select
            value={filters.read === undefined ? '' : filters.read ? 'read' : 'unread'}
            onValueChange={(value) => 
              handleFilterChange('read', value === '' ? undefined : value === 'read')
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tipo */}
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={Array.isArray(filters.type) ? '' : filters.type || ''}
            onValueChange={(value) => 
              handleFilterChange('type', value === '' ? undefined : value)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="SUCCESS">Sucesso</SelectItem>
              <SelectItem value="ERROR">Erro</SelectItem>
              <SelectItem value="WARNING">Aviso</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="CRITICAL">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Prioridade */}
        <div className="space-y-1">
          <Label className="text-xs">Prioridade</Label>
          <Select
            value={Array.isArray(filters.priority) ? '' : filters.priority || ''}
            onValueChange={(value) => 
              handleFilterChange('priority', value === '' ? undefined : value)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="LOW">Baixa</SelectItem>
              <SelectItem value="MEDIUM">Média</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
              <SelectItem value="CRITICAL">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Módulo */}
        <div className="space-y-1">
          <Label className="text-xs">Módulo</Label>
          <Select
            value={Array.isArray(filters.module) ? '' : filters.module || ''}
            onValueChange={(value) => 
              handleFilterChange('module', value === '' ? undefined : value)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="CRM">CRM</SelectItem>
              <SelectItem value="USER_MANAGEMENT">Usuários</SelectItem>
              <SelectItem value="SERVICES">Serviços</SelectItem>
              <SelectItem value="AGENDAMENTO">Agendamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtro de data */}
      <div className="space-y-2">
        <Label className="text-xs">Período</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* Data de início */}
          <Popover open={datePickerOpen === 'from'} onOpenChange={(open) => setDatePickerOpen(open ? 'from' : null)}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-8 justify-start text-left font-normal text-xs',
                  !filters.dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => {
                  handleFilterChange('dateFrom', date);
                  setDatePickerOpen(null);
                }}
                locale={ptBR}
                disabled={(date) => 
                  date > new Date() || (filters.dateTo && date > filters.dateTo)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Data de fim */}
          <Popover open={datePickerOpen === 'to'} onOpenChange={(open) => setDatePickerOpen(open ? 'to' : null)}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-8 justify-start text-left font-normal text-xs',
                  !filters.dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => {
                  handleFilterChange('dateTo', date);
                  setDatePickerOpen(null);
                }}
                locale={ptBR}
                disabled={(date) => 
                  date > new Date() || (filters.dateFrom && date < filters.dateFrom)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}