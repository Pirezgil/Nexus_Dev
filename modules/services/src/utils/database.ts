import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { config } from './config';
import { setupPrismaValidation } from './prismaValidation';

// Create a global variable to store the Prisma instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Initialize Prisma Client with connection pooling and logging configuration
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: config.nodeEnv === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
    errorFormat: 'pretty',
  });
};

// Use singleton pattern to avoid multiple connections in development
export const prisma = globalThis.__prisma || createPrismaClient();

if (config.nodeEnv === 'development') {
  globalThis.__prisma = prisma;
}

// Setup cross-module validation middleware
setupPrismaValidation(prisma);

// Connection event handlers
prisma.$on('error', (e: any) => {
  logger.error('Prisma error event', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp,
  });
});

if (config.nodeEnv === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug('Prisma query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      target: e.target,
    });
  });

  prisma.$on('warn', (e: any) => {
    logger.warn('Prisma warning', {
      message: e.message,
      target: e.target,
    });
  });
}

// Database connection test function
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
};

// Database health check function
export const getDatabaseHealth = async () => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    // Get basic statistics
    const stats = await Promise.all([
      prisma.service.count(),
      prisma.professional.count(),
      prisma.appointmentCompleted.count(),
      prisma.servicePhoto.count(),
    ]);

    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      statistics: {
        services: stats[0],
        professionals: stats[1],
        appointmentsCompleted: stats[2],
        servicePhotos: stats[3],
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Graceful disconnection function
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
    throw error;
  }
};

// Transaction helper function
export const withTransaction = async <T>(
  operation: (tx: any) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(async (tx) => {
    try {
      const result = await operation(tx);
      logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      logger.error('Transaction failed, rolling back', { error });
      throw error;
    }
  });
};

// Bulk operations helper
export const bulkCreate = async <T extends Record<string, any>>(
  model: keyof PrismaClient,
  data: T[]
): Promise<any> => {
  try {
    const result = await (prisma[model] as any).createMany({
      data,
      skipDuplicates: true,
    });

    logger.info(`Bulk create operation completed for ${String(model)}`, {
      model: String(model),
      recordsCreated: result.count,
      totalRecords: data.length,
    });

    return result;
  } catch (error) {
    logger.error(`Bulk create operation failed for ${String(model)}`, {
      model: String(model),
      error,
    });
    throw error;
  }
};

// Soft delete helper (if using soft deletes)
export const softDelete = async (
  model: keyof PrismaClient,
  id: string,
  userInfo: { userId: string; companyId: string }
): Promise<any> => {
  try {
    const result = await (prisma[model] as any).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userInfo.userId,
        updatedAt: new Date(),
      },
    });

    logger.info(`Soft delete completed for ${String(model)}`, {
      model: String(model),
      id,
      deletedBy: userInfo.userId,
    });

    return result;
  } catch (error) {
    logger.error(`Soft delete failed for ${String(model)}`, {
      model: String(model),
      id,
      error,
    });
    throw error;
  }
};

// Database statistics helper
export const getDatabaseStatistics = async (companyId?: string) => {
  try {
    const whereClause = companyId ? { companyId } : {};

    const [
      servicesCount,
      professionalsCount,
      appointmentsCount,
      photosCount,
      recentAppointments,
      topServices,
      professionalStats,
    ] = await Promise.all([
      // Basic counts
      prisma.service.count({ where: whereClause }),
      prisma.professional.count({ where: whereClause }),
      prisma.appointmentCompleted.count({ where: whereClause }),
      prisma.servicePhoto.count({ where: whereClause }),

      // Recent appointments (last 30 days)
      prisma.appointmentCompleted.count({
        where: {
          ...whereClause,
          completedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Top services by usage
      prisma.appointmentCompleted.groupBy({
        by: ['serviceId'],
        where: whereClause,
        _count: {
          serviceId: true,
        },
        orderBy: {
          _count: {
            serviceId: 'desc',
          },
        },
        take: 10,
      }),

      // Professional performance
      prisma.appointmentCompleted.groupBy({
        by: ['professionalId'],
        where: whereClause,
        _count: {
          professionalId: true,
        },
        _sum: {
          totalAmount: true,
        },
        orderBy: {
          _count: {
            professionalId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      overview: {
        services: servicesCount,
        professionals: professionalsCount,
        totalAppointments: appointmentsCount,
        totalPhotos: photosCount,
        recentAppointments,
      },
      topServices,
      professionalStats,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to get database statistics', { error, companyId });
    throw error;
  }
};

export default prisma;