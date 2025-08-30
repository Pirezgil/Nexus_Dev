import { Request, Response } from 'express';
import { SegmentService } from '../services/segmentService';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

/**
 * SegmentController
 * 
 * Gerencia segmentação de clientes conforme especificação
 * docs/02-modules/crm.md (linhas 164-186)
 * 
 * Permite segmentação avançada de clientes:
 * - Segmentos manuais (VIP, Inadimplente, etc.)
 * - Segmentos automáticos (por critérios)
 * - Cores para UI
 * - Analytics por segmento
 */
export class SegmentController {
  private segmentService: SegmentService;

  constructor() {
    this.segmentService = new SegmentService();
  }

  /**
   * GET /crm/segments
   * Lista todos os segmentos da empresa
   * Conforme docs/02-modules/crm.md:489-495
   */
  getSegments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { include_stats = 'false' } = req.query;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const segments = await this.segmentService.getSegments(
      companyId,
      include_stats === 'true'
    );

    const response: ApiResponse = {
      success: true,
      data: { segments },
      message: 'Segmentos recuperados com sucesso'
    };

    res.json(response);
  });

  /**
   * GET /crm/segments/:id
   * Busca um segmento específico com detalhes
   */
  getSegmentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { include_customers = 'false' } = req.query;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const segment = await this.segmentService.getSegmentById(
      id,
      companyId,
      include_customers === 'true'
    );

    if (!segment) {
      const response: ApiResponse = {
        success: false,
        error: 'SEGMENT_NOT_FOUND',
        message: 'Segmento não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: { segment },
      message: 'Segmento encontrado com sucesso'
    };

    res.json(response);
  });

  /**
   * POST /crm/segments
   * Cria novo segmento de clientes
   * Conforme docs/02-modules/crm.md:494-495
   * 
   * Body example:
   * {
   *   "name": "Clientes VIP",
   *   "description": "Clientes com alto valor",
   *   "color": "#ff6b6b",
   *   "criteria": {
   *     "total_spent": { "gte": 1000 },
   *     "total_visits": { "gte": 5 }
   *   },
   *   "is_auto": true
   * }
   */
  createSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const {
      name,
      description,
      color,
      criteria,
      is_auto = false
    } = req.body;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    // Validações
    if (!name || name.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'MISSING_SEGMENT_NAME',
        message: 'Nome do segmento é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    // Validar cor se fornecida
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      const response: ApiResponse = {
        success: false,
        error: 'INVALID_COLOR_FORMAT',
        message: 'Cor deve estar no formato hexadecimal (#RRGGBB)'
      };
      res.status(400).json(response);
      return;
    }

    // Validar critérios se for segmento automático
    if (is_auto && (!criteria || typeof criteria !== 'object')) {
      const response: ApiResponse = {
        success: false,
        error: 'MISSING_AUTO_CRITERIA',
        message: 'Segmentos automáticos precisam de critérios definidos'
      };
      res.status(400).json(response);
      return;
    }

    try {
      const segment = await this.segmentService.createSegment({
        companyId,
        name: name.trim(),
        description: description?.trim(),
        color: color || null,
        criteria: criteria || null,
        isAuto: Boolean(is_auto)
      });

      logger.info(`[SEGMENTS] Segmento criado: ${name} (${is_auto ? 'automático' : 'manual'}) para empresa ${companyId}`);

      const response: ApiResponse = {
        success: true,
        data: { segment },
        message: 'Segmento criado com sucesso'
      };

      res.status(201).json(response);

    } catch (error: any) {
      if (error.message.includes('já existe')) {
        const response: ApiResponse = {
          success: false,
          error: 'DUPLICATE_SEGMENT_NAME',
          message: 'Já existe um segmento com este nome'
        };
        res.status(409).json(response);
        return;
      }

      logger.error('[SEGMENTS] Erro ao criar segmento:', error);
      throw error;
    }
  });

  /**
   * PUT /crm/segments/:id
   * Atualiza segmento existente
   */
  updateSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const updateData = req.body;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    // Validar cor se fornecida
    if (updateData.color && !/^#[0-9A-Fa-f]{6}$/.test(updateData.color)) {
      const response: ApiResponse = {
        success: false,
        error: 'INVALID_COLOR_FORMAT',
        message: 'Cor deve estar no formato hexadecimal (#RRGGBB)'
      };
      res.status(400).json(response);
      return;
    }

    try {
      const segment = await this.segmentService.updateSegment(
        id,
        companyId,
        updateData
      );

      if (!segment) {
        const response: ApiResponse = {
          success: false,
          error: 'SEGMENT_NOT_FOUND',
          message: 'Segmento não encontrado'
        };
        res.status(404).json(response);
        return;
      }

      logger.info(`[SEGMENTS] Segmento atualizado: ${id} para empresa ${companyId}`);

      const response: ApiResponse = {
        success: true,
        data: { segment },
        message: 'Segmento atualizado com sucesso'
      };

      res.json(response);

    } catch (error: any) {
      if (error.message.includes('já existe')) {
        const response: ApiResponse = {
          success: false,
          error: 'DUPLICATE_SEGMENT_NAME',
          message: 'Já existe um segmento com este nome'
        };
        res.status(409).json(response);
        return;
      }

      logger.error('[SEGMENTS] Erro ao atualizar segmento:', error);
      throw error;
    }
  });

  /**
   * DELETE /crm/segments/:id
   * Remove segmento e suas associações
   */
  deleteSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const deleted = await this.segmentService.deleteSegment(id, companyId);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: 'SEGMENT_NOT_FOUND',
        message: 'Segmento não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    logger.info(`[SEGMENTS] Segmento removido: ${id} da empresa ${companyId}`);

    const response: ApiResponse = {
      success: true,
      message: 'Segmento removido com sucesso'
    };

    res.json(response);
  });

  /**
   * GET /crm/segments/:id/customers
   * Lista clientes de um segmento específico
   */
  getSegmentCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { page = '1', limit = '20' } = req.query;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const result = await this.segmentService.getSegmentCustomers(
      id,
      companyId,
      {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      }
    );

    if (!result) {
      const response: ApiResponse = {
        success: false,
        error: 'SEGMENT_NOT_FOUND',
        message: 'Segmento não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Clientes do segmento recuperados com sucesso'
    };

    res.json(response);
  });

  /**
   * PUT /customers/:customerId/segments
   * Atualiza segmentos de um cliente
   * Conforme docs/02-modules/crm.md:497-498
   */
  updateCustomerSegments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { segment_ids } = req.body;
    const userId = req.user?.userId;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    if (!segment_ids || !Array.isArray(segment_ids)) {
      const response: ApiResponse = {
        success: false,
        error: 'INVALID_SEGMENT_IDS',
        message: 'segment_ids deve ser um array'
      };
      res.status(400).json(response);
      return;
    }

    try {
      const result = await this.segmentService.updateCustomerSegments(
        customerId,
        segment_ids,
        companyId,
        userId || 'system'
      );

      if (!result) {
        const response: ApiResponse = {
          success: false,
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado'
        };
        res.status(404).json(response);
        return;
      }

      logger.info(`[SEGMENTS] Segmentos do cliente ${customerId} atualizados para empresa ${companyId}`);

      const response: ApiResponse = {
        success: true,
        data: { 
          customer_id: customerId,
          segments: result.segments 
        },
        message: 'Segmentos do cliente atualizados com sucesso'
      };

      res.json(response);

    } catch (error) {
      logger.error('[SEGMENTS] Erro ao atualizar segmentos do cliente:', error);
      throw error;
    }
  });

  /**
   * POST /crm/segments/:id/refresh
   * Executa critérios automáticos do segmento (recalcula membros)
   */
  refreshAutoSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const result = await this.segmentService.refreshAutoSegment(id, companyId);

    if (!result) {
      const response: ApiResponse = {
        success: false,
        error: 'SEGMENT_NOT_FOUND_OR_NOT_AUTO',
        message: 'Segmento não encontrado ou não é automático'
      };
      res.status(404).json(response);
      return;
    }

    logger.info(`[SEGMENTS] Segmento automático atualizado: ${id}, ${result.customersAdded} adicionados, ${result.customersRemoved} removidos`);

    const response: ApiResponse = {
      success: true,
      data: {
        segment_id: id,
        customers_added: result.customersAdded,
        customers_removed: result.customersRemoved,
        total_customers: result.totalCustomers
      },
      message: 'Segmento automático atualizado com sucesso'
    };

    res.json(response);
  });

  /**
   * GET /crm/segments/analytics
   * Analytics de segmentação da empresa
   */
  getSegmentAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const analytics = await this.segmentService.getSegmentAnalytics(companyId);

    const response: ApiResponse = {
      success: true,
      data: analytics,
      message: 'Analytics de segmentação recuperadas com sucesso'
    };

    res.json(response);
  });
}