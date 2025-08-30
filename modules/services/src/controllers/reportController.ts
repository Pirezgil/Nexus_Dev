import { Request, Response } from 'express';
import { reportService } from '../services/reportService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import { NotFoundError } from '../types';

export class ReportController {
  /**
   * Generate daily report
   */
  getDailyReport = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date parameter or use today
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        code: 'INVALID_DATE',
      });
    }

    const report = await reportService.generateDailyReport(companyId, date);

    logger.info('Daily report generated via API', {
      companyId,
      date: date.toISOString().split('T')[0],
      appointmentsCount: report.appointmentsCount,
      revenue: report.totalRevenue,
    });

    res.json({
      success: true,
      data: report,
      meta: {
        reportType: 'daily',
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Generate professional performance report
   */
  getProfessionalReport = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { professionalId } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date range
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start date format',
        code: 'INVALID_START_DATE',
      });
    }

    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid end date format',
        code: 'INVALID_END_DATE',
      });
    }

    if (startDate && endDate && startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date',
        code: 'INVALID_DATE_RANGE',
      });
    }

    const report = await reportService.generateProfessionalReport(
      professionalId,
      companyId,
      startDate,
      endDate
    );

    logger.info('Professional report generated via API', {
      professionalId,
      companyId,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      appointments: report.totalAppointments,
      revenue: report.totalRevenue,
    });

    res.json({
      success: true,
      data: report,
      meta: {
        reportType: 'professional',
        professionalId,
        dateRange: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Generate service analytics report
   */
  getServiceAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date range
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start date format',
        code: 'INVALID_START_DATE',
      });
    }

    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid end date format',
        code: 'INVALID_END_DATE',
      });
    }

    const report = await reportService.generateServiceAnalytics(companyId, startDate, endDate);

    logger.info('Service analytics report generated via API', {
      companyId,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      totalServices: report.totalServices,
      totalRevenue: report.totalRevenue,
    });

    res.json({
      success: true,
      data: report,
      meta: {
        reportType: 'service-analytics',
        dateRange: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Generate financial report
   */
  getFinancialReport = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse date range
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start date format',
        code: 'INVALID_START_DATE',
      });
    }

    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid end date format',
        code: 'INVALID_END_DATE',
      });
    }

    const report = await reportService.generateFinancialReport(companyId, startDate, endDate);

    logger.info('Financial report generated via API', {
      companyId,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      totalRevenue: report.totalRevenue,
      paidRevenue: report.paidRevenue,
    });

    res.json({
      success: true,
      data: report,
      meta: {
        reportType: 'financial',
        dateRange: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get weekly summary report
   */
  getWeeklySummary = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Calculate current week dates
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
    weekEnd.setHours(23, 59, 59, 999);

    // Generate reports for the week
    const [serviceAnalytics, financialReport] = await Promise.all([
      reportService.generateServiceAnalytics(companyId, weekStart, weekEnd),
      reportService.generateFinancialReport(companyId, weekStart, weekEnd),
    ]);

    const summary = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      overview: {
        totalRevenue: financialReport.totalRevenue,
        paidRevenue: financialReport.paidRevenue,
        pendingRevenue: financialReport.pendingRevenue,
        totalAppointments: serviceAnalytics.totalAppointments,
        averageTicket: financialReport.averageTicket,
      },
      topServices: serviceAnalytics.servicePerformance.slice(0, 5),
      topPerformers: financialReport.topPerformers.slice(0, 5),
      paymentMethods: financialReport.paymentMethodBreakdown,
      dailyTrend: financialReport.revenueByPeriod,
    };

    res.json({
      success: true,
      data: summary,
      meta: {
        reportType: 'weekly-summary',
        weekNumber: this.getWeekNumber(now),
        year: now.getFullYear(),
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get monthly summary report
   */
  getMonthlySummary = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Parse month and year or use current
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month must be between 1 and 12',
        code: 'INVALID_MONTH',
      });
    }

    // Calculate month start and end
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Generate reports for the month
    const [serviceAnalytics, financialReport] = await Promise.all([
      reportService.generateServiceAnalytics(companyId, monthStart, monthEnd),
      reportService.generateFinancialReport(companyId, monthStart, monthEnd),
    ]);

    const summary = {
      year,
      month,
      monthName: monthStart.toLocaleString('default', { month: 'long' }),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      overview: {
        totalRevenue: financialReport.totalRevenue,
        paidRevenue: financialReport.paidRevenue,
        pendingRevenue: financialReport.pendingRevenue,
        refundedAmount: financialReport.refundedAmount,
        totalAppointments: serviceAnalytics.totalAppointments,
        averageTicket: financialReport.averageTicket,
        activeServices: serviceAnalytics.activeServices,
      },
      servicePerformance: serviceAnalytics.servicePerformance,
      categoryBreakdown: serviceAnalytics.categoryBreakdown,
      topPerformers: financialReport.topPerformers,
      paymentMethods: financialReport.paymentMethodBreakdown,
      weeklyTrend: financialReport.revenueByPeriod,
    };

    logger.info('Monthly summary report generated via API', {
      companyId,
      year,
      month,
      totalRevenue: summary.overview.totalRevenue,
    });

    res.json({
      success: true,
      data: summary,
      meta: {
        reportType: 'monthly-summary',
        month,
        year,
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const today = new Date();
    
    // Get today's report
    const dailyReport = await reportService.generateDailyReport(companyId, today);

    // Get current month metrics
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const [monthlyService, monthlyFinancial] = await Promise.all([
      reportService.generateServiceAnalytics(companyId, monthStart, monthEnd),
      reportService.generateFinancialReport(companyId, monthStart, monthEnd),
    ]);

    const dashboardMetrics = {
      today: {
        appointments: dailyReport.appointmentsCount,
        completedAppointments: dailyReport.completedAppointments,
        revenue: dailyReport.totalRevenue,
        averageTicket: dailyReport.averageTicket,
      },
      thisMonth: {
        totalAppointments: monthlyService.totalAppointments,
        totalRevenue: monthlyFinancial.totalRevenue,
        paidRevenue: monthlyFinancial.paidRevenue,
        pendingRevenue: monthlyFinancial.pendingRevenue,
        averageTicket: monthlyFinancial.averageTicket,
        activeServices: monthlyService.activeServices,
      },
      topServices: dailyReport.topServices.slice(0, 3),
      topProfessionals: dailyReport.professionalPerformance.slice(0, 3),
      recentTrend: monthlyFinancial.revenueByPeriod.slice(-7), // Last 7 periods
    };

    res.json({
      success: true,
      data: dashboardMetrics,
      meta: {
        reportType: 'dashboard-metrics',
        date: today.toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Export report data
   */
  exportReport = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req;
    const { reportType } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const format = req.query.format as string || 'json';
    const validFormats = ['json', 'csv'];

    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
        code: 'INVALID_FORMAT',
      });
    }

    let reportData: any;
    let filename: string;

    switch (reportType) {
      case 'daily':
        const date = req.query.date ? new Date(req.query.date as string) : new Date();
        reportData = await reportService.generateDailyReport(companyId, date);
        filename = `daily-report-${date.toISOString().split('T')[0]}`;
        break;

      case 'service-analytics':
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        reportData = await reportService.generateServiceAnalytics(companyId, startDate, endDate);
        filename = `service-analytics-${startDate?.toISOString().split('T')[0] || 'recent'}`;
        break;

      case 'financial':
        const finStartDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const finEndDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        reportData = await reportService.generateFinancialReport(companyId, finStartDate, finEndDate);
        filename = `financial-report-${finStartDate?.toISOString().split('T')[0] || 'recent'}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type',
          code: 'INVALID_REPORT_TYPE',
        });
    }

    if (format === 'csv') {
      // This is a simplified CSV export - in a real implementation, 
      // you'd want to flatten the data appropriately
      const csvContent = this.convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({
        success: true,
        data: reportData,
        meta: {
          reportType,
          format,
          exportedAt: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * Helper method to get week number
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Helper method to convert report data to CSV
   */
  private convertToCSV(data: any): string {
    // This is a basic CSV conversion - you'd want to implement proper CSV formatting
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return 'Error converting data to CSV format';
    }
  }
}

export const reportController = new ReportController();