import { StatsCalculatorJob } from './StatsCalculatorJob'
import { logger } from '../utils/logger'

/**
 * Inicializador do sistema de jobs
 */
class JobManager {
  private statsJob: StatsCalculatorJob | null = null

  /**
   * Inicia todos os jobs
   */
  async start() {
    try {
      logger.info('Starting Job Manager...')

      // Iniciar Stats Calculator Job
      this.statsJob = new StatsCalculatorJob()
      this.statsJob.start()

      // TODO: Adicionar outros jobs aqui no futuro
      // - Email marketing jobs
      // - Backup jobs  
      // - Notification jobs
      // - Report generation jobs

      logger.info('All jobs started successfully')

      // Handle graceful shutdown
      this.setupGracefulShutdown()

    } catch (error) {
      logger.error('Error starting Job Manager', { error })
      process.exit(1)
    }
  }

  /**
   * Para todos os jobs graciosamente
   */
  async stop() {
    logger.info('Stopping all jobs...')

    if (this.statsJob) {
      await this.statsJob.stop()
      this.statsJob = null
    }

    logger.info('All jobs stopped')
  }

  /**
   * Configura shutdown gracioso
   */
  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`)
      
      await this.stop()
      
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason })
    })

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error })
      process.exit(1)
    })
  }
}

// Auto-start if this file is executed directly
if (require.main === module) {
  const jobManager = new JobManager()
  jobManager.start()
}

export { JobManager }
export default JobManager