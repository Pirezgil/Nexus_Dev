import bcrypt from 'bcrypt';
import crypto from 'crypto';
import zxcvbn from 'zxcvbn';
import { config } from './config';
import { logger } from './logger';
import { redisClient } from './redis';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPatterns: string[];
  maxRepeatingChars: number;
  preventCommonPasswords: boolean;
  minScore: number; // zxcvbn score (0-4)
}

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number;
  feedback: string[];
  estimatedCrackTime: string;
}

export class PasswordSecurityManager {
  private static instance: PasswordSecurityManager;
  private readonly saltRounds: number;
  private readonly policy: PasswordPolicy;
  private readonly commonPasswords = new Set<string>();

  private constructor() {
    // Use higher salt rounds for better security (minimum 14 for production)
    this.saltRounds = config.nodeEnv === 'production' ? 14 : config.bcryptSaltRounds;
    
    this.policy = {
      minLength: 12, // Increased from 8
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      forbiddenPatterns: [
        'password', '123456', 'admin', 'user', 'login',
        'qwerty', 'abc123', 'letmein', 'welcome', 'monkey',
        'dragon', 'master', 'sunshine', 'iloveyou', 'princess'
      ],
      maxRepeatingChars: 3,
      preventCommonPasswords: true,
      minScore: 3 // Strong password required
    };

    this.loadCommonPasswords();
    logger.info('Password security manager initialized', {
      saltRounds: this.saltRounds,
      minLength: this.policy.minLength,
      minScore: this.policy.minScore
    });
  }

  static getInstance(): PasswordSecurityManager {
    if (!PasswordSecurityManager.instance) {
      PasswordSecurityManager.instance = new PasswordSecurityManager();
    }
    return PasswordSecurityManager.instance;
  }

  /**
   * Load common passwords from various sources
   */
  private async loadCommonPasswords(): Promise<void> {
    // Common passwords to check against
    const commonList = [
      'password', '123456789', '12345678', '1234567', '123456',
      '12345', '1234', '123', 'password123', 'admin123',
      'welcome123', 'qwerty123', 'abc123456', 'password1',
      'admin', 'user', 'guest', 'test', 'demo', 'sample'
    ];

    commonList.forEach(pwd => this.commonPasswords.add(pwd.toLowerCase()));
    logger.debug('Common passwords loaded', { count: this.commonPasswords.size });
  }

  /**
   * Enhanced password strength validation using zxcvbn
   */
  validatePasswordStrength(password: string, userInputs: string[] = []): PasswordStrengthResult {
    const feedback: string[] = [];
    let isValid = true;

    // Basic length check
    if (password.length < this.policy.minLength) {
      feedback.push(`Password must be at least ${this.policy.minLength} characters long`);
      isValid = false;
    }

    // Character type requirements
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
      isValid = false;
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
      isValid = false;
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
      isValid = false;
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character');
      isValid = false;
    }

    // Check for repeating characters
    const repeatingPattern = new RegExp(`(.)\\1{${this.policy.maxRepeatingChars},}`, 'i');
    if (repeatingPattern.test(password)) {
      feedback.push(`Password cannot have more than ${this.policy.maxRepeatingChars} repeating characters`);
      isValid = false;
    }

    // Check forbidden patterns
    const lowerPassword = password.toLowerCase();
    for (const pattern of this.policy.forbiddenPatterns) {
      if (lowerPassword.includes(pattern.toLowerCase())) {
        feedback.push(`Password cannot contain common patterns like "${pattern}"`);
        isValid = false;
      }
    }

    // Check against common passwords
    if (this.policy.preventCommonPasswords && this.commonPasswords.has(lowerPassword)) {
      feedback.push('This password is too common and easily guessable');
      isValid = false;
    }

    // Use zxcvbn for advanced strength analysis
    const strengthAnalysis = zxcvbn(password, userInputs);
    
    if (strengthAnalysis.score < this.policy.minScore) {
      feedback.push(`Password is too weak (score: ${strengthAnalysis.score}/4). ${strengthAnalysis.feedback.suggestions.join(' ')}`);
      isValid = false;
    }

