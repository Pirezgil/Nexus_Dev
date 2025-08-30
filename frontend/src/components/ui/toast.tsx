// ERP Nexus - Toast Component
// Sistema de notificações baseado no design system

import * as React from 'react';
import { cn } from '@/utils';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const toastVariants = {
  success: {
    container: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/30 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  error: {
    container: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  warning: {
    container: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/30 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
  },
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/30 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const variant = toastVariants[toast.type];
  const Icon = variant.icon;

  React.useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg transition-all',
        'animate-in slide-in-from-top-full duration-300',
        variant.container
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={cn('h-5 w-5', variant.iconColor)} />
          </div>
          
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.message && (
              <p className="mt-1 text-sm opacity-90">{toast.message}</p>
            )}
          </div>
          
          <div className="ml-4 flex flex-shrink-0">
            <button
              className="inline-flex rounded-md hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2"
              onClick={() => onRemove(toast.id)}
            >
              <span className="sr-only">Fechar</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end px-4 py-6 sm:items-start sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};