'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Star, Activity } from 'lucide-react';
import { formatDate, formatTimeAgo } from '@/lib/format';

interface CustomerJourneyProps {
  customer: {
    id: string;
    name: string;
    first_visit?: string;
    last_visit?: string;
    createdAt: string;
  };
}

export const CustomerJourney: React.FC<CustomerJourneyProps> = ({ customer }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Jornada do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div>
            <p className="text-sm text-muted-foreground">Primeira visita</p>
            <p className="font-medium">
              {customer.first_visit ? formatDate(customer.first_visit) : 'Não registrada'}
            </p>
          </div>
          <Star className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex items-center justify-between p-3 bg-success/5 rounded-lg border border-success/10">
          <div>
            <p className="text-sm text-muted-foreground">Última visita</p>
            <p className="font-medium">
              {customer.last_visit ? formatDate(customer.last_visit) : 'Não registrada'}
            </p>
          </div>
          <Clock className="h-5 w-5 text-success" />
        </div>
        
        <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg border border-warning/10">
          <div>
            <p className="text-sm text-muted-foreground">Tempo como cliente</p>
            <p className="font-medium">
              {formatTimeAgo(customer.createdAt)}
            </p>
          </div>
          <Calendar className="h-5 w-5 text-warning" />
        </div>
      </CardContent>
    </Card>
  );
};