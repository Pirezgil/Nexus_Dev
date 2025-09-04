// ERP Nexus - Configurações do CRM
// Página para configurar campos customizados e configurações específicas do CRM

'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

import { CRMSettings } from '@/components/settings/CRMSettings';
import { withAuth } from '@/components/auth/withAuth';
import { usePermissions } from '@/stores/auth';

function CRMConfigPage() {
  const permissions = usePermissions();

  // Verificar se o usuário tem permissão para acessar configurações do CRM
  if (!permissions.isManager && !permissions.isAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar as configurações do CRM.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl">Configurar CRM</CardTitle>
              <CardDescription className="mt-1">
                Campos customizados e configurações específicas do sistema CRM
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CRMSettings />
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(CRMConfigPage);