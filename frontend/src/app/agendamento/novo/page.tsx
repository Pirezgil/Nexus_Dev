'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/modules/agendamento/AppointmentForm';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function NovoAgendamentoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extrair parâmetros da URL
  const initialDate = searchParams?.get('date') || '';
  const initialTime = searchParams?.get('time') || '';
  const initialProfessionalId = searchParams?.get('professional_id') || '';

  const handleSubmitSuccess = async (data: any) => {
    // Após sucesso, redirecionar para a agenda
    router.push('/agendamento');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AppointmentForm
            onSubmit={handleSubmitSuccess}
            onCancel={handleCancel}
            initialDate={initialDate}
            initialTime={initialTime}
            initialProfessionalId={initialProfessionalId}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NovoAgendamentoPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Carregando formulário...</p>
          </div>
        </div>
      </DashboardLayout>
    }>
      <NovoAgendamentoPageContent />
    </Suspense>
  );
}