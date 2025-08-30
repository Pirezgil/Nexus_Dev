'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Filter,
  Users,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

// Importar componentes da biblioteca refatorada
import { Button, LoadingSpinner, Alert, Select } from '@shared/components/ui';
import { api, API_ROUTES } from '@/lib/api';

// Interfaces
interface CalendarData {
  view: 'day' | 'week' | 'month';
  period: {
    start_date: string;
    end_date: string;
  };
  business_hours: Record<string, { start: string; end: string }>;
  professionals: Array<{
    id: string;
    name: string;
    photo_url?: string;
    color: string;
  }>;
  appointments: Array<{
    id: string;
    professional_id: string;
    customer_name: string;
    service_name: string;
    start: string;
    end: string;
    status: string;
    color: string;
    notes?: string;
  }>;
  schedule_blocks: Array<{
    id: string;
    professional_id?: string;
    title: string;
    start: string;
    end: string;
    type: string;
    color: string;
  }>;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: 'appointment' | 'block';
    appointment?: any;
    block?: any;
    customer_name?: string;
    service_name?: string;
    professional_name?: string;
    status?: string;
  };
}

interface CalendarViewProps {
  onNewAppointment?: (date?: string, time?: string, professionalId?: string) => void;
  onAppointmentClick?: (appointmentId: string) => void;
  onAppointmentEdit?: (appointmentId: string) => void;
  onAppointmentDelete?: (appointmentId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onNewAppointment,
  onAppointmentClick,
  onAppointmentEdit,
  onAppointmentDelete
}) => {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  
  // Estados
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Query para dados do calendário
  const { 
    data: calendarData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<CalendarData>({
    queryKey: ['calendar', view, currentDate.toISOString().split('T')[0], selectedProfessional],
    queryFn: async () => {
      const params = new URLSearchParams({
        view,
        date: currentDate.toISOString().split('T')[0],
        ...(selectedProfessional !== 'all' && { professional_id: selectedProfessional })
      });
      
      const response = await api.get(`${API_ROUTES.agendamento}/calendar?${params}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Falha ao carregar dados do calendário');
      }
      
      return response.data.data;
    },
    refetchInterval: 30000, // Atualizar a cada 30s
    retry: 3,
    retryDelay: 1000
  });

  // Converter dados para eventos do FullCalendar
  useEffect(() => {
    if (!calendarData) return;

    const events: CalendarEvent[] = [];

    // Adicionar agendamentos - com validação defensiva
    if (Array.isArray(calendarData.appointments)) {
      calendarData.appointments.forEach(appointment => {
        events.push({
          id: `appointment-${appointment.id}`,
          title: `${appointment.customer_name} - ${appointment.service_name}`,
          start: appointment.start,
          end: appointment.end,
          backgroundColor: getStatusColor(appointment.status),
          borderColor: getStatusColor(appointment.status),
          textColor: 'white',
          extendedProps: {
            type: 'appointment',
            appointment,
            customer_name: appointment.customer_name,
            service_name: appointment.service_name,
            status: appointment.status
          }
        });
      });
    }

    // Adicionar bloqueios - com validação defensiva para evitar erro crítico
    if (Array.isArray(calendarData.schedule_blocks)) {
      calendarData.schedule_blocks.forEach(block => {
        events.push({
          id: `block-${block.id}`,
          title: block.title,
          start: block.start,
          end: block.end,
          backgroundColor: getBlockColor(block.type),
          borderColor: getBlockColor(block.type),
          textColor: '#374151',
          extendedProps: {
            type: 'block',
            block
          }
        });
      });
    } else {
      // Log para debugging em desenvolvimento - schedule_blocks chegou inválido
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ calendarData.schedule_blocks não é um array válido:', calendarData.schedule_blocks);
      }
    }

    setCalendarEvents(events);
  }, [calendarData]);

  // Funções utilitárias
  const getStatusColor = (status: string): string => {
    const colors = {
      scheduled: '#3B82F6',    // Azul
      confirmed: '#10B981',    // Verde
      in_progress: '#F59E0B',  // Amarelo
      completed: '#8B5CF6',    // Roxo
      cancelled: '#EF4444',    // Vermelho
      no_show: '#6B7280'       // Cinza
    };
    return colors[status as keyof typeof colors] || '#6B7280';
  };

  const getBlockColor = (type: string): string => {
    const colors = {
      holiday: '#FEE2E2',     // Vermelho claro
      vacation: '#DBEAFE',    // Azul claro
      maintenance: '#FEF3C7', // Amarelo claro
      break: '#F3F4F6'        // Cinza claro
    };
    return colors[type as keyof typeof colors] || '#F3F4F6';
  };

  const getStatusLabel = (status: string): string => {
    const labels = {
      scheduled: 'Agendado',
      confirmed: 'Confirmado',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      no_show: 'Faltou'
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Handlers de navegação
  const navigateDate = (direction: 'prev' | 'next') => {
    const api = calendarRef.current?.getApi();
    if (api) {
      direction === 'next' ? api.next() : api.prev();
      setCurrentDate(api.getDate());
    }
  };

  const goToToday = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.today();
      setCurrentDate(api.getDate());
    }
  };

  // Handlers de eventos do calendário
  const handleDateSelect = (selectInfo: any) => {
    const dateStr = selectInfo.startStr.split('T')[0];
    const timeStr = selectInfo.startStr.includes('T') ? 
      selectInfo.startStr.split('T')[1].substring(0, 5) : '09:00';
    
    if (onNewAppointment) {
      onNewAppointment(dateStr, timeStr, selectedProfessional !== 'all' ? selectedProfessional : undefined);
    } else {
      // Fallback para navegação direta
      const params = new URLSearchParams({
        date: dateStr,
        time: timeStr,
        ...(selectedProfessional !== 'all' && { professional_id: selectedProfessional })
      });
      router.push(`/agendamento/novo?${params}`);
    }
    
    // Limpar seleção
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    const eventData: CalendarEvent = {
      id: event.id,
      title: event.title,
      start: event.startStr,
      end: event.endStr,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      textColor: event.textColor,
      extendedProps: event.extendedProps
    };
    
    setSelectedEvent(eventData);
  };

  const handleEventDrop = async (dropInfo: any) => {
    if (dropInfo.event.extendedProps.type !== 'appointment') {
      dropInfo.revert();
      return;
    }

    try {
      const appointmentId = dropInfo.event.extendedProps.appointment.id;
      
      await api.put(`${API_ROUTES.agendamento}/appointments/${appointmentId}`, {
        appointment_date: dropInfo.event.startStr.split('T')[0],
        appointment_time: dropInfo.event.startStr.split('T')[1].substring(0, 5),
        reschedule_reason: 'Reagendado via calendário'
      });

      // Refetch dos dados
      refetch();
    } catch (error) {
      console.error('Erro ao reagendar:', error);
      dropInfo.revert();
    }
  };

  const handleEventResize = async (resizeInfo: any) => {
    if (resizeInfo.event.extendedProps.type !== 'appointment') {
      resizeInfo.revert();
      return;
    }

    try {
      const appointmentId = resizeInfo.event.extendedProps.appointment.id;
      
      await api.put(`${API_ROUTES.agendamento}/appointments/${appointmentId}`, {
        appointment_date: resizeInfo.event.startStr.split('T')[0],
        appointment_time: resizeInfo.event.startStr.split('T')[1].substring(0, 5),
        // Calcular nova duração baseada no resize
        notes: 'Duração alterada via calendário'
      });

      refetch();
    } catch (error) {
      console.error('Erro ao redimensionar:', error);
      resizeInfo.revert();
    }
  };

  // Renderização condicional para loading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  // Renderização condicional para erro
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <div>
            <h4 className="font-medium">Erro ao carregar calendário</h4>
            <p className="mt-1">{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
          </div>
        </Alert>
        <div className="mt-4 text-center">
          <Button onClick={() => refetch()} variant="outline">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Agenda
          </h1>
          
          {/* Navegação de data */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-48 text-center text-gray-700 px-4">
              {calendarData ? (
                currentDate.toLocaleDateString('pt-BR', { 
                  month: 'long', 
                  year: 'numeric',
                  ...(view === 'day' && { day: 'numeric', weekday: 'long' })
                })
              ) : (
                'Carregando...'
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigateDate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Filtro por profissional */}
          {calendarData?.professionals && calendarData.professionals.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <Select
                value={selectedProfessional}
                onChange={setSelectedProfessional}
                options={[
                  { value: 'all', label: 'Todos os profissionais' },
                  ...calendarData.professionals.map(prof => ({
                    value: prof.id,
                    label: prof.name
                  }))
                ]}
              />
            </div>
          )}

          {/* Seletor de visualização */}
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map(viewType => (
              <Button
                key={viewType}
                variant={view === viewType ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setView(viewType);
                  const api = calendarRef.current?.getApi();
                  if (api) {
                    const viewMap = {
                      day: 'timeGridDay',
                      week: 'timeGridWeek', 
                      month: 'dayGridMonth'
                    };
                    api.changeView(viewMap[viewType]);
                  }
                }}
              >
                {viewType === 'day' ? 'Dia' : viewType === 'week' ? 'Semana' : 'Mês'}
              </Button>
            ))}
          </div>

          <Button onClick={goToToday} variant="outline" size="sm">
            Hoje
          </Button>

          {/* Botão novo agendamento */}
          <Button 
            variant="primary" 
            onClick={() => onNewAppointment ? onNewAppointment() : router.push('/agendamento/novo')}
            icon={Plus}
          >
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-white rounded-lg shadow p-0 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view === 'day' ? 'timeGridDay' : view === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
          headerToolbar={false}
          events={calendarEvents}
          editable={true}
          droppable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          weekends={true}
          height="auto"
          contentHeight={600}
          locale="pt-br"
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          nowIndicator={true}
          businessHours={calendarData?.business_hours ? Object.entries(calendarData.business_hours).map(([day, hours]) => ({
            daysOfWeek: [['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day)].filter(d => d !== -1),
            startTime: hours.start,
            endTime: hours.end
          })) : {
            daysOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: '08:00',
            endTime: '18:00'
          }}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={(eventInfo) => {
            const { extendedProps } = eventInfo.event;
            
            if (extendedProps.type === 'appointment') {
              return (
                <div className="p-1 text-xs overflow-hidden">
                  <div className="font-medium truncate">{extendedProps.customer_name}</div>
                  <div className="truncate opacity-90">{extendedProps.service_name}</div>
                  <div className="opacity-75">
                    {format(new Date(eventInfo.event.startStr), 'HH:mm')}
                  </div>
                </div>
              );
            } else {
              return (
                <div className="p-1 text-xs">
                  <div className="font-medium truncate">{eventInfo.event.title}</div>
                </div>
              );
            }
          }}
          dayCellClassNames={(info) => {
            const today = new Date();
            const cellDate = info.date;
            
            if (cellDate.toDateString() === today.toDateString()) {
              return 'bg-blue-50';
            }
            return '';
          }}
          eventClassNames={(info) => {
            return `cursor-pointer hover:opacity-80 transition-opacity`;
          }}
        />
      </div>

      {/* Legenda de status */}
      {calendarData?.appointments && calendarData.appointments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Legenda de Status
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Agendado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Confirmado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Em Andamento</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span>Concluído</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Cancelado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded"></div>
              <span>Faltou</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalhes do evento */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedEvent.extendedProps.type === 'appointment' ? 'Detalhes do Agendamento' : 'Bloqueio de Agenda'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  ✕
                </Button>
              </div>

              {selectedEvent.extendedProps.type === 'appointment' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Cliente</label>
                    <p className="text-gray-900 font-medium">{selectedEvent.extendedProps.customer_name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Serviço</label>
                    <p className="text-gray-900">{selectedEvent.extendedProps.service_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Início</label>
                      <p className="text-gray-900 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(selectedEvent.start), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fim</label>
                      <p className="text-gray-900">
                        {format(new Date(selectedEvent.end), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${
                      selectedEvent.extendedProps.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      selectedEvent.extendedProps.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      selectedEvent.extendedProps.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      selectedEvent.extendedProps.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                      selectedEvent.extendedProps.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(selectedEvent.extendedProps.status || '')}
                    </span>
                  </div>

                  {selectedEvent.extendedProps.appointment?.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Observações</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                        {selectedEvent.extendedProps.appointment.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (onAppointmentClick) {
                          onAppointmentClick(selectedEvent.extendedProps.appointment.id);
                        } else {
                          router.push(`/agendamento/${selectedEvent.extendedProps.appointment.id}`);
                        }
                        setSelectedEvent(null);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Eye size={16} />
                      Ver Detalhes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (onAppointmentEdit) {
                          onAppointmentEdit(selectedEvent.extendedProps.appointment.id);
                        } else {
                          router.push(`/agendamento/${selectedEvent.extendedProps.appointment.id}/edit`);
                        }
                        setSelectedEvent(null);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Editar
                    </Button>
                    {selectedEvent.extendedProps.status !== 'confirmed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-2 text-green-600 hover:text-green-700 hover:border-green-300"
                      >
                        <CheckCircle size={16} />
                        Confirmar
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {selectedEvent.extendedProps.type === 'block' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Título</label>
                    <p className="text-gray-900 font-medium">{selectedEvent.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Início</label>
                      <p className="text-gray-900">
                        {format(new Date(selectedEvent.start), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fim</label>
                      <p className="text-gray-900">
                        {format(new Date(selectedEvent.end), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Tipo</label>
                    <p className="text-gray-900 capitalize">{selectedEvent.extendedProps.block?.type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;