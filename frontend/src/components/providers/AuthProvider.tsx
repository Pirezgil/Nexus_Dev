// ERP Nexus - AuthProvider Component
// Centraliza inicialização da autenticação e gerencia estados globais

'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { status, initialize, isInitialized } = useAuthStore();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Inicializar autenticação apenas uma vez no carregamento da aplicação
  useEffect(() => {
    if (!hasInitialized && !isInitialized) {
      console.log('🚀 AuthProvider: Inicializando autenticação...');
      initialize().finally(() => {
        setHasInitialized(true);
      });
    } else if (isInitialized && !hasInitialized) {
      // Se a store já foi inicializada (ex: SSR ou persistência), marcar como finalizado
      console.log('✅ AuthProvider: Store já inicializada, marcando como finalizado');
      setHasInitialized(true);
    }
  }, [initialize, hasInitialized, isInitialized]);

  // Mostrar loading enquanto não terminar a inicialização
  if (!isInitialized || status === 'initializing' || status === 'loading' || !hasInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
              ERP Nexus
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Inicializando sistema de autenticação...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar filhos quando a inicialização estiver completa
  return <>{children}</>;
};