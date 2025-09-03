'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { combineDateTime, extractDateForInput, extractTimeForInput, getCurrentDateForInput, getCurrentTimeForInput } from '@/lib/dates';
import { 
  Search, 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  AlertCircle, 
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Plus,
  X,
  Loader2,
  Save,
  ArrowLeft
} from 'lucide-react';

// Importar componentes e hooks
import { Button } from '@/components/ui/button';
import { filterAvailableProfessionals, isProfessionalAvailable } from '@/utils/professional-status';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useDebounce } from '@/hooks/useDebounce';
import { api, API_ROUTES } from '@/lib/api';

// Interfaces
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferred_contact: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
  };
}

interface Service {
  id: string;
  name: string;
  duration: number; // em minutos
  price: number;
  category: string;
  description?: string;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
  photo_url?: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'VACATION' | 'SICK_LEAVE';
}

interface AvailableSlot {
  start_time: string;
  end_time: string;
  available: boolean;
  reason?: string;
}

interface AvailabilityResponse {
  availability: Array<{
    date: string;
    day_name: string;
    is_business_day: boolean;
    business_hours?: {
      start: string;
      end: string;
      lunch_break?: string;
    };
    available_slots: AvailableSlot[];
  }>;
  recommended_slots?: Array<{
    date: string;
    time: string;
    reason: string;
  }>;
}

interface AppointmentData {
  customer_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
  send_confirmation?: boolean;
  send_reminder?: boolean;
  reminder_hours_before?: number;
}

interface AppointmentFormProps {
  /** Dados do agendamento para edição (opcional) */
  appointment?: any;
  /** Callback executado após submissão bem-sucedida */
  onSubmit?: (data: AppointmentData) => Promise<void>;
  /** Callback para cancelar o formulário */
  onCancel?: () => void;
  /** Se verdadeiro, mostra loading */
  loading?: boolean;
  /** Data pré-selecionada */
  initialDate?: string;
  /** Horário pré-selecionado */
  initialTime?: string;
  /** Profissional pré-selecionado */
  initialProfessionalId?: string;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  appointment,
  onSubmit,
  onCancel,
  loading: externalLoading = false,
  initialDate,
  initialTime,
  initialProfessionalId
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Estados do formulário
  const [formData, setFormData] = useState<AppointmentData>({
    customer_id: appointment?.customer_id || '',
    professional_id: appointment?.professional_id || initialProfessionalId || '',
    service_id: appointment?.service_id || '',
    appointment_date: appointment?.start_time ? extractDateForInput(appointment.start_time) : initialDate || searchParams?.get('date') || getCurrentDateForInput(),
    appointment_time: appointment?.start_time ? extractTimeForInput(appointment.start_time) : initialTime || searchParams?.get('time') || getCurrentTimeForInput(),
    notes: appointment?.notes || '',
    send_confirmation: appointment?.send_confirmation ?? true,
    send_reminder: appointment?.send_reminder ?? true,
    reminder_hours_before: appointment?.reminder_hours_before || 24
  });

  // Estados de UI
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const debouncedCustomerSearch = useDebounce(customerSearch, 300);

