// ERP Nexus - UI Store (Zustand)
// Gerenciamento de estado da interface do usuário

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UIStore, ToastMessage } from '@/types';

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'light',
      toasts: [],

      // Sidebar functions
      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed });
      },

      toggleSidebarCollapsed: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      // Theme functions
      setTheme: (theme: 'light' | 'dark') => {
        set({ theme });
        
        // Aplicar tema no DOM
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(theme);
        }
      },

      // Toast functions
      addToast: (toast: Omit<ToastMessage, 'id'>) => {
        const id = Date.now().toString();
        const newToast: ToastMessage = {
          ...toast,
          id,
          duration: toast.duration || 4000,
        };

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }));

        // Auto-remove toast após duration
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, newToast.duration);
        }
      },

      removeToast: (id: string) => {
        set((state) => ({
          toasts: state.toasts.filter(toast => toast.id !== id),
        }));
      },
    }),
    {
      name: 'erp-nexus-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

// Hook para toast notifications
export const useToast = () => {
  const { addToast } = useUIStore();

  return {
    success: (title: string, message: string = '') => 
      addToast({ type: 'success', title, message }),
    
    error: (title: string, message: string = '') => 
      addToast({ type: 'error', title, message }),
    
    warning: (title: string, message: string = '') => 
      addToast({ type: 'warning', title, message }),
    
    info: (title: string, message: string = '') => 
      addToast({ type: 'info', title, message }),

    custom: (toast: Omit<ToastMessage, 'id'>) => 
      addToast(toast),
  };
};