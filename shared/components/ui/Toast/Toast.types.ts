export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  type?: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}