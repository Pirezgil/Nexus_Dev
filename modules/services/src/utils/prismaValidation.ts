/**
 * Prisma validation setup for Services module
 * Configures cross-module validation middleware for Services entities
 */

import { PrismaClient } from '@prisma/client';
// import { PrismaValidationHooks } from '../../shared/middleware/prismaValidationHooks'; // TEMPORARIAMENTE DESABILITADO
import { createServiceLogger } from './logger';

const logger = createServiceLogger('PrismaValidation');

export function setupPrismaValidation(prisma: PrismaClient) {
  logger.info('Setting up Prisma validation middleware for Services module');

  // Add logging middleware for debugging
  prisma.$use(PrismaValidationHooks.loggingMiddleware());

  // Add audit middleware
  prisma.$use(PrismaValidationHooks.auditMiddleware('services'));

  // Configure validation for each model that has cross-module references
  const modelConfigs = {
    // AppointmentCompleted has references to CRM customers
    AppointmentCompleted: {
      customerIdField: 'customerId',
      professionalIdField: 'professionalId',
      serviceIdField: 'serviceId',
      companyIdField: 'companyId'
    },

    // Professional has references to Auth users
    Professional: {
      userIdField: 'userId',
      companyIdField: 'companyId'
    },

    // Service references company
    Service: {
      companyIdField: 'companyId'
    }
  };

  // Add the validation middleware
  prisma.$use(PrismaValidationHooks.createModuleValidationMiddleware(modelConfigs));

  logger.info('Prisma validation middleware configured successfully for Services module');
}

export default setupPrismaValidation;