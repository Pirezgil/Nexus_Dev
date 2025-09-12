'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface ActivitySummaryProps {
  interactions: Array<{ id: string; type: string; date: string; description: string }>;
  notes: Array<{ id: string; content: string; createdAt: string; type: string }>;
  appointments: Array<{ id: string; date: string; service: string; status: string }>;
}

export const ActivitySummary: React.FC<ActivitySummaryProps> = ({
  interactions = [],
  notes = [],
  appointments = []
}) => {
  // Calculate interaction types
  const interactionTypes = interactions.reduce((acc, interaction) => {
    acc[interaction.type] = (acc[interaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Resumo de Atividades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-2xl font-bold text-primary">{interactions.length}</p>
            <p className="text-sm text-muted-foreground">Interações</p>
          </div>
          
          <div className="text-center p-4 bg-success/5 rounded-lg border border-success/10">
            <p className="text-2xl font-bold text-success">{notes.length}</p>
            <p className="text-sm text-muted-foreground">Anotações</p>
          </div>
          
          <div className="text-center p-4 bg-warning/5 rounded-lg border border-warning/10">
            <p className="text-2xl font-bold text-warning">{appointments.length}</p>
            <p className="text-sm text-muted-foreground">Agendamentos</p>
          </div>
          
          <div className="text-center p-4 bg-error/5 rounded-lg border border-error/10">
            <p className="text-2xl font-bold text-error">{Object.keys(interactionTypes).length}</p>
            <p className="text-sm text-muted-foreground">Tipos de Contato</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};