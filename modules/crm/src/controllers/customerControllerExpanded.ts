import { Request, Response } from 'express';
import { CustomerService } from './customerServiceExpanded';
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

/**
 * CustomerController - VERSÃO EXPANDIDA COM TODOS ENDPOINTS
 * 
 * Inclui todos os endpoints especificados em docs/02-modules/crm.md:
 * - CRUD básico de clientes
 * - Histórico e interações
 * - Tags e segmentação  
 * - Custom fields
 * - Estatísticas
 * - Importação/Exportação
 */
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
    const data = req.body as CreateCustomerInput;
    const companyId = req.user!.companyId;
    const createdBy = req.user!.userId;

    const customer = await this.customerService.createCustomer(data, companyId, createdBy);

    const response: ApiResponse = {
      success: true,
      data: customer,
      message: 'Cliente criado com sucesso',
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

    const customers = await this.customerService.searchCustomersBasic(
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

  /**
   * GET /customers/:id/interactions
   * Get customer interactions history
   * Conforme docs/02-modules/crm.md:413-469
   */
  getCustomerInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { type, limit = '50' } = req.query;
    const companyId = req.user!.companyId;

    const interactions = await this.customerService.getCustomerInteractions(
      id,
      companyId,
      type as string,
      parseInt(limit as string, 10)
    );

    // Transform to match specification format (lines 421-468)
    const formattedInteractions = interactions.map(interaction => ({
      id: interaction.id,
      type: interaction.type.toLowerCase(),
      subject: interaction.subject || interaction.title,
      description: interaction.description,
      status: interaction.status,
      metadata: interaction.metadata,
      created_by: interaction.createdBy,
      created_by_name: 'User Name', // Would come from user service
      created_at: interaction.createdAt
    }));

    const summary = {
      total_interactions: interactions.length,
      types: interactions.reduce((acc: any, int) => {
        acc[int.type.toLowerCase()] = (acc[int.type.toLowerCase()] || 0) + 1;
        return acc;
      }, {}),
      last_interaction: interactions[0]?.createdAt
    };

    const response: ApiResponse = {
      success: true,
      data: {
        interactions: formattedInteractions,
        summary
      },
      message: 'Histórico de interações recuperado com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /customers/:id/interactions
   * Register new interaction with customer
   * Conforme docs/02-modules/crm.md:471-487
   */
  createInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
      type,
      subject,
      description,
      direction = 'outbound',
      status = 'completed',
      metadata = {}
    } = req.body;
    const companyId = req.user!.companyId;
    const createdBy = req.user!.userId;

    const interaction = await this.customerService.createInteraction(
      id,
      companyId,
      {
        type,
        subject,
        title: subject,
        description,
        direction,
        status,
        metadata
      },
      createdBy
    );

    const response: ApiResponse = {
      success: true,
      data: { interaction },
      message: 'Interação registrada com sucesso',
    };

    res.status(201).json(response);
  });

  /**
   * GET /crm/segments
   * Get customer segments list
   * Conforme docs/02-modules/crm.md:489-495
   */
  getSegments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;

    const segments = await this.customerService.getSegments(companyId);

    const response: ApiResponse = {
      success: true,
      data: { segments },
      message: 'Segmentos recuperados com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /crm/segments
   * Create new customer segment
   * Conforme docs/02-modules/crm.md:494-495
   */
  createSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const segmentData = req.body;
    const companyId = req.user!.companyId;

    const segment = await this.customerService.createSegment(
      segmentData,
      companyId
    );

    const response: ApiResponse = {
      success: true,
      data: { segment },
      message: 'Segmento criado com sucesso',
    };

    res.status(201).json(response);
  });

  /**
   * PUT /customers/:id/segments
   * Update customer segments
   * Conforme docs/02-modules/crm.md:497-498
   */
  updateCustomerSegments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { segments } = req.body;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const updatedSegments = await this.customerService.updateCustomerSegments(
      id,
      segments,
      companyId,
      userId
    );

    const response: ApiResponse = {
      success: true,
      data: { segments: updatedSegments },
      message: 'Segmentos do cliente atualizados com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:id/custom-fields
   * Get customer custom field values
   */
  getCustomerCustomFields = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const customFields = await this.customerService.getCustomerCustomFields(id, companyId);

    const response: ApiResponse = {
      success: true,
      data: { customFields },
      message: 'Campos customizados recuperados com sucesso',
    };

    res.json(response);
  });

  /**
   * PUT /customers/:id/custom-fields
   * Update customer custom field values
   */
  updateCustomerCustomFields = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { customFields } = req.body;
    const companyId = req.user!.companyId;
    const updatedBy = req.user!.userId;

    const updatedFields = await this.customerService.updateCustomerCustomFields(
      id,
      customFields,
      companyId,
      updatedBy
    );

    const response: ApiResponse = {
      success: true,
      data: { customFields: updatedFields },
      message: 'Campos customizados atualizados com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/stats
   * Get company customer statistics
   */
  getCustomerStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;

    const stats = await this.customerService.getCompanyStats(companyId);

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Estatísticas recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /customers/import
   * Import customers from CSV
   */
  importCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customers } = req.body;
    const companyId = req.user!.companyId;
    const importedBy = req.user!.userId;

    const result = await this.customerService.importCustomers(
      customers,
      companyId,
      importedBy
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Importação realizada com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/export
   * Export customers to CSV/Excel
   */
  exportCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { format = 'csv' } = req.query;
    const companyId = req.user!.companyId;

    const exportData = await this.customerService.exportCustomers(
      companyId,
      format as string
    );

    res.setHeader('Content-Type', format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=clientes.${format}`);
    res.send(exportData);
  });
}