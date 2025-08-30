import { Request, Response } from 'express';
import { StatsService } from '../services/statsService';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/error';
import { logger } from '../utils/logger';

export class StatsController {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService();
  }

  /**
   * GET /stats
   * Get comprehensive customer statistics for the company
   */
  getCustomerStatistics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;

    const statistics = await this.statsService.getCustomerStatistics(companyId);

    const response: ApiResponse = {
      success: true,
      data: statistics,
      message: 'Estatísticas recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /stats/performance
   * Get performance metrics for a specific time period
   */
  getPerformanceMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const start = startDate 
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const end = endDate 
      ? new Date(endDate as string)
      : new Date();

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const response: ApiResponse = {
        success: false,
        error: 'ValidationError',
        message: 'Datas inválidas fornecidas',
      };
      res.status(400).json(response);
      return;
    }

    if (start >= end) {
      const response: ApiResponse = {
        success: false,
        error: 'ValidationError',
        message: 'Data de início deve ser anterior à data de fim',
      };
      res.status(400).json(response);
      return;
    }

    const metrics = await this.statsService.getPerformanceMetrics(companyId, start, end);

    const response: ApiResponse = {
      success: true,
      data: metrics,
      message: 'Métricas de performance recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /stats/customers/:customerId/activity
   * Get customer activity summary
   */
  getCustomerActivitySummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const companyId = req.user!.companyId;

    const summary = await this.statsService.getCustomerActivitySummary(customerId, companyId);

    if (!summary) {
      const response: ApiResponse = {
        success: false,
        error: 'NotFoundError',
        message: 'Cliente não encontrado',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: summary,
      message: 'Resumo de atividades do cliente recuperado com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /stats/daily-activity
   * Get daily activity metrics for dashboard
   */
  getDailyActivityMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;
    const { days = '7' } = req.query;

    const daysNumber = parseInt(days as string, 10);

    // Validate days parameter
    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 90) {
      const response: ApiResponse = {
        success: false,
        error: 'ValidationError',
        message: 'Número de dias deve ser entre 1 e 90',
      };
      res.status(400).json(response);
      return;
    }

    const metrics = await this.statsService.getDailyActivityMetrics(companyId, daysNumber);

    const response: ApiResponse = {
      success: true,
      data: metrics,
      message: 'Métricas de atividade diária recuperadas com sucesso',
    };

    res.json(response);
  });

  /**
   * POST /stats/refresh
   * Invalidate statistics cache and force refresh
   */
  refreshStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    // Invalidate cache
    await this.statsService.invalidateStatsCache(companyId);

    // Generate new statistics
    const statistics = await this.statsService.getCustomerStatistics(companyId);

    logger.info('Statistics cache refreshed', { companyId, userId });

    const response: ApiResponse = {
      success: true,
      data: statistics,
      message: 'Estatísticas atualizadas com sucesso',
    };

    res.json(response);
  });

  /**
   * GET /stats/dashboard
   * Get dashboard summary statistics
   */
  getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = req.user!.companyId;

    // Get basic statistics and daily metrics in parallel
    const [statistics, dailyMetrics] = await Promise.all([
      this.statsService.getCustomerStatistics(companyId),
      this.statsService.getDailyActivityMetrics(companyId, 7),
    ]);

    // Extract key metrics for dashboard
    const dashboardData = {
      overview: {
        totalCustomers: statistics.totalCustomers,
        activeCustomers: statistics.activeCustomers,
        prospectCustomers: statistics.prospectCustomers,
        totalInteractions: statistics.totalInteractions,
        totalNotes: statistics.totalNotes,
        averageInteractionsPerCustomer: statistics.averageInteractionsPerCustomer,
      },
      distribution: {
        customersByStatus: statistics.customersByStatus,
        interactionsByType: statistics.interactionsByType,
      },
      topTags: statistics.topTags.slice(0, 5), // Top 5 tags
      growth: statistics.customersGrowth.slice(-6), // Last 6 months
      recentActivity: dailyMetrics,
    };

    const response: ApiResponse = {
      success: true,
      data: dashboardData,
      message: 'Dados do dashboard recuperados com sucesso',
    };

    res.json(response);
  });
}