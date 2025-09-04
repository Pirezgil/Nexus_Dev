// ERP Nexus - Gestão de Usuários
// Página para administração de usuários da empresa (rota: /settings/users)

'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/lib/toast';
import { 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  Mail,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';

// Tipos de dados
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

interface UsersResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Labels para roles
const roleLabels = {
  admin: { label: 'Administrador', variant: 'destructive' as const },
  manager: { label: 'Gerente', variant: 'default' as const },
  employee: { label: 'Funcionário', variant: 'secondary' as const }
};

// Hook para buscar usuários
const useUsers = (search: string = '') => {
  return useQuery<UsersResponse>({
    queryKey: ['users', search],
    queryFn: async () => {
      // Simular chamada à API - substituir pela API real
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUsers: User[] = [
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@empresa.com',
          role: 'admin',
          is_active: true,
          last_login: '2024-09-03T08:30:00Z',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2', 
          name: 'Maria Santos',
          email: 'maria@empresa.com',
          role: 'manager',
          is_active: true,
          last_login: '2024-09-02T16:45:00Z',
          created_at: '2024-02-01T10:00:00Z'
        },
        {
          id: '3',
          name: 'Pedro Costa',
          email: 'pedro@empresa.com', 
          role: 'employee',
          is_active: false,
          last_login: '2024-08-28T12:15:00Z',
          created_at: '2024-03-10T10:00:00Z'
        }
      ];

      const filteredUsers = search 
        ? mockUsers.filter(user => 
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
          )
        : mockUsers;

      return {
        success: true,
        data: {
          users: filteredUsers,
          pagination: {
            page: 1,
            limit: 20,
            total: filteredUsers.length,
            pages: 1
          }
        }
      };
    }
  });
};

// Hook para deletar usuário
const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      // Simular chamada à API
      await new Promise(resolve => setTimeout(resolve, 500));
      // Aqui seria: await api.delete(`/users/${userId}`)
    },
    onSuccess: () => {
      toast.success('Usuário removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => {
      toast.error('Erro ao remover usuário');
    }
  });
};

// Função para obter iniciais do nome
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Função para formatar data
const formatDate = (dateString?: string) => {
  if (!dateString) return 'Nunca';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Debounce da busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Hooks de dados
  const { data, isLoading, isError, error } = useUsers(debouncedSearch);
  const deleteUserMutation = useDeleteUser();

  // Handlers
  const handleAddUser = () => {
    // Navegar para página de criação ou abrir modal
    toast.info('Funcionalidade de adicionar usuário será implementada');
  };

  const handleEditUser = (user: User) => {
    // Navegar para página de edição ou abrir modal
    toast.info(`Editar usuário: ${user.name}`);
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Tem certeza que deseja remover o usuário "${user.name}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  // Definição das colunas da tabela
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Usuário',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="" />
              <AvatarFallback className="text-sm bg-blue-600 text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-600">{user.email}</div>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'role',
      header: 'Cargo',
      cell: ({ row }) => {
        const role = row.getValue('role') as keyof typeof roleLabels;
        const roleInfo = roleLabels[role];
        
        return (
          <Badge variant={roleInfo.variant}>
            {roleInfo.label}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean;
        
        return (
          <div className="flex items-center gap-1">
            {isActive ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-700">Ativo</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-700">Inativo</span>
              </>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'last_login',
      header: 'Último Acesso',
      cell: ({ row }) => {
        const lastLogin = row.getValue('last_login') as string;
        return (
          <span className="text-sm text-gray-600">
            {formatDate(lastLogin)}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => {
        const user = row.original;
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditUser(user)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm" 
              onClick={() => handleDeleteUser(user)}
              disabled={deleteUserMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      }
    }
  ];

  // Renderização com estados de loading e error
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <div>
          <h4>Erro ao carregar usuários</h4>
          <p>Não foi possível carregar a lista de usuários. Tente novamente.</p>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e ações */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Button onClick={handleAddUser}>
          <UserPlus className="w-4 h-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Tabela de usuários */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
          <span className="ml-2">Carregando usuários...</span>
        </div>
      ) : (
        <DataTable 
          columns={columns}
          data={data?.data.users || []}
          loading={isLoading}
        />
      )}
    </div>
  );
}