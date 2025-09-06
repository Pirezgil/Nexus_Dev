import { Prisma } from '@prisma/client';
import { 
  CustomerSummary, 
  CustomerDetails, 
  CreateCustomerData, 
  UpdateCustomerData,
  CustomerSearchFilters,
  PaginatedResponse,
  PaginationQuery,
  NotFoundError,
  ConflictError
} from '../types';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

export class CustomerService {
  /**
   * Get paginated list of customers with filters
   */
  async getCustomers(
    companyId: string,
    filters: CustomerSearchFilters,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<CustomerSummary>> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.CustomerWhereInput = {
        companyId,
      };

      // Apply filters
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
          { document: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.city) {
        where.city = { contains: filters.city, mode: 'insensitive' };
      }

      if (filters.state) {
        where.state = { contains: filters.state, mode: 'insensitive' };
      }

      if (filters.hasEmail !== undefined) {
        where.email = filters.hasEmail ? { not: null } : null;
      }

      if (filters.hasPhone !== undefined) {
        where.phone = filters.hasPhone ? { not: null } : null;
      }

      if (filters.createdFrom) {
        where.createdAt = { ...where.createdAt, gte: filters.createdFrom };
      }

      if (filters.createdTo) {
        where.createdAt = { ...where.createdAt, lte: filters.createdTo };
      }

      // Execute queries in parallel
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            _count: {
              select: {
                customerNotes: true,
                interactions: true,
              },
            },
            interactions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.customer.count({ where }),
      ]);

      // Transform to CustomerSummary
      const data: CustomerSummary[] = customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        tags: customer.tags,
        interactionsCount: customer._count.interactions,
        notesCount: customer._count.customerNotes,
        lastInteractionAt: customer.interactions[0]?.createdAt,
        createdAt: customer.createdAt,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        data,
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
      logger.error('Error getting customers', { error, companyId, filters });
      throw error;
    }
  }

  /**
   * Get customer by ID with full details
   */
  async getCustomerById(customerId: string, companyId: string): Promise<CustomerDetails> {
    try {
      // Try to get from cache first
      const cacheKey = `crm:customer:${customerId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const customerData = JSON.parse(cached);
        if (customerData.companyId === companyId) {
          logger.debug('Customer retrieved from cache', { customerId });
          return customerData;
        }
      }

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        include: {
          customerNotes: {
            orderBy: { createdAt: 'desc' },
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const customerDetails: CustomerDetails = {
        id: customer.id,
        companyId: customer.companyId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        status: customer.status,
        tags: customer.tags,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        notes: customer.customerNotes,
        interactions: customer.interactions,
      };

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(customerDetails));

      return customerDetails;
    } catch (error) {
      logger.error('Error getting customer by ID', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Create new customer
   */
  async createCustomer(data: CreateCustomerData, companyId: string, createdBy: string): Promise<CustomerDetails> {
    try {
      // Check for duplicates
      if (data.email) {
        const existingByEmail = await prisma.customer.findFirst({
          where: { email: data.email, companyId },
        });
        if (existingByEmail) {
          throw new ConflictError('Cliente com este email já existe');
        }
      }

      if (data.document) {
        const existingByDocument = await prisma.customer.findFirst({
          where: { cpfCnpj: data.document, companyId },
        });
        if (existingByDocument) {
          throw new ConflictError('Cliente com este documento já existe');
        }
      }

      // Map API fields to Prisma schema fields
      const prismaData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.document, // API 'document' -> Prisma 'cpfCnpj'
        addressStreet: data.address, // API 'address' -> Prisma 'addressStreet'
        addressCity: data.city,
        addressState: data.state,
        addressZipcode: data.zipCode, // API 'zipCode' -> Prisma 'addressZipcode'
        status: data.status || 'ACTIVE',
        tags: data.tags || [],
        companyId,
        createdBy,
      };

      // Create customer with proper field mapping
      const customer = await prisma.customer.create({
        data: prismaData,
      });

      // Temporarily disabled for timeout diagnosis - potential deadlock
      // await prisma.customerInteraction.create({
      //   data: {
      //     customerId: customer.id,
      //     companyId,
      //     type: 'NOTE',
      //     title: 'Cliente cadastrado',
      //     description: 'Cliente cadastrado no sistema',
      //     createdBy,
      //   },
      // });

      logger.info('Customer created', { customerId: customer.id, companyId, createdBy });

      // Invalidate related caches
      await this.invalidateCustomerCaches(customer.id, companyId);

      // Return mapped object from Prisma schema to API interface
      return {
        id: customer.id,
        companyId: customer.companyId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.cpfCnpj, // Prisma 'cpfCnpj' -> API 'document'
        address: customer.addressStreet, // Prisma 'addressStreet' -> API 'address'
        city: customer.addressCity,
        state: customer.addressState,
        zipCode: customer.addressZipcode, // Prisma 'addressZipcode' -> API 'zipCode'
        country: null, // Not available in current schema
        status: customer.status,
        tags: customer.tags,
        metadata: null, // Not available in current schema
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        notes: [], // Empty array since include was removed
        interactions: [], // Empty array since include was removed
      };
    } catch (error) {
      logger.error('Error creating customer', { error, data, companyId });
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string, 
    data: UpdateCustomerData, 
    companyId: string, 
    updatedBy: string
  ): Promise<CustomerDetails> {
    try {
      // Check if customer exists and belongs to company
      const existingCustomer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
      });

      if (!existingCustomer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Check for duplicates on unique fields
      if (data.email && data.email !== existingCustomer.email) {
        const existingByEmail = await prisma.customer.findFirst({
          where: { email: data.email, companyId, id: { not: customerId } },
        });
        if (existingByEmail) {
          throw new ConflictError('Cliente com este email já existe');
        }
      }

      if (data.document && data.document !== existingCustomer.document) {
        const existingByDocument = await prisma.customer.findFirst({
          where: { document: data.document, companyId, id: { not: customerId } },
        });
        if (existingByDocument) {
          throw new ConflictError('Cliente com este documento já existe');
        }
      }

      // Update customer
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          ...data,
          updatedBy,
        },
        include: {
          customerNotes: {
            orderBy: { createdAt: 'desc' },
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Log the update
      await prisma.customerInteraction.create({
        data: {
          customerId: customer.id,
          companyId,
          type: 'NOTE',
          title: 'Cliente atualizado',
          description: 'Dados do cliente foram atualizados',
          createdBy: updatedBy,
        },
      });

      logger.info('Customer updated', { customerId, companyId, updatedBy, changes: data });

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);

      return {
        id: customer.id,
        companyId: customer.companyId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        status: customer.status,
        tags: customer.tags,
        metadata: customer.metadata,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        notes: customer.customerNotes,
        interactions: customer.interactions,
      };
    } catch (error) {
      logger.error('Error updating customer', { error, customerId, data, companyId });
      throw error;
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId: string, companyId: string, deletedBy: string): Promise<void> {
    try {
      // Check if customer exists and belongs to company
      const existingCustomer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
      });

      if (!existingCustomer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Delete customer (cascade will handle notes and interactions)
      await prisma.customer.delete({
        where: { id: customerId },
      });

      logger.info('Customer deleted', { customerId, companyId, deletedBy });

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);
    } catch (error) {
      logger.error('Error deleting customer', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Search customers with advanced filters
   */
  async searchCustomers(
    companyId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<CustomerSummary[]> {
    try {
      const customers = await prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { document: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          _count: {
            select: {
              customerNotes: true,
              interactions: true,
            },
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { name: 'asc' },
        take: limit,
      });

      return customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        tags: customer.tags,
        interactionsCount: customer._count.interactions,
        notesCount: customer._count.customerNotes,
        lastInteractionAt: customer.interactions[0]?.createdAt,
        createdAt: customer.createdAt,
      }));
    } catch (error) {
      logger.error('Error searching customers', { error, companyId, searchTerm });
      throw error;
    }
  }

  /**
   * Get customer tags for autocomplete
   */
  async getCustomerTags(companyId: string): Promise<string[]> {
    try {
      const cacheKey = `crm:customer_tags:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await prisma.customer.findMany({
        where: { companyId },
        select: { tags: true },
      });

      const allTags = result.flatMap((customer) => customer.tags);
      const uniqueTags = [...new Set(allTags)].sort();

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(uniqueTags));

      return uniqueTags;
    } catch (error) {
      logger.error('Error getting customer tags', { error, companyId });
      throw error;
    }
  }

  /**
   * Add tags to customer
   */
  async addTags(customerId: string, tags: string[], companyId: string, userId: string): Promise<string[]> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { tags: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const currentTags = new Set(customer.tags);
      tags.forEach(tag => currentTags.add(tag.trim().toLowerCase()));
      const updatedTags = Array.from(currentTags);

      await prisma.customer.update({
        where: { id: customerId },
        data: { tags: updatedTags },
      });

      // Log the action
      await prisma.customerInteraction.create({
        data: {
          customerId,
          companyId,
          type: 'NOTE',
          title: 'Tags adicionadas',
          description: `Tags adicionadas: ${tags.join(', ')}`,
          createdBy: userId,
        },
      });

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);

      return updatedTags;
    } catch (error) {
      logger.error('Error adding tags', { error, customerId, tags, companyId });
      throw error;
    }
  }

  /**
   * Remove tags from customer
   */
  async removeTags(customerId: string, tags: string[], companyId: string, userId: string): Promise<string[]> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { tags: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const tagsToRemove = new Set(tags.map(tag => tag.trim().toLowerCase()));
      const updatedTags = customer.tags.filter(tag => !tagsToRemove.has(tag));

      await prisma.customer.update({
        where: { id: customerId },
        data: { tags: updatedTags },
      });

      // Log the action
      await prisma.customerInteraction.create({
        data: {
          customerId,
          companyId,
          type: 'NOTE',
          title: 'Tags removidas',
          description: `Tags removidas: ${tags.join(', ')}`,
          createdBy: userId,
        },
      });

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);

      return updatedTags;
    } catch (error) {
      logger.error('Error removing tags', { error, customerId, tags, companyId });
      throw error;
    }
  }

  /**
   * Get customer history (interactions and notes combined)
   */
  async getCustomerHistory(customerId: string, companyId: string, limit: number = 50): Promise<any[]> {
    try {
      // Verify customer exists and belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Get interactions and notes
      const [interactions, notes] = await Promise.all([
        prisma.customerInteraction.findMany({
          where: { customerId, companyId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.customerNote.findMany({
          where: { customerId, companyId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ]);

      // Combine and sort by date
      const history = [
        ...interactions.map(item => ({ ...item, type: 'interaction' })),
        ...notes.map(item => ({ ...item, type: 'note' })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return history;
    } catch (error) {
      logger.error('Error getting customer history', { error, customerId, companyId });
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
        redis.del(`crm:customer_tags:${companyId}`),
        redis.del(`crm:stats:${companyId}`),
      ]);
    } catch (error) {
      logger.warn('Error invalidating customer caches', { error, customerId, companyId });
    }
  }
}