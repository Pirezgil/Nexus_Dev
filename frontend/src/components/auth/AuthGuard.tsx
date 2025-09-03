// ERP Nexus - AuthGuard Component
// Centraliza a lógica de proteção de rotas e gerencia estados de loading/autenticação

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status, initialize } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Inicializar verificação de autenticação na primeira renderização
  useEffect(() => {
    if (status === 'idle') {
      console.log('🔄 AuthGuard: Initializing authentication...');
      initialize();
    }
  }, [status, initialize]);

  // Redirecionar para login quando não autenticado
  useEffect(() => {
    console.log('🔍 AuthGuard status check:', { status, pathname });
    
    // Se a verificação terminou e o usuário não está autenticado, redireciona para login
    if (status === 'unauthenticated' && pathname !== '/login') {
      console.log('❌ AuthGuard: User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [status, router, pathname]);

  // Mostrar loader enquanto verifica a autenticação
  if (status === 'idle' || status === 'loading') {
    console.log('⏳ AuthGuard: Showing loading state');
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Verificando autenticação...
          </p>
        </div>
      </div>
    );
  }

  // Se autenticado, renderizar a página
  if (status === 'authenticated') {
    console.log('✅ AuthGuard: User authenticated, rendering protected content');
    return <>{children}</>;
  }

  // Se não autenticado e está na página de login, permitir renderização
  if (status === 'unauthenticated' && pathname === '/login') {
    console.log('📝 AuthGuard: Rendering login page');
    return <>{children}</>;
  }

  // Fallback: não renderizar nada (redirecionamento deve ter acontecido)
  console.log('🚫 AuthGuard: Blocking render - invalid state');
  return null;
}