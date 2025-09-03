// ERP Nexus - Alerts Panel Component
// Componente para exibir alertas e notificações importantes no dashboard

import React, { useState } from 'react';
import { AlertCircle, Info, CheckCircle, XCircle, X, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils';
import { formatTimeAgo } from '@/lib/dates';
import type { Alert as AlertType } from '@/hooks/api/use-dashboard';

// ====================================
// TYPES
// ====================================

interface AlertsPanelProps {
  alerts: AlertType[];
  onDismiss?: (alertId: string) => void;
  onMarkAsRead?: (alertId: string) => void;
  onViewAll?: () => void;
  className?: string;
  compact?: boolean;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

const getAlertConfig = (type: AlertType['type']) => {
  switch (type) {
    case 'info':
      return {
        icon: Info,
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        iconColor: 'text-blue-600',
        badgeColor: 'bg-blue-100 text-blue-800',
      };
    case 'warning':
      return {
        icon: AlertCircle,
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        iconColor: 'text-yellow-600',
        badgeColor: 'bg-yellow-100 text-yellow-800',
      };
    case 'error':
      return {
        icon: XCircle,
        color: 'bg-red-50 border-red-200 text-red-800',
        iconColor: 'text-red-600',
        badgeColor: 'bg-red-100 text-red-800',
      };
    case 'success':
      return {
        icon: CheckCircle,
        color: 'bg-green-50 border-green-200 text-green-800',
        iconColor: 'text-green-600',
        badgeColor: 'bg-green-100 text-green-800',
      };
    default:
      return {
        icon: Info,
        color: 'bg-gray-50 border-gray-200 text-gray-800',
        iconColor: 'text-gray-600',
        badgeColor: 'bg-gray-100 text-gray-800',
      };
  }
};


const getModuleLabel = (module: AlertType['module']): string => {
  switch (module) {
    case 'crm':
      return 'CRM';
    case 'services':
      return 'Serviços';
    case 'agendamento':
      return 'Agendamento';
    case 'system':
      return 'Sistema';
    default:
      return 'Sistema';
  }
};

// ====================================
// ALERT ITEM COMPONENT
// ====================================

interface AlertItemProps {
  alert: AlertType;
  onDismiss?: (alertId: string) => void;
  compact?: boolean;
}

const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  onDismiss,
  compact = false,
}) => {
  const config = getAlertConfig(alert.type);
  const Icon = config.icon;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(alert.id);
    }
  };

  if (compact) {
    return (
      <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">
                {alert.title}
              </p>
              <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                {alert.message}
              </p>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="ml-2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge className={cn('text-xs', config.badgeColor)}>
              {getModuleLabel(alert.module)}
            </Badge>
            <span className="text-xs text-gray-500">
              {formatTimeAgo(alert.createdAt)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Alert className={cn('relative', config.color)}>
      <Icon className={cn('h-4 w-4', config.iconColor)} />
      <AlertDescription className="pr-8">
        <div className="space-y-1">
          <div className="font-medium">{alert.title}</div>
          <div className="text-sm">{alert.message}</div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <Badge className={config.badgeColor}>
              {getModuleLabel(alert.module)}
            </Badge>
            <span className="opacity-75">
              {formatTimeAgo(alert.createdAt)}
            </span>
          </div>
        </div>
      </AlertDescription>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute top-2 right-2 h-6 w-6 p-0 text-current hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Alert>
  );
};

// ====================================
// MAIN COMPONENT
// ====================================

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onDismiss,
  onMarkAsRead,
  onViewAll,
  className,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group alerts by type for stats
  const alertsByType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const criticalAlertsCount = (alertsByType.error || 0) + (alertsByType.warning || 0);

  if (alerts.length === 0) {
    return (
      <div className={cn('text-center py-4', className)}>
        <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
        <p className="text-sm text-gray-600">
          Nenhum alerta no momento
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Tudo funcionando perfeitamente!
        </p>
      </div>
    );
  }

  const displayAlerts = isExpanded ? alerts : alerts.slice(0, 3);

  if (compact) {
    return (
      <div className={className}>
        <div className="space-y-0 divide-y divide-gray-100">
          {displayAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDismiss={onDismiss}
              compact={true}
            />
          ))}
        </div>
        
        {alerts.length > 3 && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Ver mais {alerts.length - 3} alertas
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Alertas</span>
            {criticalAlertsCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalAlertsCount}
              </Badge>
            )}
          </CardTitle>
          
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              Ver todos
            </Button>
          )}
        </div>

        {/* Quick stats */}
        {Object.keys(alertsByType).length > 1 && (
          <div className="flex space-x-4 text-xs mt-2">
            {alertsByType.error && (
              <div className="flex items-center space-x-1 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>{alertsByType.error} erro{alertsByType.error !== 1 ? 's' : ''}</span>
              </div>
            )}
            {alertsByType.warning && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span>{alertsByType.warning} aviso{alertsByType.warning !== 1 ? 's' : ''}</span>
              </div>
            )}
            {alertsByType.info && (
              <div className="flex items-center space-x-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>{alertsByType.info} info</span>
              </div>
            )}
            {alertsByType.success && (
              <div className="flex items-center space-x-1 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{alertsByType.success} sucesso</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {displayAlerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onDismiss={onDismiss}
            compact={false}
          />
        ))}
        
        {alerts.length > 3 && (
          <div className="text-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Ver mais {alerts.length - 3} alertas
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ====================================
// SIMPLE ALERTS BANNER
// ====================================

interface SimpleAlertsBannerProps {
  alerts: AlertType[];
  onDismissAll?: () => void;
  className?: string;
}

export const SimpleAlertsBanner: React.FC<SimpleAlertsBannerProps> = ({
  alerts,
  onDismissAll,
  className,
}) => {
  const criticalAlerts = alerts.filter(alert => alert.type === 'error' || alert.type === 'warning');
  
  if (criticalAlerts.length === 0) return null;

  const firstAlert = criticalAlerts[0];
  const config = getAlertConfig(firstAlert.type);
  const Icon = config.icon;

  return (
    <div className={cn('mb-6', className)}>
      <Alert className={config.color}>
        <Icon className={cn('h-4 w-4', config.iconColor)} />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span className="font-medium">{firstAlert.title}</span>
            {criticalAlerts.length > 1 && (
              <span className="ml-2 text-sm">
                +{criticalAlerts.length - 1} outros alertas
              </span>
            )}
          </div>
          {onDismissAll && (
            <Button variant="ghost" size="sm" onClick={onDismissAll}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AlertsPanel;