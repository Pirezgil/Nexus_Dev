'use client';

import { useState, useEffect } from 'react';
import { Appointment, Professional } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Phone,
  MoreVertical
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MobileCalendarProps {
  appointments: Appointment[];
  professionals: Professional[];
  onAppointmentClick: (appointment: Appointment) => void;
  onNewAppointment: (date?: Date) => void;
  selectedProfessional: string;
  loading?: boolean;
}

interface DayAppointments {
  date: Date;
  appointments: Appointment[];
  isToday: boolean;
}

export const MobileCalendar: React.FC<MobileCalendarProps> = ({
  appointments,
  professionals,
  onAppointmentClick,
  onNewAppointment,
  selectedProfessional,
  loading = false,
}) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  // Calcular dias da semana
  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekEnd = endOfWeek(currentWeek, { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Organizar agendamentos por dia
  const dayAppointments: DayAppointments[] = weekDays.map(date => ({
    date,
    appointments: appointments.filter(apt => 
      isSameDay(parseISO(apt.startTime), date) &&
      (selectedProfessional === 'all' || apt.professionalId === selectedProfessional)
    ),
    isToday: isToday(date),
  }));

  const getAppointmentColor = (status: string) => {
    const colors = {
      SCHEDULED: 'bg-blue-500 border-blue-600',
      CONFIRMED: 'bg-green-500 border-green-600',
      IN_PROGRESS: 'bg-yellow-500 border-yellow-600',
      COMPLETED: 'bg-purple-500 border-purple-600',
      CANCELLED: 'bg-red-500 border-red-600',
      NO_SHOW: 'bg-gray-500 border-gray-600',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500 border-gray-600';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      SCHEDULED: 'Agendado',
      CONFIRMED: 'Confirmado',
      IN_PROGRESS: 'Em Andamento',
      COMPLETED: 'Concluído',
      CANCELLED: 'Cancelado',
      NO_SHOW: 'Faltou',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getProfessionalName = (professionalId: string) => {
    const professional = professionals.find(p => p.id === professionalId);
    return professional?.name || 'Profissional';
  };

  const renderWeekView = () => (
    <div className="space-y-4">
      {/* Navegação da Semana */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
        >
          <ChevronLeft size={16} />
        </Button>
        
        <h2 className="text-lg font-semibold text-gray-900">
          {format(weekStart, 'dd MMM', { locale: ptBR })} - {format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}
        </h2>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Dias da Semana - Mobile Scrollable */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2" style={{ minWidth: '100%' }}>
          {dayAppointments.map(day => (
            <div
              key={day.date.toISOString()}
              className="flex-shrink-0 w-48"
            >
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  day.isToday 
                    ? 'bg-blue-50 border-blue-200 shadow-md'
                    : 'bg-white border-gray-200 hover:border-blue-200'
                }`}
                onClick={() => {
                  setSelectedDay(day.date);
                  setViewMode('day');
                }}
              >
                <div className="text-center mb-2">
                  <div className="text-xs font-medium text-gray-500 uppercase">
                    {format(day.date, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-lg font-bold ${
                    day.isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day.date, 'dd')}
                  </div>
                </div>

                <div className="space-y-1">
                  {day.appointments.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-2">
                      Livre
                    </div>
                  ) : (
                    <>
                      {day.appointments.slice(0, 3).map(appointment => (
                        <div
                          key={appointment.id}
                          className={`p-1.5 rounded text-xs text-white ${getAppointmentColor(appointment.status)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(appointment);
                          }}
                        >
                          <div className="truncate">
                            {format(parseISO(appointment.startTime), 'HH:mm')}
                          </div>
                          <div className="truncate font-medium">
                            {appointment.customer.name}
                          </div>
                        </div>
                      ))}
                      {day.appointments.length > 3 && (
                        <div className="text-xs text-center text-gray-500 py-1">
                          +{day.appointments.length - 3} mais
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão Novo Agendamento */}
      <Button
        onClick={() => onNewAppointment()}
        className="w-full flex items-center justify-center gap-2"
        size="lg"
      >
        <Plus size={20} />
        Novo Agendamento
      </Button>
    </div>
  );

  const renderDayView = () => {
    const dayData = dayAppointments.find(d => isSameDay(d.date, selectedDay));
    if (!dayData) return null;

    return (
      <div className="space-y-4">
        {/* Header do Dia */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('week')}
          >
            <ChevronLeft size={16} />
            Voltar
          </Button>
          
          <h2 className="text-lg font-semibold text-gray-900">
            {format(selectedDay, 'EEEE, dd MMM yyyy', { locale: ptBR })}
          </h2>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNewAppointment(selectedDay)}
          >
            <Plus size={16} />
          </Button>
        </div>

        {/* Agendamentos do Dia */}
        <div className="space-y-3">
          {dayData.appointments.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Nenhum agendamento hoje</p>
              <Button
                onClick={() => onNewAppointment(selectedDay)}
                className="mt-4"
                size="sm"
              >
                <Plus size={16} />
                Criar Agendamento
              </Button>
            </Card>
          ) : (
            dayData.appointments
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map(appointment => (
                <Card 
                  key={appointment.id} 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onAppointmentClick(appointment)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getAppointmentColor(appointment.status).split(' ')[0]}`} />
                        <span className="text-lg font-medium text-gray-900">
                          {appointment.customer.name}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          <span>
                            {format(parseISO(appointment.startTime), 'HH:mm')} - 
                            {format(parseISO(appointment.endTime), 'HH:mm')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User size={14} />
                          <span>{getProfessionalName(appointment.professionalId)}</span>
                        </div>
                        
                        <div>
                          <span className="font-medium">{appointment.service.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          appointment.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                          appointment.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                          appointment.status === 'COMPLETED' ? 'bg-purple-100 text-purple-800' :
                          appointment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getStatusLabel(appointment.status)}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${appointment.customer.phone}`);
                          }}
                        >
                          <Phone size={14} />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {viewMode === 'week' ? renderWeekView() : renderDayView()}
    </div>
  );
};