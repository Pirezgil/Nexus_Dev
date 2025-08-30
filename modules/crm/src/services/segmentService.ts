import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

/**
 * SegmentService
 * 
 * Gerencia segmentação de clientes conforme especificação
 * docs/02-modules/crm.md (linhas 164-186)
 * 
 * Funcionalidades:
 * - CRUD de segmentos
 * - Segmentos automáticos por critérios
 * - Associação cliente-segmento
 * - Analytics de segmentação
 * - Cache para performance
 */

export interface CreateSegmentData {
  companyId: string;
  name: string;
  description?: string;
  color?: string;
  criteria?: any; // JSON criteria for auto segments
  isAuto: boolean;
}

export interface UpdateSegmentData {
  name?: string;
  description?: string;
  color?: string;
  criteria?: any;
  isAuto?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class SegmentService {

  /**
   * Get all segments for a company
   */
  async getSegments(companyId: string, includeStats: boolean = false): Promise<any[]> {
    try {
      const cacheKey = `crm:segments:${companyId}:${includeStats}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const segments = await prisma.customerSegment.findMany({
        where: { companyId },
        include: {
          _count: includeStats ? {
            select: {
              members: true
            }
          } : false
        },
        orderBy: { createdAt: 'asc' }
      });

      // Transform to API format
      const formattedSegments = segments.map(segment => ({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        color: segment.color,
        criteria: segment.criteria,
        is_auto: segment.isAuto,
        customer_count: includeStats ? segment._count?.members || 0 : undefined,
        created_at: segment.createdAt
      }));

      // Cache for 15 minutes
      await redis.setex(cacheKey, 900, JSON.stringify(formattedSegments));

      return formattedSegments;
    } catch (error) {
      logger.error('Error getting segments', { error, companyId, includeStats });
      throw error;
    }
  }

  /**
   * Get segment by ID with optional customer details
   */
  async getSegmentById(segmentId: string, companyId: string, includeCustomers: boolean = false): Promise<any | null> {
    try {
      const segment = await prisma.customerSegment.findFirst({
        where: {
          id: segmentId,
          companyId
        },
        include: {
          _count: {
            select: {
              members: true
            }
          },
          members: includeCustomers ? {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  status: true,
                  totalSpent: true,
                  totalVisits: true
                }
              }
            },
            orderBy: {
              addedAt: 'desc'
            },
            take: 100 // Limit for performance
          } : false
        }
      });

      if (!segment) {
        return null;
      }

      const result: any = {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        color: segment.color,
        criteria: segment.criteria,
        is_auto: segment.isAuto,
        customer_count: segment._count.members,
        created_at: segment.createdAt
      };

      if (includeCustomers && segment.members) {
        result.customers = segment.members.map(member => ({
          ...member.customer,
          added_at: member.addedAt,
          added_by: member.addedBy
        }));
      }

      return result;
    } catch (error) {
      logger.error('Error getting segment by ID', { error, segmentId, companyId });
      throw error;
    }
  }

  /**
   * Create new segment
   */
  async createSegment(data: CreateSegmentData): Promise<any> {
    try {
      // Check if segment name already exists for this company
      const existing = await prisma.customerSegment.findFirst({
        where: {
          companyId: data.companyId,
          name: data.name
        }
      });

      if (existing) {
        throw new Error(`Segmento com nome '${data.name}' já existe`);
      }

      const segment = await prisma.customerSegment.create({
        data: {
          companyId: data.companyId,
          name: data.name,
          description: data.description,
          color: data.color,
          criteria: data.criteria,
          isAuto: data.isAuto
        }
      });

      // If it's an auto segment, apply criteria immediately
      if (data.isAuto && data.criteria) {
        await this.applyAutoCriteria(segment.id, data.companyId, data.criteria);
      }

      logger.info('Segment created', { 
        segmentId: segment.id, 
        companyId: data.companyId, 
        name: data.name,
        isAuto: data.isAuto 
      });

      // Invalidate cache
      await this.invalidateSegmentsCache(data.companyId);

      return {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        color: segment.color,
        criteria: segment.criteria,
        is_auto: segment.isAuto,
        customer_count: 0,
        created_at: segment.createdAt
      };
    } catch (error) {
      logger.error('Error creating segment', { error, data });
      throw error;
    }
  }

  /**
   * Update segment
   */
  async updateSegment(
    segmentId: string, 
    companyId: string, 
    data: UpdateSegmentData
  ): Promise<any | null> {
    try {
      // Check if segment exists and belongs to company
      const existingSegment = await prisma.customerSegment.findFirst({
        where: {
          id: segmentId,
          companyId
        }
      });

      if (!existingSegment) {
        return null;
      }

      // Check for name conflicts if name is being updated
      if (data.name && data.name !== existingSegment.name) {
        const nameConflict = await prisma.customerSegment.findFirst({
          where: {
            companyId,
            name: data.name,
            id: { not: segmentId }
          }
        });

        if (nameConflict) {
          throw new Error(`Segmento com nome '${data.name}' já existe`);
        }
      }

      // Build update data
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.criteria !== undefined) updateData.criteria = data.criteria;
      if (data.isAuto !== undefined) updateData.isAuto = data.isAuto;

      const segment = await prisma.customerSegment.update({
        where: { id: segmentId },
        data: updateData,
        include: {
          _count: {
            select: {
              members: true
            }
          }
        }
      });

      // If criteria changed and it's an auto segment, reapply criteria
      if (data.criteria !== undefined && segment.isAuto) {
        await this.applyAutoCriteria(segmentId, companyId, data.criteria);
      }

      logger.info('Segment updated', { 
        segmentId, 
        companyId, 
        changes: updateData 
      });

      // Invalidate cache
      await this.invalidateSegmentsCache(companyId);

      return {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        color: segment.color,
        criteria: segment.criteria,
        is_auto: segment.isAuto,
        customer_count: segment._count.members,
        created_at: segment.createdAt
      };
    } catch (error) {
      logger.error('Error updating segment', { error, segmentId, companyId, data });
      throw error;
    }
  }

  /**
   * Delete segment and all its memberships
   */
  async deleteSegment(segmentId: string, companyId: string): Promise<boolean> {
    try {
      const result = await prisma.customerSegment.deleteMany({
        where: {
          id: segmentId,
          companyId
        }
      });

      if (result.count === 0) {
        return false;
      }

      logger.info('Segment deleted', { segmentId, companyId });

      // Invalidate cache
      await this.invalidateSegmentsCache(companyId);

      return true;
    } catch (error) {
      logger.error('Error deleting segment', { error, segmentId, companyId });
      throw error;
    }
  }

  /**
   * Get customers in a specific segment with pagination
   */
  async getSegmentCustomers(
    segmentId: string,
    companyId: string,
    options: PaginationOptions
  ): Promise<any | null> {
    try {
      // Verify segment exists
      const segment = await prisma.customerSegment.findFirst({
        where: {
          id: segmentId,
          companyId
        }
      });

      if (!segment) {
        return null;
      }

      const skip = (options.page - 1) * options.limit;

      const [members, total] = await Promise.all([
        prisma.customerSegmentMember.findMany({
          where: {
            segmentId,
            customer: {
              companyId
            }
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                totalSpent: true,
                totalVisits: true,
                lastVisit: true,
                tags: true
              }
            }
          },
          orderBy: {
            addedAt: 'desc'
          },
          skip,
          take: options.limit
        }),
        prisma.customerSegmentMember.count({
          where: {
            segmentId,
            customer: {
              companyId
            }
          }
        })
      ]);

      const customers = members.map(member => ({
        ...member.customer,
        segment_added_at: member.addedAt,
        segment_added_by: member.addedBy
      }));

      const totalPages = Math.ceil(total / options.limit);

      return {
        segment: {
          id: segment.id,
          name: segment.name,
          color: segment.color
        },
        customers,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting segment customers', { error, segmentId, companyId, options });
      throw error;
    }
  }

  /**
   * Update customer segments (replace all segments for a customer)
   */
  async updateCustomerSegments(
    customerId: string,
    segmentIds: string[],
    companyId: string,
    userId: string
  ): Promise<any | null> {
    try {
      // Verify customer exists
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          companyId
        }
      });

      if (!customer) {
        return null;
      }

      // Verify all segments exist and belong to company
      if (segmentIds.length > 0) {
        const segments = await prisma.customerSegment.findMany({
          where: {
            id: { in: segmentIds },
            companyId
          }
        });

        if (segments.length !== segmentIds.length) {
          throw new Error('Um ou mais segmentos não foram encontrados');
        }
      }

      // Remove existing memberships and add new ones in a transaction
      await prisma.$transaction(async (tx) => {
        // Remove existing memberships
        await tx.customerSegmentMember.deleteMany({
          where: {
            customerId,
            segment: {
              companyId
            }
          }
        });

        // Add new memberships
        if (segmentIds.length > 0) {
          await tx.customerSegmentMember.createMany({
            data: segmentIds.map(segmentId => ({
              customerId,
              segmentId,
              addedBy: userId
            }))
          });
        }
      });

      // Get updated segments
      const segments = await prisma.customerSegmentMember.findMany({
        where: {
          customerId,
          segment: {
            companyId
          }
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        }
      });

      logger.info('Customer segments updated', { 
        customerId, 
        companyId, 
        segmentCount: segments.length,
        userId 
      });

      // Invalidate cache
      await this.invalidateSegmentsCache(companyId);

      return {
        customer_id: customerId,
        segments: segments.map(member => member.segment)
      };
    } catch (error) {
      logger.error('Error updating customer segments', { error, customerId, segmentIds, companyId });
      throw error;
    }
  }

  /**
   * Refresh auto segment (reapply criteria)
   */
  async refreshAutoSegment(segmentId: string, companyId: string): Promise<any | null> {
    try {
      const segment = await prisma.customerSegment.findFirst({
        where: {
          id: segmentId,
          companyId,
          isAuto: true
        }
      });

      if (!segment || !segment.criteria) {
        return null;
      }

      const beforeCount = await prisma.customerSegmentMember.count({
        where: { segmentId }
      });

      const result = await this.applyAutoCriteria(segmentId, companyId, segment.criteria);

      const afterCount = await prisma.customerSegmentMember.count({
        where: { segmentId }
      });

      logger.info('Auto segment refreshed', { 
        segmentId, 
        companyId,
        beforeCount,
        afterCount,
        customersChanged: result.customersAdded + result.customersRemoved
      });

      return {
        customersAdded: result.customersAdded,
        customersRemoved: result.customersRemoved,
        totalCustomers: afterCount
      };
    } catch (error) {
      logger.error('Error refreshing auto segment', { error, segmentId, companyId });
      throw error;
    }
  }

  /**
   * Get segment analytics for company
   */
  async getSegmentAnalytics(companyId: string): Promise<any> {
    try {
      const cacheKey = `crm:segment_analytics:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const [
        totalSegments,
        autoSegments,
        totalCustomers,
        segmentedCustomers,
        segmentStats
      ] = await Promise.all([
        prisma.customerSegment.count({ where: { companyId } }),
        prisma.customerSegment.count({ where: { companyId, isAuto: true } }),
        prisma.customer.count({ where: { companyId } }),
        prisma.customerSegmentMember.groupBy({
          by: ['customerId'],
          where: {
            segment: { companyId }
          }
        }).then(result => result.length),
        prisma.customerSegment.findMany({
          where: { companyId },
          include: {
            _count: {
              select: { members: true }
            }
          }
        })
      ]);

      const segmentDistribution = segmentStats.map(segment => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        customer_count: segment._count.members,
        percentage: totalCustomers > 0 ? (segment._count.members / totalCustomers * 100).toFixed(1) : '0'
      }));

      const analytics = {
        total_segments: totalSegments,
        auto_segments: autoSegments,
        manual_segments: totalSegments - autoSegments,
        total_customers: totalCustomers,
        segmented_customers: segmentedCustomers,
        unsegmented_customers: totalCustomers - segmentedCustomers,
        segmentation_rate: totalCustomers > 0 ? (segmentedCustomers / totalCustomers * 100).toFixed(1) : '0',
        segment_distribution: segmentDistribution,
        top_segments: segmentDistribution
          .sort((a, b) => b.customer_count - a.customer_count)
          .slice(0, 5)
      };

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      logger.error('Error getting segment analytics', { error, companyId });
      throw error;
    }
  }

  /**
   * Apply auto criteria to segment (internal method)
   */
  private async applyAutoCriteria(
    segmentId: string, 
    companyId: string, 
    criteria: any
  ): Promise<{ customersAdded: number; customersRemoved: number }> {
    try {
      // Build where clause from criteria
      const where = this.buildCriteriaWhere(criteria, companyId);

      // Get customers that match criteria
      const matchingCustomers = await prisma.customer.findMany({
        where,
        select: { id: true }
      });

      const matchingCustomerIds = matchingCustomers.map(c => c.id);

      // Get current segment members
      const currentMembers = await prisma.customerSegmentMember.findMany({
        where: { segmentId },
        select: { customerId: true }
      });

      const currentMemberIds = currentMembers.map(m => m.customerId);

      // Determine changes
      const toAdd = matchingCustomerIds.filter(id => !currentMemberIds.includes(id));
      const toRemove = currentMemberIds.filter(id => !matchingCustomerIds.includes(id));

      // Apply changes in transaction
      await prisma.$transaction(async (tx) => {
        // Remove customers that no longer match
        if (toRemove.length > 0) {
          await tx.customerSegmentMember.deleteMany({
            where: {
              segmentId,
              customerId: { in: toRemove }
            }
          });
        }

        // Add customers that now match
        if (toAdd.length > 0) {
          await tx.customerSegmentMember.createMany({
            data: toAdd.map(customerId => ({
              segmentId,
              customerId,
              addedBy: 'auto-criteria'
            }))
          });
        }
      });

      return {
        customersAdded: toAdd.length,
        customersRemoved: toRemove.length
      };
    } catch (error) {
      logger.error('Error applying auto criteria', { error, segmentId, companyId, criteria });
      throw error;
    }
  }

  /**
   * Build Prisma where clause from criteria object
   */
  private buildCriteriaWhere(criteria: any, companyId: string): any {
    const where: any = { companyId };

    // Example criteria formats:
    // { "total_spent": { "gte": 1000 } }
    // { "total_visits": { "gte": 5 } }
    // { "last_visit": { "gte": "2024-01-01" } }
    // { "status": { "in": ["ACTIVE"] } }
    // { "tags": { "hasSome": ["VIP"] } }

    for (const [field, condition] of Object.entries(criteria)) {
      if (typeof condition === 'object' && condition !== null) {
        // Map API field names to Prisma field names
        const prismaField = this.mapFieldName(field);
        where[prismaField] = condition;
      }
    }

    return where;
  }

  /**
   * Map API field names to Prisma model field names
   */
  private mapFieldName(apiField: string): string {
    const fieldMap: { [key: string]: string } = {
      'total_spent': 'totalSpent',
      'total_visits': 'totalVisits',
      'average_ticket': 'averageTicket',
      'first_visit': 'firstVisit',
      'last_visit': 'lastVisit',
      'birth_date': 'birthDate',
      'marital_status': 'maritalStatus',
      'preferred_contact': 'preferredContact',
      'marketing_consent': 'marketingConsent',
      'created_at': 'createdAt'
    };

    return fieldMap[apiField] || apiField;
  }

  /**
   * Private method to invalidate segments cache
   */
  private async invalidateSegmentsCache(companyId: string): Promise<void> {
    try {
      await Promise.all([
        redis.del(`crm:segments:${companyId}:true`),
        redis.del(`crm:segments:${companyId}:false`),
        redis.del(`crm:segment_analytics:${companyId}`)
      ]);
    } catch (error) {
      logger.warn('Error invalidating segments cache', { error, companyId });
    }
  }
}