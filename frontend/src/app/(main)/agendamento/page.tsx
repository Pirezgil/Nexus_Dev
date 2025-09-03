'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarComplete, useDeleteAppointment } from '@/hooks/api/use-appointments';
import { useActiveProfessionals } from '@/hooks/api/use-services';
import { CalendarView } from '@/components/modules/agendamento/CalendarView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui';
import { withAuth } from '@/components/auth/withAuth';
import { useCurrentUser, usePermissions } from '@/stores/auth';
import { SIDEBAR_ITEMS, filterSidebarItemsByPermissions } from '@/config/sidebar';

function AgendamentoPage() {
  const router = useRouter();
  const { user, displayName } = useCurrentUser();
  const permissions = usePermissions();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Calculate date range for calendar view
  const startDate = new Date(selectedDate);
  startDate.setDate(selectedDate.getDate() - 7);
  const endDate = new Date(selectedDate);
  endDate.setDate(selectedDate.getDate() + 7);
  
  const { data: professionals } = useActiveProfessionals();
  const professionalIds = professionals?.map(p => p.id);
  
  const { events, scheduleBlocks, isLoading } = useCalendarComplete(
    startDate.toISOString(),
    endDate.toISOString(),
    professionalIds
  );
  
  const deleteAppointmentMutation = useDeleteAppointment();

  // REFATORADO: Usar configuração centralizada do sidebar
  const sidebarItems = filterSidebarItemsByPermissions(SIDEBAR_ITEMS, permissions);

  const handleNewAppointment = (date?: string, time?: string, professionalId?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (time) params.set('time', time);
    if (professionalId) params.set('professional_id', professionalId);
    
    router.push(`/agendamento/novo${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleAppointmentClick = (appointmentId: string) => {
    router.push(`/agendamento/${appointmentId}`);
  };

  const handleAppointmentEdit = (appointmentId: string) => {
    router.push(`/agendamento/${appointmentId}/edit`);
  };

  const handleAppointmentDelete = (appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
  };

  const confirmDelete = async () => {
    if (!appointmentToDelete) return;
    
    try {
      await deleteAppointmentMutation.mutateAsync(appointmentToDelete);
      setAppointmentToDelete(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Agendamento
          </h2>
          <p className="text-slate-600">
            Gerencie seus agendamentos e horários
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
            <CalendarView
              events={events?.data || []}
              scheduleBlocks={scheduleBlocks?.data || []}
              professionals={professionals || []}
              loading={isLoading}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onNewAppointment={handleNewAppointment}
              onAppointmentClick={handleAppointmentClick}
              onAppointmentEdit={handleAppointmentEdit}
              onAppointmentDelete={handleAppointmentDelete}
            />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setAppointmentToDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withAuth(AgendamentoPage);