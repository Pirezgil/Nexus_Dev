import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { cacheService } from '../utils/redis';
import {
  DailyReport,
  ServicePerformance,
  ProfessionalPerformance,
  PaymentMethodStats,
} from '../types';

export class ReportService {
  private readonly cacheTTL = 600; // 10 minutes for reports

  /**
   * Generate daily report
   */
  async generateDailyReport(
    companyId: string,
    date: Date = new Date()
  ): Promise<DailyReport> {
    try {
      const cacheKey = `daily_report:${companyId}:${date.toISOString().split('T')[0]}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<DailyReport>(cacheKey);
      if (cached) {
        logger.debug('Daily report retrieved from cache', { companyId, date });
        return cached;
      }

      // Set date range for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };

      const [appointmentStats, serviceStats, professionalStats, paymentStats] = await Promise.all([
        // General appointment statistics
        this.getAppointmentStats(where),
        
        // Service performance
        this.getServicePerformance(where),
        
        // Professional performance
        this.getProfessionalPerformance(where),
        
        // Payment method statistics
        this.getPaymentMethodStats(where),
      ]);

      const report: DailyReport = {
        date,
        appointmentsCount: appointmentStats.total,
        completedAppointments: appointmentStats.completed,
        totalRevenue: appointmentStats.revenue,
        averageTicket: appointmentStats.averageTicket,
        topServices: serviceStats,
        professionalPerformance: professionalStats,
        paymentMethods: paymentStats,
      };

      // Cache the report
      await cacheService.setJSON(cacheKey, report, this.cacheTTL);

      logger.info('Daily report generated successfully', {
        companyId,
        date: date.toISOString().split('T')[0],
        appointmentsCount: report.appointmentsCount,
        revenue: report.totalRevenue,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate daily report', {
        companyId,
        date,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate professional performance report
   */
  async generateProfessionalReport(
    professionalId: string,
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    professional: { id: string; name: string; email: string; specialties: string[] };
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    totalRevenue: number;
    averageTicket: number;
    efficiency: number;
    topServices: ServicePerformance[];
    dailyPerformance: Array<{ date: string; appointments: number; revenue: number }>;
    paymentBreakdown: PaymentMethodStats[];
  }> {
    try {
      const cacheKey = `professional_report:${professionalId}:${startDate?.getTime()}-${endDate?.getTime()}`;
      
      // Try cache first
      const cached = await cacheService.getJSON(cacheKey);
      if (cached) {
        logger.debug('Professional report retrieved from cache', { professionalId });
        return cached;
      }

      // Get professional info
      const professional = await prisma.professional.findFirst({
        where: {
          id: professionalId,
          companyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          specialties: true,
        },
      });

      if (!professional) {
        throw new Error('Professional not found');
      }

      // Set default date range (last 30 days if not provided)
      if (!startDate || !endDate) {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }

      const where: Prisma.AppointmentCompletedWhereInput = {
        professionalId,
        companyId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      };

      const [appointmentStats, serviceStats, dailyStats, paymentStats] = await Promise.all([
        // General appointment statistics
        this.getAppointmentStats(where),
        
        // Service performance for this professional
        this.getServicePerformance(where),
        
        // Daily performance
        this.getDailyPerformance(where),
        
        // Payment method statistics
        this.getPaymentMethodStats(where),
      ]);

      const efficiency = appointmentStats.total > 0 
        ? (appointmentStats.completed / appointmentStats.total) * 100 
        : 0;

      const report = {
        professional,
        totalAppointments: appointmentStats.total,
        completedAppointments: appointmentStats.completed,
        cancelledAppointments: appointmentStats.cancelled,
        totalRevenue: appointmentStats.revenue,
        averageTicket: appointmentStats.averageTicket,
        efficiency,
        topServices: serviceStats,
        dailyPerformance: dailyStats,
        paymentBreakdown: paymentStats,
      };

      // Cache the report
      await cacheService.setJSON(cacheKey, report, this.cacheTTL);

      logger.info('Professional report generated successfully', {
        professionalId,
        companyId,
        startDate,
        endDate,
        appointments: report.totalAppointments,
        revenue: report.totalRevenue,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate professional report', {
        professionalId,
        companyId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate service analytics report
   */
  async generateServiceAnalytics(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalServices: number;
    activeServices: number;
    totalAppointments: number;
    totalRevenue: number;
    servicePerformance: Array<ServicePerformance & {
      conversionRate: number;
      averageDuration: number;
    }>;
    categoryBreakdown: Array<{ category: string; count: number; revenue: number }>;
    trendData: Array<{ date: string; appointments: number; revenue: number }>;
  }> {
    try {
      // Set default date range (last 30 days if not provided)
      if (!startDate || !endDate) {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }

      const [serviceCount, serviceStats, categoryStats, trendData] = await Promise.all([
        // Service counts
        prisma.service.groupBy({
          by: ['status'],
          where: { companyId },
          _count: { id: true },
        }),

        // Service performance with additional metrics
        prisma.appointmentCompleted.groupBy({
          by: ['serviceId'],
          where: {
            companyId,
            startTime: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
          },
          _count: { serviceId: true },
          _sum: { totalAmount: true },
          _avg: { actualDuration: true },
          orderBy: { _count: { serviceId: 'desc' } },
        }),

        // Category breakdown
        prisma.service.groupBy({
          by: ['category'],
          where: { companyId, status: 'ACTIVE' },
          _count: { id: true },
        }),

        // Trend data
        this.getDailyPerformance({
          companyId,
          startTime: { gte: startDate, lte: endDate },
        }),
      ]);

      // Get service names for performance data
      const serviceIds = serviceStats.map(s => s.serviceId);
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, category: true },
      });

      const serviceNameMap = services.reduce((map, service) => {
        map[service.id] = service;
        return map;
      }, {} as Record<string, { id: string; name: string; category: string | null }>);

      const totalServices = serviceCount.reduce((sum, item) => sum + item._count.id, 0);
      const activeServices = serviceCount
        .filter(item => item.status === 'ACTIVE')
        .reduce((sum, item) => sum + item._count.id, 0);

      const servicePerformance = serviceStats.map(stat => {
        const service = serviceNameMap[stat.serviceId];
        return {
          serviceId: stat.serviceId,
          serviceName: service?.name || 'Unknown Service',
          count: stat._count.serviceId,
          revenue: Number(stat._sum.totalAmount || 0),
          averageDuration: Number(stat._avg.actualDuration || 0),
          conversionRate: 100, // This would need additional data to calculate properly
        };
      });

      // Calculate category breakdown with revenue
      const categoryRevenue = await Promise.all(
        categoryStats.map(async (cat) => {
          const revenue = await prisma.appointmentCompleted.aggregate({
            where: {
              companyId,
              startTime: { gte: startDate, lte: endDate },
              status: 'COMPLETED',
              service: { category: cat.category },
            },
            _sum: { totalAmount: true },
          });

          return {
            category: cat.category || 'Uncategorized',
            count: cat._count.id,
            revenue: Number(revenue._sum.totalAmount || 0),
          };
        })
      );

      const totalAppointments = servicePerformance.reduce((sum, item) => sum + item.count, 0);
      const totalRevenue = servicePerformance.reduce((sum, item) => sum + item.revenue, 0);

      const report = {
        totalServices,
        activeServices,
        totalAppointments,
        totalRevenue,
        servicePerformance,
        categoryBreakdown: categoryRevenue,
        trendData,
      };

      logger.info('Service analytics report generated successfully', {
        companyId,
        startDate,
        endDate,
        totalServices,
        totalAppointments,
        totalRevenue,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate service analytics report', {
        companyId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    refundedAmount: number;
    averageTicket: number;
    paymentMethodBreakdown: PaymentMethodStats[];
    revenueByPeriod: Array<{ period: string; revenue: number; appointments: number }>;
    topPerformers: Array<{ type: 'service' | 'professional'; name: string; revenue: number }>;
  }> {
    try {
      // Set default date range (current month if not provided)
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const where: Prisma.AppointmentCompletedWhereInput = {
        companyId,
        startTime: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      };

      const [revenueStats, paymentStats, weeklyRevenue, topServices, topProfessionals] = await Promise.all([
        // Revenue by payment status
        prisma.appointmentCompleted.groupBy({
          by: ['paymentStatus'],
          where,
          _sum: { totalAmount: true },
          _count: { id: true },
        }),

        // Payment method breakdown
        this.getPaymentMethodStats(where),

        // Weekly revenue trend
        prisma.$queryRaw<Array<{ week: string; revenue: number; appointments: bigint }>>`
          SELECT 
            CONCAT(YEAR(start_time), '-W', LPAD(WEEK(start_time, 1), 2, '0')) as week,
            COALESCE(SUM(total_amount), 0) as revenue,
            COUNT(*) as appointments
          FROM appointments_completed 
          WHERE company_id = ${companyId}
            AND start_time >= ${startDate}
            AND start_time <= ${endDate}
            AND status = 'COMPLETED'
          GROUP BY week
          ORDER BY week
        `,

        // Top services by revenue
        prisma.appointmentCompleted.groupBy({
          by: ['serviceId'],
          where,
          _sum: { totalAmount: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 5,
        }),

        // Top professionals by revenue
        prisma.appointmentCompleted.groupBy({
          by: ['professionalId'],
          where,
          _sum: { totalAmount: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 5,
        }),
      ]);

      // Calculate totals
      const totalRevenue = revenueStats.reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);
      const paidRevenue = revenueStats
        .filter(item => item.paymentStatus === 'PAID')
        .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);
      const pendingRevenue = revenueStats
        .filter(item => item.paymentStatus === 'PENDING')
        .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);
      const refundedAmount = revenueStats
        .filter(item => item.paymentStatus === 'REFUNDED')
        .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);

      const totalAppointments = revenueStats.reduce((sum, item) => sum + item._count.id, 0);
      const averageTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

      // Get names for top performers
      const [serviceNames, professionalNames] = await Promise.all([
        prisma.service.findMany({
          where: { id: { in: topServices.map(s => s.serviceId) } },
          select: { id: true, name: true },
        }),
        prisma.professional.findMany({
          where: { id: { in: topProfessionals.map(p => p.professionalId) } },
          select: { id: true, name: true },
        }),
      ]);

      const serviceNameMap = serviceNames.reduce((map, service) => {
        map[service.id] = service.name;
        return map;
      }, {} as Record<string, string>);

      const professionalNameMap = professionalNames.reduce((map, professional) => {
        map[professional.id] = professional.name;
        return map;
      }, {} as Record<string, string>);

      const topPerformers = [
        ...topServices.map(service => ({
          type: 'service' as const,
          name: serviceNameMap[service.serviceId] || 'Unknown Service',
          revenue: Number(service._sum.totalAmount || 0),
        })),
        ...topProfessionals.map(professional => ({
          type: 'professional' as const,
          name: professionalNameMap[professional.professionalId] || 'Unknown Professional',
          revenue: Number(professional._sum.totalAmount || 0),
        })),
      ].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      const revenueByPeriod = weeklyRevenue.map(item => ({
        period: item.week,
        revenue: Number(item.revenue),
        appointments: Number(item.appointments),
      }));

      const report = {
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        refundedAmount,
        averageTicket,
        paymentMethodBreakdown: paymentStats,
        revenueByPeriod,
        topPerformers,
      };

      logger.info('Financial report generated successfully', {
        companyId,
        startDate,
        endDate,
        totalRevenue,
        totalAppointments,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate financial report', {
        companyId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  /**
   * Get appointment statistics
   */
  private async getAppointmentStats(where: Prisma.AppointmentCompletedWhereInput) {
    const stats = await prisma.appointmentCompleted.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const total = stats.reduce((sum, item) => sum + item._count.id, 0);
    const completed = stats
      .filter(item => item.status === 'COMPLETED')
      .reduce((sum, item) => sum + item._count.id, 0);
    const cancelled = stats
      .filter(item => item.status === 'CANCELLED')
      .reduce((sum, item) => sum + item._count.id, 0);
    const revenue = stats
      .filter(item => item.status === 'COMPLETED')
      .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);
    const averageTicket = completed > 0 ? revenue / completed : 0;

    return { total, completed, cancelled, revenue, averageTicket };
  }

  /**
   * Get service performance data
   */
  private async getServicePerformance(where: Prisma.AppointmentCompletedWhereInput): Promise<ServicePerformance[]> {
    const stats = await prisma.appointmentCompleted.groupBy({
      by: ['serviceId'],
      where: { ...where, status: 'COMPLETED' },
      _count: { serviceId: true },
      _sum: { totalAmount: true },
      _avg: { actualDuration: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 10,
    });

    // Get service names
    const serviceIds = stats.map(s => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });

    const serviceNameMap = services.reduce((map, service) => {
      map[service.id] = service.name;
      return map;
    }, {} as Record<string, string>);

    return stats.map(stat => ({
      serviceId: stat.serviceId,
      serviceName: serviceNameMap[stat.serviceId] || 'Unknown Service',
      count: stat._count.serviceId,
      revenue: Number(stat._sum.totalAmount || 0),
      averageDuration: Number(stat._avg.actualDuration || 0),
    }));
  }

  /**
   * Get professional performance data
   */
  private async getProfessionalPerformance(where: Prisma.AppointmentCompletedWhereInput): Promise<ProfessionalPerformance[]> {
    const stats = await prisma.appointmentCompleted.groupBy({
      by: ['professionalId'],
      where: { ...where, status: 'COMPLETED' },
      _count: { professionalId: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { professionalId: 'desc' } },
      take: 10,
    });

    // Get professional names
    const professionalIds = stats.map(s => s.professionalId);
    const professionals = await prisma.professional.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, name: true },
    });

    const professionalNameMap = professionals.reduce((map, professional) => {
      map[professional.id] = professional.name;
      return map;
    }, {} as Record<string, string>);

    return stats.map(stat => ({
      professionalId: stat.professionalId,
      professionalName: professionalNameMap[stat.professionalId] || 'Unknown Professional',
      appointmentsCount: stat._count.professionalId,
      revenue: Number(stat._sum.totalAmount || 0),
      efficiency: 100, // This would need additional calculation
    }));
  }

  /**
   * Get payment method statistics
   */
  private async getPaymentMethodStats(where: Prisma.AppointmentCompletedWhereInput): Promise<PaymentMethodStats[]> {
    const stats = await prisma.appointmentCompleted.groupBy({
      by: ['paymentMethod'],
      where: { ...where, status: 'COMPLETED', paymentStatus: 'PAID' },
      _count: { paymentMethod: true },
      _sum: { totalAmount: true },
    });

    const total = stats.reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0);

    return stats.map(stat => ({
      method: stat.paymentMethod || 'Unknown',
      count: stat._count.paymentMethod,
      amount: Number(stat._sum.totalAmount || 0),
      percentage: total > 0 ? (Number(stat._sum.totalAmount || 0) / total) * 100 : 0,
    }));
  }

  /**
   * Get daily performance data
   */
  private async getDailyPerformance(where: Prisma.AppointmentCompletedWhereInput): Promise<Array<{ date: string; appointments: number; revenue: number }>> {
    const stats = await prisma.$queryRaw<Array<{ date: string; appointments: bigint; revenue: number }>>`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as appointments,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as revenue
      FROM appointments_completed 
      WHERE company_id = ${(where as any).companyId}
        ${(where as any).professionalId ? Prisma.sql`AND professional_id = ${(where as any).professionalId}` : Prisma.empty}
        ${(where as any).startTime?.gte ? Prisma.sql`AND start_time >= ${(where as any).startTime.gte}` : Prisma.empty}
        ${(where as any).startTime?.lte ? Prisma.sql`AND start_time <= ${(where as any).startTime.lte}` : Prisma.empty}
      GROUP BY DATE(start_time)
      ORDER BY date DESC
      LIMIT 30
    `;

    return stats.map(item => ({
      date: item.date,
      appointments: Number(item.appointments),
      revenue: Number(item.revenue),
    }));
  }
}

export const reportService = new ReportService();