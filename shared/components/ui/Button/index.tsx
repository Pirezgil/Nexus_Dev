import React, { useState } from 'react';
import { ButtonProps } from './Button.types';
import LoadingSpinner from '../LoadingSpinner';
import { customColors } from '../constants/colors';

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  icon: Icon,
  onClick,
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2';
  
  const getVariantStyles = (variant: string) => {
    const styles = {
      primary: {
        backgroundColor: customColors.primary,
        color: 'white',
        border: `1px solid #1E40AF`,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      },
      secondary: {
        backgroundColor: customColors.secondary,
        color: 'white'
      },
      success: {
        backgroundColor: customColors.success,
        color: 'white'
      },
      warning: {
        backgroundColor: customColors.warning,
        color: 'white'
      },
      error: {
        backgroundColor: customColors.error,
        color: 'white'
      },
      ghost: {
        color: customColors.secondary,
        backgroundColor: 'transparent'
      }
    };
    return styles[variant] || styles.primary;
  };

  const getHoverStyles = (variant: string) => {
    const hoverStyles = {
      primary: { backgroundColor: '#1D4ED8' },
      secondary: { backgroundColor: '#1E293B' },
      success: { backgroundColor: '#15803D' },
      warning: { backgroundColor: '#D97706' },
      error: { backgroundColor: '#B91C1C' },
      ghost: { 
        backgroundColor: '#E2E8F0', 
        color: customColors.textPrimary 
      }
    };
    return hoverStyles[variant] || hoverStyles.primary;
  };

  const variants = {
    primary: 'focus:ring-2 focus:ring-blue-500',
    secondary: 'focus:ring-2 focus:ring-gray-500',
    success: 'focus:ring-2 focus:ring-green-500',
    warning: 'focus:ring-2 focus:ring-yellow-500',
    error: 'focus:ring-2 focus:ring-red-500',
    ghost: 'focus:ring-2 focus:ring-blue-400'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const [isHovered, setIsHovered] = useState(false);

  const baseStyle = getVariantStyles(variant);
  const hoverStyle = getHoverStyles(variant);
  const currentStyle = isHovered ? { ...baseStyle, ...hoverStyle } : baseStyle;

  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]}`}
      style={currentStyle}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="sm" color="white" />
      ) : (
        <>
          {Icon && <Icon size={16} />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;