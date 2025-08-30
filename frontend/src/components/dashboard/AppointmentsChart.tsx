// ERP Nexus - Appointments Chart Component
// Componente para exibir gráfico de agendamentos com Chart.js

'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ====================================
// TYPES
// ====================================

interface AppointmentsChartProps {
  data: Array<{
    date: string;
    scheduled: number;
    completed: number;
    cancelled: number;
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

// ====================================
// COMPONENT
// ====================================

export const AppointmentsChart: React.FC<AppointmentsChartProps> = ({
  data,
  period,
  className,
}) => {
  // Prepare chart data
  const chartData = {
    labels: data.map(item => formatDateLabel(item.date, period)),
    datasets: [
      {
        label: 'Agendados',
        data: data.map(item => item.scheduled),
        backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Concluídos',
        data: data.map(item => item.completed),
        backgroundColor: 'rgba(34, 197, 94, 0.8)', // green-500
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
      {
        label: 'Cancelados',
        data: data.map(item => item.cancelled),
        backgroundColor: 'rgba(239, 68, 68, 0.8)', // red-500
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
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
        position: 'top' as const,
        labels: {
          color: '#374151', // gray-700
          font: {
            size: 12,
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            return `${label}: ${context.parsed.y} agendamento${context.parsed.y !== 1 ? 's' : ''}`;
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
          stepSize: 1,
          callback: function(value: any) {
            return Number.isInteger(value) ? value : '';
          },
        },
      },
    },
  };

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className={`h-64 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📅</div>
          <p className="text-gray-500 text-sm">
            Não há dados de agendamentos para exibir
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-64 ${className}`}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

// ====================================
// APPOINTMENTS CHART WITH STATS
// ====================================

interface AppointmentsChartWithStatsProps extends AppointmentsChartProps {
  totalScheduled: number;
  totalCompleted: number;
  totalCancelled: number;
  completionRate: number;
}

export const AppointmentsChartWithStats: React.FC<AppointmentsChartWithStatsProps> = ({
  data,
  period,
  totalScheduled,
  totalCompleted,
  totalCancelled,
  completionRate,
  className,
}) => {
  return (
    <div className={className}>
      {/* Stats Header */}
      <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
        <div className="text-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-1"></div>
          <p className="text-gray-500">Agendados</p>
          <p className="font-semibold text-gray-900">{totalScheduled}</p>
        </div>
        
        <div className="text-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
          <p className="text-gray-500">Concluídos</p>
          <p className="font-semibold text-gray-900">{totalCompleted}</p>
        </div>
        
        <div className="text-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
          <p className="text-gray-500">Cancelados</p>
          <p className="font-semibold text-gray-900">{totalCancelled}</p>
        </div>

        <div className="text-center">
          <p className="text-gray-500">Taxa</p>
          <p className={`font-semibold ${
            completionRate >= 80 ? 'text-green-600' : 
            completionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {completionRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <AppointmentsChart data={data} period={period} />
    </div>
  );
};

// ====================================
// SIMPLE APPOINTMENTS STATUS CHART
// ====================================

interface SimpleAppointmentsChartProps {
  scheduled: number;
  completed: number;
  cancelled: number;
  className?: string;
}

export const SimpleAppointmentsChart: React.FC<SimpleAppointmentsChartProps> = ({
  scheduled,
  completed,
  cancelled,
  className,
}) => {
  const total = scheduled + completed + cancelled;
  
  if (total === 0) {
    return (
      <div className={`h-32 flex items-center justify-center ${className}`}>
        <p className="text-gray-500 text-sm">
          Nenhum agendamento registrado
        </p>
      </div>
    );
  }

  const scheduledPercentage = (scheduled / total) * 100;
  const completedPercentage = (completed / total) * 100;
  const cancelledPercentage = (cancelled / total) * 100;

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Scheduled */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Agendados</span>
          </div>
          <span className="font-medium">{scheduled}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${scheduledPercentage}%` }}
          />
        </div>

        {/* Completed */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Concluídos</span>
          </div>
          <span className="font-medium">{completed}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completedPercentage}%` }}
          />
        </div>

        {/* Cancelled */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600">Cancelados</span>
          </div>
          <span className="font-medium">{cancelled}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-red-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${cancelledPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AppointmentsChart;