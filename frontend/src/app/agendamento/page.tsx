'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarComplete, useDeleteAppointment } from '@/hooks/api/use-appointments';
import { useActiveProfessionals } from '@/hooks/api/use-services';
import { CalendarView } from '@/components/modules/agendamento/CalendarView';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal, Button } from '@shared/components/ui';
import { withAuth } from '@/components/auth/withAuth';

function AgendamentoPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  
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
    <DashboardLayout>
      <div className="p-6 space-y-6">
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        title="Excluir Agendamento"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setAppointmentToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="error"
              onClick={confirmDelete}
              loading={deleteAppointmentMutation.isPending}
            >
              {deleteAppointmentMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export default withAuth(AgendamentoPage);