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
  ConflictError,
  CustomerStatus
} from '../types';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';
import { notificationClient } from './notificationClient';

export class CustomerService {
  /**
   * Check if document already exists
   */
  async checkDocumentExists(document: string, companyId: string, excludeId?: string): Promise<boolean> {
    try {
      const where: Prisma.CustomerWhereInput = {
        companyId,
        cpfCnpj: document,
      };

      // Exclude specific customer ID (for editing)
      if (excludeId) {
        where.id = { not: excludeId };
      }

      const existing = await prisma.customer.findFirst({
        where,
        select: { id: true },
      });

      return !!existing;
    } catch (error) {
      logger.error('Error checking document existence', { error, document, companyId });
      throw error;
    }
  }

  /**
   * Get paginated list of customers with filters
   */
  async getCustomers(
    companyId: string,
    filters: CustomerSearchFilters,
    pagination: PaginationQuery
  ): Promise<PaginatedResponse<CustomerSummary>> {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
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
          { cpfCnpj: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status as CustomerStatus[] };
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.city) {
        where.addressCity = { contains: filters.city, mode: 'insensitive' };
      }

      if (filters.state) {
        where.addressState = { contains: filters.state, mode: 'insensitive' };
      }

      if (filters.hasEmail !== undefined) {
        where.email = filters.hasEmail ? { not: null } : null;
      }

      if (filters.hasPhone !== undefined) {
        where.phone = filters.hasPhone ? { not: null } : null;
      }

