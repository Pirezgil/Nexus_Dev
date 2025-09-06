import { Router } from 'express';
import { StatsController } from '../controllers/statsController';
import { authenticate, enforceCompanyAccess, requirePermission } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const statsController = new StatsController();

// Validation schemas
const performanceQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime('Data de início deve ser um datetime válido').optional(),
    endDate: z.string().datetime('Data de fim deve ser um datetime válido').optional(),
  }),
});

const dailyActivityQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().min(1).max(90).optional().default(7),
  }),
});

const customerParamsSchema = z.object({
  params: z.object({
    customerId: z.string().uuid('ID do cliente deve ser um UUID válido'),
  }),
});

// Mock user para desenvolvimento (simula usuário autenticado)
router.use((req: any, res, next) => {
  console.log(`[${new Date().toISOString()}] STATS ${req.method} ${req.url}`);
  req.user = {
    userId: 'user-dev-001',
    companyId: 'company-dev-001',
    email: 'dev@nexuserp.com'
  };
  next();
});

// Temporarily disabled for timeout diagnosis
// router.use(authenticate);
// router.use(enforceCompanyAccess);

/**
 * @route GET /api/stats
 * @description Get comprehensive customer statistics for the company
 * @access Private (authenticated users)
 */
router.get(
  '/',
  statsController.getCustomerStatistics
);

/**
 * @route GET /api/stats/dashboard
 * @description Get dashboard summary statistics
 * @access Private (requires CRM read permission)
 */
router.get(
  '/dashboard',
  // requirePermission('CRM', 'read'), // Temporarily disabled for development
  statsController.getDashboardStats
);

/**
 * @route GET /api/stats/performance
 * @description Get performance metrics for a specific time period
 * @access Private (authenticated users)
 */
router.get(
  '/performance',
  // validateQuery(performanceQuerySchema), // Temporarily disabled for development
  statsController.getPerformanceMetrics
);

/**
 * @route GET /api/stats/daily-activity
 * @description Get daily activity metrics for dashboard
 * @access Private (authenticated users)
 */
router.get(
  '/daily-activity',
  // validateQuery(dailyActivityQuerySchema), // Temporarily disabled for development
  statsController.getDailyActivityMetrics
);

/**
 * @route GET /api/stats/customers/:customerId/activity
 * @description Get customer activity summary
 * @access Private (authenticated users)
 */
router.get(
  '/customers/:customerId/activity',
  // validateParams(customerParamsSchema), // Temporarily disabled for development
  statsController.getCustomerActivitySummary
);

/**
 * @route POST /api/stats/refresh
 * @description Invalidate statistics cache and force refresh
 * @access Private (requires CRM admin permission)
 */
router.post(
  '/refresh',
  // requirePermission('CRM', 'admin'), // Temporarily disabled for development
  statsController.refreshStats
);

export default router;