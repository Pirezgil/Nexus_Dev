// ERP Nexus - AuthGuard Component (Refatorado)
// Protege rotas sem duplicar lógica de inicialização

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status, isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Redirecionar para login quando não autenticado (após inicialização)
  useEffect(() => {
    // Só agir após a inicialização estar completa
    if (!isInitialized) return;
    
    console.log('🛡️ AuthGuard status check:', { 
      pathname,
      status, 
      isAuthenticated, 
      isInitialized 
    });
    
    // Páginas que não requerem autenticação
    const publicRoutes = ['/login'];
    
    if (!isAuthenticated && status === 'unauthenticated') {
      if (!publicRoutes.includes(pathname)) {
        console.log('❌ AuthGuard: Usuário não autenticado, redirecionando para login');
        router.push('/login');
        return;
      }
    }

    // Se autenticado e tentando acessar páginas de login
    if (isAuthenticated && status === 'authenticated' && publicRoutes.includes(pathname)) {
      console.log('✅ AuthGuard: Usuário autenticado tentando acessar login, redirecionando para dashboard');
      router.push('/dashboard');
      return;
    }
  }, [status, isAuthenticated, isInitialized, router, pathname]);

  // Aguardar inicialização (AuthProvider já cuida disso, mas garantia extra)
  if (!isInitialized || status === 'loading') {
    console.log('⏳ AuthGuard: Aguardando inicialização...');
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  // Páginas públicas - renderizar sempre
  const publicRoutes = ['/login'];
  if (publicRoutes.includes(pathname)) {
    console.log('🌐 AuthGuard: Renderizando página pública');
    return <>{children}</>;
  }

  // Páginas protegidas - só renderizar se autenticado
  if (status === 'authenticated' && isAuthenticated) {
    console.log('✅ AuthGuard: Renderizando conteúdo protegido');
    return <>{children}</>;
  }

  // Estado intermediário - aguardar redirecionamento
  console.log('⏳ AuthGuard: Aguardando redirecionamento...');
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Redirecionando...
        </p>
      </div>
    </div>
  );
}