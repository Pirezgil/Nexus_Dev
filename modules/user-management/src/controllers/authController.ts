import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import {
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  RegisterCompanyInput,
  UpdateProfileInput,
  UpdatePasswordInput,
  ApiResponse,
} from '../types';
import { logger } from '../utils/logger';
import { UserService } from '../services/userService';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuthController {
  /**
   * Login user
   * POST /auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loginData: LoginInput = req.body;
      const deviceInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };

      const result = await AuthService.login(loginData, deviceInfo);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login realizado com sucesso',
      };

      logger.info('User login successful', {
        userId: result.user.id,
        email: result.user.email,
        ipAddress: req.ip,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.user?.sessionId;
      
      if (sessionId) {
        await AuthService.logout(sessionId);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logout realizado com sucesso',
      };

      logger.info('User logout successful', {
        userId: req.user?.userId,
        sessionId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenInput = req.body;

      const result = await AuthService.refreshToken(refreshToken);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Token renovado com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate access token (for other modules)
   * GET /auth/validate
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: ApiResponse = {
          success: false,
          error: 'Token não fornecido',
        };
        res.status(401).json(response);
        return;
      }

      const token = authHeader.substring(7);
      
      // Check if this is a gateway request
      const isGatewayRequest = req.headers['x-gateway-source'] === 'nexus-api-gateway';
      
      let payload;
      if (isGatewayRequest) {
        // For gateway requests, use a simpler validation that doesn't require fingerprint
        payload = await AuthService.validateTokenForGateway(token);
      } else {
        // For direct client requests, use the full validation
        payload = await AuthService.validateToken(token);
      }

      if (!payload) {
        const response: ApiResponse = {
          success: false,
          error: 'Token inválido',
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: payload,
        message: 'Token válido',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user info
   * GET /auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      const user = await UserService.getUserById(userId, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Dados do usuário obtidos com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register new company with admin user
   * POST /auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { company, admin }: RegisterCompanyInput = req.body;

      // Create company
      const newCompany = await prisma.company.create({
        data: {
          name: company.name,
          email: company.email,
          phone: company.phone,
          cnpj: company.cnpj,
        },
      });

      // Create admin user with PENDING status for email verification
      const adminUser = await UserService.createUser(
        {
          email: admin.email,
          password: admin.password,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: UserRole.ADMIN,
          status: UserStatus.PENDING, // Require email verification
          emailVerified: false,
        },
        null, // First admin user, no creator
        newCompany.id
      );

      // Send email verification
      try {
        await AuthService.sendEmailVerification(
          admin.email,
          `${admin.firstName} ${admin.lastName}`
        );
        logger.info('Email verification sent for new admin user', {
          adminUserId: adminUser.id,
          email: admin.email,
        });
      } catch (emailError) {
        logger.warn('Failed to send email verification during registration', {
          adminUserId: adminUser.id,
          email: admin.email,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
        // Don't fail registration if email fails, but log it
      }

      const response: ApiResponse = {
        success: true,
        data: {
          company: {
            id: newCompany.id,
            name: newCompany.name,
            email: newCompany.email,
          },
          admin: adminUser,
        },
        message: 'Empresa e usuário criados com sucesso. Verifique seu email para ativar a conta.',
      };

      logger.info('Company and admin user registered', {
        companyId: newCompany.id,
        adminUserId: adminUser.id,
        companyName: newCompany.name,
        adminEmail: admin.email,
      });

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password
   * POST /auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: ForgotPasswordInput = req.body;

      await AuthService.forgotPassword(data);

      const response: ApiResponse = {
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir sua senha',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   * POST /auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: ResetPasswordInput = req.body;

      await AuthService.resetPassword(data);

      const response: ApiResponse = {
        success: true,
        message: 'Senha redefinida com sucesso',
      };

      logger.info('Password reset successful', {
        token: data.token.substring(0, 8) + '...',
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * POST /auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      await UserService.changePassword(userId, data, companyId);

      const response: ApiResponse = {
        success: true,
        message: 'Senha alterada com sucesso',
      };

      logger.info('Password changed successfully', {
        userId,
        companyId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke all sessions (logout from all devices)
   * POST /auth/revoke-all-sessions
   */
  static async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      await AuthService.revokeAllSessions(userId);

      const response: ApiResponse = {
        success: true,
        message: 'Todas as sessões foram revogadas',
      };

      logger.info('All sessions revoked', { userId });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if email exists (for registration validation)
   * POST /auth/check-email
   */
  static async checkEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          exists: !!existingUser,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email address
   * GET /auth/verify-email/:token
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;

      await AuthService.verifyEmail(token);

      const response: ApiResponse = {
        success: true,
        message: 'Email verificado com sucesso! Sua conta foi ativada.',
      };

      logger.info('Email verified successfully', {
        token: token.substring(0, 8) + '...',
      });

      // Redirect to frontend success page or return JSON
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/email-verified?success=true`;
      
      if (req.accepts('html')) {
        res.redirect(redirectUrl);
      } else {
        res.status(200).json(response);
      }
    } catch (error) {
      logger.error('Email verification failed', {
        token: req.params.token?.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Handle error redirect for HTML requests
      if (req.accepts('html')) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/email-verified?success=false&error=${encodeURIComponent(error instanceof Error ? error.message : 'Erro desconhecido')}`;
        res.redirect(redirectUrl);
      } else {
        next(error);
      }
    }
  }

  /**
   * Resend email verification
   * POST /auth/resend-verification
   */
  static async resendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      await AuthService.resendEmailVerification(email);

      const response: ApiResponse = {
        success: true,
        message: 'Se o email existir e não estiver verificado, você receberá um novo link de verificação',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile (basic data only: name, phone)
   * PATCH /auth/profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateProfileInput = req.body;
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      const updatedUser = await UserService.updateProfile(userId, data, companyId);

      const response: ApiResponse = {
        success: true,
        data: updatedUser,
        message: 'Perfil atualizado com sucesso',
      };

      logger.info('User profile updated', {
        userId,
        companyId,
        ipAddress: req.ip,
        changes: Object.keys(data),
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user password
   * PATCH /auth/password
   */
  static async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdatePasswordInput = req.body;
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      await UserService.updatePassword(userId, data as { oldPassword: string; newPassword: string }, companyId);

      const response: ApiResponse = {
        success: true,
        message: 'Senha alterada com sucesso',
      };

      logger.info('User password updated via profile', {
        userId,
        companyId,
        ipAddress: req.ip,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload and update user avatar
   * POST /auth/avatar
   */
  static async updateAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      // Check if file was uploaded
      if (!req.file) {
        const response: ApiResponse = {
          success: false,
          error: 'Nenhum arquivo foi enviado',
        };
        res.status(400).json(response);
        return;
      }

      // Log file details for debugging
      console.log('📁 File details:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      });

      // Generate a unique filename since we're using memoryStorage
      const fileExtension = req.file.originalname?.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const filename = `avatar_${userId}_${timestamp}.${fileExtension}`;
      
      console.log('🎯 Generated filename:', filename);
      
      // Save file to uploads directory
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../../uploads/avatars', userId);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 Created directory:', uploadsDir);
      }
      
      // Save the file
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      console.log('💾 File saved to:', filePath);
      
      const avatarUrl = `/uploads/avatars/${userId}/${filename}`;
      console.log('🔗 Avatar URL:', avatarUrl);

      const updatedUser = await UserService.updateAvatar(userId, avatarUrl, companyId);

      const response: ApiResponse = {
        success: true,
        data: {
          user: updatedUser,
          avatarUrl: avatarUrl,
        },
        message: 'Avatar atualizado com sucesso',
      };

      logger.info('User avatar updated', {
        userId,
        companyId,
        avatarUrl,
        ipAddress: req.ip,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}