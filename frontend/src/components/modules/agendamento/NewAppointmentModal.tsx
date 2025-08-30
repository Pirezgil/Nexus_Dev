'use client';

import { useState, useEffect } from 'react';
import { Customer, Professional, Service, AppointmentFormData, CalendarAvailability } from '@/types';
import { agendamentoApi, servicesApi, crmApi, apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Package, 
  AlertCircle,
  CheckCircle,
  Search
} from 'lucide-react';
import { format, addMinutes, parseISO, isBefore, isAfter, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedDate?: Date;
  preSelectedProfessional?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedDate,
  preSelectedProfessional,
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'customer' | 'service' | 'datetime' | 'confirm'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [formData, setFormData] = useState<AppointmentFormData>({
    customerId: '',
    professionalId: preSelectedProfessional || '',
    serviceId: '',
    startTime: '',
    notes: '',
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    preSelectedDate ? format(preSelectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [selectedTime, setSelectedTime] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProfessional && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedProfessional, selectedDate, selectedService]);

  const loadData = async () => {
    try {
      const [customersRes, professionalsRes, servicesRes] = await Promise.all([
        apiGet<Customer[]>(crmApi, '/customers', { status: 'ACTIVE' }),
        apiGet<Professional[]>(servicesApi, '/professionals', { active: true }),
        apiGet<Service[]>(servicesApi, '/services', { active: true }),
      ]);

      if (customersRes.success) setCustomers(customersRes.data);
      if (professionalsRes.success) setProfessionals(professionalsRes.data);
      if (servicesRes.success) setServices(servicesRes.data);

      // Auto-select pre-selected professional
      if (preSelectedProfessional) {
        const professional = professionalsRes.data.find(p => p.id === preSelectedProfessional);
        if (professional) setSelectedProfessional(professional);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedProfessional || !selectedDate) return;

    setLoadingSlots(true);
    try {
      const response = await apiGet<CalendarAvailability>(
        agendamentoApi,
        `/availability/${selectedProfessional.id}`,
        { date: selectedDate }
      );

      if (response.success) {
        setAvailableSlots(response.data.slots);
      }
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      professionalId: preSelectedProfessional || '',
      serviceId: '',
      startTime: '',
      notes: '',
    });
    setSelectedCustomer(null);
    setSelectedProfessional(preSelectedProfessional ? professionals.find(p => p.id === preSelectedProfessional) || null : null);
    setSelectedService(null);
    setSelectedDate(preSelectedDate ? format(preSelectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setSelectedTime('');
    setStep('customer');
    setCustomerSearch('');
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customerId: customer.id }));
    setStep('service');
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setFormData(prev => ({ ...prev, serviceId: service.id }));
    setStep('datetime');
  };

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setFormData(prev => ({ ...prev, professionalId: professional.id }));
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    const startDateTime = `${selectedDate}T${time}:00`;
    setFormData(prev => ({ ...prev, startTime: startDateTime }));
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const response = await apiPost(agendamentoApi, '/appointments', formData);

      if (response.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.phone.includes(customerSearch)
  );

  const getEndTime = () => {
    if (!selectedService || !selectedTime) return '';
    
    const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const endDateTime = addMinutes(startDateTime, selectedService.duration);
    return format(endDateTime, 'HH:mm');
  };

  const renderCustomerStep = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar Cliente
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Digite o nome, email ou telefone..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User size={48} className="mx-auto mb-2 text-gray-300" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleCustomerSelect(customer)}
              className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <div className="font-medium text-gray-900">{customer.name}</div>
              <div className="text-sm text-gray-500">{customer.email}</div>
              <div className="text-sm text-gray-500">{customer.phone}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderServiceStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Selecione o Serviço
        </h3>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => handleServiceSelect(service)}
            className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{service.name}</div>
                {service.description && (
                  <div className="text-sm text-gray-500 mt-1">{service.description}</div>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>{service.duration}min</span>
                  </div>
                  <div className="text-green-600 font-medium">
                    R$ {service.price.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDateTimeStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Selecione Data e Horário
        </h3>
      </div>

      {/* Seletor de Profissional */}
      {!preSelectedProfessional && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profissional
          </label>
          <select
            value={selectedProfessional?.id || ''}
            onChange={(e) => {
              const prof = professionals.find(p => p.id === e.target.value);
              if (prof) handleProfessionalSelect(prof);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Selecione um profissional</option>
            {professionals.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Seletor de Data */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data
        </label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={format(new Date(), 'yyyy-MM-dd')}
        />
      </div>

      {/* Horários Disponíveis */}
      {selectedProfessional && selectedDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Horários Disponíveis
          </label>
          
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock size={48} className="mx-auto mb-2 text-gray-300" />
              <p>Nenhum horário disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && handleTimeSelect(slot.time)}
                  disabled={!slot.available}
                  className={`p-2 text-sm rounded border transition-colors ${
                    slot.available
                      ? 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Confirmar Agendamento
        </h3>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Cliente:</span>
          <span className="font-medium">{selectedCustomer?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Serviço:</span>
          <span className="font-medium">{selectedService?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Profissional:</span>
          <span className="font-medium">{selectedProfessional?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Data:</span>
          <span className="font-medium">
            {format(new Date(selectedDate), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Horário:</span>
          <span className="font-medium">
            {selectedTime} - {getEndTime()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Duração:</span>
          <span className="font-medium">{selectedService?.duration}min</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-gray-600">Valor:</span>
          <span className="font-bold text-green-600">
            R$ {selectedService?.price.toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Observações (Opcional)
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Adicione observações sobre o agendamento..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Novo Agendamento
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X size={16} />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center mb-6">
            {['customer', 'service', 'datetime', 'confirm'].map((stepName, index) => {
              const isActive = step === stepName;
              const isCompleted = ['customer', 'service', 'datetime', 'confirm'].indexOf(step) > index;
              
              return (
                <div key={stepName} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isActive ? 'bg-blue-500 text-white' : 
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? <CheckCircle size={16} /> : index + 1}
                  </div>
                  {index < 3 && (
                    <div className={`w-12 h-0.5 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="mb-6">
            {step === 'customer' && renderCustomerStep()}
            {step === 'service' && renderServiceStep()}
            {step === 'datetime' && renderDateTimeStep()}
            {step === 'confirm' && renderConfirmStep()}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'customer') {
                  onClose();
                } else if (step === 'service') {
                  setStep('customer');
                } else if (step === 'datetime') {
                  setStep('service');
                } else if (step === 'confirm') {
                  setStep('datetime');
                }
              }}
            >
              {step === 'customer' ? 'Cancelar' : 'Voltar'}
            </Button>

            {step === 'confirm' && (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Agendando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};