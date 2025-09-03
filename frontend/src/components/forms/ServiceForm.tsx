import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ServiceFormSchema, ServiceFormData, SERVICE_VALIDATION_RULES } from '../../../../shared/validation/service-schemas';

interface ServiceFormProps {
  onSubmit: (data: ServiceFormData) => void;
  initialData?: Partial<ServiceFormData>;
  isLoading?: boolean;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({
  onSubmit,
  initialData,
  isLoading = false
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<ServiceFormData>({
    resolver: zodResolver(ServiceFormSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      duration: 60,
      price: 0,
      category: '',
      requirements: ''
    }
  });

  const handleFormSubmit = (data: ServiceFormData) => {
    onSubmit(data);
  };

  const handleReset = () => {
    reset();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Nome do Serviço */}
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome do Serviço *
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="name"
              {...register('name')}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="Ex: Corte de Cabelo Masculino"
            />
            {errors.name && (
              <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>
        </div>

        {/* Duração */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
            Duração (minutos) *
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="duration"
              min={SERVICE_VALIDATION_RULES.DURATION_MIN}
              max={SERVICE_VALIDATION_RULES.DURATION_MAX}
              step="1"
              {...register('duration', { valueAsNumber: true })}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.duration ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="60"
            />
            {errors.duration && (
              <p className="mt-2 text-sm text-red-600">{errors.duration.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Mínimo: {SERVICE_VALIDATION_RULES.DURATION_MIN} min | Máximo: {SERVICE_VALIDATION_RULES.DURATION_MAX} min (8 horas)
            </p>
          </div>
        </div>

        {/* Preço */}
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Preço (R$) *
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="price"
              min="0.01"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.price ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="50.00"
            />
            {errors.price && (
              <p className="mt-2 text-sm text-red-600">{errors.price.message}</p>
            )}
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Categoria
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="category"
              maxLength={SERVICE_VALIDATION_RULES.CATEGORY_MAX_LENGTH}
              {...register('category')}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.category ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="Ex: Cabelo, Barba, Estética"
            />
            {errors.category && (
              <p className="mt-2 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>
        </div>

        {/* Descrição */}
        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <div className="mt-1">
            <textarea
              id="description"
              rows={3}
              {...register('description')}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="Descreva os detalhes do serviço..."
            />
            {errors.description && (
              <p className="mt-2 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </div>

        {/* Requisitos */}
        <div className="sm:col-span-2">
          <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">
            Requisitos/Observações
          </label>
          <div className="mt-1">
            <textarea
              id="requirements"
              rows={2}
              {...register('requirements')}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                errors.requirements ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              }`}
              placeholder="Requisitos especiais, materiais necessários, etc."
            />
            {errors.requirements && (
              <p className="mt-2 text-sm text-red-600">{errors.requirements.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading || isSubmitting}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="submit"
          disabled={isLoading || isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading || isSubmitting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Salvando...
            </>
          ) : (
            'Salvar Serviço'
          )}
        </button>
      </div>

      {/* Informações de Validação */}
      <div className="rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-700">
              <strong>Validação em tempo real:</strong> Este formulário aplica as mesmas regras de validação do backend, 
              fornecendo feedback instantâneo ao usuário. A duração máxima é de 8 horas (480 minutos).
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};