import { Request, Response } from 'express';
import { CustomerService } from '../services/customerService';
import { 
  CreateCustomerInput, 
  UpdateCustomerInput,
  CustomerSearchInput,
  PaginationInput,
  TagManagementInput,
  ApiResponse 
} from '../types';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  /**
   * GET /customers
   * Get paginated list of customers with filters
   */
  getCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log(`[${new Date().toISOString()}] GET /customers - Starting`);
    
    try {
      const companyId = req.user!.companyId;
      console.log('Company ID:', companyId);
      
      // Provide default values to prevent validation errors
      const filters = {
        search: req.query.search as string || '',
        status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [],
        tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : [],
        city: req.query.city as string || '',
        state: req.query.state as string || '',
        hasEmail: req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined,
        hasPhone: req.query.hasPhone === 'true' ? true : req.query.hasPhone === 'false' ? false : undefined,
        createdFrom: req.query.createdFrom ? new Date(req.query.createdFrom as string) : undefined,
        createdTo: req.query.createdTo ? new Date(req.query.createdTo as string) : undefined
      };
      
      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      console.log('Filters:', filters);
      console.log('Pagination:', pagination);

      const result = await this.customerService.getCustomers(companyId, filters, pagination);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Clientes recuperados com sucesso',
      };

      console.log(`[${new Date().toISOString()}] GET /customers - Success`);
      res.json(response);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /customers - Error:`, error);
      throw error;
    }
  });

  /**
   * GET /customers/:id
   * Get customer by ID with full details
   */
  getCustomerById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const customer = await this.customerService.getCustomerById(id, companyId);

    const response: ApiResponse = {
      success: true,
      data: customer,
      message: 'Cliente encontrado com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /customers
   * Create new customer
   */
  createCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log(`[${new Date().toISOString()}] POST /customers - Starting`);
    console.log('Request body:', req.body);
    
    try {
      const data = req.body as CreateCustomerInput;
      const companyId = req.user!.companyId;
      const createdBy = req.user!.userId;

      console.log('Creating customer with:', { data, companyId, createdBy });

      const customer = await this.customerService.createCustomer(data, companyId, createdBy);

      const response: ApiResponse = {
        success: true,
        data: customer,
        message: 'Cliente criado com sucesso',
      };

      console.log(`[${new Date().toISOString()}] POST /customers - Success, ID: ${customer.id}`);
      res.status(201).json(response);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] POST /customers - Error:`, error);
      throw error;
    }
  });

  /**
   * PUT /customers/:id
   * Update customer
   */
  updateCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body as UpdateCustomerInput;
    const companyId = req.user!.companyId;
    const updatedBy = req.user!.userId;

    const customer = await this.customerService.updateCustomer(id, data, companyId, updatedBy);

    const response: ApiResponse = {
      success: true,
      data: customer,
      message: 'Cliente atualizado com sucesso',
    };

    res.json(response);
  });

  /**
   * DELETE /customers/:id
   * Delete customer
   */
  deleteCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const deletedBy = req.user!.userId;

    await this.customerService.deleteCustomer(id, companyId, deletedBy);

    const response: ApiResponse = {
      success: true,
      message: 'Cliente deletado com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/search
   * Advanced customer search
   */
  searchCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q: searchTerm, limit = '10' } = req.query;
    const companyId = req.user!.companyId;

    if (!searchTerm || typeof searchTerm !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'ValidationError',
        message: 'Termo de busca é obrigatório',
      };
      res.status(400).json(response);
      return;
    }

    const customers = await this.customerService.searchCustomers(
      companyId,
      searchTerm,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: customers,
      message: 'Busca realizada com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:id/history
   * Get customer history (interactions + notes)
   */
  getCustomerHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { limit = '50' } = req.query;
    const companyId = req.user!.companyId;

    const history = await this.customerService.getCustomerHistory(
      id,
      companyId,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: history,
      message: 'Histórico recuperado com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/tags
   * Get all customer tags for autocomplete
   */
  getCustomerTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log(`[${new Date().toISOString()}] GET /customers/tags - Starting`);
    
    try {
      const companyId = req.user!.companyId;
      console.log('Getting tags for company:', companyId);

      const tags = await this.customerService.getCustomerTags(companyId);

      const response: ApiResponse = {
        success: true,
        data: tags,
        message: 'Tags recuperadas com sucesso',
      };

      console.log(`[${new Date().toISOString()}] GET /customers/tags - Success, found ${tags.length} tags`);
      res.json(response);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] GET /customers/tags - Error:`, error);
      throw error;
    }
  });

  /**
   * POST /customers/:id/tags
   * Add tags to customer
   */
  addTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { tags } = req.body as TagManagementInput;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const updatedTags = await this.customerService.addTags(id, tags, companyId, userId);

    const response: ApiResponse = {
      success: true,
      data: { tags: updatedTags },
      message: 'Tags adicionadas com sucesso',
    };

    res.json(response);
  });

  /**
   * DELETE /customers/:id/tags
   * Remove tags from customer
   */
  removeTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { tags } = req.body as TagManagementInput;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const updatedTags = await this.customerService.removeTags(id, tags, companyId, userId);

    const response: ApiResponse = {
      success: true,
      data: { tags: updatedTags },
      message: 'Tags removidas com sucesso',
    };

    res.json(response);
  });
}