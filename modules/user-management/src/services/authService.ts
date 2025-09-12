import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, User, Session, UserRole } from '@prisma/client';
import {
  LoginInput,
  JwtPayload,
  LoginResponse,
  RefreshTokenResponse,
  UserSummary,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { SessionStore, Cache } from '../utils/redis';
import { secureJwtManager } from '../utils/secureJwt';
import { emailService } from './emailService';
import { notificationClient } from './notificationClient';

const prisma = new PrismaClient();

/**
 * Generate permissions array based on user role
 */
const generatePermissionsByRole = (role: UserRole): string[] => {
  const permissions: string[] = [];
  
  switch (role) {
    case 'ADMIN':
      // Admin has all permissions across all modules
      permissions.push(
        'CRM:read', 'CRM:write', 'CRM:delete', 'CRM:admin',
        'AGENDAMENTO:read', 'AGENDAMENTO:write', 'AGENDAMENTO:delete', 'AGENDAMENTO:admin',
        'SERVICES:read', 'SERVICES:write', 'SERVICES:delete', 'SERVICES:admin',
        'USER_MANAGEMENT:read', 'USER_MANAGEMENT:write', 'USER_MANAGEMENT:delete', 'USER_MANAGEMENT:admin',
        'ANALYTICS:read', 'ANALYTICS:write', 'ANALYTICS:admin',
        'SYSTEM:admin'
      );
      break;
      
    case 'MANAGER':
      // Manager has read/write permissions but limited delete and no admin
      permissions.push(
        'CRM:read', 'CRM:write',
        'AGENDAMENTO:read', 'AGENDAMENTO:write',
        'SERVICES:read', 'SERVICES:write',
        'ANALYTICS:read',
        'USER_MANAGEMENT:read'
      );
      break;
      
    case 'USER':
      // Regular user has basic read/write permissions
      permissions.push(
        'CRM:read', 'CRM:write',
        'AGENDAMENTO:read', 'AGENDAMENTO:write',
        'SERVICES:read'
      );
      break;
      
    case 'VIEWER':
      // Viewer has only read permissions
      permissions.push(
        'CRM:read',
        'AGENDAMENTO:read',
        'SERVICES:read'
      );
      break;
      
    default:
      // Default case - minimal permissions
      permissions.push('CRM:read');
      break;
  }
  
  return permissions;
};

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(data: LoginInput, deviceInfo?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResponse> {
    try {
      logger.info('🔍 [DEBUG] Iniciando processo de login', {
        email: data.email,
        timestamp: new Date().toISOString()
      });

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              plan: true,
              isActive: true,
            },
          },
        },
      });

      if (!user) {
        logger.error('❌ [DEBUG] Usuário não encontrado', { email: data.email });
        throw new UnauthorizedError('Email ou senha incorretos');
      }

      logger.info('✅ [DEBUG] Usuário encontrado', {
        userId: user.id,
        email: user.email,
        status: user.status,
        emailVerified: user.emailVerified,
        hasPassword: !!user.password,
        passwordLength: user.password?.length || 0,
        passwordHash: user.password?.substring(0, 10) + '...',
        companyActive: user.company.isActive
      });

      // Check if user is active - TEMPORARILY DISABLED FOR TESTING
      // if (user.status !== 'ACTIVE') {
      //   logger.error('❌ [DEBUG] Usuário com status inativo', { 
      //     userId: user.id, 
      //     status: user.status 
      //   });
      //   throw new UnauthorizedError('Usuário inativo ou suspenso');
      // }

      // Check if company is active
      if (!user.company.isActive) {
        logger.error('❌ [DEBUG] Empresa inativa', { 
          companyId: user.company.id,
          isActive: user.company.isActive 
        });
        throw new UnauthorizedError('Empresa inativa');
      }

      logger.info('🔐 [DEBUG] Iniciando verificação de senha', {
        inputPassword: data.password,
        storedHash: user.password,
        inputPasswordLength: data.password.length,
        storedHashLength: user.password.length
      });

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.password);
      
      logger.info('🔐 [DEBUG] Resultado da verificação de senha', {
        isPasswordValid,
        bcryptVersion: require('bcryptjs/package.json').version,
        inputPassword: data.password,
        storedHash: user.password
      });

      if (!isPasswordValid) {
        logger.error('❌ [DEBUG] Senha inválida', {
          userId: user.id,
          email: user.email,
          inputPassword: data.password,
          storedHash: user.password
        });

        // Send failed login notification
        try {
          await notificationClient.notifyFailedLogin(
            user.companyId,
            user.id,
            user.email,
            deviceInfo?.ipAddress,
            deviceInfo?.userAgent
          );
        } catch (notificationError) {
          logger.warn('Failed to send failed login notification', {
            userId: user.id,
            error: notificationError
          });
        }

        throw new UnauthorizedError('Email ou senha incorretos');
      }

      logger.info('✅ [DEBUG] Senha válida, prosseguindo com login', {
        userId: user.id,
        email: user.email
      });

      // Create session
      const sessionId = uuidv4();
      
      // Generate permissions based on user role
      const permissions = generatePermissionsByRole(user.role);
      
      const jwtPayload: JwtPayload = {
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
        sessionId,
        permissions,
      };

      // Generate tokens using secure JWT manager
      const bindingInfo = {
        sessionId,
        ipAddress: deviceInfo?.ipAddress || 'unknown',
        userAgent: deviceInfo?.userAgent || 'unknown'
      };

      const accessToken = secureJwtManager.generateAccessToken(jwtPayload, bindingInfo);

      const refreshToken = jwt.sign(
        { sessionId, userId: user.id },
        config.jwtSecret,
        { expiresIn: config.jwtRefreshExpiresIn } as jwt.SignOptions
      );

      // Calculate expiration times based on JWT config
      const accessTokenExpiresAt = new Date();
      const expiresInHours = config.jwtExpiresIn.endsWith('h') ? 
        parseInt(config.jwtExpiresIn.slice(0, -1)) : 24;
      accessTokenExpiresAt.setHours(accessTokenExpiresAt.getHours() + expiresInHours);

      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7); // 7 days

      // Save session to database
      await prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          companyId: user.companyId,
          accessToken,
          refreshToken,
          deviceInfo: deviceInfo?.userAgent,
          ipAddress: deviceInfo?.ipAddress,
          userAgent: deviceInfo?.userAgent,
          expiresAt: refreshTokenExpiresAt,
        },
      });

      // Update user's last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Store session in Redis for faster access
      await SessionStore.set(
        sessionId,
        jwtPayload,
        7 * 24 * 60 * 60 // 7 days in seconds
      );

      // Create user summary response
      const userSummary: UserSummary = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLoginAt: new Date(),
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      };

      // Log successful login
      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
      });

      // Send login success notification
      try {
        await notificationClient.notifySuccessfulLogin(
          user.companyId,
          user.id,
          user.email,
          deviceInfo?.ipAddress,
          deviceInfo?.userAgent
        );
      } catch (notificationError) {
        logger.warn('Failed to send login success notification', {
          userId: user.id,
          error: notificationError
        });
      }

      return {
        user: userSummary,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: expiresInHours * 60 * 60, // hours in seconds
        },
      };
    } catch (error) {
      logger.error('Login failed', {
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Logout user by revoking session
   */
  static async logout(sessionId: string): Promise<void> {
    try {
      // Revoke session in database
      const session = await prisma.session.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });

      // Remove session from Redis
      await SessionStore.delete(sessionId);

      logger.info('User logged out successfully', {
        sessionId,
        userId: session.userId,
      });
    } catch (error) {
      logger.error('Logout failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as any;
      const { sessionId, userId } = decoded;

      // Find session in database
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
          refreshToken,
          isRevoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              status: true,
              companyId: true,
            },
          },
        },
      });

      if (!session) {
        throw new UnauthorizedError('Refresh token inválido ou expirado');
      }

      // Check if user is still active
      if (session.user.status !== 'ACTIVE') {
        throw new UnauthorizedError('Usuário inativo');
      }

      // Generate new access token with permissions
      const permissions = generatePermissionsByRole(session.user.role);
      
      const jwtPayload: JwtPayload = {
        userId: session.user.id,
        companyId: session.user.companyId,
        role: session.user.role,
        sessionId,
        permissions,
      };

      const newAccessToken = jwt.sign(jwtPayload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      } as jwt.SignOptions);

      // Generate new refresh token to maintain security
      const newRefreshToken = jwt.sign(
        { sessionId, userId: session.user.id },
        config.jwtSecret,
        { expiresIn: config.jwtRefreshExpiresIn } as jwt.SignOptions
      );

      // Update refresh token expiration
      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7); // 7 days

      // Update session with new tokens
      await prisma.session.update({
        where: { id: sessionId },
        data: { 
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: refreshTokenExpiresAt
        },
      });

      // Update Redis session
      await SessionStore.set(
        sessionId,
        jwtPayload,
        7 * 24 * 60 * 60 // 7 days in seconds
      );

      logger.info('Token refreshed successfully', {
        sessionId,
        userId: session.user.id,
      });

      // Calculate expiration time for response
      const expiresInHours = config.jwtExpiresIn.endsWith('h') ? 
        parseInt(config.jwtExpiresIn.slice(0, -1)) : 24;
      
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: expiresInHours * 60 * 60, // hours in seconds
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token inválido');
      }
      throw error;
    }
  }

  /**
   * Validate access token (used by other modules)
   */
  static async validateToken(accessToken: string): Promise<JwtPayload | null> {
    try {
      // For API gateway validation, we need to use a simpler approach
      // since we don't have the original client context for fingerprint validation
      
      // First, try to validate with SecureJwtManager using minimal binding info
      try {
        const bindingInfo = {
          sessionId: 'gateway-validation',
          ipAddress: '127.0.0.1',
          userAgent: 'nexus-api-gateway'
        };
        
        const decoded = secureJwtManager.verifyAccessToken(accessToken, bindingInfo);
        
        // Check if session exists in Redis first (faster)
        const cachedSession = await SessionStore.get(decoded.sessionId);
        if (cachedSession) {
          return cachedSession;
        }

        // If not in Redis, check database
        const session = await prisma.session.findFirst({
          where: {
            id: decoded.sessionId,
            isRevoked: false,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!session || session.user.status !== 'ACTIVE') {
          return null;
        }

        return decoded;
      } catch (secureError) {
        // Fallback to legacy JWT validation for backward compatibility
        logger.warn('Secure JWT validation failed, trying fallback', { 
          error: secureError instanceof Error ? secureError.message : 'Unknown error' 
        });
        
        const decoded = jwt.verify(accessToken, config.jwtSecret) as JwtPayload;

        // Check if session exists in Redis first (faster)
        const cachedSession = await SessionStore.get(decoded.sessionId);
        if (cachedSession) {
          return cachedSession;
        }

        // If not in Redis, check database
        const session = await prisma.session.findFirst({
          where: {
            id: decoded.sessionId,
            isRevoked: false,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!session || session.user.status !== 'ACTIVE') {
          return null;
        }

        return decoded;
      }
    } catch (error) {
      logger.warn('Token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Validate access token for API gateway (simplified validation)
   * Bypasses fingerprint validation for gateway-to-service communication
   */
  static async validateTokenForGateway(accessToken: string): Promise<JwtPayload | null> {
    try {
      logger.info('🔍 [DEBUG] Gateway token validation started', {
        tokenPreview: accessToken.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });

      // Try to decode the token first to get the payload
      const decoded = jwt.decode(accessToken) as JwtPayload;
      if (!decoded || !decoded.sessionId) {
        logger.error('❌ [DEBUG] Token decode failed or missing sessionId', {
          tokenPreview: accessToken.substring(0, 20) + '...',
          hasDecoded: !!decoded,
          hasSessionId: !!(decoded && decoded.sessionId)
        });
        return null;
      }

      logger.info('✅ [DEBUG] Token decoded successfully', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        hasIss: !!decoded.iss,
        hasAud: !!decoded.aud,
        hasJti: !!decoded.jti,
        hasFingerprint: !!decoded.fingerprint
      });

      // Check if session exists in Redis first (faster)
      const cachedSession = await SessionStore.get(decoded.sessionId);
      if (cachedSession) {
        logger.info('✅ [DEBUG] Session found in Redis', {
          sessionId: decoded.sessionId
        });
        return cachedSession;
      }

      // If not in Redis, check database
      const session = await prisma.session.findFirst({
        where: {
          id: decoded.sessionId,
          isRevoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!session || session.user.status !== 'ACTIVE') {
        logger.error('❌ [DEBUG] Session not found or user inactive', {
          sessionId: decoded.sessionId,
          sessionExists: !!session,
          userStatus: session?.user.status
        });
        return null;
      }

      logger.info('✅ [DEBUG] Session validated in database', {
        sessionId: decoded.sessionId,
        userStatus: session.user.status
      });

      // Verify the token signature using the appropriate secret
      try {
        logger.info('🔐 [DEBUG] Trying SecureJwtManager validation...');
        // Try with SecureJwtManager first
        const bindingInfo = {
          sessionId: decoded.sessionId,
          ipAddress: '127.0.0.1',
          userAgent: 'nexus-api-gateway'
        };
        
        const verified = secureJwtManager.verifyAccessToken(accessToken, bindingInfo);
        logger.info('✅ [DEBUG] SecureJwtManager validation successful', {
          userId: verified.userId,
          sessionId: verified.sessionId
        });
        return verified;
      } catch (secureError) {
        logger.warn('⚠️ [DEBUG] SecureJwtManager validation failed, trying legacy...', { 
          secureError: secureError instanceof Error ? secureError.message : 'Unknown error'
        });
        
        // Fallback to legacy JWT validation
        try {
          logger.info('🔐 [DEBUG] Trying legacy JWT validation...');
          const verified = jwt.verify(accessToken, config.jwtSecret) as JwtPayload;
          logger.info('✅ [DEBUG] Legacy JWT validation successful', {
            userId: verified.userId,
            sessionId: verified.sessionId
          });
          return verified;
        } catch (legacyError) {
          logger.error('❌ [DEBUG] Gateway token validation failed with both methods', { 
            secureError: secureError instanceof Error ? secureError.message : 'Unknown error',
            legacyError: legacyError instanceof Error ? legacyError.message : 'Unknown error'
          });
          return null;
        }
      }
    } catch (error) {
      logger.error('❌ [DEBUG] Gateway token validation failed with exception', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenPreview: accessToken.substring(0, 20) + '...'
      });
      return null;
    }
  }

  /**
   * Generate password reset token
   */
  static async forgotPassword(data: ForgotPasswordInput): Promise<void> {
    try {
      const user = await prisma.user.findFirst({
        where: { 
          email: data.email,
          status: 'ACTIVE' // Only allow password reset for active users
        },
      });

      if (!user) {
        // Don't reveal if email exists or not for security
        logger.warn('Password reset requested for non-existent or inactive email', {
          email: data.email,
        });
        return;
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpires = new Date();
      resetTokenExpires.setMinutes(resetTokenExpires.getMinutes() + 10); // 10 minutes for security

      // Invalidate any existing password reset requests for this email
      await prisma.passwordResetRequest.updateMany({
        where: {
          email: data.email,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      // Create new password reset request
      await prisma.passwordResetRequest.create({
        data: {
          email: data.email,
          token: hashedToken,
          expiresAt: resetTokenExpires,
        },
      });

      // Send password reset email
      try {
        await emailService.sendPasswordReset(
          user.email, 
          resetToken, // Send original token (not hashed) in email
          `${user.firstName} ${user.lastName}`
        );
        logger.info('Password reset email sent successfully', {
          userId: user.id,
          email: user.email,
        });
      } catch (emailError) {
        logger.error('Failed to send password reset email', {
          userId: user.id,
          email: user.email,
          error: emailError instanceof Error ? emailError.message : 'Unknown email error',
        });
        // Don't throw error to prevent revealing email status to user
      }

      logger.info('Password reset token generated', {
        userId: user.id,
        email: user.email,
        expiresAt: resetTokenExpires,
      });
    } catch (error) {
      logger.error('Failed to generate password reset token', {
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  static async resetPassword(data: ResetPasswordInput): Promise<void> {
    try {
      // Hash the received token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(data.token).digest('hex');

      // Find reset request by hashed token
      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: {
          token: hashedToken,
          isUsed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!resetRequest) {
        throw new UnauthorizedError('Token de redefinição inválido ou expirado');
      }

      // Find user
      const user = await prisma.user.findFirst({
        where: { 
          email: resetRequest.email,
          status: 'ACTIVE' // Ensure user is still active
        },
      });

      if (!user) {
        throw new NotFoundError('Usuário não encontrado ou inativo');
      }

      // Hash new password with strong salt rounds
      const hashedPassword = await bcrypt.hash(data.password, config.bcryptSaltRounds);

      // Update user password and clear old reset token fields
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Mark reset request as used
      await prisma.passwordResetRequest.update({
        where: { id: resetRequest.id },
        data: { isUsed: true },
      });

      // Invalidate all existing password reset requests for this email for security
      await prisma.passwordResetRequest.updateMany({
        where: {
          email: resetRequest.email,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      // Revoke all existing sessions for security (force re-login)
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      // Clear Redis sessions
      const sessions = await prisma.session.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      for (const session of sessions) {
        await SessionStore.delete(session.id);
      }

      logger.info('Password reset successfully', {
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
      });

      // Send password reset notification
      try {
        await notificationClient.notifyPasswordReset(
          user.companyId,
          user.id,
          user.email
        );
      } catch (notificationError) {
        logger.warn('Failed to send password reset notification', {
          userId: user.id,
          error: notificationError
        });
      }

      // Create audit log for password reset
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          action: 'PASSWORD_RESET',
          entityType: 'USER',
          entityId: user.id,
          success: true,
          createdAt: new Date(),
        },
      });

    } catch (error) {
      logger.error('Password reset failed', {
        token: data.token.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcryptSaltRounds);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Send email verification token
   */
  static async sendEmailVerification(email: string, userName?: string): Promise<void> {
    try {
      // Generate secure verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

      // Invalidate any existing email verification requests
      await prisma.emailVerification.updateMany({
        where: {
          email,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      // Create new email verification request
      await prisma.emailVerification.create({
        data: {
          email,
          token: verificationToken,
          expiresAt: verificationExpires,
        },
      });

      // Send verification email
      try {
        await emailService.sendEmailVerification(
          email,
          verificationToken,
          userName
        );
        logger.info('Email verification sent successfully', {
          email,
          expiresAt: verificationExpires,
        });
      } catch (emailError) {
        logger.error('Failed to send email verification', {
          email,
          error: emailError instanceof Error ? emailError.message : 'Unknown email error',
        });
        throw new Error('Erro ao enviar email de verificação');
      }
    } catch (error) {
      logger.error('Failed to send email verification', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify email using verification token
   */
  static async verifyEmail(token: string): Promise<void> {
    try {
      // Find verification request
      const verification = await prisma.emailVerification.findFirst({
        where: {
          token,
          isUsed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!verification) {
        throw new UnauthorizedError('Token de verificação inválido ou expirado');
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: verification.email },
      });

      if (!user) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Update user to verified and active status
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          status: 'ACTIVE', // Activate user after email verification
        },
      });

      // Mark verification as used
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { isUsed: true },
      });

      // Invalidate all other verification requests for this email
      await prisma.emailVerification.updateMany({
        where: {
          email: verification.email,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });

      logger.info('Email verified successfully', {
        userId: user.id,
        email: user.email,
        timestamp: new Date(),
      });

      // Create audit log for email verification
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          action: 'EMAIL_VERIFIED',
          entityType: 'USER',
          entityId: user.id,
          success: true,
          createdAt: new Date(),
        },
      });

    } catch (error) {
      logger.error('Email verification failed', {
        token: token.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if email exists for security
        logger.warn('Email verification resend requested for non-existent email', {
          email,
        });
        return;
      }

      if (user.emailVerified) {
        throw new ConflictError('Email já verificado');
      }

      await this.sendEmailVerification(
        email, 
        `${user.firstName} ${user.lastName}`
      );

      logger.info('Email verification resent', {
        userId: user.id,
        email,
      });
    } catch (error) {
      logger.error('Failed to resend email verification', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  static async revokeAllSessions(userId: string): Promise<void> {
    try {
      // Get all sessions for user
      const sessions = await prisma.session.findMany({
        where: { userId },
        select: { id: true },
      });

      // Revoke all sessions in database
      await prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });

      // Remove all sessions from Redis
      for (const session of sessions) {
        await SessionStore.delete(session.id);
      }

      logger.info('All sessions revoked for user', { userId });
    } catch (error) {
      logger.error('Failed to revoke all sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}