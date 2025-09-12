import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../types';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
import { UserService } from '../services/userService';
import { AuthService } from '../services/authService';
import {
  CreateUserInput,
  UpdateUserInput,
  PaginationInput,
  ApiResponse,
  LoginInput,
  AppError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../types';
import { UserRole, UserStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

export class UserController {
  /**
   * User login
   * POST /users/login
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

      logger.info('User login successful via user controller', {
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
   * User logout
   * POST /users/logout
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

      logger.info('User logout successful via user controller', {
        userId: req.user?.userId,
        sessionId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new user
   * POST /users
   */
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userData: CreateUserInput = req.body;
      const createdByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      // Validate that the user has permission to create users
      if (req.user!.role === UserRole.VIEWER) {
        throw new ForbiddenError('Visualizadores não podem criar usuários');
      }

      // Only admins can create other admins or managers
      if ((userData.role === UserRole.ADMIN || userData.role === UserRole.MANAGER) && 
          req.user!.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Apenas administradores podem criar administradores ou gerentes');
      }

      // Add company ID to user data
      const createData = {
        ...userData,
        companyId,
      };

      const user = await UserService.createUser(createData, createdByUserId, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Usuário criado com sucesso',
      };

      logger.info('User created via API', {
        userId: user.id,
        email: user.email,
        createdBy: createdByUserId,
        companyId,
        role: user.role,
      });

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users with pagination
   * GET /users
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      const pagination: PaginationInput = req.query as any;

      const result = await UserService.getUsers(companyId, pagination);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Usuários obtidos com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /users/:id
   */
  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.user!.companyId;

      const user = await UserService.getUserById(id, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Usuário obtido com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user
   * PUT /users/:id
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateUserInput = req.body;
      const updatedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      // Validate that the user has permission to update users
      if (req.user!.role === UserRole.VIEWER) {
        throw new ForbiddenError('Visualizadores não podem atualizar usuários');
      }

      // Get the user being updated to check role-based permissions
      const targetUser = await prisma.user.findFirst({
        where: { id, companyId },
        select: { role: true, id: true }
      });

      if (!targetUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Users can only update their own profile unless they're admin/manager
      if (req.user!.role === UserRole.USER && id !== updatedByUserId) {
        throw new ForbiddenError('Usuários só podem atualizar seu próprio perfil');
      }

      // Only admins can change roles or update admins/managers
      if (updateData.role && req.user!.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Apenas administradores podem alterar funções de usuário');
      }

      // Managers cannot update admins
      if (req.user!.role === UserRole.MANAGER && targetUser.role === UserRole.ADMIN) {
        throw new ForbiddenError('Gerentes não podem atualizar administradores');
      }

      const user = await UserService.updateUser(id, updateData, updatedByUserId, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Usuário atualizado com sucesso',
      };

      logger.info('User updated via API', {
        userId: id,
        updatedBy: updatedByUserId,
        companyId,
        changes: Object.keys(updateData),
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /users/:id
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deletedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      // Validate that the user has permission to delete users
      if (req.user!.role === UserRole.VIEWER || req.user!.role === UserRole.USER) {
        throw new ForbiddenError('Apenas administradores e gerentes podem desativar usuários');
      }

      // Get the user being deleted to check role-based permissions
      const targetUser = await prisma.user.findFirst({
        where: { id, companyId },
        select: { role: true, id: true, email: true }
      });

      if (!targetUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Users cannot delete themselves
      if (id === deletedByUserId) {
        throw new ForbiddenError('Não é possível desativar seu próprio usuário');
      }

      // Managers cannot delete admins
      if (req.user!.role === UserRole.MANAGER && targetUser.role === UserRole.ADMIN) {
        throw new ForbiddenError('Gerentes não podem desativar administradores');
      }

      // Only admins can delete other admins
      if (req.user!.role === UserRole.ADMIN && targetUser.role === UserRole.ADMIN && id !== deletedByUserId) {
        throw new ForbiddenError('Administradores não podem desativar outros administradores');
      }

      await UserService.deleteUser(id, deletedByUserId, companyId);

      const response: ApiResponse = {
        success: true,
        message: 'Usuário desativado com sucesso',
      };

      logger.info('User deleted via API', {
        userId: id,
        deletedBy: deletedByUserId,
        companyId,
        targetUserRole: targetUser.role,
        targetUserEmail: targetUser.email,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /users/profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;

      const user = await UserService.getProfile(userId, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Perfil obtido com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PUT /users/profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const companyId = req.user!.companyId;
      const updateData = req.body;

      const user = await UserService.updateProfile(userId, updateData, companyId);

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Perfil atualizado com sucesso',
      };

      logger.info('User profile updated via API', {
        userId,
        companyId,
        changes: Object.keys(updateData),
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user statistics
   * GET /users/stats
   */
  static async getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;

      const stats = await UserService.getUserStats(companyId);

      const response: ApiResponse = {
        success: true,
        data: stats,
        message: 'Estatísticas de usuários obtidas com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search users
   * GET /users/search
   */
  static async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      const { q: search, ...pagination } = req.query as any;

      const result = await UserService.getUsers(companyId, {
        ...pagination,
        search,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Busca de usuários realizada com sucesso',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Activate user
   * POST /users/:id/activate
   */
  static async activateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updatedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      const user = await UserService.updateUser(
        id,
        { status: 'ACTIVE' },
        updatedByUserId,
        companyId
      );

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Usuário ativado com sucesso',
      };

      logger.info('User activated via API', {
        userId: id,
        activatedBy: updatedByUserId,
        companyId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate user
   * POST /users/:id/deactivate
   */
  static async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updatedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      const user = await UserService.updateUser(
        id,
        { status: 'INACTIVE' },
        updatedByUserId,
        companyId
      );

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Usuário desativado com sucesso',
      };

      logger.info('User deactivated via API', {
        userId: id,
        deactivatedBy: updatedByUserId,
        companyId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset user password (admin only)
   * POST /users/:id/reset-password
   */
  static async resetUserPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { temporaryPassword, forceChange } = req.body;
      const updatedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      // Only admins can reset passwords
      if (req.user!.role !== UserRole.ADMIN) {
        throw new ForbiddenError('Apenas administradores podem redefinir senhas');
      }

      // Get the user being updated
      const targetUser = await prisma.user.findFirst({
        where: { id, companyId },
        select: { email: true, status: true, role: true }
      });

      if (!targetUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Generate a temporary password if not provided
      const tempPassword = temporaryPassword || Math.random().toString(36).slice(-8) + 'A1!';
      
      // Hash the temporary password
      const hashedPassword = await AuthService.hashPassword(tempPassword);

      // Update user password and optionally force password change
      const updateData: any = {
        password: hashedPassword,
      };

      if (forceChange) {
        updateData.status = UserStatus.PENDING;
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              plan: true,
            },
          },
        },
      });

      // Revoke all sessions for security
      await AuthService.revokeAllSessions(id);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: updatedByUserId,
          companyId,
          action: 'RESET_PASSWORD',
          entityType: 'USER',
          entityId: id,
          success: true,
          newValues: {
            passwordReset: true,
            forceChange: !!forceChange,
          },
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            status: user.status,
          },
          temporaryPassword: tempPassword,
          forceChange: !!forceChange,
        },
        message: forceChange 
          ? 'Senha redefinida com sucesso. Usuário deve alterar a senha no próximo login.'
          : 'Senha redefinida com sucesso.',
      };

      logger.info('User password reset by admin', {
        userId: id,
        resetBy: updatedByUserId,
        companyId,
        forceChange: !!forceChange,
        targetUserEmail: targetUser.email,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}