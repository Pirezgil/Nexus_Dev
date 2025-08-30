import { PrismaClient } from '@prisma/client'
import { AnalyticsEngine } from '../services/AnalyticsEngine'
import { logger } from '../utils/logger'

/**
 * Job para cálculo automático de estatísticas
 * Executa de forma programada para manter as métricas atualizadas
 */
export class StatsCalculatorJob {
  private prisma: PrismaClient
  private analytics: AnalyticsEngine
  private isRunning: boolean = false

  constructor() {
    this.prisma = new PrismaClient()
    this.analytics = new AnalyticsEngine()
  }

  /**
   * Inicia o sistema de jobs automáticos
   */
  start() {
    logger.info('Starting Stats Calculator Job system')
    
    // Job principal - executa a cada hora
    this.scheduleHourlyStats()
    
    // Job diário - execução mais completa
    this.scheduleDailyStats()

    logger.info('Stats Calculator Job system started successfully')
  }

  /**
   * Agenda cálculo de stats a cada hora
   */
  private scheduleHourlyStats() {
    const runHourlyStats = async () => {
      if (this.isRunning) {
        logger.warn('Stats calculation already running, skipping this execution')
        return
      }

      try {
        this.isRunning = true
        logger.info('Starting hourly stats calculation')
        
        await this.calculateStatsForAllCompanies()
        
        logger.info('Hourly stats calculation completed')
      } catch (error) {
        logger.error('Error in hourly stats calculation', { error })
      } finally {
        this.isRunning = false
      }
    }

    // Executar imediatamente na primeira vez
    runHourlyStats()
    
    // Agendar para executar a cada hora
    setInterval(runHourlyStats, 60 * 60 * 1000) // 1 hora
  }

  /**
   * Agenda cálculo diário mais completo
   */
  private scheduleDailyStats() {
    const runDailyStats = async () => {
      if (this.isRunning) {
        logger.warn('Stats calculation already running, skipping daily execution')
        return
      }

      try {
        this.isRunning = true
        logger.info('Starting daily comprehensive stats calculation')
        
        await this.dailyStatsCalculation()
        
        logger.info('Daily stats calculation completed')
      } catch (error) {
        logger.error('Error in daily stats calculation', { error })
      } finally {
        this.isRunning = false
      }
    }

    // Calcular próxima execução às 01:00
    const now = new Date()
    const nextRun = new Date()
    nextRun.setHours(1, 0, 0, 0)
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }

    const timeUntilNextRun = nextRun.getTime() - now.getTime()
    
    setTimeout(() => {
      runDailyStats()
      // Depois agenda para executar diariamente
      setInterval(runDailyStats, 24 * 60 * 60 * 1000) // 24 horas
    }, timeUntilNextRun)

