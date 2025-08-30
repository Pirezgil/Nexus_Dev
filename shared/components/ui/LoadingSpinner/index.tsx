import React from 'react';
import { LoadingSpinnerProps } from './LoadingSpinner.types';

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', color = 'blue' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-${color}-200 border-t-${color}-600 rounded-full animate-spin`}></div>
  );
};

export default LoadingSpinner;