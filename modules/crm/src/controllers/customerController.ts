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
    const companyId = req.user!.companyId;
    const filters = req.query as unknown as CustomerSearchInput;
    const pagination = req.query as unknown as PaginationInput;

    const result = await this.customerService.getCustomers(companyId, filters, pagination);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Clientes recuperados com sucesso',
    };

    res.json(response);
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
    // Temporary minimal controller for timeout diagnosis
    const response: ApiResponse = {
      success: true,
      data: {
        id: 'test-id',
        name: req.body?.name || 'Test Customer',
        message: 'Controller reached successfully - no timeout!'
      },
      message: 'Teste bem-sucedido - controller funciona!',
    };

    res.status(201).json(response);
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
    const companyId = req.user!.companyId;

    const tags = await this.customerService.getCustomerTags(companyId);

    const response: ApiResponse = {
      success: true,
      data: tags,
      message: 'Tags recuperadas com sucesso',
    };

    res.json(response);
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