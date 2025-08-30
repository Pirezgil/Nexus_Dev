import { Request, Response } from 'express';
import { CustomerService } from '../services/customerService';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';
import { ApiResponse, VisitUpdateData } from '../types';

/**
 * IntegrationController
 * 
 * CRÍTICO: Controller para APIs internas usadas por outros módulos
 * - Services: precisa atualizar dados de visita e buscar clientes
 * - Agendamento: precisa buscar dados básicos dos clientes
 * 
 * TODAS as rotas aqui são [INTERNAL] - não expostas publicamente
 */
export class IntegrationController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  /**
   * GET /crm/customers/:id/basic [INTERNAL]
   * 
   * CRÍTICO para Agendamento: busca dados básicos do cliente
   * Usado para autocomplete e exibição básica durante agendamento
   * 
   * Response format conforme docs/02-modules/crm.md:502-514
   */
  getCustomerBasic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    
    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório para isolation'
      };
      res.status(400).json(response);
      return;
    }

    logger.info(`[INTEGRATION] Buscando dados básicos do cliente ${id} para empresa ${companyId}`);

    const customer = await this.customerService.getCustomerBasic(id, companyId);

    if (!customer) {
      const response: ApiResponse = {
        success: false,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Cliente não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    // Formato EXATO conforme especificação (linhas 507-513)
    res.json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      preferred_contact: customer.preferredContact || 'whatsapp'
    });
  });

  /**
   * POST /crm/customers/:id/visit [INTERNAL]
   * 
   * CRÍTICO para Services: atualiza dados quando atendimento é realizado
   * Atualiza: last_visit, total_visits, total_spent, average_ticket
   * 
   * Request format conforme docs/02-modules/crm.md:516-525
   */
  updateCustomerVisit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { visit_date, service_value }: VisitUpdateData = req.body;

    if (!companyId) {
      const response: ApiResponse = {
        success: false,
        error: 'COMPANY_ID_REQUIRED',
        message: 'Company ID é obrigatório para isolation'
      };
      res.status(400).json(response);
      return;
    }

    // Validação dos dados
    if (!visit_date || service_value === undefined) {
      const response: ApiResponse = {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'visit_date e service_value são obrigatórios'
      };
      res.status(400).json(response);
      return;
    }

    logger.info(`[INTEGRATION] Atualizando visita do cliente ${id}: date=${visit_date}, value=${service_value}`);

    try {
      await this.customerService.updateVisitData(id, companyId, {
        visit_date: new Date(visit_date),
        service_value: Number(service_value)
      });

      logger.info(`[INTEGRATION] Dados de visita atualizados com sucesso para cliente ${id}`);

      res.json({ success: true });

    } catch (error) {
      logger.error(`[INTEGRATION] Erro ao atualizar visita do cliente ${id}:`, error);
      
      const response: ApiResponse = {
        success: false,
        error: 'UPDATE_FAILED',
        message: 'Erro ao atualizar dados da visita'
      };
      res.status(500).json(response);
    }
  });

  /**
   * GET /crm/customers/search [INTERNAL]
   * 
   * Para Agendamento: busca rápida de clientes por nome/telefone
   * Usado em autocomplete durante criação de agendamentos
   */
  searchCustomersForScheduling = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q: searchTerm, limit = '10' } = req.query;
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

    if (!searchTerm || typeof searchTerm !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'SEARCH_TERM_REQUIRED',
        message: 'Termo de busca é obrigatório'
      };
      res.status(400).json(response);
      return;
    }

    logger.info(`[INTEGRATION] Busca de clientes para agendamento: "${searchTerm}"`);

    const customers = await this.customerService.searchCustomersBasic(
      companyId,
      searchTerm,
      parseInt(limit as string, 10)
    );

    // Retorna apenas dados básicos necessários para agendamento
    const basicData = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      preferred_contact: customer.preferredContact || 'whatsapp'
    }));

    res.json(basicData);
  });

  /**
   * POST /crm/customers/:id/interaction [INTERNAL]
   * 
   * Para Services: registra interação quando atendimento é realizado
   * Cria entrada no histórico do cliente
   */
  registerServiceInteraction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const companyId = req.user?.companyId || req.headers['x-company-id'] as string;
    const { 
      service_id, 
      service_name, 
      professional_name,
      description,
      duration_minutes,
      service_value,
      photos = []
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

    try {
      await this.customerService.registerServiceInteraction(id, companyId, {
        serviceId: service_id,
        serviceName: service_name || 'Atendimento',
        professionalName: professional_name,
        description: description || 'Atendimento realizado',
        durationMinutes: duration_minutes,
        serviceValue: service_value,
        photos: photos
      });

      logger.info(`[INTEGRATION] Interação de serviço registrada para cliente ${id}`);

      res.json({ success: true });

    } catch (error) {
      logger.error(`[INTEGRATION] Erro ao registrar interação de serviço:`, error);
      
      const response: ApiResponse = {
        success: false,
        error: 'INTERACTION_FAILED',
        message: 'Erro ao registrar interação'
      };
      res.status(500).json(response);
    }
  });

  /**
   * GET /crm/customers/:id/summary [INTERNAL]
   * 
   * Para Services: dados resumidos do cliente durante atendimento
   * Inclui histórico recente, preferências, etc.
   */
  getCustomerSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    logger.info(`[INTEGRATION] Buscando resumo do cliente ${id} para Services`);

    const summary = await this.customerService.getCustomerSummaryForService(id, companyId);

    if (!summary) {
      const response: ApiResponse = {
        success: false,
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Cliente não encontrado'
      };
      res.status(404).json(response);
      return;
    }

    res.json(summary);
  });

  /**
   * GET /crm/stats/company [INTERNAL]
   * 
   * Para Dashboard: estatísticas básicas dos clientes
   */
  getCompanyCustomerStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const stats = await this.customerService.getCompanyStats(companyId);

    res.json(stats);
  });
}