import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

// Interface para filtro de período
interface PeriodFilter {
  startDate: Date
  endDate: Date
}

// Interface para dados de KPI com tendência
interface KPIData {
  value: number
  previousValue: number
  change: number
  changePercent: string
  trend: 'up' | 'down' | 'neutral'
}

// Interface para estatísticas de CRM
interface CRMAnalytics {
  totalCustomers: KPIData
  activeCustomers: KPIData
  newCustomersThisMonth: KPIData
  averageInteractions: KPIData
  conversionRate: number
  customersBySource: Array<{ source: string; count: number; percentage: number }>
  interactionsByType: Array<{ type: string; count: number; percentage: number }>
  customerGrowthChart: Array<{ date: string; customers: number }>
  lastUpdated: Date
}

// Interface para estatísticas de Services
interface ServicesAnalytics {
  totalRevenue: KPIData
  completedAppointments: KPIData
  averageTicket: KPIData
  topServices: Array<{ name: string; appointments: number; revenue: number; averageTicket: number }>
  professionalsPerformance: Array<{ name: string; appointments: number; revenue: number; rating?: number }>
  revenueByDay: Array<{ date: string; revenue: number }>
  paymentStatusDistribution: Array<{ status: string; count: number; amount: number }>
  lastUpdated: Date
}

// Interface para estatísticas de Agendamento
interface AgendamentoAnalytics {
  todayAppointments: number
  weekAppointments: number
  noShowRate: number
  bookingEfficiency: number
  upcomingAppointments: Array<{ id: string; customerName: string; serviceName: string; datetime: Date }>
  appointmentsByStatus: Array<{ status: string; count: number; percentage: number }>
  lastUpdated: Date
}

/**
 * Analytics Engine Central
 * Responsável por calcular todas as métricas e KPIs do sistema
 */
