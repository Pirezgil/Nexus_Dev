import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate, authorize, requireCompanyAccess } from '../middleware/authCompat';
import { customRateLimit } from '../middleware/validation';

const router = Router();

// Apply authentication to all report routes
router.use(authenticate);
router.use(requireCompanyAccess);

// Reports can be resource-intensive, so apply stricter rate limiting
const reportRateLimit = customRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute per user
  message: 'Too many report requests, please try again later',
  keyGenerator: (req) => `reports:${req.user?.id}:${req.ip}`,
});

router.use(reportRateLimit);

/**
 * Report Routes
 * 
 * All routes require authentication, company access, and have rate limiting
 * Most routes require admin or manager permissions
 */

// GET /reports/daily - Generate daily report
router.get('/daily',
  authorize(['admin', 'manager']),
  reportController.getDailyReport
);

// GET /reports/weekly - Generate weekly summary
router.get('/weekly',
  authorize(['admin', 'manager']),
  reportController.getWeeklySummary
);

// GET /reports/monthly - Generate monthly summary
router.get('/monthly',
  authorize(['admin', 'manager']),
  reportController.getMonthlySummary
);

// GET /reports/dashboard - Get dashboard metrics
router.get('/dashboard',
  authorize(['admin', 'manager', 'staff']),
  reportController.getDashboardMetrics
);

// GET /reports/professional/:professionalId - Generate professional performance report
router.get('/professional/:professionalId',
  authorize(['admin', 'manager']),
  reportController.getProfessionalReport
);

// GET /reports/services - Generate service analytics report
router.get('/services',
  authorize(['admin', 'manager']),
  reportController.getServiceAnalytics
);

// GET /reports/financial - Generate financial report
router.get('/financial',
  authorize(['admin', 'manager']),
  reportController.getFinancialReport
);

// GET /reports/export/:reportType - Export report data
router.get('/export/:reportType',
  authorize(['admin', 'manager']),
  reportController.exportReport
);

export default router;