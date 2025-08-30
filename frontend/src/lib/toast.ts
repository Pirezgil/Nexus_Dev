// ERP Nexus - Toast Utility
// Utilitário simples para notificações

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// Toast implementation simples para compatibilidade
export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    console.log('✅ Success:', message);
    // TODO: Integrar com sistema de toast existente
  },
  
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    console.log('❌ Error:', message);
    // TODO: Integrar com sistema de toast existente
  },
  
  warning: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    console.log('⚠️ Warning:', message);
    // TODO: Integrar com sistema de toast existente
  },
  
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => {
    console.log('ℹ️ Info:', message);
    // TODO: Integrar com sistema de toast existente
  },
};

export default { toast };