export class AnalyticsEngine {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })
  }

  // ===============================
  // CRM ANALYTICS
  // ===============================

  /**
   * Calcula todas as estatísticas relacionadas ao CRM
   */
  async calculateCRMStats(companyId: string, period?: PeriodFilter): Promise<CRMAnalytics> {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      logger.info(`Calculating CRM stats for company: ${companyId}`)

      // Current period stats
      const currentStats = await this.getCRMPeriodStats(companyId, {
        startDate: period?.startDate || startOfMonth,
        endDate: period?.endDate || now
      })

      // Previous period stats for comparison
      const previousStats = await this.getCRMPeriodStats(companyId, {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth
      })

      // Calculate KPIs with trends
      const totalCustomers = this.calculateKPIWithTrend(
        currentStats.totalCustomers,
        previousStats.totalCustomers
      )

      const activeCustomers = this.calculateKPIWithTrend(
        currentStats.activeCustomers,
        previousStats.activeCustomers
      )

      const newCustomersThisMonth = this.calculateKPIWithTrend(
        currentStats.newCustomers,
        previousStats.newCustomers
      )

      const averageInteractions = this.calculateKPIWithTrend(
        currentStats.averageInteractions,
        previousStats.averageInteractions
      )

      return {
        totalCustomers,
        activeCustomers,
        newCustomersThisMonth,
        averageInteractions,
        conversionRate: await this.calculateConversionRate(companyId, period),
        customersBySource: await this.getCustomersBySource(companyId, period),
        interactionsByType: await this.getInteractionsByType(companyId, period),
        customerGrowthChart: await this.getCustomerGrowthChart(companyId),
        lastUpdated: now
      }
    } catch (error) {
      logger.error('Error calculating CRM stats', { error, companyId })
      throw error
    }
  }

  /**
   * Obtém estatísticas de CRM para um período específico
   */
  private async getCRMPeriodStats(companyId: string, period: PeriodFilter) {
    // Total customers criados no período
    const totalCustomers = await this.prisma.customer.count({
      where: {
        companyId,
        createdAt: { gte: period.startDate, lte: period.endDate }
      }
    })

    // Active customers (com interações nos últimos 30 dias)
    const activeCustomers = await this.prisma.customer.count({
      where: {
        companyId,
        status: 'ACTIVE',
        interactions: {
          some: {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        }
      }
    })

    // New customers no período
    const newCustomers = await this.prisma.customer.count({
      where: {
        companyId,
        createdAt: { gte: period.startDate, lte: period.endDate }
      }
    })

    // Average interactions per customer
    const interactionStats = await this.prisma.customerInteraction.groupBy({
      by: ['customerId'],
      where: {
        companyId,
        createdAt: { gte: period.startDate, lte: period.endDate }
      },
      _count: { id: true }
    })

    const averageInteractions = interactionStats.length > 0
      ? interactionStats.reduce((sum, stat) => sum + stat._count.id, 0) / interactionStats.length
      : 0

    return {
      totalCustomers,
      activeCustomers,
      newCustomers,
      averageInteractions: Math.round(averageInteractions * 10) / 10
    }
  }

  // ===============================
  // SERVICES ANALYTICS
  // ===============================

  /**
   * Calcula todas as estatísticas relacionadas aos Services
   */
  async calculateServicesStats(companyId: string, period?: PeriodFilter): Promise<ServicesAnalytics> {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      logger.info(`Calculating Services stats for company: ${companyId}`)

      // Current period
      const currentStats = await this.getServicesPeriodStats(companyId, {
        startDate: period?.startDate || startOfMonth,
        endDate: period?.endDate || now
      })

      // Previous period
      const previousStats = await this.getServicesPeriodStats(companyId, {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth
      })

      // Calculate KPIs
      const totalRevenue = this.calculateKPIWithTrend(
        currentStats.totalRevenue,
        previousStats.totalRevenue
      )

      const completedAppointments = this.calculateKPIWithTrend(
        currentStats.completedAppointments,
        previousStats.completedAppointments
      )

      const averageTicket = this.calculateKPIWithTrend(
        currentStats.averageTicket,
        previousStats.averageTicket
      )

      return {
        totalRevenue,
        completedAppointments,
        averageTicket,
        topServices: await this.getTopServices(companyId, period),
        professionalsPerformance: await this.getProfessionalsPerformance(companyId, period),
        revenueByDay: await this.getRevenueByDay(companyId, period),
        paymentStatusDistribution: await this.getPaymentStatusDistribution(companyId, period),
        lastUpdated: now
      }
    } catch (error) {
      logger.error('Error calculating Services stats', { error, companyId })
      throw error
    }
  }

  /**
   * Obtém estatísticas de Services para um período específico
   */
  private async getServicesPeriodStats(companyId: string, period: PeriodFilter) {
    // Revenue and appointments stats
    const appointmentStats = await this.prisma.appointmentCompleted.aggregate({
      where: {
        companyId,
        completedAt: { gte: period.startDate, lte: period.endDate }
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      _avg: { totalAmount: true }
    })

    return {
      totalRevenue: Number(appointmentStats._sum.totalAmount) || 0,
      completedAppointments: appointmentStats._count.id || 0,
      averageTicket: Number(appointmentStats._avg.totalAmount) || 0
    }
  }

  // ===============================
  // AGENDAMENTO ANALYTICS
  // ===============================

  /**
   * Calcula todas as estatísticas relacionadas ao Agendamento
   */
  async calculateAgendamentoStats(companyId: string, period?: PeriodFilter): Promise<AgendamentoAnalytics> {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      logger.info(`Calculating Agendamento stats for company: ${companyId}`)

      // Today's appointments
      const todayAppointments = await this.prisma.appointment.count({
        where: {
          company_id: companyId,
          appointment_date: {
            gte: today,
            lt: tomorrow
          }
        }
      })

      // This week's appointments
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      
      const weekAppointments = await this.prisma.appointment.count({
        where: {
          company_id: companyId,
          appointment_date: { gte: startOfWeek }
        }
      })

      // No-show rate (últimos 30 dias)
      const totalScheduled = await this.prisma.appointment.count({
        where: {
          company_id: companyId,
          appointment_date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })

      const noShows = await this.prisma.appointment.count({
        where: {
          company_id: companyId,
          status: 'no_show',
          appointment_date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })

      const noShowRate = totalScheduled > 0 ? (noShows / totalScheduled) * 100 : 0

      // Booking efficiency
      const bookingEfficiency = await this.calculateBookingEfficiency(companyId)

      return {
        todayAppointments,
        weekAppointments,
        noShowRate: Math.round(noShowRate * 10) / 10,
        bookingEfficiency: Math.round(bookingEfficiency * 10) / 10,
        upcomingAppointments: await this.getUpcomingAppointments(companyId),
        appointmentsByStatus: await this.getAppointmentsByStatus(companyId),
        lastUpdated: now
      }
    } catch (error) {
      logger.error('Error calculating Agendamento stats', { error, companyId })
      throw error
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Calcula KPI com tendência comparativa
   */
  private calculateKPIWithTrend(current: number, previous: number): KPIData {
    const change = current - previous
    const changePercent = previous > 0 ? (change / previous) * 100 : (current > 0 ? 100 : 0)
    
    return {
      value: current,
      previousValue: previous,
      change,
      changePercent: `${changePercent >= 0 ? '+' : ''}${Math.round(changePercent)}%`,
      trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral'
    }
  }

  /**
   * Calcula taxa de conversão de prospects para clientes ativos
   */
  private async calculateConversionRate(companyId: string, period?: PeriodFilter): Promise<number> {
    const totalProspects = await this.prisma.customer.count({
      where: {
        companyId,
        status: 'PROSPECT'
      }
    })

    const convertedCustomers = await this.prisma.customer.count({
      where: {
        companyId,
        status: 'ACTIVE',
        // Assumindo que clientes que foram prospects e agora são ativos foram convertidos
        createdAt: period ? { gte: period.startDate, lte: period.endDate } : undefined
      }
    })

    return totalProspects > 0 ? Math.round((convertedCustomers / totalProspects) * 100) : 0
  }

  /**
   * Obtém distribuição de clientes por fonte
   */
  private async getCustomersBySource(companyId: string, period?: PeriodFilter) {
    const customers = await this.prisma.customer.groupBy({
      by: ['source'],
      where: {
        companyId,
        ...(period && { createdAt: { gte: period.startDate, lte: period.endDate } })
      },
      _count: { id: true }
    })

    const total = customers.reduce((sum, customer) => sum + customer._count.id, 0)

    return customers.map(customer => ({
      source: customer.source || 'Não informado',
      count: customer._count.id,
      percentage: Math.round((customer._count.id / total) * 100)
    }))
  }

  /**
   * Obtém distribuição de interações por tipo
   */
  private async getInteractionsByType(companyId: string, period?: PeriodFilter) {
    const interactions = await this.prisma.customerInteraction.groupBy({
      by: ['type'],
      where: {
        companyId,
        ...(period && { createdAt: { gte: period.startDate, lte: period.endDate } })
      },
      _count: { id: true }
    })

    const total = interactions.reduce((sum, interaction) => sum + interaction._count.id, 0)

    return interactions.map(interaction => ({
      type: interaction.type,
      count: interaction._count.id,
      percentage: Math.round((interaction._count.id / total) * 100)
    }))
  }

  /**
   * Obtém dados de crescimento de clientes nos últimos 30 dias
   */
  private async getCustomerGrowthChart(companyId: string) {
    const days = 30
    const result = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      const customers = await this.prisma.customer.count({
        where: {
          companyId,
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      })

      result.push({
        date: startOfDay.toISOString().split('T')[0],
        customers
      })
    }

    return result
  }

  /**
   * Obtém top 5 serviços mais populares
   */
  private async getTopServices(companyId: string, period?: PeriodFilter) {
    const topServices = await this.prisma.appointmentCompleted.groupBy({
      by: ['serviceId'],
      where: {
        companyId,
        ...(period && { completedAt: { gte: period.startDate, lte: period.endDate } })
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5
    })

    return Promise.all(
      topServices.map(async (service) => {
        const serviceData = await this.prisma.service.findUnique({
          where: { id: service.serviceId },
          select: { name: true }
        })
        
        return {
          name: serviceData?.name || 'Serviço não encontrado',
          appointments: service._count.id,
          revenue: Number(service._sum.totalAmount) || 0,
          averageTicket: service._count.id > 0 
            ? Math.round((Number(service._sum.totalAmount) || 0) / service._count.id * 100) / 100
            : 0
        }
      })
    )
  }

  /**
   * Obtém performance dos profissionais
   */
  private async getProfessionalsPerformance(companyId: string, period?: PeriodFilter) {
    const professionals = await this.prisma.appointmentCompleted.groupBy({
      by: ['professionalId'],
      where: {
        companyId,
        ...(period && { completedAt: { gte: period.startDate, lte: period.endDate } })
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } }
    })

    return Promise.all(
      professionals.map(async (prof) => {
        const professionalData = await this.prisma.professional.findUnique({
          where: { id: prof.professionalId },
          select: { name: true }
        })
        
        return {
          name: professionalData?.name || 'Profissional não encontrado',
          appointments: prof._count.id,
          revenue: Number(prof._sum.totalAmount) || 0
        }
      })
    )
  }

  /**
   * Obtém receita por dia nos últimos 30 dias
   */
  private async getRevenueByDay(companyId: string, period?: PeriodFilter) {
    const days = 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    
    const dailyRevenue = await this.prisma.appointmentCompleted.groupBy({
      by: ['completedAt'],
      where: {
        companyId,
        completedAt: { gte: startDate }
      },
      _sum: { totalAmount: true }
    })

    // Fill missing days with 0
    const result = []
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayRevenue = dailyRevenue.find(d => 
        d.completedAt.toISOString().split('T')[0] === dateStr
      )
      
      result.push({
        date: dateStr,
        revenue: Number(dayRevenue?._sum.totalAmount) || 0
      })
    }

    return result
  }

  /**
   * Obtém distribuição por status de pagamento
   */
  private async getPaymentStatusDistribution(companyId: string, period?: PeriodFilter) {
    const payments = await this.prisma.appointmentCompleted.groupBy({
      by: ['paymentStatus'],
      where: {
        companyId,
        ...(period && { completedAt: { gte: period.startDate, lte: period.endDate } })
      },
      _count: { id: true },
      _sum: { totalAmount: true }
    })

    return payments.map(payment => ({
      status: payment.paymentStatus,
      count: payment._count.id,
      amount: Number(payment._sum.totalAmount) || 0
    }))
  }

  /**
   * Calcula eficiência de agendamento (% de ocupação)
   */
  private async calculateBookingEfficiency(companyId: string): Promise<number> {
    // Simplified calculation - could be more sophisticated
    const today = new Date()
    const totalSlots = 48 // Assumindo 8h de trabalho com slots de 10min cada
    
    const bookedSlots = await this.prisma.appointment.count({
      where: {
        company_id: companyId,
        appointment_date: today,
        status: { in: ['scheduled', 'confirmed', 'completed'] }
      }
    })

    return Math.min(Math.round((bookedSlots / totalSlots) * 100), 100)
  }

  /**
   * Obtém próximos agendamentos
   */
  private async getUpcomingAppointments(companyId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        company_id: companyId,
        appointment_date: { gte: new Date() },
        status: { in: ['scheduled', 'confirmed'] }
      },
      take: 5,
      orderBy: [
        { appointment_date: 'asc' },
        { appointment_time: 'asc' }
      ]
    })

    return appointments.map(appointment => ({
      id: appointment.id,
      customerName: 'Cliente', // TODO: join with customer table
      serviceName: 'Serviço', // TODO: join with service table
      datetime: new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
    }))
  }

  /**
   * Obtém distribuição de agendamentos por status
   */
  private async getAppointmentsByStatus(companyId: string) {
    const appointments = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: {
        company_id: companyId,
        appointment_date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: { id: true }
    })

    const total = appointments.reduce((sum, appointment) => sum + appointment._count.id, 0)

    return appointments.map(appointment => ({
      status: appointment.status,
      count: appointment._count.id,
      percentage: Math.round((appointment._count.id / total) * 100)
    }))
  }

  /**
   * Fecha a conexão com o banco de dados
   */
  async disconnect() {
    await this.prisma.$disconnect()
  }
}

export default AnalyticsEngine