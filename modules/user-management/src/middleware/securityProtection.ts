import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';

// CSRF Token Management
import csrf from 'csurf';
import crypto from 'crypto';

/**
 * Enhanced security middleware with comprehensive protection
 */
export class SecurityProtectionMiddleware {
  private static instance: SecurityProtectionMiddleware;
  private csrfTokens = new Map<string, { token: string; expires: number }>();

  static getInstance(): SecurityProtectionMiddleware {
    if (!SecurityProtectionMiddleware.instance) {
      SecurityProtectionMiddleware.instance = new SecurityProtectionMiddleware();
    }
    return SecurityProtectionMiddleware.instance;
  }

  /**
   * Comprehensive security headers middleware
   */
  securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Next.js in development
            "https://vercel.live",
            "https://*.vercel.app"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://api.erp-nexus.com",
            "wss://erp-nexus.com",
            process.env.NODE_ENV === 'development' ? "http://localhost:*" : ""
          ].filter(Boolean),
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Required for some third-party integrations
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    });
  }

  /**
   * Advanced rate limiting with progressive delays
   */
  createAdvancedRateLimit(options: {
    windowMs: number;
    max: number;
    message: string;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    onLimitReached?: (req: Request, res: Response) => void;
  }) {
    const { windowMs, max, message, keyGenerator, skipSuccessfulRequests = false } = options;

    return rateLimit({
      windowMs,
      max,
      message: {
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: keyGenerator || ((req: Request) => {
        // Use combination of IP and User-Agent for better detection
        const userAgent = req.get('User-Agent') || 'unknown';
        const forwarded = req.get('X-Forwarded-For') || req.ip;
        return `${forwarded}:${this.hashString(userAgent)}`;
      }),
      skipSuccessfulRequests,
      skip: (req) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test';
      },
      onLimitReached: (req, res) => {
        const clientInfo = {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method
        };

        logger.warn('Rate limit exceeded', clientInfo);

        // Track repeated violations for escalated responses
        this.trackViolation(req.ip, 'rate_limit');

        if (options.onLimitReached) {
          options.onLimitReached(req, res);
        }
      }
    });
  }

  /**
   * Progressive request slowdown middleware
   */
  createSlowDown(options: {
    windowMs: number;
    delayAfter: number;
    delayMs: number;
    maxDelayMs: number;
  }) {
    return slowDown({
      windowMs: options.windowMs,
      delayAfter: options.delayAfter,
      delayMs: options.delayMs,
      maxDelayMs: options.maxDelayMs,
      keyGenerator: (req: Request) => {
        const userAgent = req.get('User-Agent') || 'unknown';
        const forwarded = req.get('X-Forwarded-For') || req.ip;
        return `slowdown:${forwarded}:${this.hashString(userAgent)}`;
      },
      skip: (req) => process.env.NODE_ENV === 'test',
      onLimitReached: (req) => {
        logger.warn('Request slowdown triggered', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
      }
    });
  }

  /**
   * Brute force protection middleware
   */
  bruteForceProtection() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientKey = `brute_force:${req.ip}`;
      
      try {
        const attempts = await redisClient.get(clientKey);
        const attemptCount = attempts ? parseInt(attempts, 10) : 0;

        // Progressive blocking based on attempt count
        if (attemptCount >= 20) {
          // Permanent block after 20 attempts
          logger.error('IP permanently blocked due to brute force', {
            ip: req.ip,
            attempts: attemptCount
          });
          
          return res.status(429).json({
            success: false,
            error: 'Access permanently denied due to security violations',
            code: 'PERMANENT_BLOCK'
          });
        } else if (attemptCount >= 10) {
          // 1 hour block after 10 attempts
          const blockUntil = Date.now() + (60 * 60 * 1000);
          await redisClient.setEx(`block:${req.ip}`, 3600, blockUntil.toString());
          
          logger.warn('IP temporarily blocked due to brute force', {
            ip: req.ip,
            attempts: attemptCount,
            blockUntil: new Date(blockUntil)
          });
          
          return res.status(429).json({
            success: false,
            error: 'Access temporarily blocked due to security violations',
            code: 'TEMPORARY_BLOCK',
            unblockAt: new Date(blockUntil).toISOString()
          });
        } else if (attemptCount >= 5) {
          // Add delay for suspicious activity
          const delay = Math.min(attemptCount * 1000, 10000); // Max 10 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        next();
      } catch (error) {
        logger.error('Brute force protection error', {
          error: (error as Error).message,
          ip: req.ip
        });
        next(); // Continue on error to avoid blocking legitimate users
      }
    };
  }

  /**
   * CSRF Protection middleware
   */
  csrfProtection() {
    // Custom CSRF implementation for better control
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for API endpoints that use JWT tokens
      if (req.path.startsWith('/api/') && req.headers.authorization) {
        return next();
      }

      // Skip for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const token = req.headers['x-csrf-token'] as string || req.body._csrf;
      const sessionId = req.headers['x-session-id'] as string;

      if (!token || !sessionId) {
        logger.warn('CSRF token missing', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
        
        return res.status(403).json({
          success: false,
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING'
        });
      }

      if (!this.validateCSRFToken(sessionId, token)) {
        logger.warn('CSRF token validation failed', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          sessionId
        });
        
        await this.trackViolation(req.ip, 'csrf_violation');
        
        return res.status(403).json({
          success: false,
          error: 'CSRF token invalid',
          code: 'CSRF_TOKEN_INVALID'
        });
      }

      next();
    };
  }

  /**
   * Generate CSRF token for session
   */
  generateCSRFToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    this.csrfTokens.set(sessionId, { token, expires });

    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Validate CSRF token
   */
  private validateCSRFToken(sessionId: string, token: string): boolean {
    const storedToken = this.csrfTokens.get(sessionId);
    
    if (!storedToken) {
      return false;
    }

    if (Date.now() > storedToken.expires) {
      this.csrfTokens.delete(sessionId);
      return false;
    }

    return storedToken.token === token;
  }

  /**
   * Clean up expired CSRF tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    
    for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
      if (now > tokenData.expires) {
        this.csrfTokens.delete(sessionId);
      }
    }
  }

  /**
   * Track security violations for escalated response
   */
  private async trackViolation(ip: string, violationType: string): Promise<void> {
    try {
      const key = `violations:${ip}`;
      const violations = await redisClient.get(key);
      const violationData = violations ? JSON.parse(violations) : {};
      
      violationData[violationType] = (violationData[violationType] || 0) + 1;
      violationData.lastViolation = Date.now();
      violationData.total = Object.values(violationData).reduce((sum: number, count) => {
        return typeof count === 'number' ? sum + count : sum;
      }, 0) - 1; // Subtract lastViolation timestamp

      await redisClient.setEx(key, 86400, JSON.stringify(violationData)); // 24 hours

      // Escalate response for repeated violations
      if (violationData.total >= 5) {
        await this.escalateSecurityResponse(ip, violationData);
      }

    } catch (error) {
      logger.error('Error tracking security violation', {
        error: (error as Error).message,
        ip,
        violationType
      });
    }
  }

  /**
   * Escalate security response for repeated violations
   */
  private async escalateSecurityResponse(ip: string, violations: any): Promise<void> {
    const escalationLevel = this.calculateEscalationLevel(violations);
    
    logger.warn('Escalating security response', {
      ip,
      escalationLevel,
      violations: violations.total,
      types: Object.keys(violations).filter(k => k !== 'lastViolation' && k !== 'total')
    });

    switch (escalationLevel) {
      case 1:
        // Increase rate limiting
        await redisClient.setEx(`throttle:${ip}`, 3600, '1');
        break;
      case 2:
        // Temporary block
        await redisClient.setEx(`block:${ip}`, 7200, Date.now().toString());
        break;
      case 3:
        // Extended block and alert
        await redisClient.setEx(`block:${ip}`, 86400, Date.now().toString());
        // In production, this would send alerts to security team
        logger.error('High-risk IP detected - extended block applied', { ip, violations });
        break;
    }
  }

  /**
   * Calculate escalation level based on violations
   */
  private calculateEscalationLevel(violations: any): number {
    const total = violations.total || 0;
    const types = Object.keys(violations).filter(k => k !== 'lastViolation' && k !== 'total').length;
    
    if (total >= 15 || types >= 3) return 3;
    if (total >= 10 || types >= 2) return 2;
    if (total >= 5) return 1;
    
    return 0;
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * IP reputation checking middleware
   */
  ipReputationCheck() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientIp = req.ip;
        const reputationKey = `reputation:${clientIp}`;
        const reputation = await redisClient.get(reputationKey);
        
        if (reputation) {
          const reputationData = JSON.parse(reputation);
          
          if (reputationData.score < 0.3) { // Poor reputation
            logger.warn('Request from low reputation IP', {
              ip: clientIp,
              score: reputationData.score,
              reasons: reputationData.reasons
            });
            
            // Add additional security measures
            req.headers['x-high-risk'] = 'true';
          }
        }
        
        next();
      } catch (error) {
        logger.error('IP reputation check error', {
          error: (error as Error).message,
          ip: req.ip
        });
        next(); // Continue on error
      }
    };
  }

  /**
   * Request fingerprinting for anomaly detection
   */
  requestFingerprinting() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fingerprint = {
          userAgent: req.get('User-Agent'),
          acceptLanguage: req.get('Accept-Language'),
          acceptEncoding: req.get('Accept-Encoding'),
          connection: req.get('Connection'),
          contentType: req.get('Content-Type'),
          method: req.method,
          path: req.path
        };

        const fingerprintHash = this.hashString(JSON.stringify(fingerprint));
        req.headers['x-request-fingerprint'] = fingerprintHash;

        // Detect anomalous patterns
        const anomalyKey = `anomaly:${req.ip}:${fingerprintHash}`;
        const count = await redisClient.incr(anomalyKey);
        await redisClient.expire(anomalyKey, 3600); // 1 hour

        if (count === 1) {
          // First time seeing this pattern
          const patternKey = `patterns:${req.ip}`;
          await redisClient.sadd(patternKey, fingerprintHash);
          await redisClient.expire(patternKey, 86400); // 24 hours
        }

        // Check for too many unique patterns (possible automation)
        const uniquePatterns = await redisClient.scard(`patterns:${req.ip}`);
        if (uniquePatterns > 20) {
          logger.warn('High pattern diversity detected - possible bot activity', {
            ip: req.ip,
            uniquePatterns,
            currentPattern: fingerprintHash
          });
          
          req.headers['x-bot-suspicious'] = 'true';
        }

        next();
      } catch (error) {
        logger.error('Request fingerprinting error', {
          error: (error as Error).message,
          ip: req.ip
        });
        next();
      }
    };
  }
}

// Export singleton instance
export const securityProtection = SecurityProtectionMiddleware.getInstance();

// Convenience exports for common rate limiters
export const strictRateLimit = securityProtection.createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: false
});

export const moderateRateLimit = securityProtection.createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Rate limit exceeded, please slow down.',
  skipSuccessfulRequests: true
});

export const apiRateLimit = securityProtection.createAdvancedRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'API rate limit exceeded.',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.userId || req.ip;
  }
});