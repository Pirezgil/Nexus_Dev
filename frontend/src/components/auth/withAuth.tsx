// ERP Nexus - withAuth HOC
// Higher Order Component para proteção de rotas

'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { User } from '@/types';

interface WithAuthOptions {
  requiredRoles?: User['role'][];
  fallbackPath?: string;
  redirectToLogin?: boolean;
}

/**
 * HOC que protege componentes/páginas, garantindo que apenas usuários autenticados
 * e com as devidas permissões possam acessar
 */
export function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options: WithAuthOptions = {}
) {
  const {
    requiredRoles,
    fallbackPath = '/dashboard',
    redirectToLogin = true,
  } = options;

  return function AuthenticatedComponent(props: T) {
    const router = useRouter();
    const { 
      user, 
      isAuthenticated, 
      isLoading,
      status,
      isInitialized
    } = useAuthStore();

    // Enhanced authentication check with proper error handling and SSR safety
    useEffect(() => {
      if (!isInitialized) return; // Wait for initialization

      // SSR SAFETY FIX: Check for window availability
      if (typeof window === 'undefined') return;

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 withAuth check:', { 
          isInitialized, 
          status, 
          isLoading, 
          isAuthenticated, 
          user: user?.email,
          pathname: window.location.pathname
        });
      }
      
      // Only redirect if not authenticated and redirectToLogin is true
      if (!isLoading && !isAuthenticated && redirectToLogin) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ withAuth: Redirecting to login - not authenticated');
        }
        
        // Store current path for redirect after login
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/') {
          sessionStorage.setItem('redirectAfterLogin', currentPath);
        }
        
        router.replace('/login');
      }
    }, [isInitialized, isAuthenticated, isLoading, router, redirectToLogin, user, status]);

    // Enhanced role-based access control
    useEffect(() => {
      if (!isInitialized || isLoading || !isAuthenticated) return;
      
      if (user && requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.includes(user.role);
        
        if (!hasRequiredRole) {
          console.warn(`Access denied. Required roles: ${requiredRoles.join(', ')}, user role: ${user.role}`);
          router.replace('/unauthorized');
        }
      }
    }, [isInitialized, isAuthenticated, isLoading, user, router, requiredRoles]);

    // Show loading screen only during critical loading states
    if (!isInitialized || (isLoading && status === 'initializing')) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-600 dark:text-gray-400">
              Verificando autenticação...
            </p>
          </div>
        </div>
      );
    }

    // Se não está autenticado, não renderizar nada (redirecionamento acontece no useEffect)
    if (!isAuthenticated && redirectToLogin) {
      return null;
    }

    // Se não está autenticado mas não deve redirecionar, mostrar erro
    if (!isAuthenticated && !redirectToLogin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m0-15a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Acesso Negado
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Você precisa estar autenticado para acessar esta página.
            </p>
          </div>
        </div>
      );
    }

    // Verificar permissões de role
    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Permissão Insuficiente
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Você não tem permissão para acessar esta página.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
              <p><strong>Seu perfil:</strong> {user.role}</p>
              <p><strong>Perfis necessários:</strong> {requiredRoles.join(', ')}</p>
            </div>
            <button
              onClick={() => router.push(fallbackPath)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      );
    }

    // Renderizar componente protegido
    return <WrappedComponent {...props} />;
  };
}

// Export types para uso externo
export type { WithAuthOptions };

// Hook personalizado para verificar permissões
export const useAuthGuard = (options: WithAuthOptions = {}) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { requiredRoles } = options;

  const hasAccess = React.useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (!requiredRoles) return true;
    return requiredRoles.includes(user.role);
  }, [isAuthenticated, user, requiredRoles]);

  return {
    hasAccess,
    isAuthenticated,
    isLoading,
    user,
    userRole: user?.role,
    canAccess: (roles: User['role'][]) => {
      return isAuthenticated && user && roles.includes(user.role);
    },
  };
};

export default withAuth;