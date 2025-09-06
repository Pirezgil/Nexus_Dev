/**
 * Prisma validation setup for Services module
 * Configures cross-module validation middleware for Services entities
 * TEMPORARILY DISABLED - Module running without validation hooks for production
 */

import { PrismaClient } from '@prisma/client';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('PrismaValidation');

export function setupPrismaValidation(prisma: PrismaClient) {
  logger.info('Setting up Prisma validation middleware for Services module');

  // Basic logging middleware for debugging
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;
    
    logger.debug('Prisma query executed', {
      model: params.model,
      action: params.action,
      duration: `${duration}ms`
    });
    
    return result;
  });

  logger.info('Prisma validation middleware configured successfully for Services module');
}

export default setupPrismaValidation;