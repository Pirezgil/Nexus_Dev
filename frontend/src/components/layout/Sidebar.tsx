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
  LogOut,
  ChevronLeft,
  ChevronRight
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
  isOpen?: boolean;
  onToggle?: () => void;
  items?: SidebarItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  className, 
  isOpen = true, 
  onToggle,
  items 
}) => {
  const pathname = usePathname();
  const { 
    sidebarOpen: storeOpen, 
    setSidebarOpen, 
    sidebarCollapsed: isCollapsed, 
    setSidebarCollapsed: setIsCollapsed 
  } = useUIStore();
  const { logout } = useAuthStore();
  const { user, company, displayName, initials, roleLabel } = useCurrentUser();
  const permissions = usePermissions();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
  
  // Use props or store state
  const sidebarOpen = isOpen ?? storeOpen;
  const toggleSidebar = onToggle ?? (() => setSidebarOpen(!sidebarOpen));

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

  const filteredMenuItems = (items || menuItems).filter(item => hasPermission(item.permissions));

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
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out',
          'dark:bg-gray-900 dark:border-gray-700',
          // Mobile behavior - fixed position
          'fixed inset-y-0 left-0 z-50 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Width based on collapsed state
          isCollapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center border-b border-gray-200 dark:border-gray-700">
          <div className={cn("flex items-center transition-all duration-300", isCollapsed ? "px-2" : "px-6")}>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-white">
                    ERP Nexus
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {company?.name || 'Sistema'}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2"
            onClick={toggleSidebar}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 py-6 space-y-2 overflow-y-auto", isCollapsed ? "px-2" : "px-4")}>
          {filteredMenuItems.map((item) => (
            <div key={item.key}>
              {item.children ? (
                <>
                  <button
                    onClick={() => !isCollapsed && toggleExpanded(item.key)}
                    className={cn(
                      'w-full flex items-center rounded-lg transition-colors group',
                      isCollapsed ? 'justify-center px-3 py-2' : 'justify-between px-3 py-2',
                      'hover:bg-gray-100 dark:hover:bg-gray-800',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className={cn("flex items-center", isCollapsed ? "" : "space-x-3")}>
                      <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      {!isCollapsed && (
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-gray-500 transition-transform',
                          expandedItems.has(item.key) && 'rotate-180'
                        )}
                      />
                    )}
                  </button>
                  
                  {!isCollapsed && expandedItems.has(item.key) && (
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
                            onClick={toggleSidebar}
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
                    'flex items-center rounded-lg transition-colors group',
                    isCollapsed ? 'justify-center px-3 py-2' : 'space-x-3 px-3 py-2',
                    'text-sm font-medium',
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600 dark:bg-blue-900/20'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                  onClick={toggleSidebar}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className={cn("border-t border-gray-200 dark:border-gray-700", isCollapsed ? "p-2" : "p-4")}>
          <div className={cn("flex items-center mb-3", isCollapsed ? "justify-center" : "space-x-3")}>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{initials}</span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size={isCollapsed ? "icon" : "sm"}
            className={cn(isCollapsed ? "" : "w-full")}
            onClick={handleLogout}
            title={isCollapsed ? "Sair" : undefined}
          >
            <LogOut className={cn("w-4 h-4", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Sair"}
          </Button>
        </div>
        
        {/* Toggle button - floating on the right border */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -right-3 z-10',
            'w-6 h-6 bg-blue-600 border border-blue-700 rounded-full shadow-lg',
            'flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:bg-blue-700',
            'hidden lg:flex', // Only show on desktop
            'dark:bg-blue-600 dark:border-blue-500 dark:hover:bg-blue-500'
          )}
          title={isCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-white" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-white" />
          )}
        </button>
      </div>
    </>
  );
};