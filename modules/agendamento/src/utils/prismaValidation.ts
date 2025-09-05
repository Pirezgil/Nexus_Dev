/**
 * Prisma validation setup for Agendamento module
 * Configures cross-module validation middleware for Agendamento entities
 */

import { PrismaClient } from '@prisma/client';
// import { PrismaValidationHooks } from '../../shared/middleware/prismaValidationHooks'; // TEMPORARIAMENTE DESABILITADO

// Logger mock temporário
const moduleLogger = {
  info: (msg: string) => console.log(`[PrismaValidation] ${msg}`)
};

export function setupPrismaValidation(prisma: PrismaClient) {
  moduleLogger.info('Setting up Prisma validation middleware for Agendamento module');

  // Add logging middleware for debugging
  // prisma.$use(PrismaValidationHooks.loggingMiddleware());

  // Add audit middleware
  // prisma.$use(PrismaValidationHooks.auditMiddleware('agendamento'));

  // Configure validation for each model that has cross-module references
  /* TEMPORARIAMENTE DESABILITADO
  const modelConfigs = {
    // Appointment has references to CRM customers, Services professionals and services, Auth users
    Appointment: {
      customerIdField: 'customer_id',
      professionalIdField: 'professional_id',
      serviceIdField: 'service_id',
      userIdField: 'created_by',
      companyIdField: 'company_id'
    },

    // WaitingList has references to CRM customers, Services professionals and services, Auth users
    WaitingList: {
      customerIdField: 'customer_id',
      professionalIdField: 'professional_id',
      serviceIdField: 'service_id',
      userIdField: 'created_by',
      companyIdField: 'company_id'
    },

    // ScheduleBlock may have professional reference and user reference
    ScheduleBlock: {
      professionalIdField: 'professional_id',
      userIdField: 'created_by',
      companyIdField: 'company_id'
    },

    // MessageTemplate has company and user references
    MessageTemplate: {
      userIdField: 'created_by',
      companyIdField: 'company_id'
    },

    // BusinessHour has company reference
    BusinessHour: {
      companyIdField: 'company_id'
    },

    // AgendamentoConfig has company reference
    AgendamentoConfig: {
      companyIdField: 'company_id'
    }
  };
  */

  // Add the validation middleware
  // prisma.$use(PrismaValidationHooks.createModuleValidationMiddleware(modelConfigs));

  moduleLogger.info('Prisma validation middleware configured successfully for Agendamento module');
}

export default setupPrismaValidation;