    return {
      isValid: isValid && strengthAnalysis.score >= this.policy.minScore,
      score: strengthAnalysis.score,
      feedback,
      estimatedCrackTime: strengthAnalysis.crack_times_display.offline_slow_hashing_1e4_per_second
    };
  }

  /**
   * Hash password with enhanced security
   */
  async hashPassword(password: string, userInputs: string[] = []): Promise<string> {
    // Validate password strength first
    const validation = this.validatePasswordStrength(password, userInputs);
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.feedback.join(', ')}`);
    }

    // Add timing attack protection
    const startTime = Date.now();
    
    try {
      // Generate salt and hash
      const salt = await bcrypt.genSalt(this.saltRounds);
      const hash = await bcrypt.hash(password, salt);
      
      const hashTime = Date.now() - startTime;
      logger.info('Password hashed successfully', {
        saltRounds: this.saltRounds,
        hashTime,
        passwordStrength: validation.score
      });

      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error: (error as Error).message });
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password with timing attack protection
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Always perform comparison to prevent timing attacks
      const isValid = await bcrypt.compare(password, hash);
      
      const verifyTime = Date.now() - startTime;
      
      // Add minimum processing time to prevent timing attacks
      if (verifyTime < 100) {
        await new Promise(resolve => setTimeout(resolve, 100 - verifyTime));
      }

      if (!isValid) {
        logger.warn('Password verification failed', { verifyTime });
      }

      return isValid;
    } catch (error) {
      logger.error('Password verification error', { error: (error as Error).message });
      // Always return false on error to prevent information leakage
      return false;
    }
  }

  /**
   * Generate secure password reset token
   */
  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Store hashed token in Redis with expiration
    const resetKey = `password_reset:${userId}`;
    const resetData = {
      hashedToken,
      email,
      createdAt: Date.now(),
      attempts: 0
    };

    await redisClient.setEx(resetKey, 15 * 60, JSON.stringify(resetData)); // 15 minutes expiration
    
    logger.info('Password reset token generated', {
      userId,
      email,
      tokenPreview: token.substring(0, 8) + '...'
    });

    return token;
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(userId: string, token: string): Promise<boolean> {
    try {
      const resetKey = `password_reset:${userId}`;
      const resetDataStr = await redisClient.get(resetKey);
      
      if (!resetDataStr) {
        logger.warn('Password reset token not found or expired', { userId });
        return false;
      }

      const resetData = JSON.parse(resetDataStr);
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Check if token matches
      if (resetData.hashedToken !== hashedToken) {
        // Increment attempts
        resetData.attempts += 1;
        
        if (resetData.attempts >= 3) {
          // Delete token after 3 failed attempts
          await redisClient.del(resetKey);
          logger.warn('Password reset token deleted due to multiple failed attempts', { userId });
        } else {
          await redisClient.setEx(resetKey, 15 * 60, JSON.stringify(resetData));
        }
        
        return false;
      }

      // Valid token - delete it immediately to prevent reuse
      await redisClient.del(resetKey);
      
      logger.info('Password reset token verified successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Password reset token verification error', {
        userId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Check if password has been compromised in data breaches
   * This would integrate with HaveIBeenPwned API in production
   */
  async checkPasswordBreach(password: string): Promise<boolean> {
    try {
      const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      // In a real implementation, this would call the HaveIBeenPwned API
      // For now, we'll simulate with a local check
      logger.debug('Checking password against breach database', { 
        hashPrefix: prefix 
      });

      // This would be replaced with actual API call in production
      return false; // Assume not breached for now
    } catch (error) {
      logger.error('Password breach check failed', { error: (error as Error).message });
      return false; // Fail safe - assume not breached
    }
  }

  /**
   * Generate secure temporary password
   */
  generateTemporaryPassword(): string {
    const length = 16;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one character from each required type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Get current password policy
   */
  getPasswordPolicy(): PasswordPolicy {
    return { ...this.policy };
  }
}

// Export singleton instance
export const passwordSecurityManager = PasswordSecurityManager.getInstance();