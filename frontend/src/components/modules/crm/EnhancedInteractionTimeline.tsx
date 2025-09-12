'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Users, 
  Clock, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Plus,
  Star,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatDateTime, formatTimeAgo, formatTime } from '@/lib/format';

interface CustomerInteraction {
  id: string;
  type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'VISIT' | 'OTHER' | 'SERVICE';
  subject?: string;
  description: string;
  date: string;
  direction?: 'inbound' | 'outbound';
  status?: 'completed' | 'pending' | 'cancelled';
  user: {
    id: string;
    name: string;
  };
  metadata?: {
    duration?: number;
    phone?: string;
    service_name?: string;
    professional_name?: string;
    photos?: string[];
  };
}

interface CustomerNote {
  id: string;
  content: string;
  type: 'GENERAL' | 'IMPORTANT' | 'REMINDER' | 'FOLLOW_UP' | 'COMPLAINT' | 'COMPLIMENT';
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  isPrivate: boolean;
}

interface EnhancedInteractionTimelineProps {
  customerId: string;
  interactions: CustomerInteraction[];
  notes: CustomerNote[];
  loading?: boolean;
  onAddInteraction?: (interaction: Omit<CustomerInteraction, 'id' | 'customerId' | 'userId' | 'user' | 'createdAt'>) => void;
  onAddNote?: (note: { content: string; type: string; isPrivate: boolean }) => void;
}

interface TimelineItem {
  id: string;
  type: 'interaction' | 'note';
  date: string;
  data: CustomerInteraction | CustomerNote;
}

