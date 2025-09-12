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
  VisitUpdateData
} from '../types';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';

/**
 * CustomerService - VERSÃO EXPANDIDA COM INTEGRAÇÃO COMPLETA
 * 
 * Inclui todos os métodos necessários para:
 * - CRUD básico de clientes
 * - APIs de integração com Services e Agendamento
 * - Campos customizados e segmentação
 * - Estatísticas e relatórios
 */
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
          { cpfCnpj: { contains: filters.search, mode: 'insensitive' } }, // Updated field name
        ];
      }

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters.city) {
        where.addressCity = { contains: filters.city, mode: 'insensitive' }; // Updated field name
      }

      if (filters.state) {
        where.addressState = { contains: filters.state, mode: 'insensitive' }; // Updated field name
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
        // Add visit data for enhanced listing
        lastVisit: customer.lastVisit,
        totalVisits: customer.totalVisits,
        totalSpent: customer.totalSpent,
        averageTicket: customer.averageTicket
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
          customValues: {
            include: {
              customField: true
            }
          },
          segmentMembers: {
            include: {
              segment: true
            }
          }
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
        secondaryPhone: customer.secondaryPhone,
        cpfCnpj: customer.cpfCnpj,
        rg: customer.rg,
        // Address fields
        addressStreet: customer.addressStreet,
        addressNumber: customer.addressNumber,
        addressComplement: customer.addressComplement,
        addressNeighborhood: customer.addressNeighborhood,
        addressCity: customer.addressCity,
        addressState: customer.addressState,
        addressZipcode: customer.addressZipcode,
        // Demographics
        birthDate: customer.birthDate,
        gender: customer.gender,
        maritalStatus: customer.maritalStatus,
        profession: customer.profession,
        // Relationship data
        status: customer.status,
        source: customer.source,
        tags: customer.tags,
        notes: customer.notes,
        preferredContact: customer.preferredContact,
        marketingConsent: customer.marketingConsent,
        // Visit data
        firstVisit: customer.firstVisit,
        lastVisit: customer.lastVisit,
        totalVisits: customer.totalVisits,
        totalSpent: customer.totalSpent,
        averageTicket: customer.averageTicket,
        // Avatar
        avatarUrl: customer.avatarUrl,
        // Audit
        createdBy: customer.createdBy,
        updatedBy: customer.updatedBy,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        // Relations
        customerNotes: customer.customerNotes,
        interactions: customer.interactions,
        customValues: customer.customValues,
        segments: customer.segmentMembers.map(sm => sm.segment)
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
   * Create new customer with full field support
   */
  async createCustomer(data: CreateCustomerData, companyId: string, createdBy: string): Promise<CustomerDetails> {
    try {
      console.log('DEBUG [CustomerServiceExpanded]: Creating customer with data:', JSON.stringify(data, null, 2));

      // Check for duplicates
      if (data.email) {
        const existingByEmail = await prisma.customer.findFirst({
          where: { email: data.email, companyId },
        });
        if (existingByEmail) {
          throw new ConflictError('Cliente com este email já existe');
        }
      }

      if (data.cpfCnpj) {
        const existingByCpf = await prisma.customer.findFirst({
          where: { cpfCnpj: data.cpfCnpj, companyId },
        });
        if (existingByCpf) {
          throw new ConflictError('Cliente com este CPF/CNPJ já existe');
        }
      }

      // Build prisma data with proper address mapping
      const prismaData: any = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpfCnpj: data.document,
        status: data.status || 'PROSPECT',
        tags: data.tags || [],
        companyId,
        createdBy,
        // Ensure first visit is set if this customer has services
        firstVisit: data.firstVisit || new Date()
      };

      // Handle address mapping - support both structured and legacy formats
      if (data.addressStructured) {
        // New structured format from frontend
        console.log('DEBUG [CustomerServiceExpanded]: Processing structured address:', data.addressStructured);
        prismaData.addressStreet = data.addressStructured.street;
        prismaData.addressNumber = data.addressStructured.number;
        prismaData.addressComplement = data.addressStructured.complement;
        prismaData.addressNeighborhood = data.addressStructured.neighborhood;
        prismaData.addressCity = data.addressStructured.city;
        prismaData.addressState = data.addressStructured.state;
        prismaData.addressZipcode = data.addressStructured.zipcode;
        prismaData.addressCountry = data.addressStructured.country;
      } else {
        // Legacy format
        prismaData.address = data.address;
        prismaData.city = data.city;
        prismaData.state = data.state;
        prismaData.zipCode = data.zipCode;
        prismaData.country = data.country;
      }

      // Map additional fields
      if (data.profession) prismaData.profession = data.profession;
      if (data.source) prismaData.source = data.source;
      if (data.preferredContact) prismaData.preferredContact = data.preferredContact;
      if (data.marketingConsent !== undefined) prismaData.marketingConsent = data.marketingConsent;
      if (data.secondaryPhone) prismaData.secondaryPhone = data.secondaryPhone;
      if (data.rg) prismaData.rg = data.rg;
      if (data.birthDate) prismaData.birthDate = data.birthDate;
      if (data.gender) prismaData.gender = data.gender;
      if (data.maritalStatus) prismaData.maritalStatus = data.maritalStatus;

      console.log('DEBUG [CustomerServiceExpanded]: Final prisma data:', JSON.stringify(prismaData, null, 2));

      const customer = await prisma.customer.create({
        data: prismaData,
        include: {
          customerNotes: true,
          interactions: true,
          customValues: {
            include: {
              customField: true
            }
          },
          segmentMembers: {
            include: {
              segment: true
            }
          }
        },
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

      // Invalidate related caches
      await this.invalidateCustomerCaches(customer.id, companyId);

      return this.transformCustomerToDetails(customer);
    } catch (error) {
      logger.error('Error creating customer', { error, data, companyId });
      throw error;
    }
  }

  /**
   * Update customer with full field support
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

      if (data.cpfCnpj && data.cpfCnpj !== existingCustomer.cpfCnpj) {
        const existingByCpf = await prisma.customer.findFirst({
          where: { cpfCnpj: data.cpfCnpj, companyId, id: { not: customerId } },
        });
        if (existingByCpf) {
          throw new ConflictError('Cliente com este CPF/CNPJ já existe');
        }
      }

      // Update customer
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          ...data,
          updatedBy
        },
        include: {
          customerNotes: {
            orderBy: { createdAt: 'desc' },
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
          },
          customValues: {
            include: {
              customField: true
            }
          },
          segmentMembers: {
            include: {
              segment: true
            }
          }
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

      return this.transformCustomerToDetails(customer);
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
   * MÉTODOS DE INTEGRAÇÃO CRÍTICOS PARA OUTROS MÓDULOS
   */

  /**
   * Get customer basic data for other modules (Agendamento)
   * Conforme docs/02-modules/crm.md:502-514
   */
  async getCustomerBasic(customerId: string, companyId: string): Promise<any> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          preferredContact: true
        }
      });

      return customer;
    } catch (error) {
      logger.error('Error getting customer basic data', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Update customer visit data (called by Services)
   * CRÍTICO: Atualiza last_visit, total_visits, total_spent, average_ticket
   * Conforme docs/02-modules/crm.md:516-525
   */
  async updateVisitData(
    customerId: string, 
    companyId: string, 
    visitData: { visit_date: Date; service_value: number }
  ): Promise<void> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { 
          totalVisits: true, 
          totalSpent: true, 
          firstVisit: true 
        }
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

      const newTotalVisits = customer.totalVisits + 1;
      const newTotalSpent = customer.totalSpent.toNumber() + visitData.service_value;
      const newAverageTicket = newTotalSpent / newTotalVisits;

      // Atualizar dados do cliente
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          lastVisit: visitData.visit_date,
          firstVisit: customer.firstVisit || visitData.visit_date,
          totalVisits: newTotalVisits,
          totalSpent: newTotalSpent,
          averageTicket: newAverageTicket
        }
      });

      // Criar interação de atendimento
      await prisma.customerInteraction.create({
        data: {
          customerId,
          companyId,
          type: 'SERVICE',
          title: 'Atendimento realizado',
          description: `Atendimento no valor de R$ ${visitData.service_value.toFixed(2)}`,
          metadata: {
            service_value: visitData.service_value,
            visit_date: visitData.visit_date.toISOString()
          },
          createdBy: 'system'
        }
      });

      logger.info(
        `[INTEGRATION] Dados de visita atualizados: cliente ${customerId}, visitas: ${newTotalVisits}, gasto total: R$ ${newTotalSpent}`
      );

      await this.invalidateCustomerCaches(customerId, companyId);

    } catch (error) {
      logger.error('Error updating customer visit data', { error, customerId, visitData });
      throw error;
    }
  }

  /**
   * Search customers for scheduling (basic data only)
   */
  async searchCustomersBasic(
    companyId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const customers = await prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          preferredContact: true
        },
        orderBy: { name: 'asc' },
        take: limit
      });

      return customers;
    } catch (error) {
      logger.error('Error searching customers for scheduling', { error, companyId, searchTerm });
      throw error;
    }
  }

  /**
   * Register service interaction (called by Services module)
   */
  async registerServiceInteraction(
    customerId: string,
    companyId: string,
    serviceData: {
      serviceId: string;
      serviceName: string;
      professionalName?: string;
      description?: string;
      durationMinutes?: number;
      serviceValue?: number;
      photos?: string[];
    }
  ): Promise<void> {
    try {
      await prisma.customerInteraction.create({
        data: {
          customerId,
          companyId,
          type: 'SERVICE',
          title: serviceData.serviceName,
          description: serviceData.description || 'Atendimento realizado',
          metadata: {
            service_id: serviceData.serviceId,
            professional: serviceData.professionalName,
            duration_minutes: serviceData.durationMinutes,
            service_value: serviceData.serviceValue,
            photos: serviceData.photos || []
          },
          relatedServiceId: serviceData.serviceId,
          createdBy: 'services-module'
        }
      });

      await this.invalidateCustomerCaches(customerId, companyId);

    } catch (error) {
      logger.error('Error registering service interaction', { error, customerId, serviceData });
      throw error;
    }
  }

  /**
   * Get customer summary for Services module
   */
  async getCustomerSummaryForService(customerId: string, companyId: string): Promise<any> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          birthDate: true,
          lastVisit: true,
          totalVisits: true,
          totalSpent: true,
          averageTicket: true,
          tags: true,
          notes: true,
          preferredContact: true,
          marketingConsent: true,
          customValues: {
            include: {
              customField: {
                select: {
                  name: true,
                  fieldType: true
                }
              }
            }
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              type: true,
              title: true,
              description: true,
              createdAt: true,
              metadata: true
            }
          }
        }
      });

      if (!customer) {
        return null;
      }

      const customFields = customer.customValues.map(cv => ({
        name: cv.customField.name,
        type: cv.customField.fieldType,
        value: cv.value
      }));

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        birth_date: customer.birthDate,
        last_visit: customer.lastVisit,
        total_visits: customer.totalVisits,
        total_spent: customer.totalSpent,
        average_ticket: customer.averageTicket,
        tags: customer.tags,
        notes: customer.notes,
        preferred_contact: customer.preferredContact,
        marketing_consent: customer.marketingConsent,
        custom_fields: customFields,
        recent_interactions: customer.interactions
      };

    } catch (error) {
      logger.error('Error getting customer summary for service', { error, customerId, companyId });
      throw error;
    }
  }

  /**
   * Get company customer stats
   */
  async getCompanyStats(companyId: string): Promise<any> {
    try {
      const cacheKey = `crm:stats:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const [totalCustomers, activeCustomers, recentCustomers, totalSpent] = await Promise.all([
        prisma.customer.count({ where: { companyId } }),
        prisma.customer.count({ where: { companyId, status: 'ACTIVE' } }),
        prisma.customer.count({ 
          where: { 
            companyId, 
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          } 
        }),
        prisma.customer.aggregate({
          where: { companyId },
          _sum: { totalSpent: true },
          _avg: { averageTicket: true }
        })
      ]);

      const stats = {
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        recent_customers: recentCustomers,
        total_revenue: totalSpent._sum.totalSpent || 0,
        average_ticket: totalSpent._avg.averageTicket || 0,
        last_updated: new Date().toISOString()
      };

      await redis.setex(cacheKey, 900, JSON.stringify(stats));

      return stats;

    } catch (error) {
      logger.error('Error getting company customer stats', { error, companyId });
      throw error;
    }
  }

  /**
   * Additional existing methods (tags, history, etc.)
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

      await redis.setex(cacheKey, 3600, JSON.stringify(uniqueTags));

      return uniqueTags;
    } catch (error) {
      logger.error('Error getting customer tags', { error, companyId });
      throw error;
    }
  }

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

      await this.invalidateCustomerCaches(customerId, companyId);

      return updatedTags;
    } catch (error) {
      logger.error('Error adding tags', { error, customerId, tags, companyId });
      throw error;
    }
  }

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

      await this.invalidateCustomerCaches(customerId, companyId);

      return updatedTags;
    } catch (error) {
      logger.error('Error removing tags', { error, customerId, tags, companyId });
      throw error;
    }
  }

  async getCustomerHistory(customerId: string, companyId: string, limit: number = 50): Promise<any[]> {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundError('Cliente não encontrado');
      }

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
   * Transform prisma customer to CustomerDetails
   */
  private transformCustomerToDetails(customer: any): CustomerDetails {
    return {
      id: customer.id,
      companyId: customer.companyId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      secondaryPhone: customer.secondaryPhone,
      cpfCnpj: customer.cpfCnpj,
      rg: customer.rg,
      addressStreet: customer.addressStreet,
      addressNumber: customer.addressNumber,
      addressComplement: customer.addressComplement,
      addressNeighborhood: customer.addressNeighborhood,
      addressCity: customer.addressCity,
      addressState: customer.addressState,
      addressZipcode: customer.addressZipcode,
      birthDate: customer.birthDate,
      gender: customer.gender,
      maritalStatus: customer.maritalStatus,
      profession: customer.profession,
      status: customer.status,
      source: customer.source,
      tags: customer.tags,
      notes: customer.notes,
      preferredContact: customer.preferredContact,
      marketingConsent: customer.marketingConsent,
      firstVisit: customer.firstVisit,
      lastVisit: customer.lastVisit,
      totalVisits: customer.totalVisits,
      totalSpent: customer.totalSpent,
      averageTicket: customer.averageTicket,
      avatarUrl: customer.avatarUrl,
      createdBy: customer.createdBy,
      updatedBy: customer.updatedBy,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      customerNotes: customer.customerNotes || [],
      interactions: customer.interactions || [],
      customValues: customer.customValues || [],
      segments: customer.segmentMembers?.map((sm: any) => sm.segment) || []
    };
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