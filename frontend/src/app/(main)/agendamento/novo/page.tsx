'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/modules/agendamento/AppointmentForm';
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Novo Agendamento
          </h1>
          <p className="text-slate-600">
            Agende um novo atendimento
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        <AppointmentForm
          onSubmit={handleSubmitSuccess}
          onCancel={handleCancel}
          initialDate={initialDate}
          initialTime={initialTime}
          initialProfessionalId={initialProfessionalId}
        />
      </div>
    </div>
  );
}

export default function NovoAgendamentoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Carregando formulário...</p>
        </div>
      </div>
    }>
      <NovoAgendamentoPageContent />
    </Suspense>
  );
}