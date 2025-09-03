// ERP Nexus - Main Layout
// Layout compartilhado para todas as páginas principais do sistema

'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import AuthGuard from '@/components/auth/AuthGuard';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main content area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}