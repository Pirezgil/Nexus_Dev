'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfessionalFormData, ProfessionalStatus } from '@/types';
import { servicesApi, apiPost } from '@/lib/api';
import { getProfessionalStatusOptions, getProfessionalStatusInfo } from '@/utils/professional-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  Clock, 
  Plus, 
  X,
  Calendar,
  Shield
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export default function NovoProfissionalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  
  const [formData, setFormData] = useState<ProfessionalFormData>({
    name: '',
    email: '',
    phone: '',
    specialties: [],
    status: 'ACTIVE',
    workSchedule: {
      monday: { start: '08:00', end: '18:00', active: true },
      tuesday: { start: '08:00', end: '18:00', active: true },
      wednesday: { start: '08:00', end: '18:00', active: true },
      thursday: { start: '08:00', end: '18:00', active: true },
      friday: { start: '08:00', end: '18:00', active: true },
      saturday: { start: '08:00', end: '12:00', active: false },
      sunday: { start: '08:00', end: '12:00', active: false },
    },
  });

  const handleInputChange = (field: keyof Omit<ProfessionalFormData, 'specialties' | 'workSchedule'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStatusChange = (status: ProfessionalStatus) => {
    setFormData(prev => ({
      ...prev,
      status,
    }));
  };

  const handleAddSpecialty = () => {
    if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty.trim())) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty.trim()],
      }));
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (specialtyToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.filter(s => s !== specialtyToRemove),
    }));
  };

  const handleScheduleChange = (day: string, field: 'start' | 'end' | 'active', value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      workSchedule: {
        ...prev.workSchedule,
        [day]: {
          ...prev.workSchedule[day as keyof typeof prev.workSchedule],
          [field]: value,
        },
      },
    }));
  };

  const handleCopySchedule = (fromDay: string) => {
    const sourceSchedule = formData.workSchedule[fromDay as keyof typeof formData.workSchedule];
    
    const updatedSchedule = { ...formData.workSchedule };
    Object.keys(updatedSchedule).forEach(day => {
      if (day !== fromDay) {
        updatedSchedule[day as keyof typeof updatedSchedule] = { ...sourceSchedule };
      }
    });

    setFormData(prev => ({
      ...prev,
      workSchedule: updatedSchedule,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiPost(servicesApi, '/professionals', formData);

      if (response.success) {
        router.push('/services');
      } else {
        console.error('Erro ao criar profissional:', response.error);
        // TODO: Mostrar toast de erro
      }
    } catch (error) {
      console.error('Erro ao criar profissional:', error);
      // TODO: Mostrar toast de erro
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.phone.trim();

  const getWorkingHours = (day: string) => {
    const schedule = formData.workSchedule[day as keyof typeof formData.workSchedule];
    if (!schedule.active) return 'Não trabalha';
    
    return `${schedule.start} - ${schedule.end}`;
  };

  const getTotalWorkingDays = () => {
    return Object.values(formData.workSchedule).filter(schedule => schedule.active).length;
  };

  return (
    <DashboardLayout
      title="Novo Profissional"
      subtitle="Adicione um novo profissional ao sistema"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <div className="flex items-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Voltar
          </Button>
        </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Pessoais */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Informações Pessoais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="exemplo@email.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={16} />
                <select
                  value={formData.status}
                  onChange={(e) => handleStatusChange(e.target.value as ProfessionalStatus)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  required
                >
                  {getProfessionalStatusOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {formData.status && (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getProfessionalStatusInfo(formData.status).color} ${getProfessionalStatusInfo(formData.status).textColor}`}>
                    {getProfessionalStatusInfo(formData.status).label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {getProfessionalStatusInfo(formData.status).description}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Status Information */}
        {(formData.status === 'VACATION' || formData.status === 'SICK_LEAVE') && (
          <Card className="p-4 border-yellow-200 bg-yellow-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${
                  formData.status === 'VACATION' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
              </div>
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  {formData.status === 'VACATION' ? 'Profissional em Férias' : 'Profissional em Licença Médica'}
                </p>
                <p className="text-yellow-700 mt-1">
                  {formData.status === 'VACATION' 
                    ? 'Este profissional não estará disponível para agendamentos regulares, mas pode ser contactado para casos urgentes.'
                    : 'Este profissional não estará disponível para agendamentos até o retorno da licença médica.'
                  }
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Especialidades */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Especialidades</h2>
          </div>

          <div className="space-y-4">
            {/* Input para nova especialidade */}
            <div className="flex gap-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="Digite uma especialidade e pressione Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpecialty();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddSpecialty}
                disabled={!newSpecialty.trim()}
                variant="outline"
              >
                <Plus size={16} />
                Adicionar
              </Button>
            </div>

            {/* Especialidades adicionadas */}
            {formData.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.specialties.map((specialty, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                  >
                    {specialty}
                    <button
                      type="button"
                      onClick={() => handleRemoveSpecialty(specialty)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Horários de Trabalho */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold">Horários de Trabalho</h2>
          </div>

          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const schedule = formData.workSchedule[day.key as keyof typeof formData.workSchedule];
              
              return (
                <div key={day.key} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="w-20 font-medium text-gray-700">
                    {day.label}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={schedule.active}
                      onChange={(e) => handleScheduleChange(day.key, 'active', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Ativo</span>
                  </div>

                  {schedule.active && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">De:</label>
                        <input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => handleScheduleChange(day.key, 'start', e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Até:</label>
                        <input
                          type="time"
                          value={schedule.end}
                          onChange={(e) => handleScheduleChange(day.key, 'end', e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopySchedule(day.key)}
                        className="text-xs"
                      >
                        Copiar para todos
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resumo dos horários */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Resumo da Agenda</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Dias de trabalho:</span>
                <span className="ml-2 font-medium">{getTotalWorkingDays()} dias/semana</span>
              </div>
              <div>
                <span className="text-gray-600">Horários:</span>
                <div className="ml-2 space-y-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.key} className="flex justify-between">
                      <span>{day.label}:</span>
                      <span className="font-mono text-xs">{getWorkingHours(day.key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!isFormValid || loading}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? 'Salvando...' : 'Salvar Profissional'}
          </Button>
        </div>
        </form>
      </div>
    </DashboardLayout>
  );
}