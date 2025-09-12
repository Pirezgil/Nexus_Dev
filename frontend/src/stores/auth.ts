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

      // Refresh authentication with race condition protection
      refreshAuth: (() => {
        let refreshPromise: Promise<void> | null = null;
        
        return async (): Promise<void> => {
          // RACE CONDITION FIX: Return existing promise if refresh is already in progress
          if (refreshPromise) {
            if (process.env.NODE_ENV === 'development') {
              console.log('⏳ Token refresh already in progress, waiting...');
            }
            return refreshPromise;
          }
          
          const { refreshToken } = get();
          
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Create and store refresh promise to prevent race conditions
          refreshPromise = (async () => {
            try {
              if (process.env.NODE_ENV === 'development') {
                console.log('🔄 Starting token refresh...');
              }
              
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
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ Token refreshed successfully');
                }
              } else {
                throw new Error(response.error || 'Falha na renovação do token');
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('❌ Token refresh error:', error);
              }
              // Se falhar, fazer logout
              get().logout();
              throw error;
            } finally {
              // Clear the refresh promise after completion
              refreshPromise = null;
            }
          })();
          
          return refreshPromise;
        };
      })(),

      // Simplified initialization with better error handling and timeout protection
      initialize: async () => {
        if (typeof window === 'undefined') return;
        
        const { isInitialized } = get();
        if (isInitialized) {
          console.log('⚠️ Auth store already initialized, skipping...');
          return;
        }
        
        set({ status: 'initializing', isLoading: true, isInitialized: false });
        console.log('🔄 Starting auth store initialization...');

        // Add timeout protection
        const initializationTimeout = setTimeout(() => {
          console.warn('⚠️ Auth initialization timeout, forcing completion');
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
        }, 8000); // 8 second timeout

        try {
          // Get tokens from storage
          const token = getTokenFromStorage();
          const refreshToken = getRefreshTokenFromStorage();
          
          console.log('🔍 Initial storage check:', { 
            hasToken: !!token, 
            hasRefresh: !!refreshToken,
            tokenLength: token?.length || 0
          });

          // Quick validation: No tokens = not authenticated
          if (!token || !refreshToken) {
            console.log('❌ No tokens found, setting as unauthenticated');
            clearTimeout(initializationTimeout);
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
            clearAllTokens();
            return;
          }

          // Basic token format validation (no parsing to avoid hanging)
          let tokenValid = false;
          if (token) {
            try {
              const parts = token.split('.');
              tokenValid = parts.length === 3;
              console.log('🔍 Token format validation:', { tokenValid });
            } catch (e) {
              console.warn('⚠️ Token format validation failed:', e);
            }
          }

          // If token format is invalid, treat as unauthenticated
          if (!tokenValid) {
            console.log('❌ Invalid token format, setting as unauthenticated');
            clearTimeout(initializationTimeout);
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
            return;
          }

          // Check for persisted user data
          const persistedData = localStorage.getItem('erp-nexus-auth');
          let userData = null;
          let companyData = null;
          
          if (persistedData) {
            try {
              const parsed = JSON.parse(persistedData);
              userData = parsed.user;
              companyData = parsed.company;
            } catch (e) {
              console.warn('⚠️ Failed to parse persisted auth data:', e);
            }
          }

          // If we have tokens and user data, restore session
          if (userData && companyData) {
            console.log('✅ Restoring authenticated session from persisted data');
            clearTimeout(initializationTimeout);
            set({
              user: userData,
              company: companyData,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              status: 'authenticated',
              isInitialized: true,
            });

            // Background validation (non-blocking)
            setTimeout(async () => {
              try {
                const response = await authApi.validate();
                if (!response.success) {
                  console.warn('⚠️ Background token validation failed');
                }
              } catch (error) {
                console.warn('⚠️ Background validation error (non-critical):', error);
              }
            }, 1000);
            
            return;
          }

          // If we have tokens but no user data, clear and set as unauthenticated
          console.log('⚠️ Has tokens but no user data, clearing and setting as unauthenticated');
          clearTimeout(initializationTimeout);
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
          console.error('❌ Critical initialization error:', error);
          clearTimeout(initializationTimeout);
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