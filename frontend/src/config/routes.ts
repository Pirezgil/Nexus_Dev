/**
 * Centralized route definitions for consistent navigation
 * All route paths should be imported from this file
 */

export const ROUTES = {
  // Authentication
  LOGIN: '/login',
  LOGOUT: '/logout',
  
  // Main Dashboard
  DASHBOARD: '/dashboard',
  
  // CRM Module
  CRM: {
    LIST: '/crm',
    NEW: '/crm/novo',
    DETAIL: (id: string) => `/crm/${id}`,
    EDIT: (id: string) => `/crm/${id}/edit`,
    SEARCH: '/crm/search',
  },
  
  // Services Module
  SERVICES: {
    LIST: '/services',
    NEW: '/services/novo',
    DETAIL: (id: string) => `/services/${id}`,
    EDIT: (id: string) => `/services/${id}/edit`,
    CATEGORIES: '/services/categories',
  },
  
  // Scheduling Module
  AGENDAMENTO: {
    LIST: '/agendamento',
    NEW: '/agendamento/novo',
    DETAIL: (id: string) => `/agendamento/${id}`,
    EDIT: (id: string) => `/agendamento/${id}/edit`,
    CALENDAR: '/agendamento/calendario',
  },
  
  // Reports
  RELATORIOS: '/relatorios',
  
  // Settings
  SETTINGS: {
    ROOT: '/settings',
    USERS: '/settings/users',
    COMPANY: '/settings/company',
    CRM: '/settings/crm',
    PROFILE: '/settings/profile',
  },
  
  // API Endpoints
  API: {
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      VALIDATE: '/api/auth/validate',
    },
    CRM: {
      CUSTOMERS: '/api/customers',
      CUSTOMER_BY_ID: (id: string) => `/api/customers/${id}`,
      CUSTOMER_SEARCH: '/api/customers/search',
      CUSTOMER_TAGS: '/api/customers/tags',
    },
    SERVICES: {
      SERVICES: '/api/services',
      SERVICE_BY_ID: (id: string) => `/api/services/${id}`,
      PROFESSIONALS: '/api/services/professionals',
      CATEGORIES: '/api/services/categories',
    },
    AGENDAMENTO: {
      APPOINTMENTS: '/api/appointments',
      APPOINTMENT_BY_ID: (id: string) => `/api/appointments/${id}`,
    },
  },
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RouteValue = typeof ROUTES[RouteKey];

/**
 * Helper function to generate breadcrumbs based on pathname
 */
export const generateBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [];
  
  let currentPath = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    let label = segment;
    let href = currentPath;
    
    // Map specific segments to human-readable labels
    switch (segment) {
      case 'crm':
        label = 'CRM';
        break;
      case 'agendamento':
        label = 'Agendamentos';
        break;
      case 'services':
        label = 'Serviços';
        break;
      case 'relatorios':
        label = 'Relatórios';
        break;
      case 'settings':
        label = 'Configurações';
        break;
      case 'dashboard':
        label = 'Dashboard';
        break;
      case 'novo':
        label = 'Novo';
        break;
      case 'edit':
        label = 'Editar';
        break;
      case 'users':
        label = 'Usuários';
        break;
      case 'company':
        label = 'Empresa';
        break;
      case 'calendario':
        label = 'Calendário';
        break;
      case 'categories':
        label = 'Categorias';
        break;
      default:
        // For IDs, try to keep them short
        if (segment.length > 10 && segment.includes('-')) {
          label = segment.substring(0, 8) + '...';
        }
        break;
    }
    
    breadcrumbs.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      href,
      current: i === segments.length - 1,
    });
  }
  
  return breadcrumbs;
};

/**
 * Helper function to validate if a route exists
 */
export const isValidRoute = (path: string): boolean => {
  const normalizedPath = path.replace(/\/[^\/]*\/edit$/, '/edit')
                             .replace(/\/[^\/]*$/, '/:id');
  
  const allRoutes = Object.values(ROUTES).flat();
  const stringRoutes = allRoutes.filter(route => typeof route === 'string');
  
  return stringRoutes.some(route => 
    route === path || 
    route === normalizedPath ||
    path.startsWith(route)
  );
};