// ERP Nexus - Sidebar Component
// Navegação principal do sistema

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  Calendar, 
  Settings, 
  BarChart3,
  Package,
  Phone,
  Menu,
  X,
  ChevronDown,
  Building2,
  UserCog,
  LogOut
} from 'lucide-react';

import { cn } from '@/utils';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui';
import { useAuthStore, useCurrentUser, usePermissions } from '@/stores/auth';

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  children?: Omit<SidebarItem, 'children'>[];
  permissions?: string[];
}

// Menu items baseado nos módulos implementados
const menuItems: SidebarItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard',
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: Users,
    href: '/crm',
  },
  {
    key: 'services',
    label: 'Serviços',
    icon: Package,
    href: '/services',
  },
  {
    key: 'scheduling',
    label: 'Agendamento',
    icon: Calendar,
    href: '/agendamento',
  },
  {
    key: 'reports',
    label: 'Relatórios',
    icon: BarChart3,
    href: '/relatorios',
    permissions: ['view_reports'],
  },
  {
    key: 'settings',
    label: 'Configurações',
    icon: Settings,
    href: '/settings',
    children: [
      {
        key: 'users',
        label: 'Usuários',
        icon: Users,
        href: '/settings/users',
        permissions: ['manage_users'],
      },
      {
        key: 'company',
        label: 'Empresa',
        icon: Building2,
        href: '/settings/company',
      },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { logout } = useAuthStore();
  const { user, company, displayName, initials, roleLabel } = useCurrentUser();
  const permissions = usePermissions();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  // Auto-expand current section
  React.useEffect(() => {
    const currentSection = menuItems.find(item => 
      pathname.startsWith(item.href) || 
      item.children?.some(child => pathname.startsWith(child.href))
    );
    
    if (currentSection && currentSection.children) {
      setExpandedItems(prev => new Set([...prev, currentSection.key]));
    }
  }, [pathname]);

  const toggleExpanded = (key: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isActive = (href: string) => {
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  const hasPermission = (itemPermissions?: string[]) => {
    if (!itemPermissions) return true;
    // Simplificado - em produção, implementar lógica completa de permissões
    return permissions.isManager || permissions.isAdmin;
  };

  // Debug: Log do menu filtrado
  console.log('🔍 Debug Sidebar:', {
    allMenuItems: menuItems.map(item => ({ key: item.key, permissions: item.permissions })),
    permissions,
    filteredItems: menuItems.filter(item => hasPermission(item.permissions)).map(item => item.key)
  });

  const filteredMenuItems = menuItems.filter(item => hasPermission(item.permissions));

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0',
          'dark:bg-gray-900 dark:border-gray-700',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white">
                ERP Nexus
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {company?.name || 'Sistema'}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {filteredMenuItems.map((item) => (
            <div key={item.key}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      'hover:bg-gray-100 dark:hover:bg-gray-800',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.label}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-gray-500 transition-transform',
                        expandedItems.has(item.key) && 'rotate-180'
                      )}
                    />
                  </button>
                  
                  {expandedItems.has(item.key) && (
                    <div className="ml-4 mt-2 space-y-1">
                      {item.children
                        .filter(child => hasPermission(child.permissions))
                        .map((child) => (
                          <Link
                            key={child.key}
                            href={child.href}
                            className={cn(
                              'flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors',
                              isActive(child.href)
                                ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600 dark:bg-blue-900/20'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <child.icon className="w-4 h-4" />
                            <span>{child.label}</span>
                            {child.badge && (
                              <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600 dark:bg-blue-900/20'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {roleLabel}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </>
  );
};