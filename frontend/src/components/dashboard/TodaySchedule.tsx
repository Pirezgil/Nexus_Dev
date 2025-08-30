// ERP Nexus - Today Schedule Component
// Componente para exibir agenda de hoje no dashboard

import React from 'react';
import { Calendar, Clock, User, Phone, CheckCircle, AlertCircle, XCircle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils';
import type { TodayAppointment } from '@/hooks/api/use-dashboard';

// ====================================
// TYPES
// ====================================

interface TodayScheduleProps {
  appointments: TodayAppointment[];
  onViewAll?: () => void;
  onAppointmentClick?: (appointmentId: string) => void;
  className?: string;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

const getStatusConfig = (status: TodayAppointment['status']) => {
  switch (status) {
    case 'scheduled':
      return {
        icon: Clock,
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        label: 'Agendado',
      };
    case 'confirmed':
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-700 border-green-200',
        label: 'Confirmado',
      };
    case 'in_progress':
      return {
        icon: Play,
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        label: 'Em andamento',
      };
    case 'completed':
      return {
        icon: CheckCircle,
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        label: 'Concluído',
      };
    case 'cancelled':
      return {
        icon: XCircle,
        color: 'bg-red-100 text-red-700 border-red-200',
        label: 'Cancelado',
      };
    default:
      return {
        icon: AlertCircle,
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        label: 'Desconhecido',
      };
  }
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
};

// ====================================
// APPOINTMENT ITEM COMPONENT
// ====================================

interface AppointmentItemProps {
  appointment: TodayAppointment;
  onClick?: (appointmentId: string) => void;
}

const AppointmentItem: React.FC<AppointmentItemProps> = ({
  appointment,
  onClick,
}) => {
  const statusConfig = getStatusConfig(appointment.status);
  const StatusIcon = statusConfig.icon;

  const handleClick = () => {
    if (onClick) {
      onClick(appointment.id);
    }
  };

  return (
    <Card 
      className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        onClick && 'hover:border-blue-300'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Left side - Main info */}
          <div className="flex-1 space-y-2">
            {/* Time and Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="font-semibold text-gray-900">
                  {appointment.time}
                </span>
                <span className="text-gray-500">
                  ({formatDuration(appointment.duration)})
                </span>
              </div>
              
              <Badge className={cn('border', statusConfig.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Customer */}
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">
                {appointment.customerName}
              </span>
              {appointment.customerPhone && (
                <div className="flex items-center space-x-1 text-gray-500">
                  <Phone className="h-3 w-3" />
                  <span className="text-xs">
                    {appointment.customerPhone}
                  </span>
                </div>
              )}
            </div>

            {/* Service and Professional */}
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Serviço:</span> {appointment.serviceName}
              </p>
              <p>
                <span className="font-medium">Profissional:</span> {appointment.professionalName}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ====================================
// MAIN COMPONENT
// ====================================

export const TodaySchedule: React.FC<TodayScheduleProps> = ({
  appointments,
  onViewAll,
  onAppointmentClick,
  className,
}) => {
  // Sort appointments by time
  const sortedAppointments = [...appointments].sort((a, b) => {
    return a.time.localeCompare(b.time);
  });

  // Group appointments by status for quick stats
  const stats = appointments.reduce((acc, appointment) => {
    acc[appointment.status] = (acc[appointment.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (appointments.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum agendamento para hoje
        </h3>
        <p className="text-gray-500 text-sm">
          Quando houver agendamentos para hoje, eles aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with stats */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">
              Agenda de Hoje
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex space-x-4 text-xs">
          {stats.confirmed && (
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span>{stats.confirmed} confirmado{stats.confirmed !== 1 ? 's' : ''}</span>
            </div>
          )}
          {stats.in_progress && (
            <div className="flex items-center space-x-1 text-yellow-600">
              <Play className="h-3 w-3" />
              <span>{stats.in_progress} em andamento</span>
            </div>
          )}
          {stats.scheduled && (
            <div className="flex items-center space-x-1 text-blue-600">
              <Clock className="h-3 w-3" />
              <span>{stats.scheduled} agendado{stats.scheduled !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Appointments list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sortedAppointments.slice(0, 5).map((appointment) => (
          <AppointmentItem
            key={appointment.id}
            appointment={appointment}
            onClick={onAppointmentClick}
          />
        ))}
      </div>

      {/* View all button */}
      {appointments.length > 5 && (
        <div className="mt-4 text-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onViewAll}
            className="w-full"
          >
            Ver todos os {appointments.length} agendamentos
          </Button>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="text-blue-600 hover:text-blue-700"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            className="text-green-600 hover:text-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Ver Concluídos
          </Button>
        </div>
      </div>
    </div>
  );
};

// ====================================
// SIMPLE TODAY SCHEDULE
// ====================================

interface SimpleTodayScheduleProps {
  appointments: TodayAppointment[];
  limit?: number;
  className?: string;
}

export const SimpleTodaySchedule: React.FC<SimpleTodayScheduleProps> = ({
  appointments,
  limit = 3,
  className,
}) => {
  const sortedAppointments = [...appointments]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, limit);

  if (appointments.length === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">
          Nenhum agendamento hoje
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        {sortedAppointments.map((appointment) => {
          const statusConfig = getStatusConfig(appointment.status);
          return (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="text-sm font-medium text-gray-900 min-w-[4rem]">
                  {appointment.time}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {appointment.customerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {appointment.serviceName} • {appointment.professionalName}
                  </p>
                </div>
              </div>
              
              <Badge className={cn('text-xs border', statusConfig.color)}>
                {statusConfig.label}
              </Badge>
            </div>
          );
        })}
      </div>
      
      {appointments.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" className="text-xs">
            Ver mais {appointments.length - limit} agendamentos
          </Button>
        </div>
      )}
    </div>
  );
};

export default TodaySchedule;