import { CustomerStatistics } from '../types';
import { Prisma, CustomerStatus, InteractionType } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

export class StatsService {
  /**
   * Get comprehensive customer statistics for a company
   */
  async getCustomerStatistics(companyId: string): Promise<CustomerStatistics> {
    try {
      // Try to get from cache first
      const cacheKey = `crm:stats:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        logger.debug('Statistics retrieved from cache', { companyId });
        return JSON.parse(cached);
      }

      // Execute all queries in parallel for better performance
      const [
        totalCustomers,
        customersByStatus,
        totalInteractions,
        totalNotes,
        interactionsByType,
        topTags,
        customersGrowth
      ] = await Promise.all([
        this.getTotalCustomers(companyId),
        this.getCustomersByStatus(companyId),
        this.getTotalInteractions(companyId),
        this.getTotalNotes(companyId),
        this.getInteractionsByType(companyId),
        this.getTopTags(companyId),
        this.getCustomersGrowth(companyId),
      ]);

      // Calculate derived statistics
      const activeCustomers = customersByStatus.find(s => s.status === 'ACTIVE')?.count || 0;
      const prospectCustomers = customersByStatus.find(s => s.status === 'PROSPECT')?.count || 0;
      const inactiveCustomers = customersByStatus.find(s => s.status === 'INACTIVE')?.count || 0;
      const blockedCustomers = customersByStatus.find(s => s.status === 'BLOCKED')?.count || 0;
      
      const averageInteractionsPerCustomer = totalCustomers > 0 
        ? Math.round((totalInteractions / totalCustomers) * 100) / 100
        : 0;

      const statistics: CustomerStatistics = {
        totalCustomers,
        activeCustomers,
        prospectCustomers,
        inactiveCustomers,
        blockedCustomers,
        totalInteractions,
        totalNotes,
        averageInteractionsPerCustomer,
        topTags,
        customersByStatus,
        interactionsByType,
        customersGrowth,
      };

      // Cache for 15 minutes
      await redis.setex(cacheKey, 900, JSON.stringify(statistics));

      logger.info('Statistics calculated and cached', { companyId });

      return statistics;
    } catch (error) {
      logger.error('Error getting customer statistics', { error, companyId });
      throw error;
    }
  }

  /**
   * Get total customers count
   */
  private async getTotalCustomers(companyId: string): Promise<number> {
    return await prisma.customer.count({
      where: { companyId },
    });
  }

  /**
   * Get customers grouped by status
   */
  private async getCustomersByStatus(companyId: string): Promise<Array<{ status: CustomerStatus; count: number }>> {
    const result = await prisma.customer.groupBy({
      by: ['status'],
      where: { companyId },
      _count: {
        id: true,
      },
    });

    return result.map(item => ({
      status: item.status,
      count: item._count.id,
    }));
  }

  /**
   * Get total interactions count
   */
  private async getTotalInteractions(companyId: string): Promise<number> {
    return await prisma.customerInteraction.count({
      where: { companyId },
    });
  }

  /**
   * Get total notes count
   */
  private async getTotalNotes(companyId: string): Promise<number> {
    return await prisma.customerNote.count({
      where: { companyId },
    });
  }

  /**
   * Get interactions grouped by type
   */
  private async getInteractionsByType(companyId: string): Promise<Array<{ type: InteractionType; count: number }>> {
    const result = await prisma.customerInteraction.groupBy({
      by: ['type'],
      where: { companyId },
      _count: {
        id: true,
      },
    });

    return result.map(item => ({
      type: item.type,
      count: item._count.id,
    }));
  }

  /**
   * Get top customer tags
   */
  private async getTopTags(companyId: string, limit: number = 10): Promise<Array<{ tag: string; count: number }>> {
    try {
      // Get all customers with their tags
      const customers = await prisma.customer.findMany({
        where: { companyId },
        select: { tags: true },
      });

      // Count tag occurrences
      const tagCounts = new Map<string, number>();
      
      customers.forEach(customer => {
        customer.tags.forEach(tag => {
          const normalizedTag = tag.toLowerCase().trim();
          tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
        });
      });

      // Convert to array, sort by count, and return top N
      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting top tags', { error, companyId });
      return [];
    }
  }

  /**
   * Get customers growth over time (last 12 months)
   */
  private async getCustomersGrowth(companyId: string): Promise<Array<{ date: string; count: number }>> {
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Get monthly customer creation counts
      const result = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::bigint as count
        FROM nexus_crm.customers 
        WHERE company_id = ${companyId} 
          AND created_at >= ${twelveMonthsAgo}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month ASC
      `;

      return result.map(item => ({
        date: item.month,
        count: Number(item.count),
      }));
    } catch (error) {
      logger.error('Error getting customers growth', { error, companyId });
      return [];
    }
  }

