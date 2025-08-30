// ERP Nexus - Configuração Centralizada do Sidebar
// Este arquivo centraliza TODOS os itens do menu lateral

import { 
  Home,
  Users,
  Package,
  Calendar,
  BarChart3,
  Settings
} from 'lucide-react';

export interface SidebarItem {
  icon: any;
  label: string;
  href: string;
  permissions?: string[];
}

/**
 * CONFIGURAÇÃO CENTRAL DO SIDEBAR
 * 
 * IMPORTANTE: Este é o ÚNICO lugar onde os itens do menu são definidos.
 * Todas as páginas devem importar deste arquivo.
 * 
 * Para adicionar um novo item:
 * 1. Importe o ícone do lucide-react
 * 2. Adicione o item no array abaixo
 * 3. Todos os componentes automaticamente terão o novo item
 */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    icon: Home,
    label: 'Dashboard',
    href: '/dashboard'
  },
  {
    icon: Users,
    label: 'CRM',
    href: '/crm'
  },
  {
    icon: Package,
    label: 'Serviços',
    href: '/services'
  },
  {
    icon: Calendar,
    label: 'Agendamento',
    href: '/agendamento'
  },
  {
    icon: BarChart3,
    label: 'Relatórios',
    href: '/relatorios',
    permissions: ['view_reports']
  },
  {
    icon: Settings,
    label: 'Configurações',
    href: '/settings'
  }
];

/**
 * Função utilitária para filtrar itens por permissão
 */
export const filterSidebarItemsByPermissions = (
  items: SidebarItem[], 
  permissions: { isManager: boolean; isAdmin: boolean }
): SidebarItem[] => {
  return items.filter(item => {
    if (!item.permissions) return true;
    return permissions.isManager || permissions.isAdmin;
  });
};