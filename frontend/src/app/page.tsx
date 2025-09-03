// ERP Nexus - Home Page
// Página inicial com redirecionamento automático

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  // Inicializar autenticação na primeira renderização
  useEffect(() => {
    const initAuth = async () => {
      await initialize();
    };
    initAuth();
  }, [initialize]);

  // Redirecionar baseado no status de autenticação com timeout de segurança
  useEffect(() => {
    // Timeout de segurança: se está carregando há mais de 8 segundos, forçar redirect para login
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ HomePage auth loading timeout, redirecting to login');
        router.replace('/login');
      }
    }, 8000); // 8 segundos

    if (!isLoading) {
      if (isAuthenticated) {
        console.log('✅ HomePage: User authenticated, redirecting to dashboard');
        router.replace('/dashboard');
      } else {
        console.log('❌ HomePage: User not authenticated, redirecting to login');
        router.replace('/login');
      }
    }

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, router]);

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-gray-700 mb-2">ERP Nexus</h1>
        <p className="text-gray-500">Carregando sistema...</p>
      </div>
    </div>
  );
}
