'use client';

import { CustomerInteraction } from '@/types';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Users, 
  Clock, 
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatTimeAgo, formatTime } from '@/lib/dates';

interface InteractionTimelineProps {
  interactions: CustomerInteraction[];
  onAddInteraction?: (interaction: Omit<CustomerInteraction, 'id' | 'customerId' | 'userId' | 'user' | 'createdAt'>) => void;
  loading?: boolean;
}

export const InteractionTimeline: React.FC<InteractionTimelineProps> = ({
  interactions,
  onAddInteraction,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  const visibleInteractions = showAll ? interactions : interactions.slice(0, 5);

  const getInteractionIcon = (type: string) => {
    const icons = {
      CALL: Phone,
      EMAIL: Mail,
      WHATSAPP: MessageCircle,
      VISIT: Users,
      OTHER: Clock,
    };
    
    const IconComponent = icons[type as keyof typeof icons] || Clock;
    return <IconComponent size={16} />;
  };

  const getInteractionColor = (type: string) => {
    const colors = {
      CALL: 'bg-blue-100 border-blue-300 text-blue-600',
      EMAIL: 'bg-green-100 border-green-300 text-green-600', 
      WHATSAPP: 'bg-emerald-100 border-emerald-300 text-emerald-600',
      VISIT: 'bg-purple-100 border-purple-300 text-purple-600',
      OTHER: 'bg-gray-100 border-gray-300 text-gray-600',
    };
    
    return colors[type as keyof typeof colors] || colors.OTHER;
  };

  const getInteractionTypeLabel = (type: string) => {
    const labels = {
      CALL: 'Ligação',
      EMAIL: 'E-mail',
      WHATSAPP: 'WhatsApp',
      VISIT: 'Visita',
      OTHER: 'Outro',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatRelativeTime = (dateString: string) => {
    const diffInHours = Math.abs(Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatTime(dateString);
    } else if (diffInHours < 24 * 7) {
      return formatTimeAgo(dateString);
    } else {
      return formatDateTime(dateString);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock size={48} className="mx-auto mb-4 text-gray-300" />
        <p className="text-lg">Nenhuma interação registrada</p>
        <p className="text-sm mt-2">
          Registre interações para acompanhar o histórico de relacionamento com o cliente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com controle de expansão */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          Histórico de Interações ({interactions.length})
        </button>
        
        {interactions.length > 5 && expanded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Mostrar Menos' : `Ver Todas (${interactions.length})`}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="relative">
          {/* Linha do timeline */}
          <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200"></div>
          
          {/* Interações */}
          <div className="space-y-4">
            {visibleInteractions.map((interaction, index) => (
              <div key={interaction.id} className="relative flex gap-4">
                {/* Ícone da interação */}
                <div className={`
                  relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center
                  ${getInteractionColor(interaction.type)}
                `}>
                  {getInteractionIcon(interaction.type)}
                </div>

                {/* Conteúdo da interação */}
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {getInteractionTypeLabel(interaction.type)}
                      </span>
                      <span className="text-sm text-gray-500">
                        por {interaction.user.name}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500" title={formatDateTime(interaction.date)}>
                      <Calendar size={14} className="inline mr-1" />
                      {formatRelativeTime(interaction.date)}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed">
                    {interaction.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mostrar mais/menos se houver muitas interações */}
          {interactions.length > 5 && !showAll && (
            <div className="relative flex gap-4 mt-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              </div>
              <div className="flex-1 text-center text-gray-500 text-sm italic">
                {interactions.length - 5} interações mais antigas...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface QuickInteractionProps {
  onAdd: (interaction: { type: string; description: string }) => void;
  loading?: boolean;
}

export const QuickInteraction: React.FC<QuickInteractionProps> = ({
  onAdd,
  loading = false,
}) => {
  const [type, setType] = useState('CALL');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAdd({ type, description });
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex gap-4 items-end">
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            disabled={loading}
          >
            <option value="CALL">Ligação</option>
            <option value="EMAIL">E-mail</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="VISIT">Visita</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a interação..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          disabled={!description.trim() || loading}
          className="px-6"
        >
          {loading ? 'Salvando...' : 'Registrar'}
        </Button>
      </div>
    </form>
  );
};