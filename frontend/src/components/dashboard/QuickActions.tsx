// ERP Nexus - Quick Actions Component
// Componente para ações rápidas no dashboard

import React from 'react';
import { 
  Calendar, 
  Users, 
  BarChart3, 
  Settings, 
  Plus, 
  FileText, 
  Phone, 
  Clock,
  UserPlus,
  CalendarPlus,
  Search,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils';

// ====================================
// TYPES
// ====================================

interface QuickAction {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  onAction?: (actionId: string) => void;
  className?: string;
  layout?: 'grid' | 'list';
  size?: 'small' | 'medium' | 'large';
}

// ====================================
// DEFAULT ACTIONS
// ====================================

const defaultActions: QuickAction[] = [
  {
    id: 'new-appointment',
    title: 'Novo Agendamento',
    description: 'Agendar atendimento',
    icon: CalendarPlus,
    color: 'bg-blue-500 hover:bg-blue-600 text-white',
    href: '/agendamento/novo',
  },
  {
    id: 'new-customer',
    title: 'Cadastrar Cliente',
    description: 'Adicionar novo cliente',
    icon: UserPlus,
    color: 'bg-green-500 hover:bg-green-600 text-white',
    href: '/crm/novo',
  },
  {
    id: 'search-customer',
    title: 'Buscar Cliente',
    description: 'Encontrar cliente',
    icon: Search,
    color: 'bg-purple-500 hover:bg-purple-600 text-white',
    href: '/crm',
  },
  {
    id: 'view-schedule',
    title: 'Ver Agenda',
    description: 'Visualizar calendário',
    icon: Calendar,
    color: 'bg-orange-500 hover:bg-orange-600 text-white',
    href: '/agendamento',
  },
  {
    id: 'reports',
    title: 'Relatórios',
    description: 'Ver estatísticas',
    icon: BarChart3,
    color: 'bg-indigo-500 hover:bg-indigo-600 text-white',
    href: '/relatorios',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Enviar mensagem',
    icon: MessageCircle,
    color: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    href: '/agendamento',
    badge: 'Novo',
  },
];

// ====================================
// ACTION ITEM COMPONENT
// ====================================

interface ActionItemProps {
  action: QuickAction;
  onAction?: (actionId: string) => void;
  size?: 'small' | 'medium' | 'large';
  layout?: 'grid' | 'list';
}

const ActionItem: React.FC<ActionItemProps> = ({
  action,
  onAction,
  size = 'medium',
  layout = 'grid',
}) => {
  const Icon = action.icon;

  const handleClick = () => {
    if (action.disabled) return;
    
    if (action.onClick) {
      action.onClick();
    } else if (onAction) {
      onAction(action.id);
    } else if (action.href) {
      // In a real app, use router.push(action.href)
      console.log(`Navigate to: ${action.href}`);
    }
  };

  if (layout === 'list') {
    return (
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start h-auto p-3',
          action.disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleClick}
        disabled={action.disabled}
      >
        <div className="flex items-center space-x-3">
          <div className={cn(
            'p-2 rounded-lg',
            action.color.replace('text-white', '').replace('hover:bg-', 'bg-').split(' ')[0] + '/10'
          )}>
            <Icon className={cn(
              'h-4 w-4',
              action.color.replace('bg-', 'text-').replace('hover:bg-', '').replace('text-white', '').split(' ')[0]
            )} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{action.title}</span>
              {action.badge && (
                <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">
                  {action.badge}
                </span>
              )}
            </div>
            {action.description && (
              <p className="text-xs text-gray-500 mt-0.5">
                {action.description}
              </p>
            )}
          </div>
        </div>
      </Button>
    );
  }

  const sizeClasses = {
    small: 'h-16 text-xs',
    medium: 'h-20 text-sm',
    large: 'h-24 text-base',
  };

  return (
    <Button
      variant="outline"
      className={cn(
        'flex flex-col space-y-2 border-0 relative overflow-hidden',
        sizeClasses[size],
        action.color,
        action.disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={handleClick}
      disabled={action.disabled}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{action.title}</span>
      
      {action.badge && (
        <span className="absolute top-1 right-1 bg-white/20 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-full">
          {action.badge}
        </span>
      )}
    </Button>
  );
};

// ====================================
// MAIN COMPONENT
// ====================================

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAction,
  className,
  layout = 'grid',
  size = 'medium',
}) => {
  if (layout === 'list') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0 divide-y">
            {defaultActions.map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                onAction={onAction}
                size={size}
                layout="list"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Ações Rápidas</CardTitle>
        <CardDescription>
          Acesse rapidamente as funcionalidades mais utilizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {defaultActions.slice(0, 4).map((action) => (
            <ActionItem
              key={action.id}
              action={action}
              onAction={onAction}
              size={size}
              layout="grid"
            />
          ))}
        </div>
        
        {/* Additional actions in a secondary row */}
        {defaultActions.length > 4 && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {defaultActions.slice(4, 6).map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                onAction={onAction}
                size="small"
                layout="grid"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ====================================
// COMPACT QUICK ACTIONS
// ====================================

interface CompactQuickActionsProps {
  actions?: QuickAction[];
  onAction?: (actionId: string) => void;
  className?: string;
}

export const CompactQuickActions: React.FC<CompactQuickActionsProps> = ({
  actions = defaultActions.slice(0, 3),
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex space-x-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        
        const handleClick = () => {
          if (action.disabled) return;
          
          if (action.onClick) {
            action.onClick();
          } else if (onAction) {
            onAction(action.id);
          } else if (action.href) {
            console.log(`Navigate to: ${action.href}`);
          }
        };

        return (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className={cn(
              'flex items-center space-x-1',
              action.disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={handleClick}
            disabled={action.disabled}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{action.title}</span>
            {action.badge && (
              <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded-full ml-1">
                {action.badge}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
};

// ====================================
// FLOATING ACTION BUTTON
// ====================================

interface FloatingActionProps {
  onNewAppointment?: () => void;
  onNewCustomer?: () => void;
  className?: string;
}

export const FloatingAction: React.FC<FloatingActionProps> = ({
  onNewAppointment,
  onNewCustomer,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const actions = [
    {
      id: 'appointment',
      title: 'Agendamento',
      icon: CalendarPlus,
      onClick: onNewAppointment,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'customer',
      title: 'Cliente',
      icon: UserPlus,
      onClick: onNewCustomer,
      color: 'bg-green-500 hover:bg-green-600',
    },
  ];

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      {/* Action items */}
      {isOpen && (
        <div className="mb-4 space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                className="flex items-center space-x-2 animate-in slide-in-from-bottom-2 duration-200"
              >
                <span className="bg-white shadow-lg text-sm px-3 py-1 rounded-lg text-gray-700">
                  {action.title}
                </span>
                <Button
                  size="sm"
                  className={cn('rounded-full w-10 h-10 p-0 text-white', action.color)}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <Button
        size="lg"
        className={cn(
          'rounded-full w-14 h-14 p-0 text-white shadow-lg',
          'bg-blue-600 hover:bg-blue-700',
          isOpen && 'rotate-45'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default QuickActions;