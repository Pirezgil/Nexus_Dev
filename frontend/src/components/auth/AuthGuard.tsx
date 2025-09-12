// ERP Nexus - AuthGuard Component (Enhanced)
// Protege rotas com lógica de autenticação robusta e tratamento de estados

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status, isAuthenticated, isInitialized, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  // Enhanced route protection with proper state management
  useEffect(() => {
    // Only proceed after full initialization
    if (!isInitialized || isLoading) return;

    console.log('🛡️ AuthGuard comprehensive check:', { 
      pathname,
      status, 
      isAuthenticated, 
      isInitialized,
      isLoading,
      redirected: redirected.current
    });

    // Define public routes that don't require authentication
    const publicRoutes = ['/login', '/register', '/forgot-password'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // Handle unauthenticated users
    if (!isAuthenticated && status === 'unauthenticated') {
      if (!isPublicRoute && !redirected.current) {
        console.log('❌ AuthGuard: User not authenticated, redirecting to login');
        redirected.current = true;
        
        // Store current path for redirect after login
        if (pathname !== '/login' && pathname !== '/') {
          sessionStorage.setItem('redirectAfterLogin', pathname);
        }
        
        router.replace('/login');
        return;
      }
    }

    // Handle authenticated users trying to access public routes
    if (isAuthenticated && status === 'authenticated') {
      if (isPublicRoute && !redirected.current) {
        console.log('✅ AuthGuard: Authenticated user accessing public route, redirecting to dashboard');
        redirected.current = true;
        
        // Check for redirect path from login
        const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
        if (pathname === '/login') {
          sessionStorage.removeItem('redirectAfterLogin');
          router.replace(redirectPath);
        } else {
          router.replace('/dashboard');
        }
        return;
      }
    }

    // Reset redirect flag on successful navigation
    if (redirected.current && isAuthenticated && !isPublicRoute) {
      redirected.current = false;
    }
  }, [status, isAuthenticated, isInitialized, isLoading, router, pathname]);

  // Show loading during initialization only
  if (!isInitialized) {
    console.log('⏳ AuthGuard: Waiting for initialization -', { isInitialized, status });
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
              ERP Nexus
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Inicializando sistema...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle public routes - render immediately if accessing public route
  const publicRoutes = ['/login', '/register', '/forgot-password'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    console.log('🌐 AuthGuard: Rendering public route');
    return <>{children}</>;
  }

  // Handle protected routes - only render if authenticated
  if (status === 'authenticated' && isAuthenticated) {
    console.log('✅ AuthGuard: Rendering protected content');
    return <>{children}</>;
  }

  // Fallback state - show loading while redirect is processed
  console.log('⏳ AuthGuard: Fallback state, showing loading');
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <div className="space-y-2">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Verificando acesso...
          </p>
        </div>
      </div>
    </div>
  );
}