import { Request, Response } from 'express';
import { CustomFieldService } from '../services/customFieldService';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

/**
 * CustomFieldController
 * 
 * Gerencia campos customizados por empresa conforme especificação
 * docs/02-modules/crm.md (linhas 114-186)
 * 
 * Permite que cada empresa defina campos específicos para seus clientes:
 * - Tipo de pele, alergias, preferências, etc.
 * - Suporte a diferentes tipos: text, number, date, select, boolean
 * - Validação e ordenação
 */
export class CustomFieldController {
  private customFieldService: CustomFieldService;

  constructor() {
    this.customFieldService = new CustomFieldService();
  }

  /**
   * GET /crm/custom-fields
   * Lista todos os campos customizados da empresa
   */
  getCustomFields = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { active_only = 'true' } = req.query;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    const customFields = await this.customFieldService.getCustomFields(
      companyId,
      active_only === 'true'
    );

    const response: ApiResponse = {
      success: true,
      data: { custom_fields: customFields },
      message: 'Campos customizados recuperados com sucesso'
    };

    res.json(response);
  });

  /**
   * GET /crm/custom-fields/:id
   * Busca um campo customizado específico
   */
  getCustomFieldById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const customField = await this.customFieldService.getCustomFieldById(id, companyId);

    if (!customField) {
      const response: ApiResponse = {
        success: false,
        error: 'CUSTOM_FIELD_NOT_FOUND',
        message: 'Campo customizado não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: { custom_field: customField },
      message: 'Campo customizado encontrado com sucesso'
    };

    res.json(response);
  });

  /**
   * POST /crm/custom-fields
   * Cria novo campo customizado
   * 
   * Body example:
   * {
   *   "name": "Tipo de Pele",
   *   "field_type": "select",
   *   "options": ["Oleosa", "Seca", "Mista"],
   *   "required": false,
   *   "display_order": 1
   * }
   */
  createCustomField = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const {
      name,
      field_type,
      options,
      required = false,
      display_order = 0
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
    if (!name || !field_type) {
      const response: ApiResponse = {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Nome e tipo do campo são obrigatórios'
      };
      res.status(400).json(response);
      return;
    }

    const validTypes = ['text', 'number', 'date', 'select', 'boolean'];
    if (!validTypes.includes(field_type)) {
      const response: ApiResponse = {
        success: false,
        error: 'INVALID_FIELD_TYPE',
        message: 'Tipo de campo inválido. Tipos válidos: ' + validTypes.join(', ')
      };
      res.status(400).json(response);
      return;
    }

    // Para tipo select, options são obrigatórias
    if (field_type === 'select' && (!options || !Array.isArray(options) || options.length === 0)) {
      const response: ApiResponse = {
        success: false,
        error: 'MISSING_SELECT_OPTIONS',
        message: 'Para campos do tipo select, as opções são obrigatórias'
      };
      res.status(400).json(response);
      return;
    }

    try {
      const customField = await this.customFieldService.createCustomField({
        companyId,
        name: name.trim(),
        fieldType: field_type,
        options: options || null,
        required: Boolean(required),
        displayOrder: Number(display_order)
      });

      logger.info(`[CUSTOM_FIELDS] Campo customizado criado: ${name} (${field_type}) para empresa ${companyId}`);

      const response: ApiResponse = {
        success: true,
        data: { custom_field: customField },
        message: 'Campo customizado criado com sucesso'
      };

      res.status(201).json(response);

    } catch (error: any) {
      if (error.message.includes('já existe')) {
        const response: ApiResponse = {
          success: false,
          error: 'DUPLICATE_FIELD_NAME',
          message: 'Já existe um campo com este nome'
        };
        res.status(409).json(response);
        return;
      }

      logger.error('[CUSTOM_FIELDS] Erro ao criar campo customizado:', error);
      throw error;
    }
  });

  /**
   * PUT /crm/custom-fields/:id
   * Atualiza campo customizado existente
   */
  updateCustomField = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    // Validar field_type se fornecido
    if (updateData.field_type) {
      const validTypes = ['text', 'number', 'date', 'select', 'boolean'];
      if (!validTypes.includes(updateData.field_type)) {
        const response: ApiResponse = {
          success: false,
          error: 'INVALID_FIELD_TYPE',
          message: 'Tipo de campo inválido. Tipos válidos: ' + validTypes.join(', ')
        };
        res.status(400).json(response);
        return;
      }
    }

    try {
      const customField = await this.customFieldService.updateCustomField(
        id,
        companyId,
        updateData
      );

      if (!customField) {
        const response: ApiResponse = {
          success: false,
          error: 'CUSTOM_FIELD_NOT_FOUND',
          message: 'Campo customizado não encontrado'
        };
        res.status(404).json(response);
        return;
      }

      logger.info(`[CUSTOM_FIELDS] Campo customizado atualizado: ${id} para empresa ${companyId}`);

      const response: ApiResponse = {
        success: true,
        data: { custom_field: customField },
        message: 'Campo customizado atualizado com sucesso'
      };

      res.json(response);

    } catch (error: any) {
      if (error.message.includes('já existe')) {
        const response: ApiResponse = {
          success: false,
          error: 'DUPLICATE_FIELD_NAME',
          message: 'Já existe um campo com este nome'
        };
        res.status(409).json(response);
        return;
      }

      logger.error('[CUSTOM_FIELDS] Erro ao atualizar campo customizado:', error);
      throw error;
    }
  });

  /**
   * DELETE /crm/custom-fields/:id
   * Remove campo customizado (soft delete - marca como inativo)
   */
  deleteCustomField = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const deleted = await this.customFieldService.deleteCustomField(id, companyId);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: 'CUSTOM_FIELD_NOT_FOUND',
        message: 'Campo customizado não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    logger.info(`[CUSTOM_FIELDS] Campo customizado removido: ${id} da empresa ${companyId}`);

    const response: ApiResponse = {
      success: true,
      message: 'Campo customizado removido com sucesso'
    };

    res.json(response);
  });

  /**
   * POST /crm/custom-fields/reorder
   * Reordena campos customizados (atualiza display_order)
   * 
   * Body: {
   *   "field_orders": [
   *     {"id": "field-1", "display_order": 1},
   *     {"id": "field-2", "display_order": 2}
   *   ]
   * }
   */
  reorderCustomFields = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { field_orders } = req.body;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    if (!field_orders || !Array.isArray(field_orders)) {
      const response: ApiResponse = {
        success: false,
        error: 'INVALID_FIELD_ORDERS',
        message: 'field_orders deve ser um array'
      };
      res.status(400).json(response);
      return;
    }

    await this.customFieldService.reorderCustomFields(companyId, field_orders);

    logger.info(`[CUSTOM_FIELDS] Campos reordenados para empresa ${companyId}`);

    const response: ApiResponse = {
      success: true,
      message: 'Campos reordenados com sucesso'
    };

    res.json(response);
  });
}