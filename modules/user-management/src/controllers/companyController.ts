import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

export class CompanyController {
  /**
   * Validate company existence for cross-module validation
   * GET /api/companies/:id/validate
   */
  static async validateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Company ID is required',
          code: 'MISSING_COMPANY_ID'
        });
        return;
      }

      // Check if company exists and is active
      const company = await prisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          isActive: true,
          plan: true
        }
      });

      if (!company) {
        logger.info(`Company validation failed: ${id} not found`);
        res.status(404).json({
          success: false,
          error: 'Company not found',
          code: 'COMPANY_NOT_FOUND'
        });
        return;
      }

      if (!company.isActive) {
        logger.info(`Company validation failed: ${id} is inactive`);
        res.status(403).json({
          success: false,
          error: 'Company is inactive',
          code: 'COMPANY_INACTIVE'
        });
        return;
      }

      logger.info(`Company validation successful: ${id}`);
      res.status(200).json({
        success: true,
        data: {
          id: company.id,
          name: company.name,
          isActive: company.isActive,
          plan: company.plan
        },
        message: 'Company validation successful'
      });
    } catch (error: any) {
      logger.error('Error validating company:', {
        companyId: req.params.id,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error during company validation',
        code: 'VALIDATION_ERROR'
      });
    }
  }

  /**
   * Get company details
   * GET /api/companies/:id
   */
  static async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Company ID is required',
          code: 'MISSING_COMPANY_ID'
        });
        return;
      }

      const company = await prisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cnpj: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          isActive: true,
          plan: true,
          maxUsers: true,
          settings: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!company) {
        res.status(404).json({
          success: false,
          error: 'Company not found',
          code: 'COMPANY_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: company,
        message: 'Company retrieved successfully'
      });
    } catch (error: any) {
      logger.error('Error retrieving company:', {
        companyId: req.params.id,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });
    }
  }
}