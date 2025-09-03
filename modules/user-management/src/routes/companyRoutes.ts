import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';

const router = Router();

/**
 * Company validation routes for cross-module integration
 */

/**
 * @route   GET /api/companies/:id/validate
 * @desc    Validate company existence for cross-module validation
 * @access  Internal (no auth required for cross-module validation)
 */
router.get('/:id/validate', CompanyController.validateCompany);

/**
 * @route   GET /api/companies/:id
 * @desc    Get company details
 * @access  Internal (no auth required for cross-module validation)
 */
router.get('/:id', CompanyController.getCompany);

export default router;