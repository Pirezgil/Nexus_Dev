'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { useCustomers, Customer, useInactivateCustomer } from '@/hooks/api/use-customers';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { AdvancedFilters } from '@/components/modules/crm/AdvancedFilters';
import { CustomerStats } from '@/components/modules/crm/CustomerStatsRefactored';
import { BulkActions } from '@/components/modules/crm/BulkActions';
import { useSelection } from '@/hooks/useSelection';
import { Checkbox } from '@/components/ui/checkbox';
import { Sidebar } from '@/components/layout';
import { withAuth } from '@/components/auth/withAuth';
import { useCurrentUser, usePermissions } from '@/stores/auth';
import { SIDEBAR_ITEMS, filterSidebarItemsByPermissions } from '@/config/sidebar';

function CRMPage() {
  const router = useRouter();
  const { user, displayName } = useCurrentUser();
  const permissions = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    tags: [] as string[],
    page: 1,
    limit: 20, // ✅ Paginação real no backend
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Inactivation hook
  const inactivateCustomer = useInactivateCustomer();

  // ✅ Seleção Múltipla
  const selection = useSelection({
    data: paginatedData,
    getItemId: (customer) => customer.id,
  });

  // Function to handle customer inactivation
  const handleInactivateCustomer = (customerId: string, customerName: string) => {
    if (confirm(`Tem certeza que deseja inativar o cliente "${customerName}"?\n\nO cliente será marcado como inativo e não aparecerá mais nas listagens padrão.`)) {
      inactivateCustomer.mutate(customerId);
    }
  };

  const customerQuery = useCustomers({
    search: debouncedSearch,
    ...filters,
  });


  // REFATORADO: Usar configuração centralizada do sidebar
  const sidebarItems = filterSidebarItemsByPermissions(SIDEBAR_ITEMS, permissions);

  // ✅ Dados já paginados pelo backend - usar diretamente
  const paginatedData = useMemo(() => {
    return customerQuery.data?.data || [];
  }, [customerQuery.data?.data]);

  const totalPages = customerQuery.data?.totalPages || 0;
  const totalItems = customerQuery.data?.total || 0;

  const columns = useMemo(() => [
    // ✅ Coluna de seleção
    {
      id: 'select',
      header: ({ }) => (
        <Checkbox
          checked={selection.isAllSelected}
          onCheckedChange={selection.toggleAll}
          aria-label="Selecionar todos os clientes"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }: { row: any }) => (
        <Checkbox
          checked={selection.isSelected(row.original.id)}
          onCheckedChange={() => selection.toggleSelection(row.original.id)}
          aria-label={`Selecionar cliente ${row.original.name}`}
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }: { row: any }) => (
        <div className="flex flex-col min-w-[200px]">
          <span className="font-medium text-[#020617]">{row.original.name}</span>
          {row.original.email && (
            <span className="text-sm text-[#64748B]">{row.original.email}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Telefone',
      cell: ({ row }: { row: any }) => (
        <span className="text-sm text-[#475569] min-w-[120px]">{row.original.phone || '-'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableHiding: false,
      cell: ({ row }: { row: any }) => {
        const statusColors = {
          ACTIVE: 'bg-success text-white', // ✅ Usando design system
          PROSPECT: 'bg-primary text-white', // ✅ Usando design system
          INACTIVE: 'bg-slate-500 text-white', // ✅ Usando Tailwind padrão
          BLOCKED: 'bg-error text-white', // ✅ Usando design system
        };
        
        const statusLabels = {
          ACTIVE: 'Ativo',
          PROSPECT: 'Prospect',
          INACTIVE: 'Inativo',
          BLOCKED: 'Bloqueado',
        };

        return (
          <Badge className={`${statusColors[row.original.status as keyof typeof statusColors]} border-0 font-medium`}>
            {statusLabels[row.original.status as keyof typeof statusLabels]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      enableHiding: false,
      cell: ({ row }: { row: any }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.tags.slice(0, 2).map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {row.original.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{row.original.tags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Cadastrado',
      cell: ({ row }: { row: any }) => (
        <span className="text-sm text-[#64748B] min-w-[100px]">
          {new Date(row.original.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Ações',
      enableHiding: false,
      cell: ({ row }: { row: any }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-[#E2E8F0] shadow-lg">
            <DropdownMenuItem
              onClick={() => router.push(`/crm/${row.original.id}`)}
              className="hover:bg-[#F8FAFC] hover:text-[#2563EB]"
            >
              Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/crm/${row.original.id}/edit`)}
              className="hover:bg-[#F8FAFC] hover:text-[#2563EB]"
            >
              Editar
            </DropdownMenuItem>
            {row.original.status === 'ACTIVE' && (
              <DropdownMenuItem
                onClick={() => handleInactivateCustomer(row.original.id, row.original.name)}
                className="hover:bg-[#F8FAFC] hover:text-[#DC2626]"
              >
                Inativar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [router, handleInactivateCustomer, selection]);


  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Clientes
          </h2>
          <p className="text-slate-600">
            Gerencie sua base de clientes
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
            {/* Action Button */}
            <div className="flex justify-end">
              <Button onClick={() => router.push('/crm/novo')}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </div>

            {/* ✅ Stats Cards Refatorado */}
            <CustomerStats />

            {/* Filters and Sorting */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar clientes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Sorting */}
                  <div className="flex gap-2">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as 'createdAt' | 'name')}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="createdAt">Ordenar por Data</option>
                      <option value="name">Ordenar por Nome</option>
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="desc">Mais Recente</option>
                      <option value="asc">Mais Antigo</option>
                    </select>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                  </Button>
                </div>

                {showFilters && (
                  <div className="mt-4">
                    <AdvancedFilters
                      filters={filters}
                      onFiltersChange={setFilters}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <DataTable
                    columns={columns}
                    data={paginatedData}
                    loading={customerQuery.isLoading}
                  />
                </div>
                
                {/* Simple Pagination */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="text-sm text-[#64748B] font-medium">
                    Mostrando {paginatedData.length} de {totalItems} clientes
                    {filters.page && filters.page > 1 && (
                      <span className="ml-2">• Página {filters.page} de {totalPages}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                      disabled={!filters.page || filters.page === 1 || customerQuery.isLoading}
                      className="px-4 py-2 text-sm border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:border-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, (prev.page || 1) + 1) }))}
                      disabled={!filters.page || filters.page >= totalPages || customerQuery.isLoading}
                      className="px-4 py-2 text-sm border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:border-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

        </div>

        {/* ✅ Ações em Lote */}
        <BulkActions
          selectedItems={selection.selectedItems}
          selectedCount={selection.selectedCount}
          onClearSelection={selection.clearSelection}
          onBulkInactivate={(customers) => {
            // Implementar inativação em lote
            customers.forEach(customer => {
              inactivateCustomer.mutate(customer.id);
            });
            selection.clearSelection();
          }}
          onBulkExport={(customers) => {
            // Implementar export CSV
            const csvData = customers.map(c => ({
              Nome: c.name,
              Email: c.email || '',
              Telefone: c.phone || '',
              Status: c.status,
              'Data Cadastro': new Date(c.createdAt).toLocaleDateString('pt-BR')
            }));
            
            const csv = Object.keys(csvData[0]).join(',') + '\n' +
              csvData.map(row => Object.values(row).join(',')).join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clientes-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
          }}
        />
    </div>
  );
}

export default withAuth(CRMPage);