  /**
   * Get performance metrics for a specific time period
   */
  async getPerformanceMetrics(
    companyId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<any> {
    try {
      const [
        newCustomers,
        completedInteractions,
        pendingInteractions,
        notesCreated,
        customerStatusChanges
      ] = await Promise.all([
        // New customers in period
        prisma.customer.count({
          where: {
            companyId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        
        // Completed interactions in period
        prisma.customerInteraction.count({
          where: {
            companyId,
            isCompleted: true,
            completedAt: { gte: startDate, lte: endDate },
          },
        }),
        
        // Pending interactions
        prisma.customerInteraction.count({
          where: {
            companyId,
            isCompleted: false,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        
        // Notes created in period
        prisma.customerNote.count({
          where: {
            companyId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),

        // Customer status changes (approximated by updates in period)
        prisma.customer.count({
          where: {
            companyId,
            updatedAt: { gte: startDate, lte: endDate },
            createdAt: { lt: startDate }, // Exclude new customers
          },
        }),
      ]);

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        metrics: {
          newCustomers,
          completedInteractions,
          pendingInteractions,
          notesCreated,
          customerStatusChanges,
          interactionCompletionRate: pendingInteractions + completedInteractions > 0
            ? Math.round((completedInteractions / (pendingInteractions + completedInteractions)) * 100)
            : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting performance metrics', { error, companyId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Get customer activity summary
   */
  async getCustomerActivitySummary(customerId: string, companyId: string): Promise<any> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true, createdAt: true, updatedAt: true, status: true },
      });

      if (!customer) {
        return null;
      }

      const [
        totalInteractions,
        completedInteractions,
        pendingInteractions,
        totalNotes,
        recentActivity,
        interactionsByType
      ] = await Promise.all([
        // Total interactions
        prisma.customerInteraction.count({
          where: { customerId, companyId },
        }),
        
        // Completed interactions
        prisma.customerInteraction.count({
          where: { customerId, companyId, isCompleted: true },
        }),
        
        // Pending interactions
        prisma.customerInteraction.count({
          where: { customerId, companyId, isCompleted: false },
        }),
        
        // Total notes
        prisma.customerNote.count({
          where: { customerId, companyId },
        }),

        // Recent activity (last 30 days)
        prisma.customerInteraction.count({
          where: {
            customerId,
            companyId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),

        // Interactions by type
        prisma.customerInteraction.groupBy({
          by: ['type'],
          where: { customerId, companyId },
          _count: { id: true },
        }),
      ]);

      return {
        customer: {
          id: customerId,
          status: customer.status,
          customerSince: customer.createdAt,
          lastUpdated: customer.updatedAt,
        },
        interactions: {
          total: totalInteractions,
          completed: completedInteractions,
          pending: pendingInteractions,
          recentActivity, // Last 30 days
          byType: interactionsByType.map(item => ({
            type: item.type,
            count: item._count.id,
          })),
        },
        notes: {
          total: totalNotes,
        },
      };
    } catch (error) {
      logger.error('Error getting customer activity summary', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Invalidate statistics cache
   */
  async invalidateStatsCache(companyId: string): Promise<void> {
    try {
      await redis.del(`crm:stats:${companyId}`);
      logger.debug('Statistics cache invalidated', { companyId });
    } catch (error) {
      logger.warn('Error invalidating statistics cache', { error, companyId });
    }
  }

  /**
   * Get daily activity metrics for dashboard
   */
  async getDailyActivityMetrics(companyId: string, days: number = 7): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyMetrics = await prisma.$queryRaw<Array<{
        date: string;
        new_customers: bigint;
        new_interactions: bigint;
        new_notes: bigint;
      }>>`
        SELECT 
          DATE(created_at) as date,
          0::bigint as new_customers,
          0::bigint as new_interactions,
          0::bigint as new_notes
        FROM generate_series(${startDate}::date, CURRENT_DATE, '1 day'::interval) as created_at
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::bigint as new_customers,
          0::bigint as new_interactions,
          0::bigint as new_notes
        FROM nexus_crm.customers 
        WHERE company_id = ${companyId} 
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          0::bigint as new_customers,
          COUNT(*)::bigint as new_interactions,
          0::bigint as new_notes
        FROM customer_interactions 
        WHERE company_id = ${companyId} 
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          0::bigint as new_customers,
          0::bigint as new_interactions,
          COUNT(*)::bigint as new_notes
        FROM customer_notes 
        WHERE company_id = ${companyId} 
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        
        ORDER BY date ASC
      `;

      // Aggregate results by date
      const aggregated = new Map<string, { date: string; newCustomers: number; newInteractions: number; newNotes: number }>();
      
      dailyMetrics.forEach(metric => {
        const existing = aggregated.get(metric.date) || {
          date: metric.date,
          newCustomers: 0,
          newInteractions: 0,
          newNotes: 0,
        };
        
        existing.newCustomers += Number(metric.new_customers);
        existing.newInteractions += Number(metric.new_interactions);
        existing.newNotes += Number(metric.new_notes);
        
        aggregated.set(metric.date, existing);
      });

      return Array.from(aggregated.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error('Error getting daily activity metrics', { error, companyId });
      return [];
    }
  }
}