      // Fix: Properly combine date range filters instead of overwriting
      const dateFilter: any = {};
      if (filters.createdFrom) {
        dateFilter.gte = filters.createdFrom;
      }
      if (filters.createdTo) {
        dateFilter.lte = filters.createdTo;
      }
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
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
        document: customer.cpfCnpj,
        address: customer.addressStreet,
        city: customer.addressCity,
        state: customer.addressState,
        zipCode: customer.addressZipcode,
        country: null,
        status: customer.status,
        tags: customer.tags,
        metadata: customer.notes ? JSON.parse(customer.notes) : null,
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
        const documentExists = await this.checkDocumentExists(data.document, companyId);
        if (documentExists) {
          throw new ConflictError('Cliente com este documento já existe');
        }
      }

      // Map API fields to Prisma schema fields
      const prismaData: any = {
        name: data.name,
        companyId,
        createdBy,
        status: data.status || 'ACTIVE',
        tags: data.tags || [],
      };

      // Handle address mapping - support both structured and legacy formats
      console.log('DEBUG: Data received:', JSON.stringify(data, null, 2));
      
      if (data.addressStructured) {
        // New structured format from frontend
        console.log('DEBUG: Processing structured address:', data.addressStructured);
        if (data.addressStructured.street) prismaData.addressStreet = data.addressStructured.street;
        if (data.addressStructured.number) prismaData.addressNumber = data.addressStructured.number;
        if (data.addressStructured.complement) prismaData.addressComplement = data.addressStructured.complement;
        if (data.addressStructured.neighborhood) prismaData.addressNeighborhood = data.addressStructured.neighborhood;
        if (data.addressStructured.city) prismaData.addressCity = data.addressStructured.city;
        if (data.addressStructured.state) prismaData.addressState = data.addressStructured.state;
        if (data.addressStructured.zipcode) prismaData.addressZipcode = data.addressStructured.zipcode;
        if (data.addressStructured.country) prismaData.addressCountry = data.addressStructured.country;
      } else {
        // Legacy flat format for compatibility
        console.log('DEBUG: Processing legacy address format');
        if (data.address) prismaData.addressStreet = data.address;
        if (data.city) prismaData.addressCity = data.city;
        if (data.state) prismaData.addressState = data.state;
        if (data.zipCode) prismaData.addressZipcode = data.zipCode;
        if (data.country) prismaData.addressCountry = data.country;
      }
      
      console.log('DEBUG: Final prismaData:', JSON.stringify(prismaData, null, 2));

      // Only include fields that are provided
      if (data.email) prismaData.email = data.email;
      if (data.phone) prismaData.phone = data.phone;
      if (data.document) prismaData.cpfCnpj = data.document;
      if (data.secondaryPhone) prismaData.secondaryPhone = data.secondaryPhone;
      if (data.rg) prismaData.rg = data.rg;
      if (data.metadata) prismaData.notes = JSON.stringify(data.metadata);
      
      // Additional fields
      if (data.profession) prismaData.profession = data.profession;
      if (data.source) prismaData.source = data.source;
      if (data.preferredContact) prismaData.preferredContact = data.preferredContact;
      if (data.marketingConsent !== undefined) prismaData.marketingConsent = data.marketingConsent;
      if (data.birthDate) prismaData.birthDate = new Date(data.birthDate);
      if (data.gender) prismaData.gender = data.gender;
      if (data.maritalStatus) prismaData.maritalStatus = data.maritalStatus;

      // Create customer with proper field mapping
      const customer = await prisma.customer.create({
        data: prismaData,
      });

      // Create initial interaction
      await prisma.customerInteraction.create({
        data: {
          customerId: customer.id,
          companyId,
          type: 'NOTE',
          title: 'Cliente cadastrado',
          description: 'Cliente cadastrado no sistema',
          createdBy,
        },
      });

      logger.info('Customer created', { customerId: customer.id, companyId, createdBy });

      // Send notification about new customer
      try {
        await notificationClient.notifyCustomerCreated(
          companyId,
          createdBy,
          customer.name,
          customer.id
        );
      } catch (notificationError) {
        logger.warn('Failed to send customer creation notification', {
          customerId: customer.id,
          error: notificationError
        });
      }

      // Invalidate related caches
      await this.invalidateCustomerCaches(customer.id, companyId);

      // Return mapped object from Prisma schema to API interface
      return {
        id: customer.id,
        companyId: customer.companyId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.cpfCnpj,
        address: customer.addressStreet,
        city: customer.addressCity,
        state: customer.addressState,
        zipCode: customer.addressZipcode,
        country: null,
        status: customer.status,
        tags: customer.tags,
        metadata: customer.notes ? JSON.parse(customer.notes) : null,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        notes: [],
        interactions: [],
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

      if (data.document && data.document !== existingCustomer.cpfCnpj) {
        const existingByDocument = await prisma.customer.findFirst({
          where: { cpfCnpj: data.document, companyId, id: { not: customerId } },
        });
        if (existingByDocument) {
          throw new ConflictError('Cliente com este documento já existe');
        }
      }

      // Map API fields to Prisma schema fields
      const updateData: any = { updatedBy };
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.document !== undefined) updateData.cpfCnpj = data.document;
      if (data.address !== undefined) updateData.addressStreet = data.address;
      if (data.city !== undefined) updateData.addressCity = data.city;
      if (data.state !== undefined) updateData.addressState = data.state;
      if (data.zipCode !== undefined) updateData.addressZipcode = data.zipCode;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.metadata !== undefined) updateData.notes = JSON.stringify(data.metadata);

      // Update customer
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
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

      // Send notification about customer update
      try {
        const changedFields = Object.keys(data).filter(key => data[key as keyof UpdateCustomerData] !== undefined);
        await notificationClient.notifyCustomerUpdated(
          companyId,
          updatedBy,
          customer.name,
          customerId,
          changedFields
        );
      } catch (notificationError) {
        logger.warn('Failed to send customer update notification', {
          customerId,
          error: notificationError
        });
      }

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);

      return {
        id: customer.id,
        companyId: customer.companyId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.cpfCnpj,
        address: customer.addressStreet,
        city: customer.addressCity,
        state: customer.addressState,
        zipCode: customer.addressZipcode,
        country: null,
        status: customer.status,
        tags: customer.tags,
        metadata: customer.notes ? JSON.parse(customer.notes) : null,
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
   * Delete customer with enhanced error handling and audit logging
   */
  async deleteCustomer(customerId: string, companyId: string, deletedBy: string): Promise<void> {
    // Start audit logging
    const auditContext = {
      operation: 'DELETE_CUSTOMER',
      customerId,
      companyId,
      deletedBy,
      timestamp: new Date().toISOString(),
      userAgent: process.env.USER_AGENT || 'crm-service',
    };

    logger.info('Customer deletion attempt started', auditContext);

    try {
      // Enhanced validation: Check UUID format
      if (!this.isValidUUID(customerId)) {
        const error = new Error('ID do cliente possui formato inválido');
        logger.warn('Customer deletion failed: invalid UUID format', {
          ...auditContext,
          error: error.message,
          providedId: customerId
        });
        throw new ValidationError('ID do cliente possui formato inválido', {
          customerId: ['Formato de UUID inválido']
        });
      }

      // Check if customer exists and belongs to company with detailed context
      const existingCustomer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        include: {
          _count: {
            select: {
              customerNotes: true,
              interactions: true,
            }
          }
        }
      });

      if (!existingCustomer) {
        // Enhanced 404 error with detailed context
        const errorMessage = 'Cliente não encontrado ou não pertence à empresa';
        const errorDetails = {
          reason: 'CUSTOMER_NOT_FOUND',
          customerId,
          companyId,
          suggestions: [
            'Verifique se o ID do cliente está correto',
            'Confirme se o cliente pertence à sua empresa',
            'O cliente pode ter sido excluído anteriormente'
          ]
        };
        
        logger.warn('Customer deletion failed: customer not found', {
          ...auditContext,
          error: errorMessage,
          details: errorDetails
        });
        
        const notFoundError = new NotFoundError(errorMessage);
        (notFoundError as any).details = errorDetails;
        throw notFoundError;
      }

      // Check for business rules that might prevent deletion
      const relatedDataCount = existingCustomer._count.customerNotes + existingCustomer._count.interactions;
      
      // Log customer details before deletion for audit
      logger.info('Customer deletion: target customer details', {
        ...auditContext,
        customerName: existingCustomer.name,
        customerEmail: existingCustomer.email,
        customerStatus: existingCustomer.status,
        relatedNotesCount: existingCustomer._count.customerNotes,
        relatedInteractionsCount: existingCustomer._count.interactions,
        totalRelatedData: relatedDataCount
      });

      // Delete customer (cascade will handle notes and interactions)
      await prisma.customer.delete({
        where: { id: customerId },
      });

      logger.info('Customer deleted successfully', {
        ...auditContext,
        customerName: existingCustomer.name,
        deletedDataCount: relatedDataCount,
        status: 'SUCCESS'
      });

      // Send notification about customer deletion
      try {
        await notificationClient.notifyCustomerDeleted(
          companyId,
          deletedBy,
          existingCustomer.name,
          customerId
        );
        logger.debug('Customer deletion notification sent', auditContext);
      } catch (notificationError) {
        logger.warn('Failed to send customer deletion notification', {
          ...auditContext,
          notificationError: notificationError instanceof Error ? notificationError.message : notificationError
        });
      }

      // Invalidate caches
      await this.invalidateCustomerCaches(customerId, companyId);
      logger.debug('Customer caches invalidated', auditContext);
      
    } catch (error) {
      // Enhanced error logging with full context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Customer deletion failed', {
        ...auditContext,
        error: errorMessage,
        errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        status: 'FAILED'
      });
      
      // Re-throw with enhanced context if it's our custom error
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap unexpected errors with proper context
      throw new AppError(
        'Erro interno durante a exclusão do cliente',
        500,
        false // Not operational - indicates a system issue
      );
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
            { cpfCnpj: { contains: searchTerm, mode: 'insensitive' } },
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
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
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