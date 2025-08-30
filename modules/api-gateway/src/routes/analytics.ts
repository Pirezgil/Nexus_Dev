import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { AnalyticsController } from '../controllers/AnalyticsController'
import { logger } from '../utils/logger'

const router = Router()
const analyticsController = new AnalyticsController()

// Rate limiting para analytics (disabled in development)
const isDevelopment = process.env.NODE_ENV === 'development';

const analyticsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: isDevelopment ? 0 : 100, // Unlimited in development, 100 in production
  skip: () => isDevelopment, // Skip rate limiting in development
  message: {
    success: false,
    error: 'Too many analytics requests, please try again later',
    code: 'ANALYTICS_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID + IP for more granular rate limiting
    const userId = (req as any).user?.id || 'anonymous'
    return `${userId}-${req.ip}`
  }
})

// Aplicar rate limiting apenas em produção
if (!isDevelopment) {
  router.use(analyticsRateLimit)
} else {
  console.log('🚀 Analytics rate limiting disabled in development mode')
}

// Middleware de logging específico para analytics
router.use((req, res, next) => {
  const start = Date.now()
  
  // Log da requisição
  logger.info('Analytics API Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: (req as any).user?.id,
    companyId: (req as any).user?.companyId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  
  // Override do res.json para logar a resposta
  const originalJson = res.json
  res.json = function(data) {
    const duration = Date.now() - start
    
    logger.info('Analytics API Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: data.success,
      userId: (req as any).user?.id,
      companyId: (req as any).user?.companyId
    })
    
    // Adicionar headers de performance
    res.setHeader('X-Response-Time', `${duration}ms`)
    res.setHeader('X-Cache-Status', 'MISS') // TODO: Implementar cache
    
    return originalJson.call(this, data)
  }
  
  next()
})

// ===============================
// DASHBOARD ROUTES
// ===============================

/**
 * GET /api/analytics/dashboard/kpis
 * Retorna KPIs principais do dashboard executivo
 * 
 * Query Params:
 * - period: today|week|month|quarter (default: month)
 * - startDate: Data inicial (YYYY-MM-DD)
 * - endDate: Data final (YYYY-MM-DD)
 */
router.get('/dashboard/kpis', analyticsController.getDashboardKPIs)

/**
 * GET /api/analytics/revenue/chart
 * Retorna dados para o gráfico de receita
 * 
 * Query Params:
 * - period: 7d|30d|90d (default: 30d)
 */
router.get('/revenue/chart', analyticsController.getRevenueChart)

// ===============================
// MODULE SPECIFIC ANALYTICS
// ===============================

/**
 * GET /api/analytics/crm/stats
 * Estatísticas detalhadas do módulo CRM
 */
router.get('/crm/stats', analyticsController.getCRMStats)

/**
 * GET /api/analytics/services/stats
 * Estatísticas detalhadas do módulo Services
 */
router.get('/services/stats', analyticsController.getServicesStats)

/**
 * GET /api/analytics/agendamento/stats
 * Estatísticas detalhadas do módulo Agendamento
 */
router.get('/agendamento/stats', analyticsController.getAgendamentoStats)

// ===============================
// CUSTOM REPORTS
// ===============================

/**
 * GET /api/analytics/reports/:reportType
 * Relatórios personalizados
 * 
 * Tipos disponíveis:
 * - customer-acquisition: Relatório de aquisição de clientes
 * - service-performance: Performance dos serviços
 * - professional-performance: Performance dos profissionais
 * - revenue-analysis: Análise detalhada de receita
 * 
 * Query Params:
 * - startDate: Data inicial (YYYY-MM-DD)
 * - endDate: Data final (YYYY-MM-DD)
 */
router.get('/reports/:reportType', analyticsController.getCustomReport)

// ===============================
// HEALTH CHECK
// ===============================

/**
 * GET /api/analytics/health
 * Health check específico do analytics
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: [
      'GET /dashboard/kpis - Dashboard KPIs',
      'GET /revenue/chart - Revenue chart data', 
      'GET /crm/stats - CRM statistics',
      'GET /services/stats - Services statistics',
      'GET /agendamento/stats - Scheduling statistics',
      'GET /reports/:type - Custom reports'
    ]
  })
})

// ===============================
// ERROR HANDLING
// ===============================

// Error handler específico para analytics
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Analytics API Error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    companyId: req.user?.companyId
  })

  // Se já foi tratado, passa adiante
  if (res.headersSent) {
    return next(error)
  }

  // Errors específicos do analytics
  if (error.message?.includes('Analytics')) {
    return res.status(503).json({
      success: false,
      error: 'Sistema de analytics temporariamente indisponível',
      code: 'ANALYTICS_UNAVAILABLE'
    })
  }

  // Database connection errors
  if (error.message?.includes('Prisma') || error.message?.includes('database')) {
    return res.status(503).json({
      success: false,
      error: 'Erro na conexão com banco de dados',
      code: 'DATABASE_ERROR'
    })
  }

  // Timeout errors
  if (error.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      error: 'Timeout no processamento dos dados',
      code: 'ANALYTICS_TIMEOUT'
    })
  }

  // Default error
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    code: 'ANALYTICS_INTERNAL_ERROR'
  })
})

export { router as analyticsRoutes }