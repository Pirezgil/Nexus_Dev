import React from 'react';
import { KPICardProps } from './KPICard.types';
import { customColors } from '../constants/colors';

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon: Icon, trend = 'neutral', loading = false }) => {
  const trendColors = {
    up: customColors.success,
    down: customColors.error,
    neutral: customColors.textSecondary
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: customColors.bgLight }}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-xl" style={{ backgroundColor: `${customColors.primary}15` }}>
          <Icon style={{ color: customColors.primary }} size={24} />
        </div>
        {change && (
          <span className="text-sm font-medium" style={{ color: trendColors[trend] }}>
            {change}
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold mb-1" style={{ color: customColors.textPrimary }}>{value}</h3>
      <p style={{ color: customColors.textSecondary }}>{title}</p>
    </div>
  );
};

export default KPICard;