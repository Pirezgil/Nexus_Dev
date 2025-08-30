#!/usr/bin/env node

import { JobManager } from '../jobs/index'
import { getAnalyticsCache } from '../services/AnalyticsCacheService'
import { logger } from '../utils/logger'

/**
 * Script de inicialização do sistema de Analytics
 * Inicia jobs automáticos e verifica conectividade
 */

async function startAnalyticsSystem() {
  logger.info('🚀 Starting Nexus ERP Analytics System...')

  try {
    // 1. Verificar conectividade do Redis
    logger.info('📊 Checking Redis connectivity for analytics cache...')
    const cache = getAnalyticsCache()
    const isRedisHealthy = await cache.healthCheck()
    
    if (isRedisHealthy) {
      logger.info('✅ Redis connection successful')
    } else {
      logger.warn('⚠️  Redis connection failed - analytics will work without cache')
    }

    // 2. Verificar estrutura do banco de dados
    logger.info('🗄️  Checking database connectivity...')
    try {
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      // Test connection with a simple query
      await prisma.$queryRaw`SELECT 1`
      logger.info('✅ Database connection successful')
      
      await prisma.$disconnect()
    } catch (dbError) {
      logger.error('❌ Database connection failed:', { error: dbError })
      throw dbError
    }

    // 3. Inicializar Jobs Manager
    logger.info('⚡ Starting Analytics Jobs Manager...')
    const jobManager = new JobManager()
    await jobManager.start()

    // 4. Executar cálculo inicial de stats
    logger.info('🔄 Running initial stats calculation...')
    const { StatsCalculatorJob } = require('../jobs/StatsCalculatorJob')
    const statsJob = new StatsCalculatorJob()
    
    // Executa uma vez imediatamente
    setTimeout(async () => {
      try {
        await (statsJob as any).calculateStatsForAllCompanies()
        logger.info('✅ Initial stats calculation completed')
      } catch (error) {
        logger.error('❌ Initial stats calculation failed:', { error })
      }
    }, 5000) // Aguarda 5 segundos para o sistema estabilizar

    // 5. Setup de monitoramento
    setupMonitoring()

    logger.info('🎉 Nexus ERP Analytics System started successfully!')
    logger.info('📋 System Components:')
    logger.info('   ✓ Analytics Engine - Real-time KPI calculations')
    logger.info('   ✓ Stats Calculator Job - Automated hourly/daily calculations')
    logger.info('   ✓ Redis Cache - Performance optimization')
    logger.info('   ✓ API Gateway Analytics Routes - /api/analytics/*')

    // Mantém o processo ativo
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down Analytics System gracefully...')
      await jobManager.stop()
      await cache.disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      logger.info('🛑 Analytics System terminated')
      await jobManager.stop()
      await cache.disconnect()
      process.exit(0)
    })

  } catch (error) {
    logger.error('💥 Failed to start Analytics System:', { error })
    process.exit(1)
  }
}

/**
 * Configura monitoramento do sistema
 */
function setupMonitoring() {
  // Monitor de memória a cada 5 minutos
  setInterval(async () => {
    const used = process.memoryUsage()
    const cache = getAnalyticsCache()
    const cacheInfo = await cache.getCacheInfo()

    logger.info('📊 System Monitoring:', {
      memory: {
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
      },
      cache: cacheInfo ? {
        totalKeys: cacheInfo.totalKeys,
        keysByType: cacheInfo.keysByType
      } : 'unavailable'
    })
  }, 5 * 60 * 1000) // 5 minutos

  // Health check a cada minuto
  setInterval(async () => {
    const cache = getAnalyticsCache()
    const isHealthy = await cache.healthCheck()
    
    if (!isHealthy) {
      logger.warn('⚠️  Redis cache health check failed')
    }
  }, 60 * 1000) // 1 minuto
}

/**
 * Utilitário para teste do sistema
 */
async function testAnalyticsSystem() {
  logger.info('🧪 Testing Analytics System...')

  try {
    const { AnalyticsEngine } = require('../services/AnalyticsEngine')
    const analytics = new AnalyticsEngine()

    // Test with mock company ID
    const testCompanyId = 'test-company-123'
    
    logger.info(`Testing CRM stats calculation for company: ${testCompanyId}`)
    const crmStats = await analytics.calculateCRMStats(testCompanyId)
    logger.info('✅ CRM stats calculation successful')

    logger.info(`Testing Services stats calculation for company: ${testCompanyId}`)
    const servicesStats = await analytics.calculateServicesStats(testCompanyId)
    logger.info('✅ Services stats calculation successful')

    logger.info(`Testing Agendamento stats calculation for company: ${testCompanyId}`)
    const agendamentoStats = await analytics.calculateAgendamentoStats(testCompanyId)
    logger.info('✅ Agendamento stats calculation successful')

    // Test cache
    const cache = getAnalyticsCache()
    await cache.setDashboardKPIs(testCompanyId, 'month', {
      totalCustomers: crmStats.totalCustomers,
      monthlyRevenue: servicesStats.totalRevenue
    })
    
    const cachedData = await cache.getDashboardKPIs(testCompanyId, 'month')
    if (cachedData) {
      logger.info('✅ Cache system working correctly')
    }

    await analytics.disconnect()
    
    logger.info('🎉 Analytics System test completed successfully!')

  } catch (error) {
    logger.error('❌ Analytics System test failed:', { error })
    throw error
  }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2)

if (args.includes('--test')) {
  testAnalyticsSystem()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
} else if (args.includes('--help')) {
  console.log(`
Nexus ERP Analytics System

Usage:
  npm run analytics:start         # Start the analytics system
  npm run analytics:test          # Test the analytics system
  npm run analytics:start --help  # Show this help

Features:
  - Real-time KPI calculations
  - Automated stats calculation jobs
  - Redis cache for performance
  - Comprehensive API endpoints

Environment Variables:
  DATABASE_URL     # PostgreSQL connection string
  REDIS_HOST       # Redis host (default: localhost)
  REDIS_PORT       # Redis port (default: 6379)
  REDIS_PASSWORD   # Redis password (if required)
  NODE_ENV         # Environment (development/production)
`)
  process.exit(0)
} else {
  startAnalyticsSystem()
}

export { startAnalyticsSystem, testAnalyticsSystem }