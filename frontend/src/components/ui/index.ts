// Temporary index file to fix build issues
export { Button } from './button';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
export { Input } from './input';
export { LoadingSpinner } from './loading-spinner';
export { KPICard } from './kpi-card';

// Import from other components
export { Alert } from './alert';
export { Select } from './select';
export { DataTable } from './data-table';

// Temporary Modal alias for Dialog (for compatibility)
export { Dialog as Modal } from './dialog';

// Import actual Sidebar component
export { Sidebar } from '../layout/Sidebar';

// Export customColors for compatibility
export const customColors = {
  primary: '#2563EB',
  secondary: '#334155',
  accent: '#3B82F6',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  bgLight: '#F8FAFC',
  bgDark: '#0F172A',
  textPrimary: '#020617',
  textSecondary: '#64748B'
};