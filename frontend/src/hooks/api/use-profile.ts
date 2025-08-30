// ERP Nexus - Profile API Hooks
// React Query hooks para operações de perfil do usuário

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

// ====================================
// TYPES
// ====================================

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
}

// Backend expects these field names
interface BackendProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// ====================================
// API FUNCTIONS
// ====================================

const profileApi = {
  // Update profile
  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    // Map frontend fields to backend expected fields
    const backendData: BackendProfileRequest = {
      firstName: data.firstName,
      lastName: data.lastName,
      ...(data.email && data.email.trim() ? { email: data.email } : {}),
      phone: data.phone,
    };
    
    console.log('🔄 Sending profile update:', backendData);
    
    const response = await api.patch('/api/auth/profile', backendData);
    const userData = response.data.data || response.data;
    
    console.log('✅ Profile update response:', userData);
    
    // Add computed name field for compatibility
    if (userData.firstName || userData.lastName) {
      userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    }
    
    return userData;
  },

  // Change password
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    // Map frontend fields to backend expected fields
    const backendData = {
      oldPassword: data.current_password,
      newPassword: data.new_password,
    };
    
    await api.patch('/api/auth/password', backendData);
  },

  // Upload avatar
  uploadAvatar: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await api.post('/api/auth/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data || response.data;
  },
};

// ====================================
// HOOKS
// ====================================

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (updatedUser) => {
      // Update cache
      queryClient.setQueryData(queryKeys.auth.me, updatedUser);
      
      // Update auth store
      updateUser(updatedUser);
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Profile update error:', error);
      toast({
        title: "Erro ao atualizar perfil",
        description: error?.response?.data?.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Password change error:', error);
      const errorMessage = error?.response?.data?.message;
      
      if (errorMessage?.includes('current password')) {
        toast({
          title: "Senha atual incorreta",
          description: "A senha atual informada não está correta.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao alterar senha",
          description: errorMessage || "Ocorreu um erro inesperado.",
          variant: "destructive",
        });
      }
    },
  });
};

export const useUploadAvatar = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (data, file) => {
      console.log('🎯 Avatar upload success data:', data);
      
      // Extract avatar URL from various possible response formats
      const avatarUrl = data.data?.avatarUrl || data.avatarUrl || data.data?.user?.avatar || data.user?.avatar || data.url;
      
      console.log('🔍 Extracted avatar URL:', avatarUrl);
      
      if (avatarUrl) {
        // Update cache
        queryClient.setQueryData(queryKeys.auth.me, (oldData: any) => {
          if (oldData) {
            const updatedData = { ...oldData, avatar: avatarUrl };
            console.log('📦 Updated cache data:', updatedData);
            return updatedData;
          }
          return oldData;
        });
        
        // Update auth store - prefer full user data from response, otherwise just update avatar
        if (data.data?.user) {
          console.log('✅ Updating auth store with full user data:', data.data.user);
          updateUser(data.data.user);
        } else if (data.user) {
          console.log('✅ Updating auth store with user data:', data.user);
          updateUser(data.user);
        } else {
          console.log('✅ Updating auth store with avatar only:', { avatar: avatarUrl });
          updateUser({ avatar: avatarUrl });
        }
      } else {
        console.warn('⚠️ No avatar URL found in response:', data);
      }
      
      toast({
        title: "Avatar atualizado",
        description: "Sua foto de perfil foi atualizada com sucesso.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Avatar upload error:', error);
      toast({
        title: "Erro ao fazer upload",
        description: "Não foi possível fazer upload da imagem. Tente novamente.",
        variant: "destructive",
      });
    },
  });
};