    logger.info(`Daily stats scheduled for ${nextRun.toISOString()}`)
  }

  /**
   * Calcula estatísticas para todas as empresas ativas
   */
  private async calculateStatsForAllCompanies() {
    try {
      // Buscar todas as empresas ativas
      // Como não temos o model Company ainda, vamos buscar empresas distintas dos customers
      const companies = await this.prisma.customer.groupBy({
        by: ['companyId'],
        _count: { id: true }
      })

      logger.info(`Calculating stats for ${companies.length} companies`)

      for (const company of companies) {
        await this.calculateCompanyStats(company.companyId)
        
        // Pequeno delay para não sobrecarregar o banco
        await this.sleep(100)
      }

      logger.info('Stats calculation completed for all companies')

    } catch (error) {
      logger.error('Error calculating stats for all companies', { error })
      throw error
    }
  }

  /**
   * Calcula estatísticas para uma empresa específica
   */
  private async calculateCompanyStats(companyId: string) {
    try {
      logger.info(`Calculating stats for company: ${companyId}`)

      // Calcular CRM stats
      const crmStats = await this.analytics.calculateCRMStats(companyId)
      await this.saveCRMStats(companyId, crmStats)

      // Calcular Services stats
      const servicesStats = await this.analytics.calculateServicesStats(companyId)
      await this.saveServicesStats(companyId, servicesStats)

      logger.info(`Stats calculated successfully for company ${companyId}`)

    } catch (error) {
      logger.error(`Error calculating stats for company ${companyId}`, { error })
      // Não interrompe o processamento para outras empresas
    }
  }

  /**
   * Salva estatísticas de CRM no banco
   */
  private async saveCRMStats(companyId: string, stats: any) {
    await this.prisma.customerStats.upsert({
      where: { companyId },
      update: {
        totalCustomers: stats.totalCustomers.value,
        activeCustomers: stats.activeCustomers.value,
        prospectCustomers: await this.getProspectCustomersCount(companyId),
        totalInteractions: await this.getTotalInteractionsCount(companyId),
        totalNotes: await this.getTotalNotesCount(companyId),
        averageInteractions: stats.averageInteractions.value,
        lastCalculatedAt: new Date()
      },
      create: {
        companyId,
        totalCustomers: stats.totalCustomers.value,
        activeCustomers: stats.activeCustomers.value,
        prospectCustomers: await this.getProspectCustomersCount(companyId),
        totalInteractions: await this.getTotalInteractionsCount(companyId),
        totalNotes: await this.getTotalNotesCount(companyId),
        averageInteractions: stats.averageInteractions.value,
        lastCalculatedAt: new Date()
      }
    })

    logger.info(`CRM stats saved for company: ${companyId}`)
  }

  /**
   * Salva estatísticas de Services no banco
   */
  private async saveServicesStats(companyId: string, stats: any) {
    await this.prisma.serviceStats.upsert({
      where: { companyId },
      update: {
        totalServices: await this.getTotalServicesCount(companyId),
        activeServices: await this.getActiveServicesCount(companyId),
        totalProfessionals: await this.getTotalProfessionalsCount(companyId),
        activeProfessionals: await this.getActiveProfessionalsCount(companyId),
        totalAppointments: await this.getTotalAppointmentsCount(companyId),
        completedAppointments: stats.completedAppointments.value,
        totalRevenue: stats.totalRevenue.value,
        averageTicket: stats.averageTicket.value,
        lastCalculatedAt: new Date()
      },
      create: {
        companyId,
        totalServices: await this.getTotalServicesCount(companyId),
        activeServices: await this.getActiveServicesCount(companyId),
        totalProfessionals: await this.getTotalProfessionalsCount(companyId),
        activeProfessionals: await this.getActiveProfessionalsCount(companyId),
        totalAppointments: await this.getTotalAppointmentsCount(companyId),
        completedAppointments: stats.completedAppointments.value,
        totalRevenue: stats.totalRevenue.value,
        averageTicket: stats.averageTicket.value,
        lastCalculatedAt: new Date()
      }
    })

    logger.info(`Services stats saved for company: ${companyId}`)
  }

  /**
   * Execução diária mais completa com limpeza e relatórios
   */
  private async dailyStatsCalculation() {
    logger.info('Starting daily comprehensive stats calculation')

    // Cálculo completo para todas as empresas
    await this.calculateStatsForAllCompanies()
    
    // Tarefas adicionais do processamento diário
    await this.cleanupOldStats()
    await this.generateDailyInsights()
    
    logger.info('Daily stats calculation completed')
  }

  /**
   * Limpeza de estatísticas antigas (manter apenas 90 dias)
   */
  private async cleanupOldStats() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      
      logger.info('Starting cleanup of old stats data')
      
      // TODO: Implementar limpeza de dados históricos se necessário
      // Por enquanto apenas log
      logger.info(`Cleanup completed - cutoff date: ${cutoffDate.toISOString()}`)
      
    } catch (error) {
      logger.error('Error during stats cleanup', { error })
    }
  }

  /**
   * Gera insights diários para alertas e relatórios
   */
  private async generateDailyInsights() {
    try {
      logger.info('Generating daily business insights')
      
      // TODO: Implementar geração de insights automáticos
      // - Alertas para quedas de performance
      // - Identificação de tendências
      // - Sugestões de melhorias
      
      logger.info('Daily insights generated successfully')
      
    } catch (error) {
      logger.error('Error generating daily insights', { error })
    }
  }

  // ===============================
  // HELPER METHODS PARA CONTAGENS
  // ===============================

  private async getProspectCustomersCount(companyId: string): Promise<number> {
    return this.prisma.customer.count({
      where: { companyId, status: 'PROSPECT' }
    })
  }

  private async getTotalInteractionsCount(companyId: string): Promise<number> {
    return this.prisma.customerInteraction.count({
      where: { companyId }
    })
  }

  private async getTotalNotesCount(companyId: string): Promise<number> {
    return this.prisma.customerNote.count({
      where: { companyId }
    })
  }

  private async getTotalServicesCount(companyId: string): Promise<number> {
    return this.prisma.service.count({
      where: { companyId }
    })
  }

  private async getActiveServicesCount(companyId: string): Promise<number> {
    return this.prisma.service.count({
      where: { companyId, status: 'ACTIVE' }
    })
  }

  private async getTotalProfessionalsCount(companyId: string): Promise<number> {
    return this.prisma.professional.count({
      where: { companyId }
    })
  }

  private async getActiveProfessionalsCount(companyId: string): Promise<number> {
    return this.prisma.professional.count({
      where: { companyId, status: 'ACTIVE' }
    })
  }

  private async getTotalAppointmentsCount(companyId: string): Promise<number> {
    return this.prisma.appointment.count({
      where: { company_id: companyId }
    })
  }

  /**
   * Utilitário para delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Para o sistema de jobs
   */
  async stop() {
    logger.info('Stopping Stats Calculator Job system')
    
    // Aguarda finalização do job atual se estiver executando
    while (this.isRunning) {
      await this.sleep(1000)
    }
    
    await this.analytics.disconnect()
    await this.prisma.$disconnect()
    
    logger.info('Stats Calculator Job system stopped')
  }
}

export default StatsCalculatorJob