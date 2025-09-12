// ERP Nexus - Login Page (CORRIGIDA)
// Página de autenticação do sistema
// ✅ CONFORMIDADE: Design System + Nova Biblioteca Modular

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building } from 'lucide-react';
import { LoginForm } from '@/components/modules/auth/LoginForm';
import { useAuthStore } from '@/stores/auth';

// ✅ CORRIGIDO: Importação das cores do Design System
import { customColors } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    console.log('🔄 LoginPage useEffect:', { isAuthenticated, status: useAuthStore.getState().status });
    // Se já estiver logado, redirecionar para dashboard
    if (isAuthenticated) {
      console.log('✅ LoginPage: User already authenticated, redirecting to dashboard');
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ 
        background: `linear-gradient(135deg, ${customColors.bgLight} 0%, #E2E8F0 100%)` 
      }}
    >
      <div className="w-full max-w-md px-8 py-12 mx-4">
        <div 
          className="rounded-2xl shadow-xl border p-8"
          style={{
            backgroundColor: 'white',
            borderColor: '#E2E8F0'
          }}
        >
          {/* ✅ CORRIGIDO: Logo usando cores do Design System */}
          <div className="text-center mb-8">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4"
              style={{ backgroundColor: customColors.primary }}
            >
              <Building className="w-8 h-8 text-white" />
            </div>
            <h1 
              className="text-2xl font-bold"
              style={{ color: customColors.textPrimary }}
            >
              ERP Nexus
            </h1>
            <p 
              style={{ color: customColors.textSecondary }}
            >
              Sistema de Gestão Empresarial
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* ✅ CORRIGIDO: Footer usando cores do Design System */}
          <div className="mt-8 text-center text-xs" style={{ color: customColors.textSecondary }}>
            <p>© 2025 ERP Nexus. Todos os direitos reservados.</p>
            <p className="mt-1">Versão 1.0.0 MVP</p>
          </div>
        </div>
      </div>
    </div>
  );
}