// ERP Nexus - Home Page
// Página inicial com redirecionamento automático baseado na autenticação

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function HomePage() {
  const router = useRouter();
  const { status, isAuthenticated, isInitialized } = useAuthStore();

  // Redirecionar baseado no status de autenticação APENAS após inicialização completa
  useEffect(() => {
    // Só redirecionar quando a autenticação estiver totalmente inicializada
    if (!isInitialized) {
      console.log('⏳ HomePage: Aguardando inicialização da autenticação...');
      return;
    }

    console.log('🔍 HomePage: Status de autenticação determinado:', { 
      status, 
      isAuthenticated, 
      isInitialized 
    });

    // Delay redirect slightly to prevent flash and ensure smooth UX
    const redirectTimer = setTimeout(() => {
      if (isAuthenticated && status === 'authenticated') {
        console.log('✅ HomePage: Usuário autenticado, redirecionando para dashboard');
        router.replace('/dashboard');
      } else if (!isAuthenticated && (status === 'unauthenticated' || status === 'initializing')) {
        console.log('❌ HomePage: Usuário não autenticado, redirecionando para login');
        router.replace('/login');
      }
    }, 300); // Small delay for smooth transition

    return () => clearTimeout(redirectTimer);
  }, [status, isAuthenticated, isInitialized, router]);

  // Loading state enquanto aguarda a inicialização ou redirecionamento
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-700">ERP Nexus</h1>
          <p className="text-gray-500">
            {!isInitialized 
              ? 'Inicializando sistema...' 
              : 'Redirecionando...'
            }
          </p>
        </div>
      </div>
    </div>
  );
}