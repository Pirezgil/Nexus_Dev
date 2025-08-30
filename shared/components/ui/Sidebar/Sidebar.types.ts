import { LucideIcon } from 'lucide-react';

export interface SidebarItem {
  icon: LucideIcon;
  label: string;
  href: string;
  // Removido 'active' - será determinado automaticamente pela rota
}

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  items?: SidebarItem[];
}