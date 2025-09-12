// ERP Nexus - Gestão de Usuários
// Página para administração de usuários da empresa (rota: /settings/users)

'use client';

import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  Mail,
  AlertCircle,
  CheckCircle,
  MoreHorizontal
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserFormModal } from '@/components/users/UserFormModal';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useActivateUser,
  useDeactivateUser,
  useResetUserPassword,
  User,
  CreateUserData,
  UpdateUserData,
  PaginationParams
} from '@/hooks/api/use-users';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Types for confirmation dialogs
interface ConfirmationDialog {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

// Modal states
interface ModalState {
  isOpen: boolean;
  user: User | null;
}

// Labels para roles
const roleLabels = {
  ADMIN: { label: 'Administrador', variant: 'destructive' as const },
  MANAGER: { label: 'Gerente', variant: 'default' as const },
  USER: { label: 'Usuário', variant: 'secondary' as const }
};

const statusLabels = {
  ACTIVE: { label: 'Ativo', variant: 'default' as const },
  INACTIVE: { label: 'Inativo', variant: 'secondary' as const },
  PENDING: { label: 'Pendente', variant: 'outline' as const }
};

// Helper functions
const getFullName = (user: User) => `${user.firstName} ${user.lastName}`;

const getInitials = (user: User) => {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return (firstName[0] || '') + (lastName[0] || '');
};



// Função para formatar data
const formatDate = (dateString?: string | null) => {
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
  const [pagination, setPagination] = React.useState<PaginationParams>({
    page: 1,
    limit: 10,
    sortBy: 'firstName',
    sortOrder: 'asc',
  });
  const [userModal, setUserModal] = React.useState<ModalState>({
    isOpen: false,
    user: null,
  });
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmationDialog>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Debounce da busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination(prev => ({ ...prev, page: 1, search: searchTerm || undefined }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // API Hooks
  const { data: usersData, isLoading, isError, error } = useUsers({
    ...pagination,
    search: debouncedSearch || undefined,
  });
  
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const activateUserMutation = useActivateUser();
  const deactivateUserMutation = useDeactivateUser();
  const resetPasswordMutation = useResetUserPassword();

  // Handlers
  const handleCreateUser = () => {
    setUserModal({ isOpen: true, user: null });
  };

  const handleEditUser = (user: User) => {
    setUserModal({ isOpen: true, user });
  };

  const handleDeleteUser = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Exclusão',
      description: `Tem certeza que deseja remover o usuário "${getFullName(user)}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => {
        deleteUserMutation.mutate(user.id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleActivateUser = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Ativar Usuário',
      description: `Confirma a ativação do usuário "${getFullName(user)}"?`,
      onConfirm: () => {
        activateUserMutation.mutate(user.id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeactivateUser = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Desativar Usuário',
      description: `Confirma a desativação do usuário "${getFullName(user)}"?`,
      onConfirm: () => {
        deactivateUserMutation.mutate(user.id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetPassword = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Redefinir Senha',
      description: `Confirma a redefinição da senha do usuário "${getFullName(user)}"? Uma nova senha temporária será gerada.`,
      onConfirm: () => {
        resetPasswordMutation.mutate({ userId: user.id });
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleFormSubmit = (data: CreateUserData | UpdateUserData) => {
    if (userModal.user) {
      // Update user
      updateUserMutation.mutate(
        { id: userModal.user.id, data: data as UpdateUserData },
        {
          onSuccess: () => {
            setUserModal({ isOpen: false, user: null });
          },
        }
      );
    } else {
      // Create user
      createUserMutation.mutate(data as CreateUserData, {
        onSuccess: () => {
          setUserModal({ isOpen: false, user: null });
        },
      });
    }
  };

  const handleCloseModal = () => {
    setUserModal({ isOpen: false, user: null });
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Definição das colunas da tabela
  const columns: ColumnDef<User>[] = [
    {
      id: 'user',
      header: 'Usuário',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.avatar || ''} />
              <AvatarFallback className="text-sm bg-blue-600 text-white">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{getFullName(user)}</div>
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
          <Badge variant={roleInfo?.variant || 'secondary'}>
            {roleInfo?.label || role}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as keyof typeof statusLabels;
        const statusInfo = statusLabels[status];
        
        return (
          <div className="flex items-center gap-1">
            {status === 'ACTIVE' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === 'INACTIVE' && <AlertCircle className="w-4 h-4 text-red-500" />}
            {status === 'PENDING' && <Mail className="w-4 h-4 text-yellow-500" />}
            <Badge variant={statusInfo?.variant || 'secondary'}>
              {statusInfo?.label || status}
            </Badge>
          </div>
        );
      }
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Último Acesso',
      cell: ({ row }) => {
        const lastLogin = row.getValue('lastLoginAt') as string;
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              
              {user.status === 'ACTIVE' ? (
                <DropdownMenuItem onClick={() => handleDeactivateUser(user)}>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Desativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivateUser(user)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Ativar
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                <Mail className="mr-2 h-4 w-4" />
                Redefinir Senha
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteUser(user)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  // Loading states for mutations
  const isAnyMutationLoading = 
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    deleteUserMutation.isPending ||
    activateUserMutation.isPending ||
    deactivateUserMutation.isPending ||
    resetPasswordMutation.isPending;

  // Renderização com estados de loading e error
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          Erro ao carregar usuários: {error?.message || 'Erro desconhecido'}
        </AlertDescription>
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
        
        <Button onClick={handleCreateUser}>
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
          data={usersData?.data || []}
          loading={isLoading || isAnyMutationLoading}
        />
      )}

      {/* User Form Modal */}
      <UserFormModal
        isOpen={userModal.isOpen}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        user={userModal.user}
        isLoading={isAnyMutationLoading}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={handleCloseConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseConfirmDialog}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}