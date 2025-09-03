// ERP Nexus - Gestão de Usuários
// Componente para CRUD de usuários da empresa (Admin apenas)

'use client';

import * as React from 'react';
import { Plus, Search, Edit, Trash2, UserPlus, Mail, Shield, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/dates';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  avatar_url?: string;
  last_login?: string;
  created_at: string;
}

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE'], {
    required_error: 'Selecione um cargo',
  }),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').optional(),
  is_active: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userSchema>;

const roleLabels = {
  ADMIN: { label: 'Administrador', color: 'bg-red-100 text-red-800' },
  MANAGER: { label: 'Gerente', color: 'bg-blue-100 text-blue-800' },
  EMPLOYEE: { label: 'Funcionário', color: 'bg-gray-100 text-gray-800' },
};

const statusLabels = {
  ACTIVE: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  INACTIVE: { label: 'Inativo', color: 'bg-gray-100 text-gray-800' },
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
};

export const UsersManagement: React.FC = () => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'EMPLOYEE',
      password: '',
      is_active: true,
    },
  });

  // Simular dados iniciais (substituir por API real)
  React.useEffect(() => {
    const mockUsers: User[] = [
      {
        id: '1',
        name: 'João Silva',
        email: 'joao@empresa.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        last_login: '2024-08-23T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: '2',
        name: 'Maria Santos',
        email: 'maria@empresa.com',
        role: 'MANAGER',
        status: 'ACTIVE',
        last_login: '2024-08-22T15:30:00Z',
        created_at: '2024-02-01T10:00:00Z',
      },
      {
        id: '3',
        name: 'Pedro Costa',
        email: 'pedro@empresa.com',
        role: 'EMPLOYEE',
        status: 'PENDING',
        created_at: '2024-08-20T10:00:00Z',
      },
    ];

    setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 500);
  }, []);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateUser = () => {
    setEditingUser(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.status === 'ACTIVE',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: UserFormValues) => {
    try {
      if (editingUser) {
        // Update user
        toast.success('Usuário atualizado com sucesso!');
      } else {
        // Create user
        toast.success('Usuário criado com sucesso!');
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar usuário');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        // Delete user API call
        toast.success('Usuário removido com sucesso!');
      } catch (error) {
        toast.error('Erro ao remover usuário');
      }
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      // Resend invite API call
      toast.success('Convite reenviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao reenviar convite');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
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
          Novo Usuário
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários da Empresa</CardTitle>
          <CardDescription>
            Gerencie os usuários que têm acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                        <div className="space-y-1">
                          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
                          <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-20 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="text-sm bg-blue-600 text-white">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleLabels[user.role].color}>
                        {roleLabels[user.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusLabels[user.status].color}>
                        {statusLabels[user.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_login ? (
                        <span className="text-sm">
                          {formatDate(user.last_login)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.status === 'PENDING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvite(user.id)}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
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
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Atualize as informações do usuário'
                : 'Adicione um novo usuário à sua empresa'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(value) => form.setValue('role', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Funcionário</SelectItem>
                  <SelectItem value="MANAGER">Gerente</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-red-600">{form.formState.errors.role.message}</p>
              )}
            </div>
            
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha Temporária</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...form.register('password')}
                    error={form.formState.errors.password?.message}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={form.watch('is_active')}
                onCheckedChange={(checked) => form.setValue('is_active', checked)}
              />
              <Label htmlFor="is_active">Usuário ativo</Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingUser ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};