import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  avatar?: string;
  lastLoginAt?: string;
  company: {
    id: string;
    name: string;
    plan: string;
  };
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
  recentLogins: number;
}

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  search: (query: string) => [...userKeys.all, 'search', query] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
};

// Hooks
export const useUsers = (params?: PaginationParams) => {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async (): Promise<PaginatedResponse<User>> => {
      const response = await usersApi.getUsers(params);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch users');
      }
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUser = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async (): Promise<User> => {
      const response = await usersApi.getUser(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user');
      }
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useSearchUsers = (query: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.search(query),
    queryFn: async (): Promise<PaginatedResponse<User>> => {
      const response = await usersApi.searchUsers({ q: query });
      if (!response.success) {
        throw new Error(response.error || 'Failed to search users');
      }
      return response.data;
    },
    enabled: enabled && !!query,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useUserStats = () => {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: async (): Promise<UserStats> => {
      const response = await usersApi.getUserStats();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user stats');
      }
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUserProfile = () => {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: async (): Promise<User> => {
      const response = await usersApi.getProfile();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch profile');
      }
      return response.data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Mutations
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserData): Promise<User> => {
      const response = await usersApi.createUser(userData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create user');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      
      toast({
        title: 'Sucesso',
        description: `Usuário ${data.firstName} ${data.lastName} criado com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }): Promise<User> => {
      const response = await usersApi.updateUser(id, data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update user');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(data.id), data);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      
      toast({
        title: 'Sucesso',
        description: `Usuário ${data.firstName} ${data.lastName} atualizado com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      const response = await usersApi.deleteUser(userId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete user');
      }
    },
    onSuccess: (_, userId) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: userKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      
      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useActivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<User> => {
      const response = await usersApi.activateUser(userId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to activate user');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      
      toast({
        title: 'Sucesso',
        description: `Usuário ${data.firstName} ${data.lastName} ativado com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao ativar usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useDeactivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<User> => {
      const response = await usersApi.deactivateUser(userId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to deactivate user');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      
      toast({
        title: 'Sucesso',
        description: `Usuário ${data.firstName} ${data.lastName} desativado com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao desativar usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useResetUserPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, temporaryPassword }: { userId: string; temporaryPassword?: string }): Promise<User> => {
      const response = await usersApi.resetUserPassword(userId, { temporaryPassword });
      if (!response.success) {
        throw new Error(response.error || 'Failed to reset user password');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      
      toast({
        title: 'Sucesso',
        description: `Senha do usuário ${data.firstName} ${data.lastName} redefinida com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao redefinir senha do usuário',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: Partial<UpdateUserData>): Promise<User> => {
      const response = await usersApi.updateProfile(profileData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update profile');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update profile cache
      queryClient.setQueryData(userKeys.profile(), data);
      
      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar perfil',
        variant: 'destructive',
      });
    },
  });
};