import React from 'react';
import { InputProps } from './Input.types';
import { customColors } from '../constants/colors';

const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  required = false, 
  icon: Icon,
  placeholder,
  ...props 
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium" style={{ color: customColors.textPrimary }}>
          {label} {required && <span style={{ color: customColors.error }}>*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: customColors.textSecondary }} size={18} />
        )}
        <input
          className={`w-full rounded-lg border transition-all outline-none ${
            Icon ? 'pl-10 pr-3 py-2.5' : 'px-3 py-2.5'
          } ${error ? 'border-red-500' : 'border-gray-300'}`}
          style={{
            backgroundColor: customColors.bgLight,
            color: customColors.textPrimary,
            borderColor: error ? customColors.error : '#D1D5DB',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = customColors.primary;
            e.target.style.boxShadow = `0 0 0 2px ${customColors.primary}25`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? customColors.error : '#D1D5DB';
            e.target.style.boxShadow = 'none';
          }}
          placeholder={placeholder}
          {...props}
        />
      </div>
      {error && <p className="text-sm" style={{ color: customColors.error }}>{error}</p>}
    </div>
  );
};

export default Input;