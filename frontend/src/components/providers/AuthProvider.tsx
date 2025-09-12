// ERP Nexus - AuthProvider Component
// Centraliza inicialização da autenticação e gerencia estados globais

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isSystemReady, setIsSystemReady] = useState(false);
  const { initialize, isInitialized, isLoading, status } = useAuthStore();
  const initializationStartedRef = useRef(false);

  // Initialize auth store on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (initializationStartedRef.current) {
        console.log('⚠️ AuthProvider: Initialization already started, skipping...');
        return;
      }

      initializationStartedRef.current = true;
      console.log('🔄 AuthProvider: Starting authentication initialization...');

      try {
        await initialize();
        console.log('✅ AuthProvider: Auth store initialized successfully');
      } catch (error) {
        console.error('❌ AuthProvider: Error initializing auth store:', error);
      }
    };

    initializeAuth();
  }, [initialize]);

  // Set system ready once auth is initialized with shorter timeout
  useEffect(() => {
    if (isInitialized) {
      console.log('✅ AuthProvider: Auth initialization complete, system ready');
      setIsSystemReady(true);
    } else {
      // Force system ready after 5 seconds to prevent infinite loading
      const forceReadyTimer = setTimeout(() => {
        console.warn('⚠️ AuthProvider: Forcing system ready due to initialization timeout');
        setIsSystemReady(true);
      }, 5000);
      
      return () => clearTimeout(forceReadyTimer);
    }
  }, [isInitialized]);

  // Show loading screen while auth is initializing
  if (!isSystemReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-700">
              ERP Nexus
            </h1>
            <p className="text-slate-600 text-sm">
              {status === 'initializing' ? 'Inicializando autenticação...' : 'Carregando sistema...'}
            </p>
            <p className="text-slate-400 text-xs">
              Isso pode levar alguns segundos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render children when auth system is ready
  return <>{children}</>;
};