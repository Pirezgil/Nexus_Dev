import { Request, Response } from 'express';
import { InteractionService } from '../services/interactionService';
import { 
  CreateInteractionInput, 
  UpdateInteractionInput,
  InteractionFilters,
  PaginationInput,
  ApiResponse 
} from '../types';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';

export class InteractionController {
  private interactionService: InteractionService;

  constructor() {
    this.interactionService = new InteractionService();
  }

  /**
   * GET /customers/:customerId/interactions
   * Get paginated interactions for a customer
   */
  getInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const filters = req.query as unknown as InteractionFilters;
    const pagination = req.query as unknown as PaginationInput;

    const result = await this.interactionService.getInteractions(
      customerId,
      companyId,
      filters,
      pagination,
      userId
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Interações recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/:interactionId
   * Get interaction by ID
   */
  getInteractionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { interactionId } = req.params;
    const companyId = req.user!.companyId;

    const interaction = await this.interactionService.getInteractionById(interactionId, companyId);

    const response: ApiResponse = {
      success: true,
      data: interaction,
      message: 'Interação encontrada com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /customers/:customerId/interactions
   * Create new interaction for customer
   */
  createInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const data = req.body as CreateInteractionInput;
    const companyId = req.user!.companyId;
    const createdBy = req.user!.userId;

    const interaction = await this.interactionService.createInteraction(
      customerId,
      data,
      companyId,
      createdBy
    );

    const response: ApiResponse = {
      success: true,
      data: interaction,
      message: 'Interação criada com sucesso',
    };

    res.status(201).json(response);
  });

  /**
   * PUT /customers/:customerId/interactions/:interactionId
   * Update interaction
   */
  updateInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { interactionId } = req.params;
    const data = req.body as UpdateInteractionInput;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const interaction = await this.interactionService.updateInteraction(
      interactionId,
      data,
      companyId,
      userId
    );

    const response: ApiResponse = {
      success: true,
      data: interaction,
      message: 'Interação atualizada com sucesso',
    };

    res.json(response);
  });

  /**
   * DELETE /customers/:customerId/interactions/:interactionId
   * Delete interaction
   */
  deleteInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { interactionId } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    await this.interactionService.deleteInteraction(interactionId, companyId, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Interação deletada com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/type/:type
   * Get interactions by type for a customer
   */
  getInteractionsByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId, type } = req.params;
    const { limit = '20' } = req.query;
    const companyId = req.user!.companyId;

    const interactions = await this.interactionService.getInteractionsByType(
      customerId,
      type,
      companyId,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: interactions,
      message: `Interações do tipo ${type} recuperadas com sucesso`,
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/upcoming
   * Get upcoming interactions for a customer
   */
  getUpcomingInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const { limit = '10' } = req.query;
    const companyId = req.user!.companyId;

    const interactions = await this.interactionService.getUpcomingInteractions(
      customerId,
      companyId,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: interactions,
      message: 'Próximas interações recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/overdue
   * Get overdue interactions for a customer
   */
  getOverdueInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const { limit = '10' } = req.query;
    const companyId = req.user!.companyId;

    const interactions = await this.interactionService.getOverdueInteractions(
      customerId,
      companyId,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: interactions,
      message: 'Interações em atraso recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * PATCH /customers/:customerId/interactions/:interactionId/complete
   * Mark interaction as completed
   */
  markAsCompleted = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { interactionId } = req.params;
    const { completedAt } = req.body;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const completedDate = completedAt ? new Date(completedAt) : new Date();

    const interaction = await this.interactionService.markAsCompleted(
      interactionId,
      companyId,
      userId,
      completedDate
    );

    const response: ApiResponse = {
      success: true,
      data: interaction,
      message: 'Interação marcada como concluída',
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/stats
   * Get interaction statistics for a customer
   */
  getInteractionStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const companyId = req.user!.companyId;

    const stats = await this.interactionService.getInteractionStats(customerId, companyId);

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Estatísticas de interações recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /customers/:customerId/interactions/search
   * Search interactions by title or description
   */
  searchInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
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

    const interactions = await this.interactionService.searchInteractions(
      customerId,
      searchTerm,
      companyId,
      parseInt(limit as string, 10)
    );

    const response: ApiResponse = {
      success: true,
      data: interactions,
      message: 'Busca de interações realizada com sucesso',
    };

    res.json(response);
  });
}