'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User, 
  Phone, 
  Mail, 
  MessageCircle, 
  Calendar, 
  DollarSign,
  Clock,
  Edit,
  ArrowLeft,
  MapPin,
  Building
} from 'lucide-react';
import { formatPhone, formatCurrency, formatDate, getDaysSince } from '@/lib/format';

interface CustomerHeaderProps {
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone: string;
    status: 'ACTIVE' | 'PROSPECT' | 'INACTIVE' | 'BLOCKED';
    avatar_url?: string;
    address?: {
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
    };
    createdAt: string;
    total_visits?: number;
    total_spent?: number;
    average_ticket?: number;
    last_visit?: string;
    tags?: string[];
  };
  loading?: boolean;
  onEdit?: () => void;
  onBack?: () => void;
  onContact?: (type: 'whatsapp' | 'email' | 'phone') => void;
  onSchedule?: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  customer,
  loading = false,
  onEdit,
  onBack,
  onContact,
  onSchedule,
}) => {
  // Loading state
  if (loading || !customer) {
    return (
      <div className="space-y-6">
        {onBack && (
          <div className="h-10 bg-muted rounded w-20"></div>
        )}
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-primary to-primary/90 h-32 relative">
              <div className="absolute inset-0 bg-black opacity-10"></div>
            </div>
            <div className="px-6 pb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 -mt-16">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="w-24 h-24 bg-muted rounded-full border-4 border-background animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
                  <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PROSPECT: 'bg-blue-50 text-blue-700 border-blue-200',
    INACTIVE: 'bg-gray-50 text-gray-600 border-gray-200',
    BLOCKED: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusLabels = {
    ACTIVE: 'Ativo',
    PROSPECT: 'Prospect',
    INACTIVE: 'Inativo',
    BLOCKED: 'Bloqueado',
  };

  const daysSinceCreation = getDaysSince(customer.createdAt);
  const daysSinceLastVisit = customer.last_visit ? getDaysSince(customer.last_visit) : null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
          aria-label="Voltar para lista de clientes"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar</span>
        </Button>
      )}

      {/* Main Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header Background */}
          <div className="bg-gradient-to-r from-primary to-primary/90 h-32 relative">
            <div className="absolute inset-0 bg-black opacity-10"></div>
          </div>

          {/* Customer Info */}
          <div className="px-6 pb-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 -mt-16">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                    {customer.avatar_url ? (
                      <img 
                        src={customer.avatar_url} 
                        alt={customer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <User className="h-12 w-12 text-primary" />
                      </div>
                    )}
                  </div>
                  {/* Status Badge */}
                  <div className="absolute -bottom-2 -right-2">
                    <Badge 
                      className={`${statusColors[customer.status]} border-2 border-white shadow-md`}
                    >
                      {statusLabels[customer.status]}
                    </Badge>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    {customer.name}
                  </h1>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Cliente há {daysSinceCreation} dias</span>
                    </div>
                    
                    {customer.last_visit && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Última visita: {daysSinceLastVisit === 0 ? 'hoje' : `${daysSinceLastVisit} dias atrás`}</span>
                      </div>
                    )}
                    
                    {customer.total_spent !== undefined && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Total gasto: {formatCurrency(customer.total_spent)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {customer.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div 
                className="flex flex-wrap gap-2" 
                role="group" 
                aria-label="Ações rápidas do cliente"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onContact?.('phone')}
                  className="flex items-center gap-2"
                  aria-label={`Ligar para ${customer.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onContact?.('phone');
                    }
                  }}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <span>Ligar</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onContact?.('whatsapp')}
                  className="flex items-center gap-2"
                  aria-label={`Enviar WhatsApp para ${customer.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onContact?.('whatsapp');
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>WhatsApp</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onContact?.('email')}
                  className="flex items-center gap-2"
                  aria-label={`Enviar email para ${customer.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onContact?.('email');
                    }
                  }}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Email</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSchedule}
                  className="flex items-center gap-2"
                  aria-label={`Agendar atendimento para ${customer.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSchedule?.();
                    }
                  }}
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <span>Agendar</span>
                </Button>
                
                <Button
                  onClick={onEdit}
                  className="flex items-center gap-2"
                  aria-label={`Editar informações de ${customer.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit?.();
                    }
                  }}
                >
                  <Edit className="h-4 w-4" aria-hidden="true" />
                  <span>Editar</span>
                </Button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium text-gray-900">{formatPhone(customer.phone)}</p>
                </div>
              </div>

              {customer.email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{customer.email}</p>
                  </div>
                </div>
              )}

              {customer.address && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Localização</p>
                    <p className="font-medium text-gray-900">
                      {customer.address.city}, {customer.address.state}
                    </p>
                  </div>
                </div>
              )}

              {customer.total_visits !== undefined && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Building className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Visitas</p>
                    <p className="font-medium text-gray-900">{customer.total_visits} visitas</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};