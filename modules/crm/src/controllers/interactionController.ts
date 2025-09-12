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
   * Helper function to safely get authentication data from request
   * Follows the same pattern as CustomerController for consistency
   */
  private getAuthData(req: Request) {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const userId = req.user?.userId || req.headers['x-user-id'] as string;
    
    if (!companyId || !userId) {
      throw new Error('Authentication required: companyId and userId not found');
    }
    
    return { companyId, userId };
  }

  /**
   * GET /customers/:customerId/interactions
   * Get paginated interactions for a customer
   */
  getInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { companyId, userId } = this.getAuthData(req);
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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/:interactionId
   * Get interaction by ID
   */
  getInteractionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { interactionId } = req.params;
      const { companyId } = this.getAuthData(req);

      const interaction = await this.interactionService.getInteractionById(interactionId, companyId);

      const response: ApiResponse = {
        success: true,
        data: interaction,
        message: 'Interação encontrada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * POST /customers/:customerId/interactions
   * Create new interaction for customer
   */
  createInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const data = req.body as CreateInteractionInput;
      const { companyId, userId: createdBy } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * PUT /customers/:customerId/interactions/:interactionId
   * Update interaction
   */
  updateInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { interactionId } = req.params;
      const data = req.body as UpdateInteractionInput;
      const { companyId, userId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * DELETE /customers/:customerId/interactions/:interactionId
   * Delete interaction
   */
  deleteInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { interactionId } = req.params;
      const { companyId, userId } = this.getAuthData(req);

      await this.interactionService.deleteInteraction(interactionId, companyId, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Interação deletada com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/type/:type
   * Get interactions by type for a customer
   */
  getInteractionsByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, type } = req.params;
      const { limit = '20' } = req.query;
      const { companyId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/upcoming
   * Get upcoming interactions for a customer
   */
  getUpcomingInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { limit = '10' } = req.query;
      const { companyId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/overdue
   * Get overdue interactions for a customer
   */
  getOverdueInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { limit = '10' } = req.query;
      const { companyId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * PATCH /customers/:customerId/interactions/:interactionId/complete
   * Mark interaction as completed
   */
  markAsCompleted = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { interactionId } = req.params;
      const { completedAt } = req.body;
      const { companyId, userId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/stats
   * Get interaction statistics for a customer
   */
  getInteractionStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { companyId } = this.getAuthData(req);

      const stats = await this.interactionService.getInteractionStats(customerId, companyId);

      const response: ApiResponse = {
        success: true,
        data: stats,
        message: 'Estatísticas de interações recuperadas com sucesso',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });

  /**
   * GET /customers/:customerId/interactions/search
   * Search interactions by title or description
   */
  searchInteractions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { q: searchTerm, limit = '10' } = req.query;
      const { companyId } = this.getAuthData(req);

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
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication required',
      };
      res.status(401).json(response);
    }
  });
}