  // Query: Buscar clientes
  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers-search', debouncedCustomerSearch],
    queryFn: async () => {
      if (!debouncedCustomerSearch || debouncedCustomerSearch.length < 2) {
        return [];
      }
      
      const response = await api.get(`${API_ROUTES.crm}/customers/search`, {
        params: {
          q: debouncedCustomerSearch,
          limit: 10
        }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao buscar clientes');
      }
      
      return response.data.data || [];
    },
    enabled: debouncedCustomerSearch.length >= 2,
    staleTime: 30000 // Cache por 30 segundos
  });

  // Query: Buscar serviços
  const { data: services, isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ['services-list'],
    queryFn: async () => {
      const response = await api.get(`${API_ROUTES.services}/list`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao buscar serviços');
      }
      
      return response.data.data || [];
    },
    staleTime: 300000 // Cache por 5 minutos
  });

  // Query: Buscar profissionais (filtrados por serviço se selecionado)
  const { data: professionals, isLoading: loadingProfessionals } = useQuery<Professional[]>({
    queryKey: ['professionals-list', formData.service_id],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (formData.service_id) {
        params.service_id = formData.service_id;
      }
      
      const response = await api.get(`${API_ROUTES.services}/professionals`, { params });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao buscar profissionais');
      }
      
      return response.data.data || [];
    },
    staleTime: 300000 // Cache por 5 minutos
  });

  // Query: Verificar disponibilidade
  const { 
    data: availability, 
    isLoading: loadingAvailability,
    error: availabilityError 
  } = useQuery<AvailabilityResponse>({
    queryKey: ['availability', formData.professional_id, formData.service_id, formData.appointment_date],
    queryFn: async () => {
      const params = new URLSearchParams({
        professional_id: formData.professional_id,
        service_id: formData.service_id,
        date: formData.appointment_date,
        days: '1'
      });
      
      const response = await api.get(`${API_ROUTES.agendamento}/availability?${params}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao verificar disponibilidade');
      }
      
      return response.data.data;
    },
    enabled: !!(formData.professional_id && formData.service_id && formData.appointment_date),
    staleTime: 60000 // Cache por 1 minuto
  });

  // Mutation: Criar/atualizar agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentData) => {
      const url = appointment?.id 
        ? `${API_ROUTES.agendamento}/appointments/${appointment.id}`
        : `${API_ROUTES.agendamento}/appointments`;
      
      const method = appointment?.id ? 'put' : 'post';
      
      const response = await api[method](url, data);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Erro ao salvar agendamento');
      }
      
      return response.data.data;
    },
    onSuccess: (data) => {
      // Invalidar caches relacionados
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      
      // Callback customizado ou navegação padrão
      if (onSubmit) {
        onSubmit(formData);
      } else {
        router.push('/agendamento');
      }
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    }
  });

  // Slots disponíveis calculados
  const availableSlots = useMemo(() => {
    if (!availability?.availability?.[0]?.available_slots) {
      return [];
    }
    
    return availability.availability[0].available_slots.filter(slot => slot.available);
  }, [availability]);

  // Serviço selecionado
  const selectedService = useMemo(() => {
    return services?.find(s => s.id === formData.service_id);
  }, [services, formData.service_id]);

  // Profissional selecionado
  const selectedProfessional = useMemo(() => {
    return professionals?.find(p => p.id === formData.professional_id);
  }, [professionals, formData.professional_id]);

  // Professionals filtrados por disponibilidade
  const availableProfessionals = useMemo(() => {
    if (!professionals) return [];
    return filterAvailableProfessionals(professionals, false); // Não permitir profissionais em férias por padrão
  }, [professionals]);

  // Handlers
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch(customer.name);
    setErrors(prev => ({ ...prev, customer_id: '' }));
  };

  const handleFieldChange = (field: keyof AppointmentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando alterado
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Reset dependent fields
    if (field === 'service_id') {
      setFormData(prev => ({ ...prev, professional_id: '', appointment_time: '' }));
      setErrors(prev => ({ ...prev, professional_id: '', appointment_time: '' }));
    } else if (field === 'professional_id' || field === 'appointment_date') {
      setFormData(prev => ({ ...prev, appointment_time: '' }));
      setErrors(prev => ({ ...prev, appointment_time: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_id) newErrors.customer_id = 'Cliente é obrigatório';
    if (!formData.professional_id) newErrors.professional_id = 'Profissional é obrigatório';
    if (!formData.service_id) newErrors.service_id = 'Serviço é obrigatório';
    if (!formData.appointment_date) newErrors.appointment_date = 'Data é obrigatória';
    if (!formData.appointment_time) newErrors.appointment_time = 'Horário é obrigatório';
    
    // Validar se a data não é no passado
    if (formData.appointment_date) {
      const selectedDate = new Date(formData.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.appointment_date = 'Data não pode ser no passado';
      }
    }
    
    // Validar se horário está disponível
    if (formData.appointment_time && availableSlots.length > 0) {
      const selectedSlot = availableSlots.find(
        slot => slot.start_time === formData.appointment_time
      );
      
      if (!selectedSlot?.available) {
        newErrors.appointment_time = 'Horário não disponível';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // Converter data e hora para ISO string antes de enviar
      const dataToSubmit = {
        ...formData,
        start_time: combineDateTime(formData.appointment_date, formData.appointment_time)
      };
      
      // Remover campos que não são necessários na API
      const { appointment_date, appointment_time, ...apiData } = dataToSubmit;
      
      await createAppointmentMutation.mutateAsync(apiData);
    } catch (error) {
      // Error já tratado no onError da mutation
      console.error('Erro ao submeter formulário:', error);
    }
  };

  const isSubmitting = createAppointmentMutation.isPending || externalLoading;

  // Configurar dados iniciais se existe agendamento para edição
  useEffect(() => {
    if (appointment && !selectedCustomer) {
      // Buscar dados do cliente se estamos editando
      const fetchCustomerData = async () => {
        try {
          const response = await api.get(`${API_ROUTES.crm}/customers/${appointment.customer_id}`);
          if (response.data.success) {
            setSelectedCustomer(response.data.data);
            setCustomerSearch(response.data.data.name);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do cliente:', error);
        }
      };
      
      fetchCustomerData();
    }
  }, [appointment, selectedCustomer]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel || (() => router.back())}
            disabled={isSubmitting}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {appointment?.id ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h1>
            <p className="text-gray-600">
              {appointment?.id ? 'Atualize os dados do agendamento' : 'Preencha os dados para criar um novo agendamento'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Erro geral */}
        {errors.submit && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <div>
              <h4 className="font-medium">Erro ao salvar agendamento</h4>
              <p className="mt-1">{errors.submit}</p>
            </div>
          </Alert>
        )}

        {/* Seleção do Cliente */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Cliente
          </h3>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente por nome, telefone ou email..."
                className={`w-full pl-10 pr-4 py-3 border rounded-lg text-sm transition-all outline-none ${
                  errors.customer_id 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                }`}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                disabled={isSubmitting}
              />
              {loadingCustomers && (
                <div className="absolute right-3 top-3">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
            
            {errors.customer_id && (
              <p className="text-red-500 text-sm">{errors.customer_id}</p>
            )}
            
            {/* Lista de clientes encontrados */}
            {customers && customers.length > 0 && !selectedCustomer && customerSearch.length >= 2 && (
              <Card className="border border-gray-200 max-h-64 overflow-y-auto">
                <div className="p-2">
                  {customers.map(customer => (
                    <div
                      key={customer.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors border-b last:border-b-0"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            
            {/* Cliente selecionado */}
            {selectedCustomer && (
              <Card className="p-4 bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="font-medium text-green-900">Cliente selecionado:</div>
                      <div className="text-green-700">{selectedCustomer.name}</div>
                      <div className="text-sm text-green-600 flex items-center gap-4">
                        <span>{selectedCustomer.phone}</span>
                        <span>{selectedCustomer.email}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                      setFormData(prev => ({ ...prev, customer_id: '' }));
                    }}
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}
            
            {/* Botão para criar novo cliente */}
            {customerSearch.length >= 2 && customers?.length === 0 && !loadingCustomers && (
              <Card className="p-4 text-center bg-gray-50">
                <p className="text-gray-600 mb-3">Nenhum cliente encontrado para "{customerSearch}"</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateCustomer(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Novo Cliente
                </Button>
              </Card>
            )}
          </div>
        </Card>

        {/* Seleção do Serviço e Profissional */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-blue-600" />
            Serviço e Profissional
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Serviço */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Serviço <span className="text-red-500">*</span>
              </label>
              {loadingServices ? (
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
              ) : (
                <select
                  value={formData.service_id}
                  onChange={(e) => handleFieldChange('service_id', e.target.value)}
                  className={`w-full px-3 py-3 border rounded-lg bg-white transition-all outline-none ${
                    errors.service_id 
                      ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
                      : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                  }`}
                  disabled={isSubmitting}
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {services?.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration}min - R$ {service.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              )}
              {errors.service_id && (
                <p className="text-red-500 text-sm mt-1">{errors.service_id}</p>
              )}
              {selectedService && (
                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium">{selectedService.category}</div>
                  <div>Duração: {selectedService.duration} minutos</div>
                  <div>Valor: R$ {selectedService.price.toFixed(2)}</div>
                  {selectedService.description && (
                    <div className="mt-1">{selectedService.description}</div>
                  )}
                </div>
              )}
            </div>
            
            {/* Profissional */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Profissional <span className="text-red-500">*</span>
              </label>
              {loadingProfessionals ? (
                <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
              ) : (
                <select
                  value={formData.professional_id}
                  onChange={(e) => handleFieldChange('professional_id', e.target.value)}
                  className={`w-full px-3 py-3 border rounded-lg bg-white transition-all outline-none ${
                    errors.professional_id 
                      ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
                      : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                  }`}
                  disabled={!formData.service_id || isSubmitting}
                  required
                >
                  <option value="">Selecione um profissional</option>
                  {availableProfessionals?.map(prof => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name}
                    </option>
                  ))}
                  {/* Mostrar profissionais indisponíveis com indicação */}
                  {professionals?.filter(prof => !isProfessionalAvailable(prof.status)).map(prof => (
                    <option key={prof.id} value={prof.id} disabled>
                      {prof.name} (Indisponível)
                    </option>
                  ))}
                </select>
              )}
              {errors.professional_id && (
                <p className="text-red-500 text-sm mt-1">{errors.professional_id}</p>
              )}
              {!formData.service_id && (
                <p className="text-gray-500 text-sm mt-1">Selecione um serviço primeiro</p>
              )}
              {selectedProfessional && (
                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium">{selectedProfessional.name}</div>
                  <div>Especialidades: {selectedProfessional.specialties.join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Data e Horário */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Data e Horário
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.appointment_date}
                onChange={(e) => handleFieldChange('appointment_date', e.target.value)}
                min={getCurrentDateForInput()}
                className={`w-full px-3 py-3 border rounded-lg transition-all outline-none ${
                  errors.appointment_date 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                }`}
                disabled={isSubmitting}
                required
              />
              {errors.appointment_date && (
                <p className="text-red-500 text-sm mt-1">{errors.appointment_date}</p>
              )}
            </div>
            
            {/* Horário */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                Horário Disponível <span className="text-red-500">*</span>
                {loadingAvailability && <LoadingSpinner size="sm" />}
              </label>
              
              {availabilityError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="w-4 h-4" />
                  <div>
                    <h4 className="font-medium">Erro ao verificar disponibilidade</h4>
                    <p className="mt-1">{availabilityError instanceof Error ? availabilityError.message : 'Erro desconhecido'}</p>
                  </div>
                </Alert>
              )}
              
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.start_time}
                      type="button"
                      className={`p-2 text-sm border rounded transition-all ${
                        formData.appointment_time === slot.start_time
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                      }`}
                      onClick={() => handleFieldChange('appointment_time', slot.start_time)}
                      disabled={isSubmitting}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      {slot.start_time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 p-4 border border-gray-200 rounded-lg bg-gray-50 text-center">
                  {formData.professional_id && formData.service_id && formData.appointment_date
                    ? (loadingAvailability ? 'Verificando disponibilidade...' : 'Nenhum horário disponível para esta data')
                    : 'Selecione serviço, profissional e data para ver horários disponíveis'
                  }
                </div>
              )}
              
              {errors.appointment_time && (
                <p className="text-red-500 text-sm mt-1">{errors.appointment_time}</p>
              )}
            </div>
          </div>

          {/* Horários recomendados */}
          {availability?.recommended_slots && availability.recommended_slots.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Horários Recomendados:</h4>
              <div className="flex flex-wrap gap-2">
                {availability.recommended_slots.map((slot, index) => (
                  <button
                    key={index}
                    type="button"
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
                    onClick={() => {
                      handleFieldChange('appointment_date', slot.date);
                      handleFieldChange('appointment_time', slot.time);
                    }}
                    disabled={isSubmitting}
                  >
                    {format(parseISO(slot.date), 'dd/MM', { locale: ptBR })} às {slot.time}
                    <span className="text-xs ml-1">({slot.reason})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Observações e Configurações */}
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Observações e Notificações</h3>
          
          <div className="space-y-4">
            {/* Observações */}
            <div>
              <label className="block text-sm font-medium mb-2">Observações</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all resize-none"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Observações especiais para este agendamento..."
                disabled={isSubmitting}
              />
            </div>
            
            {/* Configurações de notificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.send_confirmation}
                  onChange={(e) => handleFieldChange('send_confirmation', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <div>
                  <div className="font-medium text-sm">Enviar confirmação por WhatsApp</div>
                  <div className="text-xs text-gray-500">Confirmação enviada imediatamente após agendamento</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.send_reminder}
                  onChange={(e) => handleFieldChange('send_reminder', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <div>
                  <div className="font-medium text-sm">Enviar lembrete</div>
                  <div className="text-xs text-gray-500">Lembrete enviado {formData.reminder_hours_before}h antes</div>
                </div>
              </label>
            </div>

            {/* Horário do lembrete */}
            {formData.send_reminder && (
              <div>
                <label className="block text-sm font-medium mb-2">Enviar lembrete quantas horas antes?</label>
                <select
                  value={formData.reminder_hours_before}
                  onChange={(e) => handleFieldChange('reminder_hours_before', parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                  disabled={isSubmitting}
                >
                  <option value={1}>1 hora antes</option>
                  <option value={2}>2 horas antes</option>
                  <option value={4}>4 horas antes</option>
                  <option value={12}>12 horas antes</option>
                  <option value={24}>24 horas antes (1 dia)</option>
                  <option value={48}>48 horas antes (2 dias)</option>
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* Botões de ação */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button"
            variant="outline" 
            onClick={onCancel || (() => router.back())}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            variant="default"
            disabled={
              isSubmitting || 
              !formData.customer_id || 
              !formData.professional_id || 
              !formData.service_id || 
              !formData.appointment_date || 
              !formData.appointment_time
            }
            className="min-w-32 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {appointment?.id ? 'Atualizar' : 'Criar'} Agendamento
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AppointmentForm;