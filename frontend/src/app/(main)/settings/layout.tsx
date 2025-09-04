// ERP Nexus - Layout de Configurações
// Layout compartilhado para as páginas de configurações (/settings/*)

'use client';

import React from 'react';
import { Settings } from 'lucide-react';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header da seção */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Configurações
            </h1>
            <p className="text-slate-600">
              Gerencie configurações do sistema e da empresa
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo das páginas */}
      <div>
        {children}
      </div>
    </div>
  );
}