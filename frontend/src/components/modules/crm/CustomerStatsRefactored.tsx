'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPIGrid } from './KPIGrid';
import { CustomerJourney } from './CustomerJourney';
import { ActivitySummary } from './ActivitySummary';
import { InteractionTypeChart } from './InteractionTypeChart';

interface CustomerStatsProps {
  customer?: {
    id: string;
    name: string;
    total_visits?: number;
    total_spent?: number;
    average_ticket?: number;
    first_visit?: string;
    last_visit?: string;
    createdAt: string;
  };
  interactions?: Array<{
    id: string;
    type: string;
    date: string;
    description: string;
  }>;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: string;
    type: string;
  }>;
  appointments?: Array<{
    id: string;
    date: string;
    service: string;
    status: string;
  }>;
  loading?: boolean;
}

export const CustomerStats: React.FC<CustomerStatsProps> = ({
  customer,
  interactions = [],
  notes = [],
  appointments = [],
  loading = false,
}) => {
  // Se não há customer, mostra apenas as estatísticas gerais
  if (!customer) {
    return (
      <div className="space-y-6">
        <KPIGrid />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <KPIGrid />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
          <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics - sempre mostra */}
      <KPIGrid />

      {/* Detailed Statistics para customer específico */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="interactions">Interações</TabsTrigger>
          <TabsTrigger value="visits">Visitas</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfação</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CustomerJourney customer={customer} />
            <ActivitySummary 
              interactions={interactions}
              notes={notes}
              appointments={appointments}
            />
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InteractionTypeChart interactions={interactions} />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Interações Recentes</h3>
              {interactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma interação registrada</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {interactions.slice(0, 5).map((interaction) => (
                    <div key={interaction.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {interaction.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(interaction.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">
                        {interaction.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visits" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            <p>Funcionalidade de visitas será implementada em breve</p>
          </div>
        </TabsContent>

        <TabsContent value="satisfaction" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            <p>Funcionalidade de satisfação será implementada em breve</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};