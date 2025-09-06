// ERP Nexus - Auth Store (Zustand)
// Sistema de autenticação integrado com User Management API

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthStore, LoginRequest, User, Company } from '@/types';
import { api, authApi, API_ROUTES, apiPost } from '@/lib/api';

// Import TokenPersistenceManager from api.ts (we need to create a type-only import)
// Since it's a class in the same file, we'll create a bridge function
const getTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('erp_nexus_token');
};

const getRefreshTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('erp_nexus_refresh_token');
};

const saveTokenToStorage = (token: string, refreshToken?: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const timestamp = Date.now().toString();
    
    localStorage.setItem('erp_nexus_token', token);
    localStorage.setItem('erp_nexus_token_timestamp', timestamp);
    
    if (refreshToken) {
      localStorage.setItem('erp_nexus_refresh_token', refreshToken);
    }
    
    // Verification
    const savedToken = localStorage.getItem('erp_nexus_token');
    const savedTimestamp = localStorage.getItem('erp_nexus_token_timestamp');
    
    const success = savedToken === token && savedTimestamp === timestamp;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Zustand token save result:', {
        success,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
        timestamp,
        refreshTokenSaved: !!refreshToken
      });
    }
    
    return success;
  } catch (error) {
    console.error('❌ Failed to save token in Zustand store:', error);
    return false;
  }
};

