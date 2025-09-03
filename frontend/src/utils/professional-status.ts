// Professional Status Utility Functions
// Provides consistent status display and business logic for Professional entities

import type { ProfessionalStatus } from '@/types';

export interface ProfessionalStatusInfo {
  label: string;
  color: string;
  textColor: string;
  available: boolean;
  description: string;
}

/**
 * Get display information for a professional status
 * Returns color, text, and availability info for UI components
 */
export function getProfessionalStatusInfo(status: ProfessionalStatus): ProfessionalStatusInfo {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Ativo',
        color: 'bg-green-100 border-green-200',
        textColor: 'text-green-800',
        available: true,
        description: 'Disponível para agendamentos'
      };
    
    case 'INACTIVE':
      return {
        label: 'Inativo',
        color: 'bg-gray-100 border-gray-200',
        textColor: 'text-gray-600',
        available: false,
        description: 'Indisponível para agendamentos'
      };
    
    case 'VACATION':
      return {
        label: 'Férias',
        color: 'bg-yellow-100 border-yellow-200',
        textColor: 'text-yellow-800',
        available: false, // Could be true for urgent cases in some business logic
        description: 'Em período de férias'
      };
    
    case 'SICK_LEAVE':
      return {
        label: 'Licença Médica',
        color: 'bg-red-100 border-red-200',
        textColor: 'text-red-700',
        available: false,
        description: 'Afastado por motivos de saúde'
      };
    
    default:
      return {
        label: 'Status Desconhecido',
        color: 'bg-gray-100 border-gray-200',
        textColor: 'text-gray-500',
        available: false,
        description: 'Status não reconhecido'
      };
  }
}

/**
 * Check if a professional is available for appointment scheduling
 * Based on status and optional business rules
 */
export function isProfessionalAvailable(
  status: ProfessionalStatus,
  allowVacationUrgent: boolean = false
): boolean {
  switch (status) {
    case 'ACTIVE':
      return true;
    case 'VACATION':
      return allowVacationUrgent; // Business rule: vacation professionals can handle urgent cases
    case 'INACTIVE':
    case 'SICK_LEAVE':
    default:
      return false;
  }
}

/**
 * Get all available professional status options for forms
 */
export function getProfessionalStatusOptions(): Array<{
  value: ProfessionalStatus;
  label: string;
  description: string;
}> {
  return [
    {
      value: 'ACTIVE',
      label: 'Ativo',
      description: 'Disponível para agendamentos regulares'
    },
    {
      value: 'INACTIVE',
      label: 'Inativo',
      description: 'Temporariamente indisponível'
    },
    {
      value: 'VACATION',
      label: 'Férias',
      description: 'Em período de férias'
    },
    {
      value: 'SICK_LEAVE',
      label: 'Licença Médica',
      description: 'Afastado por motivos de saúde'
    }
  ];
}

/**
 * Filter professionals by availability status
 */
export function filterAvailableProfessionals<T extends { status: ProfessionalStatus }>(
  professionals: T[],
  allowVacationUrgent: boolean = false
): T[] {
  return professionals.filter(professional => 
    isProfessionalAvailable(professional.status, allowVacationUrgent)
  );
}