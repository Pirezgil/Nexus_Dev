// ERP Nexus - Dashboard Layout
// CORRIGIDO: Simplificado para usar Sidebar da Biblioteca_visual.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Menu, 
  Search, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown,
  Settings,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

// REFATORADO: Importar da nova biblioteca de componentes modular
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Sidebar } from '@/components/ui';
import { useAuthStore, useCurrentUser, usePermissions } from '@/stores/auth';
import { useUIStore, useToast } from '@/stores/ui';
import { cn } from '@/utils';
import { SIDEBAR_ITEMS, filterSidebarItemsByPermissions } from '@/config/sidebar';
import { UserAvatar } from '@/components/ui/UserAvatar';

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
  const { isAuthenticated, isLoading, logout } = useAuthStore();
  const { user, displayName, company } = useCurrentUser();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { success, error } = useToast();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const permissions = usePermissions();

  // Redirect to login if not authenticated with timeout safety
  React.useEffect(() => {
    // Timeout de segurança: se está carregando há mais de 10 segundos, forçar redirect
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ Auth loading timeout reached, forcing redirect to login');
        router.push('/login');
      }
    }, 10000); // 10 segundos

    if (!isLoading && !isAuthenticated) {
      console.log('🔄 DashboardLayout: Redirecting to login - not authenticated');
      router.push('/login');
    }

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      success('Logout realizado', 'Até logo!');
      router.push('/login');
    } catch (err) {
      error('Erro no logout', 'Tente novamente');
    }
  };

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as Element)?.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // CORRIGIDO: Removido useEffect não necessário

  // REFATORADO: Usar configuração centralizada do sidebar
  const sidebarItems = filterSidebarItemsByPermissions(SIDEBAR_ITEMS, permissions);

  // Show loading or redirect with timeout protection
  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F8FAFC' }}
      >
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 text-sm">
            Carregando sistema...
          </p>
          <button
            onClick={() => {
              console.log('🔄 User clicked retry, forcing logout and redirect');
              logout();
              router.push('/login');
            }}
            className="mt-4 text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Clique aqui se a tela não carregar em alguns segundos
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div 
      className="min-h-screen flex"
      style={{ backgroundColor: '#F8FAFC' }} // CORRIGIDO: bgLight
    >
      {/* CORRIGIDO: Sidebar seguindo padrão do Dashboard */}
      <Sidebar />

      {/* Main content */}
      <div 
        className={cn(
          `flex-1 flex flex-col transition-all duration-300`,
          // No mobile, sem margin (sidebar sobrepõe)
          'lg:ml-64', // Desktop: margin left padrão
          sidebarCollapsed && 'lg:ml-16' // Desktop: margin left reduzido quando collapsed
        )}
      >
        {/* CORRIGIDO: Header seguindo padrão do Dashboard */}
        <header 
          className="bg-white border-b px-6 py-4"
          style={{ 
            borderColor: '#E2E8F0'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div>
                {title && (
                  <h1 
                    className="text-2xl font-semibold"
                    style={{ color: '#020617' }} // CORRIGIDO: textPrimary
                  >
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p style={{ color: '#64748B' }}> {/* CORRIGIDO: textSecondary */}
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* User Dropdown */}
            <div className="flex items-center space-x-4">
              <div className="relative user-menu-container">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <UserAvatar size="sm" />
                  <span style={{ color: '#020617' }}>{displayName}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {/* User Info Section */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <UserAvatar size="md" />
                        <div className="flex-1">
                          <h3 className="font-semibold" style={{ color: '#020617' }}>{displayName}</h3>
                          <p className="text-sm" style={{ color: '#64748B' }}>{user?.email}</p>
                          <p className="text-xs capitalize" style={{ color: '#94A3B8' }}>{user?.role?.toLowerCase()}</p>
                        </div>
                      </div>
                      
                      {user?.company && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm" style={{ color: '#475569' }}>
                            <span className="font-medium">Empresa:</span> {user.company.name}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Menu Options */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push('/settings');
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-500" />
                        <span style={{ color: '#334155' }}>Meu Perfil</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push('/settings');
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                        <span style={{ color: '#334155' }}>Configurações</span>
                      </button>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-red-50 rounded-md transition-colors text-red-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};