import { PrismaClient, User, UserRole, UserStatus } from '@prisma/client';
import {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  UserSummary,
  PaginationInput,
  PaginatedResponse,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  CreateUserData,
  UpdateUserData,
} from '../types';
import { AuthService } from './authService';
import { logger } from '../utils/logger';
import { Cache } from '../utils/redis';

const prisma = new PrismaClient();

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserInput,
    createdByUserId: string,
    companyId: string
  ): Promise<UserSummary> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ConflictError('Usuário já existe com este email');
      }

      // Check company user limits
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!company) {
        throw new NotFoundError('Empresa não encontrada');
      }

      if (company._count.users >= company.maxUsers) {
        throw new ConflictError('Limite de usuários da empresa atingido');
      }

      // Hash password
      const hashedPassword = await AuthService.hashPassword(data.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role || UserRole.USER,
          status: UserStatus.ACTIVE,
          companyId,
          createdBy: createdByUserId,
        },
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

      // Create audit log
      await this.createAuditLog({
        userId: createdByUserId,
        companyId,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: user.id,
        newValues: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
        },
      });

      // Clear user cache
      await Cache.deletePattern(`users:${companyId}:*`);

      const userSummary: UserSummary = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      };

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        createdBy: createdByUserId,
        companyId,
      });

      return userSummary;
    } catch (error) {
      logger.error('Failed to create user', {
        email: data.email,
        createdBy: createdByUserId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string, companyId: string): Promise<UserSummary> {
    try {
      // Check cache first
      const cacheKey = `user:${userId}`;
      const cachedUser = await Cache.get<UserSummary>(cacheKey);
      if (cachedUser) {
        return cachedUser;
      }

      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
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

      if (!user) {
        throw new NotFoundError('Usuário não encontrado');
      }

      const userSummary: UserSummary = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      };

      // Cache user for 5 minutes
      await Cache.set(cacheKey, userSummary, 300);

      return userSummary;
    } catch (error) {
      logger.error('Failed to get user by ID', {
        userId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(
    companyId: string,
    pagination: PaginationInput
  ): Promise<PaginatedResponse<UserSummary>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc', search } = pagination;

      // Build where clause
      const where: any = {
        companyId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Check cache
      const cacheKey = `users:${companyId}:${JSON.stringify(pagination)}`;
      const cachedResult = await Cache.get<PaginatedResponse<UserSummary>>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get total count
      const total = await prisma.user.count({ where });

      // Calculate pagination
      const skip = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get users
      const users = await prisma.user.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              plan: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      const userSummaries: UserSummary[] = users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      }));

      const result: PaginatedResponse<UserSummary> = {
        data: userSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      // Cache result for 2 minutes
      await Cache.set(cacheKey, result, 120);

      return result;
    } catch (error) {
      logger.error('Failed to get users', {
        companyId,
        pagination,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  static async updateUser(
    userId: string,
    data: UpdateUserInput,
    updatedByUserId: string,
    companyId: string
  ): Promise<UserSummary> {
    try {
      // Check if user exists and belongs to company
      const existingUser = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!existingUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Check if email is being changed and already exists
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (emailExists) {
          throw new ConflictError('Email já está em uso');
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
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

      // Create audit log
      await this.createAuditLog({
        userId: updatedByUserId,
        companyId,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: userId,
        oldValues: {
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          status: existingUser.status,
        },
        newValues: data,
      });

      // Clear caches
      await Cache.delete(`user:${userId}`);
      await Cache.deletePattern(`users:${companyId}:*`);

      const userSummary: UserSummary = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        status: updatedUser.status,
        avatar: updatedUser.avatar,
        lastLoginAt: updatedUser.lastLoginAt,
        company: {
          id: updatedUser.company.id,
          name: updatedUser.company.name,
          plan: updatedUser.company.plan,
        },
      };

      logger.info('User updated successfully', {
        userId,
        updatedBy: updatedByUserId,
        companyId,
        changes: Object.keys(data),
      });

      return userSummary;
    } catch (error) {
      logger.error('Failed to update user', {
        userId,
        updatedBy: updatedByUserId,
        companyId,
        data,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete user (soft delete by deactivating)
   */
  static async deleteUser(
    userId: string,
    deletedByUserId: string,
    companyId: string
  ): Promise<void> {
    try {
      // Check if user exists and belongs to company
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Prevent self-deletion
      if (userId === deletedByUserId) {
        throw new ConflictError('Não é possível deletar seu próprio usuário');
      }

      // Soft delete by changing status to INACTIVE
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.INACTIVE,
          updatedAt: new Date(),
        },
      });

      // Revoke all sessions for the user
      await AuthService.revokeAllSessions(userId);

      // Create audit log
      await this.createAuditLog({
        userId: deletedByUserId,
        companyId,
        action: 'DELETE_USER',
        entityType: 'USER',
        entityId: userId,
        oldValues: {
          status: user.status,
        },
        newValues: {
          status: UserStatus.INACTIVE,
        },
      });

      // Clear caches
      await Cache.delete(`user:${userId}`);
      await Cache.deletePattern(`users:${companyId}:*`);

      logger.info('User deleted successfully', {
        userId,
        deletedBy: deletedByUserId,
        companyId,
      });
    } catch (error) {
      logger.error('Failed to delete user', {
        userId,
        deletedBy: deletedByUserId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    data: ChangePasswordInput,
    companyId: string
  ): Promise<void> {
    try {
      // Get current user
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Verify current password
      const isCurrentPasswordValid = await AuthService.verifyPassword(
        data.currentPassword,
        user.password
      );

      if (!isCurrentPasswordValid) {
        throw new UnauthorizedError('Senha atual incorreta');
      }

      // Hash new password
      const newHashedPassword = await AuthService.hashPassword(data.newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: newHashedPassword,
          updatedAt: new Date(),
        },
      });

      // Revoke all existing sessions for security (except current one would need session context)
      await AuthService.revokeAllSessions(userId);

      // Create audit log
      await this.createAuditLog({
        userId,
        companyId,
        action: 'CHANGE_PASSWORD',
        entityType: 'USER',
        entityId: userId,
      });

      logger.info('Password changed successfully', {
        userId,
        companyId,
      });
    } catch (error) {
      logger.error('Failed to change password', {
        userId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user profile (current user)
   */
  static async getProfile(userId: string, companyId: string): Promise<UserSummary> {
    return this.getUserById(userId, companyId);
  }

  /**
   * Update user profile (current user) - Profile-specific data only
   */
  static async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; email?: string; phone?: string },
    companyId: string
  ): Promise<UserSummary> {
    try {
      // Check if user exists and belongs to company
      const existingUser = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!existingUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Check if email is being changed and already exists
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (emailExists) {
          throw new ConflictError('Email já está em uso');
        }
      }

      // Update only profile fields
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
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

      // Create audit log
      await this.createAuditLog({
        userId,
        companyId,
        action: 'UPDATE_PROFILE',
        entityType: 'USER',
        entityId: userId,
        oldValues: {
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          phone: existingUser.phone,
        },
        newValues: data,
      });

      // Clear caches
      await Cache.delete(`user:${userId}`);
      await Cache.deletePattern(`users:${companyId}:*`);

      const userSummary: UserSummary = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.status,
        avatar: updatedUser.avatar,
        lastLoginAt: updatedUser.lastLoginAt,
        company: {
          id: updatedUser.company.id,
          name: updatedUser.company.name,
          plan: updatedUser.company.plan,
        },
      };

      logger.info('User profile updated successfully', {
        userId,
        companyId,
        changes: Object.keys(data),
      });

      return userSummary;
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId,
        companyId,
        data,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user password (profile endpoint)
   */
  static async updatePassword(
    userId: string,
    data: { oldPassword: string; newPassword: string },
    companyId: string
  ): Promise<void> {
    try {
      // Get current user
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Verify current password
      const isOldPasswordValid = await AuthService.verifyPassword(
        data.oldPassword,
        user.password
      );

      if (!isOldPasswordValid) {
        throw new UnauthorizedError('Senha atual incorreta');
      }

      // Hash new password
      const newHashedPassword = await AuthService.hashPassword(data.newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: newHashedPassword,
          updatedAt: new Date(),
        },
      });

      // Create audit log (don't log sensitive password data)
      await this.createAuditLog({
        userId,
        companyId,
        action: 'UPDATE_PASSWORD_PROFILE',
        entityType: 'USER',
        entityId: userId,
      });

      // Clear user cache
      await Cache.delete(`user:${userId}`);

      logger.info('User password updated via profile', {
        userId,
        companyId,
      });
    } catch (error) {
      logger.error('Failed to update user password via profile', {
        userId,
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user avatar
   */
  static async updateAvatar(
    userId: string,
    avatarUrl: string,
    companyId: string
  ): Promise<UserSummary> {
    try {
      // Check if user exists and belongs to company
      const existingUser = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
      });

      if (!existingUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Update avatar
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          avatar: avatarUrl,
          updatedAt: new Date(),
        },
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

      // Create audit log
      await this.createAuditLog({
        userId,
        companyId,
        action: 'UPDATE_AVATAR',
        entityType: 'USER',
        entityId: userId,
        oldValues: {
          avatar: existingUser.avatar,
        },
        newValues: {
          avatar: avatarUrl,
        },
      });

      // Clear caches
      await Cache.delete(`user:${userId}`);
      await Cache.deletePattern(`users:${companyId}:*`);

      const userSummary: UserSummary = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        status: updatedUser.status,
        avatar: updatedUser.avatar,
        lastLoginAt: updatedUser.lastLoginAt,
        company: {
          id: updatedUser.company.id,
          name: updatedUser.company.name,
          plan: updatedUser.company.plan,
        },
      };

      logger.info('User avatar updated successfully', {
        userId,
        companyId,
      });

      return userSummary;
    } catch (error) {
      logger.error('Failed to update user avatar', {
        userId,
        companyId,
        avatarUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private static async createAuditLog(data: {
    userId: string;
    companyId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          companyId: data.companyId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          oldValues: data.oldValues,
          newValues: data.newValues,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: data.success ?? true,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log', { error });
      // Don't throw error for audit log failures
    }
  }

  /**
   * Get user statistics for dashboard
   */
  static async getUserStats(companyId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    recentLogins: number;
  }> {
    try {
      const cacheKey = `user_stats:${companyId}`;
      const cachedStats = await Cache.get(cacheKey) as {
        total: number;
        active: number;
        inactive: number;
        byRole: Record<string, number>;
        recentLogins: number;
      } | null;
      if (cachedStats) {
        return cachedStats;
      }

      const [total, active, inactive, byRole, recentLogins] = await Promise.all([
        prisma.user.count({ where: { companyId } }),
        prisma.user.count({ where: { companyId, status: UserStatus.ACTIVE } }),
        prisma.user.count({ where: { companyId, status: UserStatus.INACTIVE } }),
        prisma.user.groupBy({
          by: ['role'],
          where: { companyId },
          _count: true,
        }),
        prisma.user.count({
          where: {
            companyId,
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
      ]);

      const roleStats = byRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {} as Record<string, number>);

      const stats = {
        total,
        active,
        inactive,
        byRole: roleStats,
        recentLogins,
      };

      // Cache for 10 minutes
      await Cache.set(cacheKey, stats, 600);

      return stats;
    } catch (error) {
      logger.error('Failed to get user stats', {
        companyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return default stats on error
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {},
        recentLogins: 0,
      };
    }
  }
}