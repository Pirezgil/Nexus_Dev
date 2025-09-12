import { 
  CustomerInteractionDetails, 
  CreateInteractionData, 
  UpdateInteractionData,
  InteractionFilters,
  PaginatedResponse,
  PaginationQuery,
  NotFoundError,
  ForbiddenError
} from '../types';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';
import { notificationClient } from './notificationClient';

export class InteractionService {
  /**
   * Get paginated interactions for a customer
   */
  async getInteractions(
    customerId: string,
    companyId: string,
    filters: InteractionFilters,
    pagination: PaginationQuery,
    userId: string
  ): Promise<PaginatedResponse<CustomerInteractionDetails>> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Build where clause
      const where: Prisma.CustomerInteractionWhereInput = {
        customerId,
        companyId,
      };

      // Apply filters
      if (filters.type && filters.type.length > 0) {
        where.type = { in: filters.type };
      }

      if (filters.isCompleted !== undefined) {
        where.isCompleted = filters.isCompleted;
      }

      if (filters.scheduledFrom) {
        where.scheduledAt = { ...where.scheduledAt, gte: filters.scheduledFrom };
      }

      if (filters.scheduledTo) {
        where.scheduledAt = { ...where.scheduledAt, lte: filters.scheduledTo };
      }

      if (filters.createdFrom) {
        where.createdAt = { ...where.createdAt, gte: filters.createdFrom };
      }

      if (filters.createdTo) {
        where.createdAt = { ...where.createdAt, lte: filters.createdTo };
      }

      if (filters.createdBy) {
        where.createdBy = filters.createdBy;
      }

      // Execute queries in parallel
      const [interactions, total] = await Promise.all([
        prisma.customerInteraction.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.customerInteraction.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: interactions,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error getting interactions', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Get interaction by ID
   */
  async getInteractionById(interactionId: string, companyId: string): Promise<CustomerInteractionDetails> {
    try {
      const interaction = await prisma.customerInteraction.findFirst({
        where: { id: interactionId, companyId },
      });

      if (!interaction) {
        throw new NotFoundError('Interação não encontrada');
      }

      return interaction;
    } catch (error) {
      logger.error('Error getting interaction by ID', { error, interactionId, companyId });
      throw error;
    }
  }

  /**
   * Create new interaction
   */
  async createInteraction(
    customerId: string,
    data: CreateInteractionData,
    companyId: string,
    createdBy: string
  ): Promise<CustomerInteractionDetails> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Parse dates if they are strings
      const interactionData: any = {
        customerId,
        companyId,
        type: data.type,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
        isCompleted: data.isCompleted ?? true,
        createdBy,
      };

      if (data.scheduledAt) {
        interactionData.scheduledAt = typeof data.scheduledAt === 'string' 
          ? new Date(data.scheduledAt) 
          : data.scheduledAt;
      }

      if (data.completedAt) {
        interactionData.completedAt = typeof data.completedAt === 'string' 
          ? new Date(data.completedAt) 
          : data.completedAt;
      } else if (data.isCompleted) {
        interactionData.completedAt = new Date();
      }

      const interaction = await prisma.customerInteraction.create({
        data: interactionData,
      });

      logger.info('Interaction created', { 
        interactionId: interaction.id, 
        customerId, 
        companyId, 
        createdBy,
        type: data.type 
      });

      // Send notification about new interaction
      try {
        // Get customer name for notification
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { name: true }
        });
        
        if (customer) {
          await notificationClient.notifyInteractionCreated(
            companyId,
            createdBy,
            customer.name,
            customerId,
            data.type,
            data.title
          );
        }
      } catch (notificationError) {
        logger.warn('Failed to send interaction creation notification', {
          interactionId: interaction.id,
          error: notificationError
        });
      }

      // Invalidate customer cache
      await this.invalidateCustomerCaches(customerId, companyId);

