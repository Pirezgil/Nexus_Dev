// ERP Nexus - Configurações Gerais
// Página principal de configurações com navegação por abas

'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { withAuth } from '@/components/auth/withAuth';
import { useCurrentUser } from '@/stores/auth';

function SettingsPage() {
  const { user, displayName } = useCurrentUser();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl">Meu Perfil</CardTitle>
              <CardDescription className="mt-1">
                Configurações pessoais e preferências
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileSettings />
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(SettingsPage);