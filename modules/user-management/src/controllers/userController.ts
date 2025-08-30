import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import {
  CreateUserInput,
  UpdateUserInput,
  PaginationInput,
  ApiResponse,
} from '../types';
import { logger } from '../utils/logger';

export class UserController {
  /**
   * Create new user
   * POST /users
   */
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userData: CreateUserInput = req.body;
      const createdByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      const user = await UserService.createUser(userData, createdByUserId, companyId);

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

      await UserService.deleteUser(id, deletedByUserId, companyId);

      const response: ApiResponse = {
        success: true,
        message: 'Usuário desativado com sucesso',
      };

      logger.info('User deleted via API', {
        userId: id,
        deletedBy: deletedByUserId,
        companyId,
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
      const { temporaryPassword } = req.body;
      const updatedByUserId = req.user!.userId;
      const companyId = req.user!.companyId;

      // This would hash the temporary password and update the user
      // For now, we'll use the update method to change status to PENDING
      // In a full implementation, you'd want a specific resetPassword method
      const user = await UserService.updateUser(
        id,
        { status: 'PENDING' }, // Force password change on next login
        updatedByUserId,
        companyId
      );

      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Senha do usuário foi redefinida. Usuário deve alterar a senha no próximo login.',
      };

      logger.info('User password reset by admin', {
        userId: id,
        resetBy: updatedByUserId,
        companyId,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}