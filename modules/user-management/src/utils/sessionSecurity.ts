import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { redisClient } from './redis';
import { logger } from './logger';
import { config } from './config';

const prisma = new PrismaClient();

export interface SessionInfo {
  sessionId: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  isActive: boolean;
  lastAccessAt: Date;
  expiresAt: Date;
}

export interface SessionMetadata {
  device?: string;
  browser?: string;
  os?: string;
  location?: string;
}

export class SessionSecurityManager {
  private static instance: SessionSecurityManager;
  private readonly maxSessionsPerUser = 5;
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private readonly inactivityTimeout = 30 * 60 * 1000; // 30 minutes
  private readonly encryptionKey: Buffer;

  private constructor() {
    // Generate encryption key for session data
    const keyString = process.env.SESSION_ENCRYPTION_KEY || 'default-session-key-change-in-production';
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
    
    if (config.nodeEnv === 'production' && keyString === 'default-session-key-change-in-production') {
      throw new Error('SESSION_ENCRYPTION_KEY must be set in production');
    }

    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info('Session security manager initialized', {
      maxSessionsPerUser: this.maxSessionsPerUser,
      sessionTimeout: this.sessionTimeout,
      inactivityTimeout: this.inactivityTimeout
    });
  }

  static getInstance(): SessionSecurityManager {
    if (!SessionSecurityManager.instance) {
      SessionSecurityManager.instance = new SessionSecurityManager();
    }
    return SessionSecurityManager.instance;
  }

