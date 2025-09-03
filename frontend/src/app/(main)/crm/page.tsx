'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { useCustomers, useDeleteCustomer, Customer } from '@/hooks/api/use-customers';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { AdvancedFilters } from '@/components/modules/crm/AdvancedFilters';
import { CustomerStats } from '@/components/modules/crm/CustomerStats';
import { Sidebar } from '@/components/ui';
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
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const customerQuery = useCustomers({
    search: debouncedSearch,
    ...filters,
  });

  const deleteCustomerMutation = useDeleteCustomer();

  // REFATORADO: Usar configuração centralizada do sidebar
  const sidebarItems = filterSidebarItemsByPermissions(SIDEBAR_ITEMS, permissions);

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }: { row: any }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.email && (
            <span className="text-sm text-gray-500">{row.original.email}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Telefone',
      cell: ({ row }: { row: any }) => (
        <span className="text-sm">{row.original.phone || '-'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: any }) => {
        const statusColors = {
          ACTIVE: 'bg-green-100 text-green-800',
          PROSPECT: 'bg-blue-100 text-blue-800',
          INACTIVE: 'bg-gray-100 text-gray-800',
          BLOCKED: 'bg-red-100 text-red-800',
        };
        
        const statusLabels = {
          ACTIVE: 'Ativo',
          PROSPECT: 'Prospect',
          INACTIVE: 'Inativo',
          BLOCKED: 'Bloqueado',
        };

        return (
          <Badge className={statusColors[row.original.status as keyof typeof statusColors]}>
            {statusLabels[row.original.status as keyof typeof statusLabels]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }: { row: any }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.tags.slice(0, 2).map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {row.original.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
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
        <span className="text-sm text-gray-500">
          {new Date(row.original.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }: { row: any }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/crm/${row.original.id}`)}
            >
              Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/crm/${row.original.id}/edit`)}
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCustomerToDelete(row.original.id)}
              className="text-red-600"
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [router]);

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomerMutation.mutateAsync(customerToDelete);
      setCustomerToDelete(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

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

            {/* Stats Cards */}
            <CustomerStats />

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar clientes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
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
              <CardContent>
                <DataTable
                  columns={columns}
                  data={customerQuery.data?.data || []}
                  loading={customerQuery.isLoading}
                  pagination={{
                    pageIndex: filters.page - 1,
                    pageSize: filters.limit,
                  }}
                  onPaginationChange={(pagination) =>
                    setFilters(prev => ({
                      ...prev,
                      page: pagination.pageIndex + 1,
                      limit: pagination.pageSize,
                    }))
                  }
                  totalCount={customerQuery.data?.total || 0}
                />
              </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteCustomer}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteCustomerMutation.isPending}
                  >
                    {deleteCustomerMutation.isPending ? 'Excluindo...' : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
      </div>
    </div>
  );
}

export default withAuth(CRMPage);