// ERP Nexus - Revenue Chart Component
// Componente para exibir gráfico de faturamento com Chart.js

'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ====================================
// TYPES
// ====================================

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    appointments: number;
  }>;
  period: string;
  className?: string;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

const formatDateLabel = (dateString: string, period: string): string => {
  const date = new Date(dateString);
  
  switch (period) {
    case 'today':
      return date.getHours() + 'h';
    case 'week':
      return date.toLocaleDateString('pt-BR', { 
        weekday: 'short' 
      });
    case 'month':
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    case 'quarter':
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'short' 
      });
    default:
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ====================================
// COMPONENT
// ====================================

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  period,
  className,
}) => {
  // Prepare chart data
  const chartData = {
    labels: data.map(item => formatDateLabel(item.date, period)),
    datasets: [
      {
        label: 'Faturamento',
        data: data.map(item => item.revenue),
        borderColor: 'rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue-500 with opacity
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // Hide legend since we only have one dataset
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            return `Faturamento: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          color: '#6B7280', // gray-500
          font: {
            size: 12,
          },
        },
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)', // gray-500 with opacity
        },
        ticks: {
          color: '#6B7280', // gray-500
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return formatCurrency(value);
          },
        },
      },
    },
    elements: {
      point: {
        hoverBackgroundColor: 'rgb(59, 130, 246)',
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 2,
      },
    },
  };

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className={`h-64 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📈</div>
          <p className="text-gray-500 text-sm">
            Não há dados de faturamento para exibir
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// ====================================
// REVENUE CHART WITH STATS
// ====================================

interface RevenueChartWithStatsProps extends RevenueChartProps {
  totalRevenue: number;
  averageRevenue: number;
  growthPercentage: number;
}

export const RevenueChartWithStats: React.FC<RevenueChartWithStatsProps> = ({
  data,
  period,
  totalRevenue,
  averageRevenue,
  growthPercentage,
  className,
}) => {
  return (
    <div className={className}>
      {/* Stats Header */}
      <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <p className="text-gray-500">Total</p>
          <p className="font-semibold text-gray-900">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-gray-500">Média</p>
          <p className="font-semibold text-gray-900">
            {formatCurrency(averageRevenue)}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-gray-500">Crescimento</p>
          <p className={`font-semibold ${
            growthPercentage > 0 ? 'text-green-600' : 
            growthPercentage < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {growthPercentage > 0 && '+'}
            {growthPercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <RevenueChart data={data} period={period} />
    </div>
  );
};

export default RevenueChart;