  /**
   * Encrypt session data
   */
  private encryptSessionData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('session-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt session data
   */
  private decryptSessionData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted session data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('session-data'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const fingerprintData = `${userAgent}|${ipAddress}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Parse user agent for device information
   */
  private parseUserAgent(userAgent: string): SessionMetadata {
    // Simple user agent parsing - in production, use a library like ua-parser-js
    const metadata: SessionMetadata = {};
    
    if (userAgent.includes('Chrome')) metadata.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) metadata.browser = 'Firefox';
    else if (userAgent.includes('Safari')) metadata.browser = 'Safari';
    else if (userAgent.includes('Edge')) metadata.browser = 'Edge';
    
    if (userAgent.includes('Windows')) metadata.os = 'Windows';
    else if (userAgent.includes('Mac OS')) metadata.os = 'macOS';
    else if (userAgent.includes('Linux')) metadata.os = 'Linux';
    else if (userAgent.includes('Android')) metadata.os = 'Android';
    else if (userAgent.includes('iOS')) metadata.os = 'iOS';
    
    if (userAgent.includes('Mobile')) metadata.device = 'Mobile';
    else if (userAgent.includes('Tablet')) metadata.device = 'Tablet';
    else metadata.device = 'Desktop';

    return metadata;
  }

  /**
   * Create new secure session
   */
  async createSession(userId: string, userAgent: string, ipAddress: string): Promise<SessionInfo> {
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    const metadata = this.parseUserAgent(userAgent);

    // Check for existing sessions and limit
    const existingSessions = await this.getActiveSessions(userId);
    
    if (existingSessions.length >= this.maxSessionsPerUser) {
      // Remove oldest session
      const oldestSession = existingSessions.sort((a, b) => 
        a.lastAccessAt.getTime() - b.lastAccessAt.getTime()
      )[0];
      
      await this.revokeSession(oldestSession.sessionId, 'session_limit_exceeded');
      logger.info('Oldest session revoked due to session limit', {
        userId,
        revokedSessionId: oldestSession.sessionId
      });
    }

    // Encrypt sensitive session data
    const encryptedData = this.encryptSessionData(JSON.stringify({
      userAgent,
      ipAddress,
      metadata,
      deviceFingerprint
    }));

    // Create session in database
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        accessToken: '', // Will be set when JWT is generated
        refreshToken: '', // Will be set when JWT is generated
        deviceFingerprint,
        userAgent: encryptedData,
        ipAddress: crypto.createHash('sha256').update(ipAddress).digest('hex'), // Hash IP for privacy
        isRevoked: false,
        lastAccessAt: new Date(),
        expiresAt
      }
    });

    // Store additional session info in Redis for quick access
    const redisSessionKey = `session:${sessionId}`;
    const sessionInfo = {
      userId,
      ipAddress,
      deviceFingerprint,
      createdAt: session.createdAt,
      lastAccessAt: session.lastAccessAt,
      metadata
    };

    await redisClient.setEx(
      redisSessionKey, 
      Math.floor(this.sessionTimeout / 1000), 
      JSON.stringify(sessionInfo)
    );

    logger.info('New session created', {
      sessionId,
      userId,
      deviceFingerprint,
      browser: metadata.browser,
      device: metadata.device,
      os: metadata.os
    });

    return {
      sessionId,
      userId,
      userAgent,
      ipAddress,
      deviceFingerprint,
      isActive: true,
      lastAccessAt: session.lastAccessAt,
      expiresAt
    };
  }

  /**
   * Update session with token information
   */
  async updateSessionTokens(sessionId: string, accessToken: string, refreshToken: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        accessToken: crypto.createHash('sha256').update(accessToken).digest('hex'),
        refreshToken: crypto.createHash('sha256').update(refreshToken).digest('hex'),
        lastAccessAt: new Date()
      }
    });

    // Update Redis cache
    const redisSessionKey = `session:${sessionId}`;
    const sessionData = await redisClient.get(redisSessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastAccessAt = new Date();
      await redisClient.setEx(
        redisSessionKey, 
        Math.floor(this.sessionTimeout / 1000), 
        JSON.stringify(session)
      );
    }

    logger.debug('Session tokens updated', { sessionId });
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string, accessToken: string, userAgent: string, ipAddress: string): Promise<SessionInfo | null> {
    try {
      // First check Redis cache
      const redisSessionKey = `session:${sessionId}`;
      const cachedSession = await redisClient.get(redisSessionKey);
      
      let session;
      if (cachedSession) {
        const sessionData = JSON.parse(cachedSession);
        
        // Verify device fingerprint
        const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
        if (sessionData.deviceFingerprint !== deviceFingerprint) {
          logger.warn('Session validation failed: device fingerprint mismatch', {
            sessionId,
            userId: sessionData.userId
          });
          return null;
        }
        
        // Check for suspicious activity
        if (await this.detectSuspiciousActivity(sessionData.userId, ipAddress, userAgent)) {
          await this.revokeSession(sessionId, 'suspicious_activity');
          return null;
        }

        session = sessionData;
      } else {
        // Fallback to database
        const dbSession = await prisma.session.findFirst({
          where: {
            id: sessionId,
            accessToken: crypto.createHash('sha256').update(accessToken).digest('hex'),
            isRevoked: false,
            expiresAt: { gt: new Date() }
          },
          include: {
            user: {
              select: {
                id: true,
                status: true
              }
            }
          }
        });

        if (!dbSession || dbSession.user.status !== 'ACTIVE') {
          return null;
        }

        // Decrypt and validate session data
        const decryptedData = this.decryptSessionData(dbSession.userAgent);
        const sessionData = JSON.parse(decryptedData);
        
        const deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
        if (sessionData.deviceFingerprint !== deviceFingerprint) {
          logger.warn('Session validation failed: device fingerprint mismatch', {
            sessionId,
            userId: dbSession.userId
          });
          return null;
        }

        session = {
          userId: dbSession.userId,
          ipAddress: sessionData.ipAddress,
          deviceFingerprint: sessionData.deviceFingerprint,
          lastAccessAt: dbSession.lastAccessAt,
          metadata: sessionData.metadata
        };
      }

      // Update last access time
      await this.updateSessionActivity(sessionId);

      return {
        sessionId,
        userId: session.userId,
        userAgent,
        ipAddress,
        deviceFingerprint: session.deviceFingerprint,
        isActive: true,
        lastAccessAt: new Date(session.lastAccessAt),
        expiresAt: new Date(Date.now() + this.sessionTimeout)
      };

    } catch (error) {
      logger.error('Session validation error', {
        sessionId,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Update session activity
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    const now = new Date();
    
    // Update database
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastAccessAt: now }
    });

    // Update Redis cache
    const redisSessionKey = `session:${sessionId}`;
    const sessionData = await redisClient.get(redisSessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastAccessAt = now;
      await redisClient.setEx(
        redisSessionKey, 
        Math.floor(this.sessionTimeout / 1000), 
        JSON.stringify(session)
      );
    }
  }

  /**
   * Detect suspicious activity
   */
  private async detectSuspiciousActivity(userId: string, ipAddress: string, userAgent: string): Promise<boolean> {
    const suspiciousActivityKey = `suspicious:${userId}`;
    const activityData = await redisClient.get(suspiciousActivityKey);
    
    if (activityData) {
      const activity = JSON.parse(activityData);
      
      // Check for rapid location changes
      if (activity.lastIpAddress && activity.lastIpAddress !== ipAddress) {
        const timeDiff = Date.now() - activity.lastAccessTime;
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          logger.warn('Suspicious activity detected: rapid location change', {
            userId,
            timeDiff,
            oldIp: activity.lastIpAddress,
            newIp: ipAddress
          });
          return true;
        }
      }
      
      // Check for multiple failed attempts
      if (activity.failedAttempts && activity.failedAttempts > 3) {
        logger.warn('Suspicious activity detected: multiple failed attempts', {
          userId,
          failedAttempts: activity.failedAttempts
        });
        return true;
      }
    }

    // Update activity tracking
    const newActivity = {
      lastIpAddress: ipAddress,
      lastUserAgent: userAgent,
      lastAccessTime: Date.now(),
      failedAttempts: 0
    };

    await redisClient.setEx(
      suspiciousActivityKey,
      60 * 60, // 1 hour
      JSON.stringify(newActivity)
    );

    return false;
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastAccessAt: 'desc' }
    });

    return sessions.map(session => {
      let metadata = {};
      try {
        const decryptedData = this.decryptSessionData(session.userAgent);
        const sessionData = JSON.parse(decryptedData);
        metadata = sessionData.metadata || {};
      } catch (error) {
        logger.error('Error decrypting session data', {
          sessionId: session.id,
          error: (error as Error).message
        });
      }

      return {
        sessionId: session.id,
        userId: session.userId,
        userAgent: (metadata as any).browser || 'Unknown',
        ipAddress: 'Hidden',
        deviceFingerprint: session.deviceFingerprint,
        isActive: true,
        lastAccessAt: session.lastAccessAt,
        expiresAt: session.expiresAt
      };
    });
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string, reason: string = 'user_logout'): Promise<void> {
    // Update database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    });

    // Remove from Redis cache
    await redisClient.del(`session:${sessionId}`);

    logger.info('Session revoked', { sessionId, reason });
  }

  /**
   * Revoke all sessions for user
   */
  async revokeAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const whereCondition: any = {
      userId,
      isRevoked: false
    };

    if (excludeSessionId) {
      whereCondition.id = { not: excludeSessionId };
    }

    const sessions = await prisma.session.findMany({
      where: whereCondition,
      select: { id: true }
    });

    // Revoke in database
    await prisma.session.updateMany({
      where: whereCondition,
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    });

    // Remove from Redis cache
    const pipeline = redisClient.multi();
    sessions.forEach(session => {
      pipeline.del(`session:${session.id}`);
    });
    await pipeline.exec();

    logger.info('All user sessions revoked', {
      userId,
      excludeSessionId,
      revokedCount: sessions.length
    });
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = await prisma.session.findMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              lastAccessAt: { 
                lt: new Date(Date.now() - this.inactivityTimeout) 
              } 
            }
          ],
          isRevoked: false
        },
        select: { id: true }
      });

      if (expiredSessions.length > 0) {
        // Update database
        await prisma.session.updateMany({
          where: {
            id: { in: expiredSessions.map(s => s.id) }
          },
          data: {
            isRevoked: true,
            revokedAt: new Date()
          }
        });

        // Remove from Redis cache
        const pipeline = redisClient.multi();
        expiredSessions.forEach(session => {
          pipeline.del(`session:${session.id}`);
        });
        await pipeline.exec();

        logger.info('Expired sessions cleaned up', {
          cleanedCount: expiredSessions.length
        });
      }
    } catch (error) {
      logger.error('Session cleanup error', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 15 * 60 * 1000); // Run every 15 minutes
  }
}

// Export singleton instance
export const sessionSecurityManager = SessionSecurityManager.getInstance();