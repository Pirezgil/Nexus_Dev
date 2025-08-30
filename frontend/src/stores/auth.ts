// ERP Nexus - Auth Store (Zustand)
// Sistema de autenticação integrado com User Management API

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthStore, LoginRequest, User, Company } from '@/types';
import { api, authApi, API_ROUTES, apiPost } from '@/lib/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      company: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Login function
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true });
        
        try {
          const response = await authApi.login(credentials);
          
          if (response.success) {
            const { tokens, user } = response.data;
            const { accessToken, refreshToken } = tokens;
            const { company, ...userData } = user;
            
            // Normalize token name for consistency
            const token = accessToken;
            
            console.log('🔍 Login response data:', { 
              userData, 
              company, 
              hasCompany: !!company,
              fullResponse: response.data 
            });
            
            // Add computed name field for compatibility
            if (userData.firstName || userData.lastName) {
              userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
            }
            
            // Salvar tokens no localStorage
            localStorage.setItem('erp_nexus_token', token);
            localStorage.setItem('erp_nexus_refresh_token', refreshToken);
            
            // Atualizar estado
            set({
              user: userData,
              company,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            
            console.log('✅ Login successful:', userData.firstName || userData.name || userData.email);
          } else {
            throw new Error(response.error || 'Falha no login');
          }
        } catch (error: any) {
          set({ isLoading: false });
          console.error('❌ Login error:', error);
          
          // Melhor tratamento de erros
          const errorMessage = error.response?.data?.message || error.message || 'Erro no login';
          throw new Error(errorMessage);
        }
      },

      // Logout function
      logout: async () => {
        set({ isLoading: true });
        
        try {
          // Chamar API de logout se possível
          const { token } = get();
          if (token) {
            await authApi.logout();
          }
        } catch (error) {
          console.warn('⚠️ Logout API call failed:', error);
        } finally {
          // Limpar estado e localStorage
          localStorage.removeItem('erp_nexus_token');
          localStorage.removeItem('erp_nexus_refresh_token');
          sessionStorage.clear();
          
          set({
            user: null,
            company: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          
          console.log('✅ Logout successful');
        }
      },

      // Refresh authentication
      refreshAuth: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authApi.refresh(refreshToken);
          
          if (response.success) {
            const { accessToken: newToken, refreshToken: newRefreshToken } = response.data;
            
            // Atualizar tokens
            localStorage.setItem('erp_nexus_token', newToken);
            if (newRefreshToken) {
              localStorage.setItem('erp_nexus_refresh_token', newRefreshToken);
            }
            
            set({
              token: newToken,
              refreshToken: newRefreshToken || refreshToken, // Keep old refresh token if new one not provided
            });
            
            console.log('✅ Token refreshed successfully');
          } else {
            throw new Error(response.error || 'Falha na renovação do token');
          }
        } catch (error) {
          console.error('❌ Token refresh error:', error);
          // Se falhar, fazer logout
          get().logout();
          throw error;
        }
      },

      // Initialize authentication from localStorage
      initialize: async () => {
        if (typeof window === 'undefined') return;
        
        console.log('🔄 Initializing auth store...');

        const token = localStorage.getItem('erp_nexus_token');
        const refreshToken = localStorage.getItem('erp_nexus_refresh_token');
        const persistedData = localStorage.getItem('erp-nexus-auth');
        
        console.log('🔍 Storage data:', { 
          hasToken: !!token, 
          hasRefresh: !!refreshToken, 
          hasPersisted: !!persistedData,
          persistedData: persistedData ? JSON.parse(persistedData) : null
        });
        
        if (token && refreshToken) {
          // O Zustand persist middleware já carregou os dados salvos
          // Verificar se os tokens ainda são válidos
          const currentState = get();
          const { user, company, isAuthenticated } = currentState;
          
          console.log('🔍 Current store state:', { 
            hasUser: !!user, 
            hasCompany: !!company, 
            userEmail: user?.email,
            isAuthenticated,
            fullUser: user
          });
          
          if (user && company) {
            // Se os dados do usuário E company estão disponíveis, assumir autenticado
            set({
              isAuthenticated: true,
              isLoading: false,
            });
            console.log('✅ Session restored with user and company data');
            
            // Validar token em background (não bloquear UI)
            setTimeout(async () => {
              try {
                const response = await authApi.validate();
                if (!response.success) {
                  throw new Error('Token validation failed');
                }
                console.log('✅ Token validated successfully');
              } catch (error) {
                console.warn('⚠️ Token validation failed, attempting refresh...');
                try {
                  await get().refreshAuth();
                  console.log('✅ Token refreshed successfully');
                } catch (refreshError) {
                  console.error('❌ Token refresh failed, logging out...');
                  await get().logout();
                }
              }
            }, 100); // Pequeno delay para não bloquear a UI
          } else {
            console.log('❌ Missing user/company data, clearing session');
            // Missing user data, clear invalid session
            localStorage.removeItem('erp_nexus_token');
            localStorage.removeItem('erp_nexus_refresh_token');
            set({
              user: null,
              company: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          console.log('❌ No tokens found, clearing state');
          // Limpar estado se não há tokens
          set({
            user: null,
            company: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      // Update user data
      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          const updatedUser = { ...user, ...userData };
          
          // Add computed name field for compatibility
          if (updatedUser.firstName || updatedUser.lastName) {
            updatedUser.name = `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim();
          }
          
          set({
            user: updatedUser
          });
        }
      },
    }),
    {
      name: 'erp-nexus-auth',
      partialize: (state) => ({
        user: state.user,
        company: state.company,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Hook para verificar permissões
export const usePermissions = () => {
  const { user } = useAuthStore();
  
  return {
    isAdmin: user?.role === 'ADMIN',
    isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN',
    canManageUsers: user?.role === 'ADMIN',
    canViewReports: user?.role !== 'VIEWER',
    canEdit: user?.role !== 'VIEWER',
    hasRole: (role: User['role']) => user?.role === role,
  };
};

// Hook para dados do usuário atual
export const useCurrentUser = () => {
  const { user, company } = useAuthStore();
  
  return {
    user,
    company,
    displayName: user?.name || 'Usuário',
    initials: user?.name
      ?.split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'UN',
    roleLabel: {
      'ADMIN': 'Administrador',
      'MANAGER': 'Gerente',
      'USER': 'Usuário',
      'VIEWER': 'Visualizador',
    }[user?.role || 'USER'],
  };
};