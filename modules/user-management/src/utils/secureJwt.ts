import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './config';
import { JwtPayload } from '../types';
import { logger } from './logger';

// Enhanced JWT configuration with security best practices
const JWT_ALGORITHMS = ['HS256'] as const;
const TOKEN_ISSUER = 'erp-nexus';
const TOKEN_AUDIENCE = 'erp-nexus-client';

interface SecureJwtPayload extends JwtPayload {
  iss: string;
  aud: string;
  jti: string; // JWT ID for token tracking
  fingerprint: string; // Device fingerprint
}

interface TokenBindingInfo {
  ipAddress?: string;
  userAgent?: string;
  sessionId: string;
}

export class SecureJwtManager {
  private static instance: SecureJwtManager;
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;
  private readonly tokenBlacklist = new Set<string>();
  
  private constructor() {
    // Generate separate secrets for access and refresh tokens
    this.jwtSecret = this.generateSecret('JWT_SECRET');
    this.refreshSecret = this.generateSecret('JWT_REFRESH_SECRET');
    
    // Validate secrets strength
    this.validateSecretStrength(this.jwtSecret);
    this.validateSecretStrength(this.refreshSecret);
  }

  static getInstance(): SecureJwtManager {
    if (!SecureJwtManager.instance) {
      SecureJwtManager.instance = new SecureJwtManager();
    }
    return SecureJwtManager.instance;
  }

  /**
   * Generate or retrieve secret from environment
   */
  private generateSecret(envVar: string): string {
    const envSecret = process.env[envVar];
    
    if (envSecret && envSecret !== 'your-super-secret-jwt-key-change-in-production') {
      return envSecret;
    }
    
    if (config.nodeEnv === 'production') {
      throw new Error(`${envVar} must be set in production environment`);
    }
    
    // Generate a secure random secret for development
    const generatedSecret = crypto.randomBytes(64).toString('hex');
    logger.warn(`Using generated ${envVar} for development. Set environment variable for production.`);
    return generatedSecret;
  }

  /**
   * Validate secret strength
   */
  private validateSecretStrength(secret: string): void {
    if (secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
    
    // Check for common weak patterns
    const weakPatterns = [
      'password',
      'secret',
      '123456',
      'admin',
      'default'
    ];
    
    const lowerSecret = secret.toLowerCase();
    for (const pattern of weakPatterns) {
      if (lowerSecret.includes(pattern)) {
        throw new Error(`JWT secret contains weak pattern: ${pattern}`);
      }
    }
  }

  /**
   * Generate device fingerprint for token binding
   */
  private generateFingerprint(bindingInfo: TokenBindingInfo): string {
    const { ipAddress, userAgent, sessionId } = bindingInfo;
    const fingerprintData = `${ipAddress || 'unknown'}|${userAgent || 'unknown'}|${sessionId}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Generate secure access token with binding
   */
  generateAccessToken(payload: JwtPayload, bindingInfo: TokenBindingInfo): string {
    const jti = crypto.randomUUID();
    const fingerprint = this.generateFingerprint(bindingInfo);
    
    const securePayload: SecureJwtPayload = {
      ...payload,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      jti,
      fingerprint
    };

    const signOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
      notBefore: '0', // Valid immediately
    };

    const token = jwt.sign(securePayload, this.jwtSecret, signOptions);
    
    logger.info('Access token generated', {
      userId: payload.userId,
      sessionId: payload.sessionId,
      jti,
      expiresIn: config.jwtExpiresIn
    });

    return token;
  }

  /**
   * Generate secure refresh token
   */
  generateRefreshToken(payload: JwtPayload, bindingInfo: TokenBindingInfo): string {
    const jti = crypto.randomUUID();
    const fingerprint = this.generateFingerprint(bindingInfo);
    
    const securePayload: SecureJwtPayload = {
      ...payload,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      jti,
      fingerprint
    };

    const signOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: config.jwtRefreshExpiresIn,
    };

    return jwt.sign(securePayload, this.refreshSecret, signOptions);
  }

  /**
   * Verify access token with security checks
   */
  verifyAccessToken(token: string, bindingInfo: TokenBindingInfo): SecureJwtPayload {
    if (this.tokenBlacklist.has(token)) {
      throw new Error('Token is blacklisted');
    }

    const verifyOptions: VerifyOptions = {
      algorithms: JWT_ALGORITHMS,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      clockTolerance: 30, // 30 seconds clock tolerance
    };

    try {
      const decoded = jwt.verify(token, this.jwtSecret, verifyOptions) as SecureJwtPayload;
      
      // Verify token binding
      const expectedFingerprint = this.generateFingerprint(bindingInfo);
      if (decoded.fingerprint !== expectedFingerprint) {
        logger.warn('Token fingerprint mismatch', {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          jti: decoded.jti
        });
        throw new Error('Token binding verification failed');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('JWT verification failed', { 
          error: error.message,
          tokenPreview: token.substring(0, 20) + '...'
        });
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string, bindingInfo: TokenBindingInfo): SecureJwtPayload {
    if (this.tokenBlacklist.has(token)) {
      throw new Error('Refresh token is blacklisted');
    }

    const verifyOptions: VerifyOptions = {
      algorithms: JWT_ALGORITHMS,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      clockTolerance: 30,
    };

    try {
      const decoded = jwt.verify(token, this.refreshSecret, verifyOptions) as SecureJwtPayload;
      
      // Verify token binding
      const expectedFingerprint = this.generateFingerprint(bindingInfo);
      if (decoded.fingerprint !== expectedFingerprint) {
        logger.warn('Refresh token fingerprint mismatch', {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          jti: decoded.jti
        });
        throw new Error('Refresh token binding verification failed');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Refresh token verification failed', { 
          error: error.message 
        });
      }
      throw error;
    }
  }

  /**
   * Blacklist a token (for logout/revocation)
   */
  blacklistToken(token: string): void {
    this.tokenBlacklist.add(token);
    
    // Clean up old blacklisted tokens periodically
    if (this.tokenBlacklist.size > 10000) {
      this.cleanupBlacklist();
    }
    
    logger.info('Token blacklisted', {
      tokenPreview: token.substring(0, 20) + '...',
      blacklistSize: this.tokenBlacklist.size
    });
  }

  /**
   * Clean up expired tokens from blacklist
   */
  private cleanupBlacklist(): void {
    const tokens = Array.from(this.tokenBlacklist);
    let cleanedCount = 0;

    for (const token of tokens) {
      try {
        // Try to decode without verification to check expiration
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
          this.tokenBlacklist.delete(token);
          cleanedCount++;
        }
      } catch {
        // Invalid tokens can be removed
        this.tokenBlacklist.delete(token);
        cleanedCount++;
      }
    }

    logger.info('Blacklist cleanup completed', {
      cleanedCount,
      remainingSize: this.tokenBlacklist.size
    });
  }

  /**
   * Extract token information without verification (for logging)
   */
  getTokenInfo(token: string): { jti?: string; exp?: number; userId?: string } | null {
    try {
      const decoded = jwt.decode(token) as any;
      return {
        jti: decoded?.jti,
        exp: decoded?.exp,
        userId: decoded?.userId
      };
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const secureJwtManager = SecureJwtManager.getInstance();