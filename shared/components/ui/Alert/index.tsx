import React from 'react';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { AlertProps } from './Alert.types';
import { customColors } from '../constants/colors';

const Alert: React.FC<AlertProps> = ({ type = 'info', title, children, dismissible = true, onDismiss }) => {
  const alertStyles = {
    info: { 
      bg: `${customColors.accent}10`, 
      border: `${customColors.accent}30`, 
      text: customColors.accent 
    },
    success: { 
      bg: `${customColors.success}10`, 
      border: `${customColors.success}30`, 
      text: customColors.success 
    },
    warning: { 
      bg: `${customColors.warning}10`, 
      border: `${customColors.warning}30`, 
      text: customColors.warning 
    },
    error: { 
      bg: `${customColors.error}10`, 
      border: `${customColors.error}30`, 
      text: customColors.error 
    }
  };

  const icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle
  };

  const Icon = icons[type];
  const style = alertStyles[type];

  return (
    <div 
      className="border rounded-xl p-4 flex items-start space-x-3"
      style={{ 
        backgroundColor: style.bg, 
        borderColor: style.border,
        color: style.text 
      }}
    >
      <Icon size={20} />
      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div>{children}</div>
      </div>
      {dismissible && onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100">
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default Alert;