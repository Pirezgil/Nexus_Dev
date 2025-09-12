import { Request, Response } from 'express';
import { CustomerService } from '../services/customerService';
import { 
  CreateCustomerInput, 
  UpdateCustomerInput,
  CustomerSearchInput,
  PaginationInput,
  TagManagementInput,
  ApiResponse,
  createCustomerSchema,
  updateCustomerSchema,
  customerSearchSchema,
  paginationSchema,
  customerSearchWithPaginationSchema,
  tagManagementSchema,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  AppError,
  CustomerStatus
} from '../types';
import { asyncHandler } from '../middleware/error';
import { validateBody, validateQuery } from '../middleware/validation';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  /**
   * GET /customers/check-document
   * Check if document already exists
   */
  checkDocument = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log(`[${new Date().toISOString()}] GET /customers/check-document - Starting`);
    
    try {
      const { document } = req.query;
      const { excludeId } = req.query;
      
      if (!document || typeof document !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Documento é obrigatório',
        });
        return;
      }
      
      // Obter companyId dos headers do API Gateway ou do user autenticado
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      
      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Company ID não encontrado. Verifique a autenticação.',
        });
        return;
      }
      
      // Clean document (remove non-numeric characters)
      const cleanDocument = document.replace(/\D/g, '');
      
      // Check if document exists
      const exists = await this.customerService.checkDocumentExists(cleanDocument, companyId, excludeId as string);
      
      res.json({
        success: true,
        data: {
          exists,
          document: cleanDocument
        },
        message: exists ? 'Documento já existe' : 'Documento disponível'
      });
    } catch (error) {
      console.error('Error checking document:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao verificar documento',
      });
    }
  });

  /**
   * GET /customers
   * Get paginated list of customers with filters
   */
  getCustomers = [
    validateQuery(customerSearchWithPaginationSchema),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      console.log(`[${new Date().toISOString()}] GET /customers - Starting`);
      
      try {
        // Obter companyId dos headers do API Gateway ou do user autenticado
        const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
        
        if (!companyId) {
          res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Company ID não encontrado. Verifique a autenticação.',
          });
          return;
        }
        
        console.log('Company ID:', companyId);
        
        // Parse query parameters with proper typing
        const filters: CustomerSearchInput = {
          search: req.query.search as string || undefined,
          status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status as CustomerStatus[] : [req.query.status as CustomerStatus]) : undefined,
          tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string]) : undefined,
          city: req.query.city as string || undefined,
          state: req.query.state as string || undefined,
          hasEmail: req.query.hasEmail ? req.query.hasEmail === 'true' : undefined,
          hasPhone: req.query.hasPhone ? req.query.hasPhone === 'true' : undefined,
          createdFrom: req.query.createdFrom ? new Date(req.query.createdFrom as string) : undefined,
          createdTo: req.query.createdTo ? new Date(req.query.createdTo as string) : undefined,
          lastInteractionFrom: req.query.lastInteractionFrom ? new Date(req.query.lastInteractionFrom as string) : undefined,
          lastInteractionTo: req.query.lastInteractionTo ? new Date(req.query.lastInteractionTo as string) : undefined
        };
        
        const pagination: PaginationInput = {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          sortBy: req.query.sortBy as string || 'createdAt',
          sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
        };

        console.log('🔍 [PAGINATION DEBUG]');
        console.log('  - req.query.limit (raw):', req.query.limit);
        console.log('  - parseInt result:', parseInt(req.query.limit as string));
        console.log('  - final limit:', pagination.limit);

        console.log('Filters:', filters);
        console.log('Pagination:', pagination);

        const result = await this.customerService.getCustomers(companyId, filters, pagination);
        
        console.log('🔍 [DEBUG] API RESULT:');
        console.log('  - Total found in DB:', result.pagination.total);
        console.log('  - Customers returned:', result.data.length);
        console.log('  - Page:', result.pagination.page, 'Limit:', result.pagination.limit);
        console.log('  - Customer names:', result.data.map(c => `${c.name} (${c.id})`));

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
    })
  ];

  /**
   * GET /customers/:id
   * Get customer by ID with full details
   */
  getCustomerById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

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
  createCustomer = [
    // TEMPORARIAMENTE SEM VALIDAÇÃO PARA DEBUG
    // validateBody(createCustomerSchema),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      console.log(`[${new Date().toISOString()}] POST /customers - Starting`);
      console.log('Request body:', req.body);
      
      try {
        const data = req.body as any as CreateCustomerInput;
        // Obter companyId e userId dos headers do API Gateway ou do user autenticado
        const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
        const createdBy = req.user?.userId || req.headers['x-user-id'] as string;
        
        if (!companyId || !createdBy) {
          res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Informações de autenticação não encontradas. Verifique os headers ou autenticação.',
          });
          return;
        }

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
    })
  ];

  /**
   * PUT /customers/:id
   * Update customer
   */
  updateCustomer = [
    validateBody(updateCustomerSchema),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const data = req.body as any as UpdateCustomerInput;
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      const updatedBy = req.user?.userId || req.headers['x-user-id'] as string;

      const customer = await this.customerService.updateCustomer(id, data, companyId, updatedBy);

      const response: ApiResponse = {
        success: true,
        data: customer,
        message: 'Cliente atualizado com sucesso',
      };

      res.json(response);
    })
  ];

  /**
   * DELETE /customers/:id
   * Delete customer with enhanced error handling and validation
   */
  deleteCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    console.log(`[${new Date().toISOString()}] DELETE /customers/${req.params.id} - Starting`);
    
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      const deletedBy = req.user?.userId || req.headers['x-user-id'] as string;

      // Enhanced validation
      if (!id || typeof id !== 'string') {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'ID do cliente é obrigatório',
          details: {
            reason: 'MISSING_CUSTOMER_ID',
            field: 'id',
            suggestions: ['Forneça um ID válido do cliente']
          }
        });
        return;
      }

      if (!companyId || !deletedBy) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Informações de autenticação não encontradas',
          details: {
            reason: 'MISSING_AUTH_INFO',
            missingFields: [
              ...(!companyId ? ['companyId'] : []),
              ...(!deletedBy ? ['userId'] : [])
            ],
            suggestions: ['Verifique sua autenticação e tente novamente']
          }
        });
        return;
      }

      console.log('Deleting customer:', { id, companyId, deletedBy });

      await this.customerService.deleteCustomer(id, companyId, deletedBy);

      const response: ApiResponse = {
        success: true,
        message: 'Cliente excluído com sucesso',
        data: {
          deletedCustomerId: id,
          deletedAt: new Date().toISOString(),
          deletedBy
        }
      };

      console.log(`[${new Date().toISOString()}] DELETE /customers/${id} - Success`);
      res.json(response);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] DELETE /customers/${req.params.id} - Error:`, error);
      
      // Handle specific error types with enhanced responses
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: error.message,
          details: {
            reason: 'VALIDATION_FAILED',
            errors: error.errors,
            suggestions: ['Verifique os dados fornecidos e tente novamente']
          }
        });
        return;
      }
      
      if (error instanceof NotFoundError) {
        const enhancedError = error as any;
        res.status(404).json({
          success: false,
          error: 'NotFoundError',
          message: error.message,
          details: enhancedError.details || {
            reason: 'CUSTOMER_NOT_FOUND',
            customerId: req.params.id,
            suggestions: [
              'Verifique se o ID do cliente está correto',
              'Confirme se o cliente pertence à sua empresa',
              'O cliente pode ter sido excluído anteriormente'
            ]
          }
        });
        return;
      }
      
      if (error instanceof UnauthorizedError) {
        res.status(401).json({
          success: false,
          error: 'UnauthorizedError',
          message: error.message,
          details: {
            reason: 'INSUFFICIENT_PERMISSIONS',
            suggestions: ['Verifique suas permissões de usuário']
          }
        });
        return;
      }
      
      if (error instanceof ForbiddenError) {
        res.status(403).json({
          success: false,
          error: 'ForbiddenError',
          message: error.message,
          details: {
            reason: 'ACCESS_DENIED',
            suggestions: ['Contate o administrador do sistema para obter acesso']
          }
        });
        return;
      }
      
      // Handle unexpected errors
      const isOperationalError = error instanceof AppError;
      
      res.status(isOperationalError ? (error as AppError).statusCode : 500).json({
        success: false,
        error: 'InternalServerError',
        message: isOperationalError ? error.message : 'Erro interno do servidor durante a exclusão',
        details: {
          reason: isOperationalError ? 'OPERATIONAL_ERROR' : 'SYSTEM_ERROR',
          suggestions: [
            'Tente novamente em alguns minutos',
            'Se o problema persistir, contate o suporte técnico'
          ],
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  /**
   * GET /customers/search
   * Advanced customer search
   */
  searchCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q: searchTerm, limit = '10' } = req.query;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

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
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

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
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      
      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Company ID não encontrado para buscar tags.',
        });
        return;
      }
      
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
  addTags = [
    validateBody(tagManagementSchema),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tags } = req.body as TagManagementInput;
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      const userId = req.user?.userId || req.headers['x-user-id'] as string;

      const updatedTags = await this.customerService.addTags(id, tags, companyId, userId);

      const response: ApiResponse = {
        success: true,
        data: { tags: updatedTags },
        message: 'Tags adicionadas com sucesso',
      };

      res.json(response);
    })
  ];

  /**
   * DELETE /customers/:id/tags
   * Remove tags from customer
   */
  removeTags = [
    validateBody(tagManagementSchema),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tags } = req.body as TagManagementInput;
      const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
      const userId = req.user?.userId || req.headers['x-user-id'] as string;

      const updatedTags = await this.customerService.removeTags(id, tags, companyId, userId);

      const response: ApiResponse = {
        success: true,
        data: { tags: updatedTags },
        message: 'Tags removidas com sucesso',
      };

      res.json(response);
    })
  ];
}