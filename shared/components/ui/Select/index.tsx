import React from 'react';
import { SelectProps } from './Select.types';
import { customColors } from '../constants/colors';

const Select: React.FC<SelectProps> = ({ label, error, required = false, options = [], ...props }) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium" style={{ color: customColors.textPrimary }}>
          {label} {required && <span style={{ color: customColors.error }}>*</span>}
        </label>
      )}
      <select
        className={`w-full rounded-lg border transition-all outline-none px-3 py-2.5 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        style={{
          backgroundColor: customColors.bgLight,
          color: customColors.textPrimary,
          borderColor: error ? customColors.error : '#D1D5DB'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = customColors.primary;
          e.target.style.boxShadow = `0 0 0 2px ${customColors.primary}25`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? customColors.error : '#D1D5DB';
          e.target.style.boxShadow = 'none';
        }}
        {...props}
      >
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm" style={{ color: customColors.error }}>{error}</p>}
    </div>
  );
};

export default Select;