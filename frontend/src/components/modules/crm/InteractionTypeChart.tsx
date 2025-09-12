'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Phone, Mail, MessageCircle, Building, Activity } from 'lucide-react';

interface InteractionTypeChartProps {
  interactions: Array<{
    id: string;
    type: string;
    date: string;
    description: string;
  }>;
}

export const InteractionTypeChart: React.FC<InteractionTypeChartProps> = ({
  interactions = []
}) => {
  // Calculate interaction types
  const interactionTypes = interactions.reduce((acc, interaction) => {
    acc[interaction.type] = (acc[interaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeConfig = {
    CALL: { label: 'Ligações', icon: Phone, color: 'bg-primary/10 text-primary border-primary/20' },
    EMAIL: { label: 'Emails', icon: Mail, color: 'bg-success/10 text-success border-success/20' },
    WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20' },
    VISIT: { label: 'Visitas', icon: Building, color: 'bg-warning/10 text-warning border-warning/20' },
    OTHER: { label: 'Outros', icon: Activity, color: 'bg-muted text-muted-foreground border-muted' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Tipos de Interação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(interactionTypes).map(([type, count]) => {
            const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.OTHER;
            const Icon = config.icon;
            const percentage = interactions.length > 0 ? Math.round((count / interactions.length) * 100) : 0;
            
            return (
              <div key={type} className={`flex items-center justify-between p-3 rounded-lg border ${config.color}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-medium">{config.label}</span>
                    <p className="text-xs text-muted-foreground">{percentage}% do total</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {count}
                </Badge>
              </div>
            );
          })}
          
          {Object.keys(interactionTypes).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Nenhuma interação registrada</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};