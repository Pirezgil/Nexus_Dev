import { Request, Response } from 'express'
import { logger } from '../utils/logger'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    companyId: string
    email: string
    role: string
  }
}

// Simplified local classes that provide basic functionality without external dependencies
class LocalAnalyticsEngine {
  async calculateCRMStats(companyId: string, _periodFilter?: any) {
    logger.info(`Calculating CRM stats for company: ${companyId}`)
    
    // Return mock data with proper structure
    return { 
      totalCustomers: { value: 125, changePercent: '+12%', trend: 'up' as const },
      conversionRate: 15.4,
      newCustomersThisMonth: { value: 23, changePercent: '+8%', trend: 'up' as const },
      activeCustomers: { value: 98, changePercent: '+5%', trend: 'up' as const },
      customersBySource: [
        { source: 'Website', count: 45, percentage: 45 },
        { source: 'Indicação', count: 35, percentage: 35 },
        { source: 'Redes Sociais', count: 20, percentage: 20 }
      ],
      customerGrowthChart: [
        { date: '2024-08-01', customers: 5 },
        { date: '2024-08-02', customers: 3 },
        { date: '2024-08-03', customers: 7 }
      ]
    }
  }
  
  async calculateServicesStats(companyId: string, _periodFilter?: any) {
    logger.info(`Calculating Services stats for company: ${companyId}`)
    
    return { 
      totalRevenue: { value: 15750.00, changePercent: '+18%', trend: 'up' as const },
      averageTicket: { value: 125.50, changePercent: '+3%', trend: 'up' as const },
      completedAppointments: { value: 87, changePercent: '+15%', trend: 'up' as const },
      topServices: [
        { name: 'Corte + Barba', appointments: 35, revenue: 4375.00, averageTicket: 125.00 },
        { name: 'Corte Simples', appointments: 28, revenue: 2520.00, averageTicket: 90.00 }
      ],
      paymentStatusDistribution: [
        { status: 'paid', count: 75, amount: 14250.00 },
        { status: 'pending', count: 12, amount: 1500.00 }
      ],
      revenueByDay: [
        { date: '2024-08-26', revenue: 850.00 },
        { date: '2024-08-27', revenue: 920.00 },
        { date: '2024-08-28', revenue: 1100.00 }
      ],
      professionalsPerformance: [
        { name: 'João Silva', appointments: 25, revenue: 3125.00 },
        { name: 'Maria Santos', appointments: 32, revenue: 4000.00 }
      ]
    }
  }
  
  async calculateAgendamentoStats(companyId: string, _periodFilter?: any) {
    logger.info(`Calculating Agendamento stats for company: ${companyId}`)
    
    return { 
      todayAppointments: 12,
      noShowRate: 8.5,
      bookingEfficiency: 85.2
    }
  }
}

class LocalAnalyticsCache {
  private cache = new Map<string, { data: any, timestamp: number, ttl: number }>()
  
  async getDashboardKPIs(companyId: string, period: string) {
    const key = `kpis:${companyId}:${period}`
    const cached = this.cache.get(key)
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl * 1000) {
      logger.debug(`Cache HIT for dashboard KPIs: ${companyId}:${period}`)
      return cached.data
    }
    
    logger.debug(`Cache MISS for dashboard KPIs: ${companyId}:${period}`)
    return null
  }
  
  async setDashboardKPIs(companyId: string, period: string, data: any) {
    const key = `kpis:${companyId}:${period}`
    const ttl = period === 'today' ? 120 : 300 // 2min for today, 5min for others
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
    
    logger.debug(`Cache SET for dashboard KPIs: ${companyId}:${period}`)
    return true
  }
  
  async getRevenueChart(companyId: string) {
    const key = `revenue:${companyId}`
    const cached = this.cache.get(key)
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl * 1000) {
      logger.debug(`Cache HIT for revenue chart: ${companyId}`)
      return cached.data
    }
    
    logger.debug(`Cache MISS for revenue chart: ${companyId}`)
    return null
  }
  
  async setRevenueChart(companyId: string, data: any) {
    const key = `revenue:${companyId}`
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: 600 // 10 minutes
    })
    
    logger.debug(`Cache SET for revenue chart: ${companyId}`)
    return true
  }
}

