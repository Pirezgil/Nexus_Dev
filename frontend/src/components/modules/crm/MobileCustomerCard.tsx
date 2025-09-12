'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Phone, 
  Mail, 
  User, 
  Calendar,
  Eye,
  Edit,
  Archive
} from 'lucide-react';
import { Customer } from '@/hooks/api/use-customers';

interface MobileCustomerCardProps {
  customer: Customer;
  isSelected: boolean;
  onToggleSelection: () => void;
  onView: () => void;
  onEdit: () => void;
  onInactivate: () => void;
}

export const MobileCustomerCard: React.FC<MobileCustomerCardProps> = ({
  customer,
  isSelected,
  onToggleSelection,
  onView,
  onEdit,
  onInactivate,
}) => {
  const statusColors = {
    ACTIVE: 'bg-success text-white',
    PROSPECT: 'bg-primary text-white',
    INACTIVE: 'bg-slate-500 text-white',
    BLOCKED: 'bg-error text-white',
  };

  const statusLabels = {
    ACTIVE: 'Ativo',
    PROSPECT: 'Prospect',
    INACTIVE: 'Inativo',
    BLOCKED: 'Bloqueado',
  };

  return (
    <Card className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Checkbox e Info Principal */}
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              className="mt-1"
            />
            
            <div className="flex-1 min-w-0">
              {/* Nome e Email */}
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {customer.name}
                  </h3>
                  {customer.email && (
                    <p className="text-sm text-muted-foreground truncate">
                      {customer.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Telefone */}
              {customer.phone && (
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {customer.phone}
                  </span>
                </div>
              )}

              {/* Status e Tags */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={`${statusColors[customer.status as keyof typeof statusColors]} text-xs`}>
                  {statusLabels[customer.status as keyof typeof statusLabels]}
                </Badge>
                
                {customer.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                
                {customer.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{customer.tags.length - 2}
                  </Badge>
                )}
              </div>

              {/* Data de Cadastro */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              {customer.status === 'ACTIVE' && (
                <DropdownMenuItem onClick={onInactivate}>
                  <Archive className="h-4 w-4 mr-2" />
                  Inativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};