export const EnhancedInteractionTimeline: React.FC<EnhancedInteractionTimelineProps> = ({
  customerId,
  interactions,
  notes,
  loading = false,
  onAddInteraction,
  onAddNote,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'interactions' | 'notes'>('all');
  const [interactionSubtype, setInteractionSubtype] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState('GENERAL');

  // Combine and sort all timeline items
  const allItems: TimelineItem[] = [
    ...interactions.map(interaction => ({
      id: interaction.id,
      type: 'interaction' as const,
      date: interaction.date,
      data: interaction,
    })),
    ...notes.map(note => ({
      id: note.id,
      type: 'note' as const,
      date: note.createdAt,
      data: note,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter items
  const filteredItems = allItems.filter(item => {
    // Type filter
    if (filterType === 'interactions' && item.type !== 'interaction') return false;
    if (filterType === 'notes' && item.type !== 'note') return false;
    
    // Interaction subtype filter
    if (item.type === 'interaction' && interactionSubtype !== 'all' && item.data.type !== interactionSubtype) return false;
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (item.type === 'interaction') {
        const interaction = item.data as CustomerInteraction;
        return (
          interaction.description?.toLowerCase().includes(searchLower) ||
          interaction.subject?.toLowerCase().includes(searchLower) ||
          interaction.user.name.toLowerCase().includes(searchLower)
        );
      } else {
        const note = item.data as CustomerNote;
        return (
          note.content.toLowerCase().includes(searchLower) ||
          note.user.name.toLowerCase().includes(searchLower)
        );
      }
    }
    
    return true;
  });

  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 10);

  const getInteractionIcon = (type: string) => {
    const icons = {
      CALL: Phone,
      EMAIL: Mail,
      WHATSAPP: MessageCircle,
      VISIT: Users,
      SERVICE: CheckCircle,
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
      SERVICE: 'bg-orange-100 border-orange-300 text-orange-600',
      OTHER: 'bg-muted border-border text-muted-foreground',
    };
    
    return colors[type as keyof typeof colors] || colors.OTHER;
  };

  const getInteractionTypeLabel = (type: string) => {
    const labels = {
      CALL: 'Ligação',
      EMAIL: 'E-mail',
      WHATSAPP: 'WhatsApp',
      VISIT: 'Visita',
      SERVICE: 'Atendimento',
      OTHER: 'Outro',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getNoteIcon = (type: string) => {
    const icons = {
      GENERAL: FileText,
      IMPORTANT: Star,
      REMINDER: Clock,
      FOLLOW_UP: Calendar,
      COMPLAINT: AlertCircle,
      COMPLIMENT: CheckCircle,
    };
    
    const IconComponent = icons[type as keyof typeof icons] || FileText;
    return <IconComponent size={16} />;
  };

  const getNoteColor = (type: string) => {
    const colors = {
      GENERAL: 'bg-muted border-border text-muted-foreground',
      IMPORTANT: 'bg-yellow-100 border-yellow-300 text-yellow-600',
      REMINDER: 'bg-blue-100 border-blue-300 text-blue-600',
      FOLLOW_UP: 'bg-purple-100 border-purple-300 text-purple-600',
      COMPLAINT: 'bg-red-100 border-red-300 text-red-600',
      COMPLIMENT: 'bg-green-100 border-green-300 text-green-600',
    };
    
    return colors[type as keyof typeof colors] || colors.GENERAL;
  };

  const getNoteTypeLabel = (type: string) => {
    const labels = {
      GENERAL: 'Geral',
      IMPORTANT: 'Importante',
      REMINDER: 'Lembrete',
      FOLLOW_UP: 'Follow-up',
      COMPLAINT: 'Reclamação',
      COMPLIMENT: 'Elogio',
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

  const handleAddNote = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote({
        content: newNote.trim(),
        type: newNoteType,
        isPrivate: false,
      });
      setNewNote('');
      setShowAddForm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 bg-muted/50 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted/50 rounded w-3/4"></div>
              <div className="h-3 bg-muted/50 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline de Atividades ({filteredItems.length})
          </CardTitle>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-4 mt-4">
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  placeholder="Buscar atividades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Filters */}
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="interactions">Interações</SelectItem>
                    <SelectItem value="notes">Anotações</SelectItem>
                  </SelectContent>
                </Select>
                
                {filterType === 'interactions' && (
                  <Select value={interactionSubtype} onValueChange={setInteractionSubtype}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      <SelectItem value="CALL">Ligações</SelectItem>
                      <SelectItem value="EMAIL">E-mails</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="VISIT">Visitas</SelectItem>
                      <SelectItem value="SERVICE">Atendimentos</SelectItem>
                      <SelectItem value="OTHER">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterType('all');
                    setInteractionSubtype('all');
                    setSearchTerm('');
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </div>

            {/* Add Note Button */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Mostrando {visibleItems.length} de {filteredItems.length} atividades
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Anotação
              </Button>
            </div>

            {/* Add Note Form */}
            {showAddForm && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Select value={newNoteType} onValueChange={setNewNoteType}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GENERAL">Geral</SelectItem>
                          <SelectItem value="IMPORTANT">Importante</SelectItem>
                          <SelectItem value="REMINDER">Lembrete</SelectItem>
                          <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                          <SelectItem value="COMPLAINT">Reclamação</SelectItem>
                          <SelectItem value="COMPLIMENT">Elogio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Input
                      placeholder="Digite sua anotação..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                      >
                        Salvar Anotação
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock size={48} className="mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg">Nenhuma atividade encontrada</p>
              <p className="text-sm mt-2">
                {searchTerm ? 'Tente ajustar sua busca ou filtros.' : 'Registre interações para acompanhar o histórico.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline */}
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-muted/50"></div>
                
                {/* Timeline Items */}
                <div className="space-y-4">
                  {visibleItems.map((item, index) => (
                    <div key={item.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={`
                        relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center
                        ${item.type === 'interaction' 
                          ? getInteractionColor((item.data as CustomerInteraction).type)
                          : getNoteColor((item.data as CustomerNote).type)
                        }
                      `}>
                        {item.type === 'interaction' 
                          ? getInteractionIcon((item.data as CustomerInteraction).type)
                          : getNoteIcon((item.data as CustomerNote).type)
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-white border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {item.type === 'interaction' ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {getInteractionTypeLabel((item.data as CustomerInteraction).type)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {(item.data as CustomerInteraction).direction === 'inbound' ? 'Recebida' : 'Enviada'}
                                </Badge>
                                {(item.data as CustomerInteraction).status && (
                                  <Badge 
                                    variant={
                                      (item.data as CustomerInteraction).status === 'completed' ? 'default' :
                                      (item.data as CustomerInteraction).status === 'pending' ? 'secondary' : 'destructive'
                                    }
                                    className="text-xs"
                                  >
                                    {(item.data as CustomerInteraction).status === 'completed' ? 'Concluído' :
                                     (item.data as CustomerInteraction).status === 'pending' ? 'Pendente' : 'Cancelado'}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-foreground">
                                  Anotação - {getNoteTypeLabel((item.data as CustomerNote).type)}
                                </span>
                                {(item.data as CustomerNote).isPrivate && (
                                  <Badge variant="outline" className="text-xs">
                                    Privada
                                  </Badge>
                                )}
                              </>
                            )}
                            <span className="text-sm text-muted-foreground">
                              por {(item.data as any).user.name}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground" title={formatDateTime(item.date)}>
                            <Calendar size={14} className="inline mr-1" />
                            {formatRelativeTime(item.date)}
                          </div>
                        </div>
                        
                        {/* Additional Details */}
                        {item.type === 'interaction' && (item.data as CustomerInteraction).subject && (
                          <p className="font-medium text-foreground mb-2">
                            {(item.data as CustomerInteraction).subject}
                          </p>
                        )}
                        
                        <p className="text-foreground leading-relaxed">
                          {item.type === 'interaction' 
                            ? (item.data as CustomerInteraction).description
                            : (item.data as CustomerNote).content
                          }
                        </p>
                        
                        {/* Metadata */}
                        {item.type === 'interaction' && (item.data as CustomerInteraction).metadata && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {(item.data as CustomerInteraction).metadata?.duration && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{(item.data as CustomerInteraction).metadata?.duration} min</span>
                                </div>
                              )}
                              {(item.data as CustomerInteraction).metadata?.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  <span>{(item.data as CustomerInteraction).metadata?.phone}</span>
                                </div>
                              )}
                              {(item.data as CustomerInteraction).metadata?.service_name && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>{(item.data as CustomerInteraction).metadata?.service_name}</span>
                                </div>
                              )}
                              {(item.data as CustomerInteraction).metadata?.professional_name && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{(item.data as CustomerInteraction).metadata?.professional_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {filteredItems.length > 10 && !showAll && (
                  <div className="relative flex gap-4 mt-4">
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-2 h-2 bg-muted/30 rounded-full"></div>
                    </div>
                    <div className="flex-1 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-muted-foreground"
                      >
                        Mostrar mais {filteredItems.length - 10} atividades
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};