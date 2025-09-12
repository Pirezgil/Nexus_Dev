// ERP Nexus - Dashboard Layout
// CORRIGIDO: Simplificado para usar Sidebar da Biblioteca_visual.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
// REFATORADO: Importar apenas componentes necessários para layout simplificado
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthStore } from '@/stores/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, isInitialized, status } = useAuthStore();

  // Enhanced authentication check with proper initialization handling
  React.useEffect(() => {
    if (!isInitialized) return; // Wait for auth initialization

    // Safety timeout: if loading for too long, provide user with option to retry
    const timeout = setTimeout(() => {
      if (isLoading && status === 'loading') {
        console.warn('⚠️ DashboardLayout: Auth loading timeout reached');
        // Don't force redirect immediately, let user decide
      }
    }, 15000); // 15 seconds - increased timeout

    // Only redirect if fully initialized and not authenticated
    if (isInitialized && !isLoading && !isAuthenticated) {
      console.log('🔄 DashboardLayout: User not authenticated, redirecting to login');
      
      // Store current path for redirect after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
      
      router.replace('/login');
    }

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, router, isInitialized, status]);

  // Show loading with better UX and error handling
  if (!isInitialized || isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F8FAFC' }}
      >
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 text-sm">
            {!isInitialized ? 'Inicializando sistema...' : 'Verificando autenticação...'}
          </p>
          <button
            onClick={() => {
              console.log('🔄 User clicked retry, forcing logout and redirect');
              logout();
              router.replace('/login');
            }}
            className="mt-4 text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Clique aqui se a tela não carregar em alguns segundos
          </button>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated (will be handled by redirect)
  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F8FAFC' }}
      >
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 text-sm">
            Redirecionando para login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Content-only layout - no sidebar (already rendered by main layout) */}
      <div className="w-full">
        {/* Simple header with title/subtitle */}
        {(title || subtitle) && (
          <div className="mb-6">
            {title && (
              <h1 
                className="text-2xl font-semibold"
                style={{ color: '#020617' }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ color: '#64748B' }}>
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Main content area */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};