const clearAllTokens = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp_nexus_refresh_token');
    localStorage.removeItem('erp_nexus_token_timestamp');
    sessionStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp-nexus-auth');
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 All tokens cleared from Zustand store');
    }
  } catch (error) {
    console.error('❌ Error clearing tokens from Zustand store:', error);
  }
};

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
      status: 'initializing',
      isInitialized: false,

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
            
            // Salvar tokens usando nossa função robusta
            const saveSuccess = saveTokenToStorage(token, refreshToken);
            
            if (!saveSuccess) {
              throw new Error('Falha ao salvar tokens no armazenamento');
            }
            
            // Verificar se os tokens foram salvos corretamente
            const verificationToken = getTokenFromStorage();
            if (verificationToken !== token) {
              throw new Error('Verificação de persistência de token falhou');
            }
            
            // Atualizar estado
            set({
              user: userData,
              company,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              status: 'authenticated',
            });
            
            console.log('✅ Login successful:', userData.firstName || userData.name || userData.email);
          } else {
            throw new Error(response.error || 'Falha no login');
          }
        } catch (error: any) {
          set({ isLoading: false, status: 'unauthenticated' });
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
          // Limpar estado usando nossa função robusta
          clearAllTokens();
          
          set({
            user: null,
            company: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            status: 'unauthenticated',
            isInitialized: true,
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
            
            // Atualizar tokens usando nossa função robusta
            const saveSuccess = saveTokenToStorage(newToken, newRefreshToken);
            
            if (!saveSuccess) {
              throw new Error('Falha ao salvar novos tokens após refresh');
            }
            
            // Verificar se os novos tokens foram salvos corretamente
            const verificationToken = getTokenFromStorage();
            if (verificationToken !== newToken) {
              throw new Error('Verificação de persistência dos novos tokens falhou');
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
        
        const { isInitialized } = get();
        if (isInitialized) {
          console.log('⚠️ Auth store already initialized, skipping...');
          return;
        }
        
        set({ status: 'loading', isLoading: true, isInitialized: false });
        console.log('🔄 Initializing auth store...');

        try {
          const token = getTokenFromStorage();
          const refreshToken = getRefreshTokenFromStorage();
          const persistedData = localStorage.getItem('erp-nexus-auth');
          
          // Validar integridade dos tokens se existirem
          let tokenValid = false;
          if (token) {
            try {
              const parts = token.split('.');
              if (parts.length === 3) {
                JSON.parse(atob(parts[0]));
                JSON.parse(atob(parts[1]));
                tokenValid = true;
              }
            } catch {
              console.warn('⚠️ Token format validation failed during initialization');
            }
          }
          
          console.log('🔍 Storage data:', { 
            hasToken: !!token, 
            hasRefresh: !!refreshToken, 
            hasPersisted: !!persistedData,
            tokenValid,
            tokenLength: token?.length || 0,
            persistedData: persistedData ? JSON.parse(persistedData) : null
          });
          
          // Se não há tokens ou tokens são inválidos, definir como não autenticado imediatamente
          if (!token || !refreshToken || !tokenValid) {
            console.log('❌ No valid tokens found, setting as unauthenticated', {
              hasToken: !!token,
              hasRefresh: !!refreshToken,
              tokenValid
            });
            set({
              user: null,
              company: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
              status: 'unauthenticated',
              isInitialized: true, // ✅ CORREÇÃO: Marcar como inicializado
            });
            return;
          }

          // Verificar se os dados do usuário estão disponíveis no Zustand persist
          const currentState = get();
          const { user, company } = currentState;
          
          console.log('🔍 Current store state:', { 
            hasUser: !!user, 
            hasCompany: !!company, 
            userEmail: user?.email,
            fullUser: user
          });
          
          // Se temos tokens mas não temos dados do usuário ou company, validar tokens
          if (!user || !company) {
            console.log('⚠️ Missing user/company data, validating tokens...');
            
            try {
              // Tentar validar token com timeout curto
              const response = await Promise.race([
                authApi.validate(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Token validation timeout')), 3000)
                )
              ]);
              
              if (response.success && response.data) {
                // Token válido mas dados não estão no store - limpar e forçar re-login
                console.log('✅ Token valid but user data missing - forcing re-login');
                clearAllTokens();
                set({
                  user: null,
                  company: null,
                  token: null,
                  refreshToken: null,
                  isAuthenticated: false,
                  isLoading: false,
                  status: 'unauthenticated',
                  isInitialized: true, // ✅ CORREÇÃO: Marcar como inicializado
                });
                return;
              }
            } catch (error) {
              console.error('❌ Token validation failed:', error);
              // Token inválido ou erro na validação
              clearAllTokens();
              set({
                user: null,
                company: null,
                token: null,
                refreshToken: null,
                isAuthenticated: false,
                isLoading: false,
                status: 'unauthenticated',
                isInitialized: true, // ✅ CORREÇÃO: Marcar como inicializado
              });
              return;
            }
          }
          
          // Se temos tokens E dados do usuário/company, assumir autenticado
          if (user && company && token && refreshToken) {
            console.log('✅ Session restored with user and company data');
            set({
              user,
              company,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              status: 'authenticated',
              isInitialized: true, // ✅ CORREÇÃO: Marcar como inicializado
            });
            
            // Validar token em background sem bloquear UI
            setTimeout(async () => {
              try {
                const response = await authApi.validate();
                if (!response.success) {
                  throw new Error('Token validation failed');
                }
                console.log('✅ Background token validation successful');
              } catch (error) {
                console.warn('⚠️ Background token validation failed, attempting refresh...');
                try {
                  await get().refreshAuth();
                  console.log('✅ Token refreshed successfully');
                } catch (refreshError) {
                  console.error('❌ Token refresh failed, logging out...');
                  await get().logout();
                }
              }
            }, 1000); // 1 segundo de delay para não bloquear a UI
            return;
          }
          
          // Fallback: limpar estado se chegamos aqui
          console.log('❌ Fallback: clearing session state');
          clearAllTokens();
          set({
            user: null,
            company: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            status: 'unauthenticated',
            isInitialized: true,
          });
          
        } catch (error) {
          console.error('❌ Initialize error:', error);
          // Em caso de erro, limpar tudo e definir como não autenticado
          clearAllTokens();
          set({
            user: null,
            company: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            status: 'unauthenticated',
            isInitialized: true,
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
        status: state.status,
        isInitialized: state.isInitialized,
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