/**
 * Controller para APIs de Analytics
 * Fornece endpoints para o dashboard e relatórios
 */
export class AnalyticsController {
  private analytics: LocalAnalyticsEngine
  private cache: LocalAnalyticsCache

  constructor() {
    this.analytics = new LocalAnalyticsEngine()
    this.cache = new LocalAnalyticsCache()
  }

  /**
   * GET /api/analytics/dashboard/kpis
   * Retorna KPIs principais do dashboard
   */
  getDashboardKPIs = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.user!
      const { period = 'month', startDate, endDate } = req.query

      logger.info(`Getting dashboard KPIs for company: ${companyId}`, { period })

      // Tentar buscar do cache primeiro
      const cached = await this.cache.getDashboardKPIs(companyId, period as string)
      if (cached) {
        logger.info(`Dashboard KPIs returned from cache for company: ${companyId}`)
        res.setHeader('X-Cache-Status', 'HIT')
        return res.json({
          success: true,
          data: cached
        })
      }

      // Parse period filter if provided
      let periodFilter = undefined
      if (startDate && endDate) {
        periodFilter = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        }
      }

      // Calcular todas as métricas em paralelo
      const [crmStats, servicesStats, agendamentoStats] = await Promise.all([
        this.analytics.calculateCRMStats(companyId, periodFilter),
        this.analytics.calculateServicesStats(companyId, periodFilter),
        this.analytics.calculateAgendamentoStats(companyId, periodFilter)
      ])

      const kpis = {
        // Métricas principais
        totalCustomers: crmStats.totalCustomers,
        monthlyRevenue: servicesStats.totalRevenue,
        todayAppointments: agendamentoStats.todayAppointments,
        conversionRate: crmStats.conversionRate,
        averageTicket: servicesStats.averageTicket,
        noShowRate: agendamentoStats.noShowRate,
        activeCustomers: crmStats.activeCustomers,
        completedAppointments: servicesStats.completedAppointments,
        bookingEfficiency: agendamentoStats.bookingEfficiency,
        newCustomersThisMonth: crmStats.newCustomersThisMonth,

        // Metadados
        period,
        lastUpdated: new Date().toISOString()
      }

      // Armazenar no cache
      await this.cache.setDashboardKPIs(companyId, period as string, kpis)

      res.setHeader('X-Cache-Status', 'MISS')
      res.json({
        success: true,
        data: kpis
      })

      logger.info(`Dashboard KPIs calculated and cached for company: ${companyId}`)

    } catch (error) {
      logger.error('Error getting dashboard KPIs', { 
        error: error instanceof Error ? error.message : error,
        companyId: req.user?.companyId 
      })
      
      res.status(500).json({
        success: false,
        error: 'Erro ao carregar KPIs do dashboard'
      })
    }
  }

  /**
   * GET /api/analytics/crm/stats
   * Retorna estatísticas detalhadas do CRM
   */
  getCRMStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.user!
      const { startDate, endDate } = req.query

      let periodFilter = undefined
      if (startDate && endDate) {
        periodFilter = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        }
      }

      const crmStats = await this.analytics.calculateCRMStats(companyId, periodFilter)

      res.json({
        success: true,
        data: crmStats
      })

    } catch (error) {
      logger.error('Error getting CRM stats', { error, companyId: req.user?.companyId })
      res.status(500).json({
        success: false,
        error: 'Erro ao carregar estatísticas do CRM'
      })
    }
  }

  /**
   * GET /api/analytics/services/stats
   * Retorna estatísticas detalhadas dos Services
   */
  getServicesStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.user!
      const { startDate, endDate } = req.query

      let periodFilter = undefined
      if (startDate && endDate) {
        periodFilter = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        }
      }

      const servicesStats = await this.analytics.calculateServicesStats(companyId, periodFilter)

      res.json({
        success: true,
        data: servicesStats
      })

    } catch (error) {
      logger.error('Error getting Services stats', { error, companyId: req.user?.companyId })
      res.status(500).json({
        success: false,
        error: 'Erro ao carregar estatísticas de serviços'
      })
    }
  }

  /**
   * GET /api/analytics/agendamento/stats
   * Retorna estatísticas detalhadas do Agendamento
   */
  getAgendamentoStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.user!
      const { startDate, endDate } = req.query

      let periodFilter = undefined
      if (startDate && endDate) {
        periodFilter = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        }
      }

      const agendamentoStats = await this.analytics.calculateAgendamentoStats(companyId, periodFilter)

      res.json({
        success: true,
        data: agendamentoStats
      })

    } catch (error) {
      logger.error('Error getting Agendamento stats', { error, companyId: req.user?.companyId })
      res.status(500).json({
        success: false,
        error: 'Erro ao carregar estatísticas de agendamento'
      })
    }
  }

  /**
   * GET /api/analytics/revenue/chart
   * Retorna dados do gráfico de receita
   */
  getRevenueChart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.user!
      const { period = '30d' } = req.query

      // Tentar buscar do cache primeiro
      const cached = await this.cache.getRevenueChart(companyId)
      if (cached) {
        res.setHeader('X-Cache-Status', 'HIT')
        return res.json({
          success: true,
          data: cached
        })
      }

      const servicesStats = await this.analytics.calculateServicesStats(companyId)
      const chartData = servicesStats.revenueByDay

      // Armazenar no cache
      await this.cache.setRevenueChart(companyId, chartData)

      res.setHeader('X-Cache-Status', 'MISS')
      res.json({
        success: true,
        data: chartData
      })

    } catch (error) {
      logger.error('Error getting revenue chart', { error, companyId: req.user?.companyId })
      res.status(500).json({
        success: false,
        error: 'Erro ao carregar gráfico de receita'
      })
    }
  }

  /**
   * GET /api/analytics/reports/:reportType
   * Retorna relatórios personalizados
   */
  getCustomReport = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reportType } = req.params
      const { companyId } = req.user!
      const { startDate, endDate } = req.query

      let periodFilter = undefined
      if (startDate && endDate) {
        periodFilter = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        }
      }

      let reportData

      switch (reportType) {
        case 'customer-acquisition':
          reportData = await this.getCustomerAcquisitionReport(companyId, periodFilter)
          break
          
        case 'service-performance':
          reportData = await this.getServicePerformanceReport(companyId, periodFilter)
          break
          
        case 'professional-performance':
          reportData = await this.getProfessionalPerformanceReport(companyId, periodFilter)
          break

        case 'revenue-analysis':
          reportData = await this.getRevenueAnalysisReport(companyId, periodFilter)
          break
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Tipo de relatório não suportado',
            availableReports: [
              'customer-acquisition',
              'service-performance', 
              'professional-performance',
              'revenue-analysis'
            ]
          })
      }

      res.json({
        success: true,
        data: reportData
      })

    } catch (error) {
      logger.error('Error generating custom report', { 
        error, 
        reportType: req.params.reportType,
        companyId: req.user?.companyId 
      })
      res.status(500).json({
        success: false,
        error: 'Erro ao gerar relatório personalizado'
      })
    }
  }

  // ===============================
  // HELPER METHODS PARA RELATÓRIOS
  // ===============================

  private async getCustomerAcquisitionReport(companyId: string, period?: any) {
    const crmStats = await this.analytics.calculateCRMStats(companyId, period)
    
    return {
      title: 'Relatório de Aquisição de Clientes',
      period: period || 'Último mês',
      metrics: {
        totalCustomers: crmStats.totalCustomers,
        newCustomers: crmStats.newCustomersThisMonth,
        conversionRate: crmStats.conversionRate,
        customersBySource: crmStats.customersBySource,
        customerGrowthChart: crmStats.customerGrowthChart
      },
      insights: this.generateCustomerInsights(crmStats),
      generatedAt: new Date()
    }
  }

  private async getServicePerformanceReport(companyId: string, period?: any) {
    const servicesStats = await this.analytics.calculateServicesStats(companyId, period)
    
    return {
      title: 'Relatório de Performance de Serviços',
      period: period || 'Último mês',
      metrics: {
        totalRevenue: servicesStats.totalRevenue,
        completedAppointments: servicesStats.completedAppointments,
        averageTicket: servicesStats.averageTicket,
        topServices: servicesStats.topServices,
        paymentStatusDistribution: servicesStats.paymentStatusDistribution
      },
      insights: this.generateServiceInsights(servicesStats),
      generatedAt: new Date()
    }
  }

  private async getProfessionalPerformanceReport(companyId: string, period?: any) {
    const servicesStats = await this.analytics.calculateServicesStats(companyId, period)
    
    return {
      title: 'Relatório de Performance de Profissionais',
      period: period || 'Último mês',
      metrics: {
        professionalsPerformance: servicesStats.professionalsPerformance,
        totalRevenue: servicesStats.totalRevenue,
        completedAppointments: servicesStats.completedAppointments
      },
      insights: this.generateProfessionalInsights(servicesStats),
      generatedAt: new Date()
    }
  }

  private async getRevenueAnalysisReport(companyId: string, period?: any) {
    const servicesStats = await this.analytics.calculateServicesStats(companyId, period)
    
    return {
      title: 'Análise de Receita',
      period: period || 'Últimos 30 dias',
      metrics: {
        totalRevenue: servicesStats.totalRevenue,
        averageTicket: servicesStats.averageTicket,
        revenueByDay: servicesStats.revenueByDay,
        topServices: servicesStats.topServices,
        paymentStatusDistribution: servicesStats.paymentStatusDistribution
      },
      insights: this.generateRevenueInsights(servicesStats),
      generatedAt: new Date()
    }
  }

  // ===============================
  // GERADORES DE INSIGHTS
  // ===============================

  private generateCustomerInsights(stats: any) {
    const insights = []

    if (stats.totalCustomers.trend === 'up') {
      insights.push({
        type: 'positive',
        message: `Crescimento de ${stats.totalCustomers.changePercent} no número de clientes`
      })
    }

    if (stats.conversionRate > 15) {
      insights.push({
        type: 'positive',
        message: `Excelente taxa de conversão de ${stats.conversionRate}%`
      })
    } else if (stats.conversionRate < 5) {
      insights.push({
        type: 'warning',
        message: `Taxa de conversão baixa: ${stats.conversionRate}% - considere melhorar o processo de vendas`
      })
    }

    return insights
  }

  private generateServiceInsights(stats: any) {
    const insights = []

    if (stats.totalRevenue.trend === 'up') {
      insights.push({
        type: 'positive',
        message: `Receita cresceu ${stats.totalRevenue.changePercent} em relação ao período anterior`
      })
    }

    if (stats.averageTicket.trend === 'down') {
      insights.push({
        type: 'warning',
        message: `Ticket médio em queda: ${stats.averageTicket.changePercent} - considere estratégias de upselling`
      })
    }

    return insights
  }

  private generateProfessionalInsights(stats: any) {
    const insights = []
    const professionals = stats.professionalsPerformance

    if (professionals.length > 0) {
      const topPerformer = professionals[0]
      insights.push({
        type: 'info',
        message: `${topPerformer.name} é o profissional com melhor performance em receita`
      })

      if (professionals.length > 1) {
        const avgRevenue = professionals.reduce((sum: number, p: any) => sum + p.revenue, 0) / professionals.length
        const belowAverage = professionals.filter((p: any) => p.revenue < avgRevenue)
        
        if (belowAverage.length > professionals.length / 2) {
          insights.push({
            type: 'warning',
            message: 'Considere treinamentos para melhorar a performance geral da equipe'
          })
        }
      }
    }

    return insights
  }

  private generateRevenueInsights(stats: any) {
    const insights = []

    if (stats.totalRevenue.trend === 'up') {
      insights.push({
        type: 'positive',
        message: `Receita total cresceu ${stats.totalRevenue.changePercent}`
      })
    }

    // Análise de sazonalidade
    const revenueData = stats.revenueByDay
    if (revenueData.length >= 7) {
      const recentWeek = revenueData.slice(-7)
      const weekRevenue = recentWeek.reduce((sum: number, day: any) => sum + day.revenue, 0)
      const previousWeek = revenueData.slice(-14, -7)
      const previousWeekRevenue = previousWeek.reduce((sum: number, day: any) => sum + day.revenue, 0)

      if (weekRevenue > previousWeekRevenue) {
        const growth = ((weekRevenue - previousWeekRevenue) / previousWeekRevenue * 100).toFixed(1)
        insights.push({
          type: 'positive',
          message: `Receita da última semana cresceu ${growth}% comparado à semana anterior`
        })
      }
    }

    return insights
  }
}

export default AnalyticsController