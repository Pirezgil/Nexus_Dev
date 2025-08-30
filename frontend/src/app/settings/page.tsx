// ERP Nexus - Configurações Gerais
// Página principal de configurações com navegação por abas

'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building2, Users, Database } from 'lucide-react';

import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { UsersManagement } from '@/components/settings/UsersManagement';
import { CRMSettings } from '@/components/settings/CRMSettings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { useCurrentUser, usePermissions } from '@/stores/auth';

function SettingsPage() {
  const { user } = useCurrentUser();
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = React.useState('profile');

  // Determinar abas disponíveis baseado nas permissões
  const availableTabs = React.useMemo(() => {
    const tabs = [
      {
        id: 'profile',
        label: 'Meu Perfil',
        icon: User,
        description: 'Configurações pessoais e preferências',
        component: ProfileSettings,
        permission: null // Sempre disponível
      },
    ];

    // Aba de usuários apenas para Admin
    if (permissions.isAdmin) {
      tabs.push({
        id: 'users',
        label: 'Usuários',
        icon: Users,
        description: 'Gestão de usuários da empresa',
        component: UsersManagement,
        permission: 'manage_users'
      });

      tabs.push({
        id: 'company',
        label: 'Empresa',
        icon: Building2,
        description: 'Configurações da empresa',
        component: CompanySettings,
        permission: 'manage_company'
      });
    }

    // Aba CRM para Manager/Admin
    if (permissions.isManager || permissions.isAdmin) {
      tabs.push({
        id: 'crm',
        label: 'CRM',
        icon: Database,
        description: 'Campos customizados e configurações do CRM',
        component: CRMSettings,
        permission: 'manage_crm_settings'
      });
    }

    return tabs;
  }, [permissions]);

  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Gerencie suas configurações pessoais e da empresa"
    >
      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 text-sm"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Contents */}
        {availableTabs.map((tab) => {
          const Component = tab.component;
          return (
            <TabsContent key={tab.id} value={tab.id} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <tab.icon className="w-6 h-6 text-blue-600" />
                    <div>
                      <CardTitle className="text-xl">{tab.label}</CardTitle>
                      <CardDescription className="mt-1">
                        {tab.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Component />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </DashboardLayout>
  );
}

export default withAuth(SettingsPage);