      return interaction;
    } catch (error) {
      logger.error('Error creating interaction', { error, customerId, data, companyId });
      throw error;
    }
  }

  /**
   * Update interaction
   */
  async updateInteraction(
    interactionId: string,
    data: UpdateInteractionData,
    companyId: string,
    userId: string
  ): Promise<CustomerInteractionDetails> {
    try {
      // Get existing interaction
      const existingInteraction = await prisma.customerInteraction.findFirst({
        where: { id: interactionId, companyId },
      });

      if (!existingInteraction) {
        throw new NotFoundError('Interação não encontrada');
      }

      // Check if user can edit this interaction (only creator can edit)
      if (existingInteraction.createdBy !== userId) {
        throw new ForbiddenError('Você só pode editar suas próprias interações');
      }

      // Parse dates if they are strings
      const updateData: any = { ...data };
      
      if (data.scheduledAt) {
        updateData.scheduledAt = typeof data.scheduledAt === 'string' 
          ? new Date(data.scheduledAt) 
          : data.scheduledAt;
      }

      if (data.completedAt) {
        updateData.completedAt = typeof data.completedAt === 'string' 
          ? new Date(data.completedAt) 
          : data.completedAt;
      }

      // If marking as completed and no completedAt provided, set it to now
      if (data.isCompleted && !updateData.completedAt && !existingInteraction.completedAt) {
        updateData.completedAt = new Date();
      }

      // If marking as not completed, remove completedAt
      if (data.isCompleted === false) {
        updateData.completedAt = null;
      }

      const interaction = await prisma.customerInteraction.update({
        where: { id: interactionId },
        data: updateData,
      });

      logger.info('Interaction updated', { 
        interactionId, 
        companyId, 
        userId, 
        changes: data 
      });

      // Invalidate customer cache
      await this.invalidateCustomerCaches(existingInteraction.customerId, companyId);

      return interaction;
    } catch (error) {
      logger.error('Error updating interaction', { error, interactionId, data, companyId });
      throw error;
    }
  }

  /**
   * Delete interaction
   */
  async deleteInteraction(interactionId: string, companyId: string, userId: string): Promise<void> {
    try {
      // Get existing interaction
      const existingInteraction = await prisma.customerInteraction.findFirst({
        where: { id: interactionId, companyId },
      });

      if (!existingInteraction) {
        throw new NotFoundError('Interação não encontrada');
      }

      // Check if user can delete this interaction (only creator can delete)
      if (existingInteraction.createdBy !== userId) {
        throw new ForbiddenError('Você só pode deletar suas próprias interações');
      }

      await prisma.customerInteraction.delete({
        where: { id: interactionId },
      });

      logger.info('Interaction deleted', { interactionId, companyId, userId });

      // Invalidate customer cache
      await this.invalidateCustomerCaches(existingInteraction.customerId, companyId);
    } catch (error) {
      logger.error('Error deleting interaction', { error, interactionId, companyId });
      throw error;
    }
  }

  /**
   * Get interactions by type for a customer
   */
  async getInteractionsByType(
    customerId: string,
    type: string,
    companyId: string,
    limit: number = 20
  ): Promise<CustomerInteractionDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const interactions = await prisma.customerInteraction.findMany({
        where: {
          customerId,
          companyId,
          type: type as any,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return interactions;
    } catch (error) {
      logger.error('Error getting interactions by type', { error, customerId, type, companyId });
      throw error;
    }
  }

  /**
   * Get upcoming interactions for a customer
   */
  async getUpcomingInteractions(
    customerId: string,
    companyId: string,
    limit: number = 10
  ): Promise<CustomerInteractionDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const interactions = await prisma.customerInteraction.findMany({
        where: {
          customerId,
          companyId,
          isCompleted: false,
          scheduledAt: {
            gte: new Date(),
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
      });

      return interactions;
    } catch (error) {
      logger.error('Error getting upcoming interactions', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Get overdue interactions for a customer
   */
  async getOverdueInteractions(
    customerId: string,
    companyId: string,
    limit: number = 10
  ): Promise<CustomerInteractionDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const interactions = await prisma.customerInteraction.findMany({
        where: {
          customerId,
          companyId,
          isCompleted: false,
          scheduledAt: {
            lt: new Date(),
          },
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit,
      });

      return interactions;
    } catch (error) {
      logger.error('Error getting overdue interactions', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Mark interaction as completed
   */
  async markAsCompleted(
    interactionId: string,
    companyId: string,
    userId: string,
    completedAt?: Date
  ): Promise<CustomerInteractionDetails> {
    try {
      return await this.updateInteraction(
        interactionId,
        {
          isCompleted: true,
          completedAt: completedAt || new Date(),
        },
        companyId,
        userId
      );
    } catch (error) {
      logger.error('Error marking interaction as completed', { error, interactionId, companyId });
      throw error;
    }
  }

  /**
   * Get interaction statistics for a customer
   */
  async getInteractionStats(customerId: string, companyId: string): Promise<any> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const [byType, byStatus, total, completed, pending, overdue] = await Promise.all([
        prisma.customerInteraction.groupBy({
          by: ['type'],
          where: { customerId, companyId },
          _count: { id: true },
        }),
        prisma.customerInteraction.groupBy({
          by: ['isCompleted'],
          where: { customerId, companyId },
          _count: { id: true },
        }),
        prisma.customerInteraction.count({
          where: { customerId, companyId },
        }),
        prisma.customerInteraction.count({
          where: { customerId, companyId, isCompleted: true },
        }),
        prisma.customerInteraction.count({
          where: { customerId, companyId, isCompleted: false },
        }),
        prisma.customerInteraction.count({
          where: {
            customerId,
            companyId,
            isCompleted: false,
            scheduledAt: { lt: new Date() },
          },
        }),
      ]);

      return {
        total,
        completed,
        pending,
        overdue,
        byType: byType.map(stat => ({
          type: stat.type,
          count: stat._count.id,
        })),
        byStatus: byStatus.map(stat => ({
          status: stat.isCompleted ? 'completed' : 'pending',
          count: stat._count.id,
        })),
      };
    } catch (error) {
      logger.error('Error getting interaction stats', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Search interactions by title or description
   */
  async searchInteractions(
    customerId: string,
    searchTerm: string,
    companyId: string,
    limit: number = 10
  ): Promise<CustomerInteractionDetails[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const interactions = await prisma.customerInteraction.findMany({
        where: {
          customerId,
          companyId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return interactions;
    } catch (error) {
      logger.error('Error searching interactions', { error, customerId, searchTerm, companyId });
      throw error;
    }
  }

  /**
   * Private method to invalidate customer-related caches
   */
  private async invalidateCustomerCaches(customerId: string, companyId: string): Promise<void> {
    try {
      await Promise.all([
        redis.del(`crm:customer:${customerId}`),
        redis.del(`crm:stats:${companyId}`),
      ]);
    } catch (error) {
      logger.warn('Error invalidating customer caches', { error, customerId, companyId });
    }
  }
}